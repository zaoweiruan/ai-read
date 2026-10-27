import { useCallback, useEffect, useRef, useState } from 'react'
import { getPageText, getPdfDocument } from '@/services/pdf'

export interface PdfStreamBlock {
  page: number
  text: string
}

export interface PdfStream {
  blocks: PdfStreamBlock[]
  loading: boolean
  error: string | null
  totalPages: number
  loadedEnd: number
  reachedEnd: boolean
  grow: () => boolean
  rearm: () => void
}

interface PdfStreamOptions {
  data: ArrayBuffer | null
  anchor: number
  enabled: boolean
}

const MAX_AUTO_GROW = 12

type PdfDoc = Awaited<ReturnType<typeof getPdfDocument>>

/**
 * PDF 视口接续流：从 anchor 页开始装载，按需向后续页追加，
 * 以便一页文字不足一屏时自动补满视口，不留下大片空白。
 */
export function usePdfStream({
  data,
  anchor,
  enabled,
}: PdfStreamOptions): PdfStream {
  const [end, setEnd] = useState(anchor)
  const [blocks, setBlocks] = useState<PdfStreamBlock[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalPages, setTotalPages] = useState(0)
  const endRef = useRef(anchor)
  const growCountRef = useRef(0)
  const docRef = useRef<PdfDoc | null>(null)
  const textCacheRef = useRef<Map<number, string>>(new Map())

  useEffect(() => {
    textCacheRef.current.clear()
    docRef.current = null
  }, [data])

  useEffect(() => {
    endRef.current = anchor
    growCountRef.current = 0
    setEnd(anchor)
    setBlocks([])
  }, [anchor, data])

  const readPage = useCallback(async (doc: PdfDoc, page: number) => {
    const cached = textCacheRef.current.get(page)
    if (cached !== undefined) return cached
    let text: string
    try {
      text = (await getPageText(doc, page)).trim()
    } catch {
      text = ''
    }
    textCacheRef.current.set(page, text)
    return text
  }, [])

  useEffect(() => {
    if (!enabled || !data) {
      setBlocks([])
      setTotalPages(0)
      setLoading(false)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const doc = docRef.current ?? (await getPdfDocument(data))
        docRef.current = doc
        if (cancelled) return
        setTotalPages(doc.numPages)
        const start = Math.max(1, Math.min(anchor, doc.numPages))
        const stop = Math.min(Math.max(endRef.current, start), doc.numPages)
        const next: PdfStreamBlock[] = []
        for (let page = start; page <= stop; page += 1) {
          const text = await readPage(doc, page)
          if (cancelled) return
          if (text.length > 0) next.push({ page, text })
        }
        if (cancelled) return
        setBlocks(next)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e))
          setBlocks([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [data, anchor, end, enabled, readPage])

  const grow = useCallback(() => {
    if (!enabled || !data) return false
    if (growCountRef.current >= MAX_AUTO_GROW) return false
    if (totalPages > 0 && endRef.current >= totalPages) return false
    growCountRef.current += 1
    endRef.current += 1
    setEnd(endRef.current)
    return true
  }, [data, enabled, totalPages])

  const rearm = useCallback(() => {
    growCountRef.current = 0
  }, [])

  return {
    blocks,
    loading,
    error,
    totalPages,
    loadedEnd: end,
    reachedEnd: totalPages > 0 && end >= totalPages,
    grow,
    rearm,
  }
}
