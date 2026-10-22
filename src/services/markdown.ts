import type { Chapter } from '@/types'

export interface ParsedMarkdown {
  title?: string
  author?: string
  chapters: Chapter[]
}

interface FrontMatter {
  data: Record<string, string>
  body: string
}

function splitFrontMatter(text: string): FrontMatter {
  const normalized = text.replace(/^\uFEFF/, '')
  if (!/^---\r?\n/.test(normalized)) return { data: {}, body: normalized }
  const end = normalized.indexOf('\n---', 3)
  if (end === -1) return { data: {}, body: normalized }
  const head = normalized.slice(4, end)
  const body = normalized.slice(end + 4).replace(/^\r?\n/, '')
  const data: Record<string, string> = {}
  for (const line of head.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/)
    if (m) data[m[1].toLowerCase()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return { data, body }
}

function hashId(input: string): string {
  let h = 0
  for (let i = 0; i < input.length; i += 1) {
    h = (h << 5) - h + input.charCodeAt(i)
    h |= 0
  }
  return `md-${Math.abs(h).toString(36)}`
}

export async function parseMarkdown(
  data: ArrayBuffer,
  fallbackTitle?: string,
): Promise<ParsedMarkdown> {
  const text = new TextDecoder('utf-8').decode(data)
  const { data: meta, body } = splitFrontMatter(text)
  const lines = body.split(/\r?\n/)

  const chapters: Chapter[] = []
  let currentTitle: string | null = null
  let currentLevel = 1
  let currentLines: string[] = []
  let documentTitle: string | undefined
  let seq = 0

  const flush = (): void => {
    const content = currentLines.join('\n').trim()
    if (!content && currentTitle === null) {
      currentLines = []
      return
    }
    if (!content && currentTitle !== null) {
      currentLines = []
      return
    }
    seq += 1
    chapters.push({
      id: hashId(`${seq}-${currentTitle ?? ''}`),
      title: currentTitle ?? '前言',
      level: currentLevel,
      content,
    })
    currentLines = []
  }

  for (const line of lines) {
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/)
    if (heading && heading[1].length <= 2) {
      flush()
      currentTitle = heading[2].trim()
      currentLevel = heading[1].length
      if (!documentTitle && currentLevel === 1) documentTitle = currentTitle
      continue
    }
    currentLines.push(line)
  }
  flush()

  const title = documentTitle ?? meta.title ?? fallbackTitle
  const author = meta.author
  return { title, author, chapters }
}

export function getMarkdownBlocks(content: string) {
  return [{ kind: 'markdown' as const, text: content }]
}
