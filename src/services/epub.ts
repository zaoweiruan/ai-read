import ePub from 'epubjs'
import type { Chapter, ContentBlock } from '@/types'

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

interface RawImage {
  src: string
  alt: string
}

type RawBlock = { type: 'text'; value: string } | { type: 'image'; image: RawImage }

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

function hasImageDescendant(el: Element): boolean {
  const stack: Element[] = [...el.children]
  while (stack.length > 0) {
    const child = stack.pop()
    if (!child) break
    if (child.tagName.toLowerCase() === 'img') return true
    stack.push(...child.children)
  }
  return false
}

function extractRawBlocks(root: Node, images: RawImage[]): RawBlock[] {
  const blocks: RawBlock[] = []
  let current: string[] = []
  const flush = (): void => {
    const text = normalizeInline(current)
    if (text) blocks.push({ type: 'text', value: text })
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
    if (tag === 'img') {
      flush()
      const image: RawImage = {
        src: el.getAttribute('src') ?? '',
        alt: el.getAttribute('alt') ?? '',
      }
      images.push(image)
      blocks.push({ type: 'image', image })
      return
    }
    if (BLOCK_TAGS.has(tag)) {
      if (hasImageDescendant(el)) {
        const children = node.childNodes
        for (let i = 0; i < children.length; i += 1) walk(children[i])
        return
      }
      flush()
      const text = inlineText(el)
      if (text) blocks.push({ type: 'text', value: text })
      return
    }
    if (
      CONTAINER_TAGS.has(tag) &&
      !hasBlockDescendant(el) &&
      !hasImageDescendant(el)
    ) {
      flush()
      const text = inlineText(el)
      if (text) blocks.push({ type: 'text', value: text })
      return
    }
    const children = node.childNodes
    for (let i = 0; i < children.length; i += 1) walk(children[i])
  }
  walk(root)
  flush()
  return blocks
}

async function resolveImageUrl(
  book: EpubBook,
  chapterPath: string,
  src: string,
): Promise<string | null> {
  if (!src) return null
  if (/^(data:|https?:|blob:)/i.test(src)) return src
  const dir = chapterPath.includes('/')
    ? chapterPath.slice(0, chapterPath.lastIndexOf('/'))
    : ''
  const joined = dir ? `${dir}/${src}` : src
  const normalized = normalizePath(joined)
  if (!normalized) return null
  const rootPath = `/${normalized}`
  const candidates: string[] = [rootPath]
  const manifest = book.packaging?.manifest
  if (manifest) {
    const items = Object.values(manifest)
    const exact = items.find((item) => {
      if (!item.href) return false
      try {
        return book.resolve(item.href) === rootPath
      } catch {
        return false
      }
    })
    if (exact?.href) {
      try {
        candidates.unshift(book.resolve(exact.href))
      } catch {
        // 保留根路径候选
      }
    }
    const byName = items.filter(
      (item) => item.href && basename(item.href) === basename(normalized),
    )
    if (byName.length === 1 && byName[0].href) {
      try {
        candidates.push(book.resolve(byName[0].href))
      } catch {
        // 忽略无法解析的候选
      }
    }
  }
  for (const path of candidates) {
    try {
      const url = await book.archive.createUrl(path, { base64: true })
      if (url) return url
    } catch {
      continue
    }
  }
  return null
}

export async function getChapterBlocks(
  data: ArrayBuffer,
  chapter: Chapter,
): Promise<ContentBlock[]> {
  if (!chapter.href) return []
  const book = await openBook(data)
  const href = resolveContentHref(book, chapter.href)
  let chapterPath = `/${normalizePath(href)}`
  try {
    chapterPath = book.resolve(href)
  } catch {
    chapterPath = `/${normalizePath(href)}`
  }
  const images: RawImage[] = []
  let raw: RawBlock[] = []
  try {
    const doc = await book.load(href)
    raw = extractRawBlocks(doc as unknown as Node, images)
  } catch {
    raw = []
  }
  if (raw.length === 0) {
    try {
      const rawText = await book.archive.getText(chapterPath)
      if (typeof rawText === 'string') {
        const div = document.createElement('div')
        div.innerHTML = rawText
        raw = extractRawBlocks(div, images)
      }
    } catch {
      raw = []
    }
  }
  const blocks: ContentBlock[] = []
  for (const block of raw) {
    if (block.type === 'text') {
      blocks.push(block.value)
      continue
    }
    const url = await resolveImageUrl(book, chapterPath, block.image.src)
    if (url) {
      blocks.push({ kind: 'image', src: url, alt: block.image.alt })
    } else {
      console.warn('[epub] 图片资源解析失败', block.image.src, chapterPath)
    }
  }
  return blocks
}

export async function getChapterContent(
  data: ArrayBuffer,
  chapter: Chapter,
): Promise<string> {
  const blocks = await getChapterBlocks(data, chapter)
  return blocks
    .map((block) => (typeof block === 'string' ? block : ''))
    .filter(Boolean)
    .join('\n\n')
}
