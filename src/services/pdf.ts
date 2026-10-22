import * as pdfjs from 'pdfjs-dist'
import type { Chapter } from '@/types'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export interface ParsedPdf {
  title?: string
  author?: string
  totalPages: number
  chapters: Chapter[]
}

interface OutlineItem {
  title: string
  dest: string | unknown[] | null
  items?: OutlineItem[]
}

export async function parsePdf(data: ArrayBuffer): Promise<ParsedPdf> {
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(data.slice(0)),
  }).promise
  const meta = await doc.getMetadata().catch(() => null)

  const info = meta?.info as { Title?: string; Author?: string } | undefined
  const title = info?.Title
  const author = info?.Author

  const outline = (await doc.getOutline().catch(() => null)) as
    | OutlineItem[]
    | null

  const chapters: Chapter[] = []
  if (outline && outline.length > 0) {
    await flattenOutline(doc, outline, 0, chapters)
  } else {
    for (let i = 1; i <= doc.numPages; i += 1) {
      chapters.push({
        id: `page-${i}`,
        title: `第 ${i} 页`,
        level: 0,
        startPage: i,
        endPage: i,
      })
    }
  }

  return { title, author, totalPages: doc.numPages, chapters }
}

async function flattenOutline(
  doc: pdfjs.PDFDocumentProxy,
  items: OutlineItem[],
  level: number,
  acc: Chapter[],
): Promise<void> {
  for (const item of items) {
    let page: number | undefined
    try {
      if (isArray(item.dest)) {
        const ref = item.dest[0]
        page = await doc.getPageIndex(ref as never).then((i) => i + 1)
      } else if (typeof item.dest === 'string') {
        const dest = await doc.getDestination(item.dest)
        if (dest) {
          page = await doc.getPageIndex(dest[0] as never).then((i) => i + 1)
        }
      }
    } catch {
      page = undefined
    }
    acc.push({
      id: `outline-${acc.length}`,
      title: item.title.trim() || `章节 ${acc.length + 1}`,
      level,
      startPage: page,
    })
    if (item.items && item.items.length > 0) {
      await flattenOutline(doc, item.items, level + 1, acc)
    }
  }
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value)
}

let cachedData: ArrayBuffer | null = null
let cachedDoc: Promise<pdfjs.PDFDocumentProxy> | null = null

export function getPdfDocument(
  data: ArrayBuffer,
): Promise<pdfjs.PDFDocumentProxy> {
  if (cachedDoc && cachedData === data) return cachedDoc
  cachedData = data
  if (data.byteLength === 0) {
    return Promise.reject(new Error('PDF 数据已失效，请重新上传文件。'))
  }
  cachedDoc = pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) }).promise
  return cachedDoc
}

export async function getPageText(
  doc: pdfjs.PDFDocumentProxy,
  page: number,
): Promise<string> {
  const p = await doc.getPage(page)
  const content = await p.getTextContent()
  return content.items
    .map((it) => ('str' in it ? it.str : ''))
    .join(' ')
    .trim()
}