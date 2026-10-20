import ePub from 'epubjs'
import type { Chapter } from '@/types'

export interface ParsedEpub {
  title?: string
  author?: string
  cover?: string
  chapters: Chapter[]
}

interface NavItem {
  id?: string
  href?: string
  label?: string
  subitems?: NavItem[]
}

function flattenNav(
  items: NavItem[],
  level: number,
  acc: Chapter[],
): void {
  for (const item of items) {
    const href = (item.href ?? '').split('#')[0]
    acc.push({
      id: hashId(href || item.label || Math.random().toString()),
      title: (item.label ?? '').trim() || `章节 ${acc.length + 1}`,
      level,
      href,
    })
    if (item.subitems && item.subitems.length > 0) {
      flattenNav(item.subitems, level + 1, acc)
    }
  }
}

function hashId(input: string): string {
  let h = 0
  for (let i = 0; i < input.length; i += 1) {
    h = (h << 5) - h + input.charCodeAt(i)
    h |= 0
  }
  return `ch-${Math.abs(h).toString(36)}`
}

type EpubBook = ReturnType<typeof ePub>

let cachedData: ArrayBuffer | null = null
let cachedBookPromise: Promise<EpubBook> | null = null

function openBook(data: ArrayBuffer): Promise<EpubBook> {
  if (cachedBookPromise && cachedData === data) return cachedBookPromise
  const book = ePub(data)
  cachedData = data
  cachedBookPromise = book.ready.then(() => book)
  return cachedBookPromise
}

export async function parseEpub(data: ArrayBuffer): Promise<ParsedEpub> {
  const book = await openBook(data)

  const meta = book.packaging?.metadata
  const title = meta?.title
  const author = meta?.creator

  const nav = await book.loaded.navigation
  const chapters: Chapter[] = []
  flattenNav((nav?.toc ?? []) as NavItem[], 0, chapters)

  let cover: string | undefined
  try {
    const c = await book.coverUrl()
    cover = c ?? undefined
  } catch {
    cover = undefined
  }

  return { title, author, cover, chapters }
}

function normalizePath(path: string): string {
  const out: string[] = []
  for (const segment of path.split('/')) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') {
      out.pop()
      continue
    }
    out.push(segment)
  }
  return out.join('/')
}

function basename(path: string): string {
  const i = path.lastIndexOf('/')
  return i === -1 ? path : path.slice(i + 1)
}

function resolveContentHref(book: EpubBook, href: string): string {
  const target = normalizePath(href)
  const manifest = book.packaging?.manifest
  if (manifest) {
    const items = Object.values(manifest)
    for (const item of items) {
      if (item.href && normalizePath(item.href) === target) return item.href
    }
    const byName = items.filter(
      (item) => item.href && basename(item.href) === basename(target),
    )
    if (byName.length === 1) return byName[0].href
  }
  return href
}

const BLOCK_TAGS = new Set([
  'p',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'pre',
  'figcaption',
  'tr',
  'td',
  'th',
])

const CONTAINER_TAGS = new Set([
  'div',
  'section',
  'article',
  'figure',
  'main',
  'header',
  'footer',
  'aside',
])

function normalizeInline(parts: string[]): string {
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

function inlineText(el: Element): string {
  const out: string[] = []
  const walk = (node: Node): void => {
    if (node.nodeType === 3) {
      if (node.nodeValue) out.push(node.nodeValue)
      return
    }
    if (node.nodeType !== 1 || !(node instanceof Element)) return
    const tag = node.tagName.toLowerCase()
    if (tag === 'script' || tag === 'style') return
    if (tag === 'br') {
      out.push(' ')
      return
    }
    const children = node.childNodes
    for (let i = 0; i < children.length; i += 1) walk(children[i])
  }
  walk(el)
  return normalizeInline(out)
}

function hasBlockDescendant(el: Element): boolean {
  const stack: Element[] = [...el.children]
  while (stack.length > 0) {
    const child = stack.pop()
    if (!child) break
    if (BLOCK_TAGS.has(child.tagName.toLowerCase())) return true
    stack.push(...child.children)
  }
  return false
}

function extractBlocks(root: Node): string[] {
  const blocks: string[] = []
  let current: string[] = []
  const flush = (): void => {
    const text = normalizeInline(current)
    if (text) blocks.push(text)
    current = []
  }
  const walk = (node: Node): void => {
    if (node.nodeType === 3) {
      if (node.nodeValue && node.nodeValue.trim()) {
        current.push(node.nodeValue.trim())
      }
      return
    }
    if (node.nodeType !== 1 || !(node instanceof Element)) return
    const el = node
    const tag = el.tagName.toLowerCase()
    if (tag === 'script' || tag === 'style' || tag === 'head' || tag === 'nav') return
    if (BLOCK_TAGS.has(tag)) {
      flush()
      const text = inlineText(el)
      if (text) blocks.push(text)
      return
    }
    if (CONTAINER_TAGS.has(tag) && !hasBlockDescendant(el)) {
      flush()
      const text = inlineText(el)
      if (text) blocks.push(text)
      return
    }
    const children = el.childNodes
    for (let i = 0; i < children.length; i += 1) walk(children[i])
  }
  walk(root)
  flush()
  return blocks
}

function extractText(doc: unknown): string {
  if (typeof doc === 'string') {
    const div = document.createElement('div')
    div.innerHTML = doc
    return extractBlocks(div).join('\n\n')
  }
  const d = doc as {
    body?: Node | null
    documentElement?: Node | null
    textContent?: string | null
  } | null
  if (!d) return ''
  for (const root of [d.body, d.documentElement]) {
    if (!root) continue
    const blocks = extractBlocks(root)
    if (blocks.length > 0) return blocks.join('\n\n')
  }
  if (typeof d.textContent === 'string') {
    return normalizeInline([d.textContent])
  }
  return ''
}

export async function getChapterContent(
  data: ArrayBuffer,
  chapter: Chapter,
): Promise<string> {
  if (!chapter.href) return ''
  const book = await openBook(data)
  const href = resolveContentHref(book, chapter.href)
  let text = ''
  try {
    const doc = await book.load(href)
    text = extractText(doc)
  } catch {
    text = ''
  }
  if (!text) {
    try {
      const raw = await book.archive.getText(book.resolve(href))
      if (typeof raw === 'string') text = extractText(raw)
    } catch {
      text = ''
    }
  }
  return text
}
