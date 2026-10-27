import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, WheelEvent as ReactWheelEvent } from 'react'
import { getChapterBlocks } from '@/services/epub'
import { getMarkdownBlocks } from '@/services/markdown'
import { renderMarkdown } from '@/lib/markdown'
import { useBookStore } from '@/stores/book-store'
import {
  bookKeyOf,
  saveReadingPosition,
  type ReadingPositionPatch,
} from '@/stores/reading-position-store'
import type { Chapter, ContentBlock } from '@/types'
import {
  useReaderStore,
  type ReaderFontFamily,
  type ReaderTheme,
} from '@/stores/reader-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { usePdfStream } from './use-pdf-stream'

type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; blocks: ContentBlock[] };

const LINE_HEIGHTS = [1.6, 1.9, 2.2]
const LETTER_SPACINGS = [0, 0.02, 0.05]
const FONT_KEYS: ReaderFontFamily[] = ['sans', 'serif', 'kai']
const THEME_KEYS: ReaderTheme[] = ['day', 'sepia', 'green', 'night']

const FONTS: Record<ReaderFontFamily, { label: string; stack: string }> = {
  sans: {
    label: '黑体',
    stack: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif",
  },
  serif: {
    label: '宋体',
    stack: "Georgia, 'Times New Roman', 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', SimSun, serif",
  },
  kai: {
    label: '楷体',
    stack: "'Kaiti SC', KaiTi, 'STKaiti', 'Noto Serif SC', serif",
  },
}

const THEMES: Record<ReaderTheme, { label: string; bg: string; fg: string }> = {
  day: { label: '日光', bg: '#ffffff', fg: '#26221c' },
  sepia: { label: '米黄', bg: '#f7f1e3', fg: '#4a3f2f' },
  green: { label: '护眼', bg: '#d9e8d4', fg: '#22301f' },
  night: { label: '墨夜', bg: '#1c1e22', fg: '#d5d9e0' },
}

function cycle<T>(list: readonly T[], current: T): T {
  const i = list.indexOf(current)
  return list[(i + 1) % list.length]
}

const COLUMN_GAP = 32
const CONTENT_PADDING = 32

type PendingSave = ReadingPositionPatch & { bookKey: string }

function computeSpreads(
  el: HTMLElement,
  twoPage: boolean,
  usableH: number,
): number {
  if (twoPage) {
    const spread = el.clientWidth + COLUMN_GAP
    return Math.max(1, Math.ceil(el.scrollWidth / Math.max(spread, 1)))
  }
  return Math.max(1, Math.ceil(el.scrollHeight / Math.max(usableH, 1)))
}

/**
 * 页号归属章节：outline 章节没有 endPage，按下一章 startPage - 1 推导，
 * 末章则延伸到 totalPages。
 */
function chapterAtPage(
  chapters: Chapter[],
  page: number,
  totalPages: number,
): Chapter | null {
  let matched: Chapter | null = null
  for (let i = 0; i < chapters.length; i += 1) {
    const chapter = chapters[i]
    const start = chapter.startPage
    if (typeof start !== 'number') continue
    if (start > page) break
    let end = chapter.endPage
    if (typeof end !== 'number') {
      end = totalPages > 0 ? totalPages : start
      for (let j = i + 1; j < chapters.length; j += 1) {
        const nextStart = chapters[j].startPage
        if (typeof nextStart === 'number' && nextStart > start) {
          end = nextStart - 1
          break
        }
      }
    }
    matched = chapter
    if (page <= end) return chapter
  }
  return matched
}

function ReaderFigure({ src, alt }: { src: string; alt: string }) {
  const [iconNatural, setIconNatural] = useState<number | null>(null)
  const isIcon = iconNatural !== null && iconNatural <= 200
  const showCaption = !isIcon && alt.trim().length > 0
  const iconWidth =
    iconNatural !== null && isIcon ? `min(${iconNatural}px, 1em)` : undefined
  return (
    <figure
      className={
        isIcon ? 'inline-block my-0.5 pl-[2em]' : 'my-3 flex flex-col items-center'
      }
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={(e) => {
          const el = e.currentTarget
          if (el.naturalWidth > 0) {
            setIconNatural(el.naturalWidth)
          }
        }}
        style={
          isIcon
            ? {
                width: iconWidth,
                maxWidth: iconWidth,
                maxHeight: '1.3em',
                objectFit: 'contain',
                verticalAlign: '-0.15em',
                display: 'inline-block',
              }
            : undefined
        }
        className={isIcon ? undefined : 'max-h-[70vh] w-auto max-w-full rounded-md'}
      />
      {showCaption ? (
        <figcaption className="mt-1 text-xs opacity-70">{alt}</figcaption>
      ) : null}
    </figure>
  )
}

export function BookContent() {
  const book = useBookStore((s) => s.book)
  const bookData = useBookStore((s) => s.bookData)
  const chapters = useBookStore((s) => s.chapters)
  const activeChapterId = useBookStore((s) => s.activeChapterId)
  const chapterRequest = useBookStore((s) => s.chapterRequest)
  const pendingRestore = useBookStore((s) => s.pendingRestore)
  const setPendingRestore = useBookStore((s) => s.setPendingRestore)
  const setActiveChapterId = useBookStore((s) => s.setActiveChapterId)
  const fontSize = useReaderStore((s) => s.fontSize)
  const lineHeight = useReaderStore((s) => s.lineHeight)
  const letterSpacing = useReaderStore((s) => s.letterSpacing)
  const fontFamily = useReaderStore((s) => s.fontFamily)
  const theme = useReaderStore((s) => s.theme)
  const setFontSize = useReaderStore((s) => s.setFontSize)
  const setLineHeight = useReaderStore((s) => s.setLineHeight)
  const setLetterSpacing = useReaderStore((s) => s.setLetterSpacing)
  const setFontFamily = useReaderStore((s) => s.setFontFamily)
  const setTheme = useReaderStore((s) => s.setTheme)
  const twoPage = useReaderStore((s) => s.twoPage)
  const setTwoPage = useReaderStore((s) => s.setTwoPage)
  const pageMode = useReaderStore((s) => s.pageMode)
  const setPageMode = useReaderStore((s) => s.setPageMode)
  const resetTypography = useReaderStore((s) => s.resetTypography)
  const [state, setState] = useState<LoadState>({ status: 'idle' })
  const [pdfPage, setPdfPage] = useState(1)
  const [readingPage, setReadingPage] = useState(1)
  const [expanded, setExpanded] = useState(false)
  const [contScroll, setContScroll] = useState(true)
  const [localChapterId, setLocalChapterId] = useState<string | null>(null)
  const [pageIndex, setPageIndex] = useState(0)
  const [totalScreens, setTotalScreens] = useState(1)
  const [viewportH, setViewportH] = useState(0)
  const [spreadW, setSpreadW] = useState(0)
  const lockUntilRef = useRef(0)
  const programmaticRef = useRef(false)
  const programmaticTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTopRef = useRef(0)
  const dirRef = useRef(0)
  const pendingBottomRef = useRef(false)
  const posRef = useRef({ scrollRatio: 0, pageIndex: 0, pdfPage: 1 })
  const pendingPatchRef = useRef<PendingSave | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const totalScreensRef = useRef(1)
  const totalPagesRef = useRef(0)
  const bookKey = book ? bookKeyOf(book.fileName, book.size) : null
  const bookKeyRef = useRef<string | null>(null)
  bookKeyRef.current = bookKey

  function flushPendingSave() {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    const pending = pendingPatchRef.current
    pendingPatchRef.current = null
    if (!pending) return
    const { bookKey: key, ...patch } = pending
    saveReadingPosition(key, patch)
  }

  function schedulePositionSave(patch: ReadingPositionPatch) {
    const key = bookKeyRef.current
    const chapterId = patch.chapterId
    if (!key || !chapterId) return
    const existing = pendingPatchRef.current
    if (existing && (existing.bookKey !== key || existing.chapterId !== chapterId)) {
      const { bookKey: existingKey, ...existingPatch } = existing
      saveReadingPosition(existingKey, existingPatch)
      pendingPatchRef.current = null
    }
    const prev = pendingPatchRef.current
    pendingPatchRef.current = {
      bookKey: key,
      chapterId,
      scrollRatio: patch.scrollRatio ?? prev?.scrollRatio,
      pageIndex: patch.pageIndex ?? prev?.pageIndex,
      pdfPage: patch.pdfPage ?? prev?.pdfPage,
    }
    if (saveTimerRef.current) return
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null
      const pending = pendingPatchRef.current
      pendingPatchRef.current = null
      if (!pending) return
      const { bookKey: key, ...patch } = pending
      saveReadingPosition(key, patch)
    }, 500)
  }

  function lockScroll(ms: number) {
    lockUntilRef.current = Date.now() + ms
  }

  function markProgrammaticScroll(holdMs = 400) {
    programmaticRef.current = true
    if (programmaticTimerRef.current) clearTimeout(programmaticTimerRef.current)
    programmaticTimerRef.current = setTimeout(() => {
      programmaticRef.current = false
      programmaticTimerRef.current = null
    }, holdMs)
  }
  const cacheRef = useRef<Map<string, ContentBlock[]>>(new Map())
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const readerRef = useRef<HTMLElement | null>(null)
  const pageNavRef = useRef(false)
  const pendingLastScreenRef = useRef(false)
  const pendingNextScreenRef = useRef(false)
  const streamSyncRef = useRef(false)
  const readingPageRef = useRef(1)
  const pdfStreamRef = useRef<ReturnType<typeof usePdfStream> | null>(null)

  const activeChapter =
    chapters.find((c) => c.id === (localChapterId ?? activeChapterId)) ??
    chapters.find((c) => c.id === activeChapterId) ??
    chapters[0] ??
    null
  const activeIndex = activeChapter ? chapters.indexOf(activeChapter) : -1
  posRef.current.pageIndex = pageIndex
  posRef.current.pdfPage = pdfPage
  totalScreensRef.current = totalScreens
  const isPdf = book?.format === 'pdf'
  const paged = pageMode === 'paged'
  // 双页时一屏左右各占一页（网格），翻页按跨页步进，避免上页内容回卷；
  // 单页时按单页步进
  const pdfStep = isPdf && twoPage ? 2 : 1
  const pdfStream = usePdfStream({
    data: bookData,
    anchor: pdfPage,
    enabled: isPdf,
  })
  pdfStreamRef.current = pdfStream
  const totalPages = pdfStream.totalPages
  totalPagesRef.current = totalPages
  readingPageRef.current = readingPage

  useEffect(() => {
    setLocalChapterId(null)
    pendingBottomRef.current = false
    posRef.current.scrollRatio = 0
  }, [chapterRequest])

  useEffect(() => {
    const onChange = () => {
      setExpanded(document.fullscreenElement === readerRef.current)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false)
    }
    document.addEventListener('fullscreenchange', onChange)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  async function toggleFullscreen() {
    const el = readerRef.current
    if (!el) return
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      return
    }
    if (expanded) {
      setExpanded(false)
      return
    }
    if (typeof el.requestFullscreen !== 'function') {
      setExpanded(true)
      return
    }
    try {
      await el.requestFullscreen()
    } catch {
      setExpanded(true)
    }
  }

  function syncReadingPage() {
    if (!isPdf) return
    // 切换模式下页码取当前流的起始页（anchor），不按 DOM 采样；
    // 采样在 translateX/translateY 屏模型下会取到错页。
    if (paged) return
    const el = contentRef.current
    const box = scrollRef.current
    if (!el || !box) return
    const nodes = el.querySelectorAll<HTMLElement>('[data-pdf-page]')
    if (nodes.length === 0) return
    const boxRect = box.getBoundingClientRect()
    let page = 0
    for (let i = 0; i < nodes.length; i += 1) {
      const rect = nodes[i].getBoundingClientRect()
      const reached = rect.bottom > boxRect.top + 2
      if (reached) {
        page = Number(nodes[i].dataset.pdfPage) || 0
        break
      }
    }
    if (page <= 0 || page === readingPageRef.current) return
    readingPageRef.current = page
    setReadingPage(page)
    pdfStreamRef.current?.rearm()
    const target = chapterAtPage(chapters, page, totalPagesRef.current)
    if (target && target.id !== useBookStore.getState().activeChapterId) {
      streamSyncRef.current = true
      setLocalChapterId(target.id)
      setActiveChapterId(target.id)
    }
  }

  function goToPage(page: number) {
    if (!isPdf) return
    const max = totalPagesRef.current
    const next = max > 0 ? Math.min(Math.max(1, page), max) : Math.max(1, page)
    pageNavRef.current = true
    setPdfPage(next)
    readingPageRef.current = next
    setReadingPage(next)
    const target = chapterAtPage(chapters, next, max)
    if (target) {
      setLocalChapterId(target.id)
      if (target.id !== activeChapterId) {
        setActiveChapterId(target.id)
      }
    }
  }

  function goNextChapter() {
    if (activeIndex < 0 || activeIndex >= chapters.length - 1) return
    lockScroll(1200)
    markProgrammaticScroll(2500)
    pendingBottomRef.current = false
    pendingLastScreenRef.current = false
    setPageIndex(0)
    posRef.current.scrollRatio = 0
    const target = chapters[activeIndex + 1]
    setLocalChapterId(target.id)
    useBookStore.setState({ activeChapterId: target.id })
  }

  function goPrevChapter() {
    if (activeIndex <= 0) return
    lockScroll(1200)
    markProgrammaticScroll(2500)
    pendingBottomRef.current = !isPdf
    pendingLastScreenRef.current = paged && !isPdf
    setPageIndex(0)
    posRef.current.scrollRatio = 1
    const target = chapters[activeIndex - 1]
    setLocalChapterId(target.id)
    useBookStore.setState({ activeChapterId: target.id })
  }

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    if (!contScroll) return
    if (programmaticRef.current) {
      lastTopRef.current = el.scrollTop
      return
    }
    if (Date.now() < lockUntilRef.current) {
      lastTopRef.current = el.scrollTop
      return
    }
    const prev = lastTopRef.current
    const cur = el.scrollTop
    if (cur > prev) dirRef.current = 1
    else if (cur < prev) dirRef.current = -1
    lastTopRef.current = cur
    const range = el.scrollHeight - el.clientHeight
    const scrollRatio = range <= 0 ? 0 : Math.min(1, Math.max(0, cur / range))
    posRef.current.scrollRatio = scrollRatio
    if (activeChapter) {
      schedulePositionSave({ chapterId: activeChapter.id, scrollRatio })
    }
    if (isPdf) syncReadingPage()
    const atBottom = cur + el.clientHeight >= el.scrollHeight - 24
    const atTop = cur <= 24
    if (atTop && dirRef.current === -1) {
      if (isPdf) goToPage(readingPageRef.current - pdfStep)
      else goPrevChapter()
      return
    }
    const stream = pdfStreamRef.current
    if (isPdf && stream && !stream.reachedEnd) {
      if (cur + el.clientHeight >= el.scrollHeight - el.clientHeight * 0.8) {
        stream.grow()
      }
      return
    }
    if (atBottom && dirRef.current === 1) {
      goNextChapter()
    }
  }

  function handleWheel(e: ReactWheelEvent<HTMLDivElement>) {
    const el = scrollRef.current
    if (!el || !contScroll) return
    if (paged) {
      if (e.deltaY > 0) nextScreen()
      else if (e.deltaY < 0) prevScreen()
      return
    }
    if (Date.now() < lockUntilRef.current) return
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 24
    const atTop = el.scrollTop <= 24
    if (e.deltaY < 0 && atTop) {
      if (isPdf) goToPage(readingPageRef.current - pdfStep)
      else goPrevChapter()
      return
    }
    const stream = pdfStreamRef.current
    if (isPdf && stream && !stream.reachedEnd) {
      if (e.deltaY > 0 && atBottom) stream.grow()
      return
    }
    if (e.deltaY > 0 && atBottom) {
      goNextChapter()
    }
  }

  function nextScreen() {
    if (pageIndex < totalScreens - 1) {
      setPageIndex(pageIndex + 1)
      return
    }
    if (isPdf) {
      const stream = pdfStreamRef.current
      // 已装流末屏：继续追加下一页，追加落地后再推进一屏
      if (stream && !stream.reachedEnd && stream.grow()) {
        pendingNextScreenRef.current = true
        return
      }
      // 真正到末尾：进入下一章（PDF 章节 = 页区间）
      goNextChapter()
      return
    }
    goNextChapter()
  }

  function prevScreen() {
    if (pageIndex > 0) {
      setPageIndex(pageIndex - 1)
      return
    }
    if (isPdf) {
      // 退到上一页开头，重新装载流
      goToPage(readingPageRef.current - 1)
      return
    }
    goPrevChapter()
  }

  useEffect(() => {
    if (!isPdf) return
    if (pageNavRef.current) {
      pageNavRef.current = false
      return
    }
    if (streamSyncRef.current) return
    const target = chapters.find((c) => c.id === activeChapterId)
    if (target?.startPage) setPdfPage(target.startPage)
  }, [activeChapterId, chapters, isPdf])

  useEffect(() => {
    setLocalChapterId(null)
    pendingBottomRef.current = false
    pendingLastScreenRef.current = false
    posRef.current.scrollRatio = 0
    setPageIndex(0)
  }, [book?.id, chapters])

  useEffect(() => {
    const onUnload = () => flushPendingSave()
    window.addEventListener('beforeunload', onUnload)
    return () => {
      window.removeEventListener('beforeunload', onUnload)
      flushPendingSave()
    }
  }, [])

  useEffect(() => {
    cacheRef.current.clear()
  }, [bookData])

  useEffect(() => {
    if (isPdf) return
    if (!activeChapter || !bookData || !book) {
      setState({ status: 'idle' })
      return
    }
    const cacheKey = activeChapter.id
    const cached = cacheRef.current.get(cacheKey)
    if (cached !== undefined) {
      setState({ status: 'ready', blocks: cached })
      return
    }
    let cancelled = false
    setState({ status: 'loading' })
    ;(async () => {
      try {
        let blocks: ContentBlock[] = []
        if (book.format === 'epub') {
          blocks = await getChapterBlocks(bookData, activeChapter)
        } else if (book.format === 'markdown') {
          blocks = getMarkdownBlocks(activeChapter.content ?? '')
        }
        cacheRef.current.set(cacheKey, blocks)
        if (!cancelled) setState({ status: 'ready', blocks })
      } catch (e) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: e instanceof Error ? e.message : String(e),
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeChapter, bookData, book, isPdf])

  useEffect(() => {
    if (!isPdf) return
    if (pdfStream.blocks.length > 0) {
      setState({ status: 'ready', blocks: [] })
      return
    }
    if (pdfStream.error) {
      setState({ status: 'error', message: pdfStream.error })
      return
    }
    setState(pdfStream.loading ? { status: 'loading' } : { status: 'idle' })
  }, [isPdf, pdfStream.blocks.length, pdfStream.error, pdfStream.loading])

  useEffect(() => {
    if (!isPdf) return
    syncReadingPage()
  }, [isPdf, twoPage, pdfStream.loadedEnd, pageIndex])

  useEffect(() => {
    if (state.status !== 'ready') return
    markProgrammaticScroll(800)
    if (paged) {
      if (!pendingLastScreenRef.current) return
      pendingLastScreenRef.current = false
      requestAnimationFrame(() => {
        const el = contentRef.current
        const box = scrollRef.current
        if (!el || !box) return
        const linePx = Math.max(fontSize * lineHeight, 1)
        const contentBox = Math.max(box.clientHeight - CONTENT_PADDING, linePx)
        const usableH = Math.max(Math.floor(contentBox / linePx) * linePx, linePx)
        setPageIndex(computeSpreads(el, twoPage, usableH) - 1)
      })
      return
    }
    if (!pendingBottomRef.current) return
    pendingBottomRef.current = false
    const el = scrollRef.current
    if (!el) return
    markProgrammaticScroll(2000)
    const id = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
    return () => cancelAnimationFrame(id)
  }, [state, paged, twoPage])

  useEffect(() => {
    const el = contentRef.current
    const box = scrollRef.current
    if (!el || !box) return
    const measure = (): void => {
      const linePx = Math.max(fontSize * lineHeight, 1)
      const contentBox = Math.max(box.clientHeight - CONTENT_PADDING, linePx)
      const usableH = Math.max(Math.floor(contentBox / linePx) * linePx, linePx)
      setViewportH(usableH)
      // PDF 切换+双页：与 EPUB 一致，一屏 = 两栏整块，
      // 位移按「两栏 + 栏间 gap」（col3 起始于 clientWidth + gap）。
      setSpreadW(el.clientWidth + COLUMN_GAP)
      const total = computeSpreads(el, paged && twoPage, usableH)
      setTotalScreens(total)
      setPageIndex((i) => Math.min(i, total - 1))
      // 用户点“下一页”在已装流末屏时 grow() 了，这里把页码推进到下一屏
      if (pendingNextScreenRef.current && total > pageIndex + 1) {
        pendingNextScreenRef.current = false
        setPageIndex(pageIndex + 1)
      }
      const stream = pdfStreamRef.current
      if (!isPdf || !stream || stream.loading || stream.reachedEnd) return
      if (stream.blocks.length === 0) return
      // 切换+双页：按列宽预取；切换单页：按屏高预取；连续：按 1.5 屏预取
      if (paged && twoPage) {
        if (el.scrollWidth < (pageIndex + 2) * (el.clientWidth + COLUMN_GAP)) stream.grow()
      } else if (paged) {
        if (el.scrollHeight < (pageIndex + 2) * usableH) stream.grow()
      } else {
        if (el.scrollHeight < box.clientHeight * 1.5) stream.grow()
        // 双页网格需要成对装载，否则末行只有左栏页面、右栏留白
        else if (twoPage && stream.blocks.length % 2 === 1) stream.grow()
      }
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    ro.observe(box)
    const mo = new MutationObserver(measure)
    mo.observe(el, { childList: true, subtree: true, characterData: true })
    return () => {
      ro.disconnect()
      mo.disconnect()
    }
  }, [
    state,
    paged,
    twoPage,
    fontSize,
    lineHeight,
    isPdf,
    pageIndex,
    pdfStream.blocks.length,
    pdfStream.loadedEnd,
  ])

  useEffect(() => {
    if (streamSyncRef.current) {
      streamSyncRef.current = false
      return
    }
    if (useBookStore.getState().pendingRestore) return
    scrollRef.current?.scrollTo({ top: 0 })
  }, [activeChapterId])

  // 装载锚点变化（翻页 / 章导航 / 恢复位置）后回到流顶部
  useEffect(() => {
    if (!isPdf) return
    const el = scrollRef.current
    if (!el) return
    markProgrammaticScroll(600)
    lockScroll(600)
    el.scrollTop = 0
    lastTopRef.current = 0
    posRef.current.scrollRatio = 0
    setPageIndex(0)
    readingPageRef.current = pdfPage
    setReadingPage(pdfPage)
  }, [isPdf, pdfPage])

  useEffect(() => {
    if (state.status !== 'ready' || !pendingRestore) return
    const restore = pendingRestore
    const raf = requestAnimationFrame(() => {
      if (useBookStore.getState().pendingRestore !== restore) return
      if (isPdf && typeof restore.pdfPage === 'number') {
        const maxPage = totalPagesRef.current
        const page =
          maxPage > 0
            ? Math.min(Math.max(1, Math.floor(restore.pdfPage)), maxPage)
            : Math.max(1, Math.floor(restore.pdfPage))
        const before = useBookStore.getState().activeChapterId
        goToPage(page)
        if (useBookStore.getState().activeChapterId === before) {
          pageNavRef.current = false
        }
        posRef.current.pdfPage = page
      } else if (!isPdf && paged && typeof restore.pageIndex === 'number') {
        const idx = Math.max(0, Math.floor(restore.pageIndex))
        const clamped =
          totalScreensRef.current > 0
            ? Math.min(idx, totalScreensRef.current - 1)
            : idx
        setPageIndex(clamped)
        posRef.current.pageIndex = clamped
      } else if (!isPdf && !paged && typeof restore.scrollRatio === 'number') {
        const el = scrollRef.current
        if (el) {
          const ratio = Math.min(1, Math.max(0, restore.scrollRatio))
          const range = el.scrollHeight - el.clientHeight
          const target = range > 0 ? ratio * range : 0
          markProgrammaticScroll(1500)
          lockScroll(1500)
          el.scrollTop = target
          lastTopRef.current = target
          posRef.current.scrollRatio = ratio
        }
      }
      setPendingRestore(null)
    })
    return () => cancelAnimationFrame(raf)
  }, [state, pendingRestore, isPdf, paged, setPendingRestore])

  useEffect(() => {
    if (!bookKey || !activeChapter || !bookData || pendingRestore) return
    flushPendingSave()
    const snap = posRef.current
    saveReadingPosition(
      bookKey,
      isPdf
        ? { chapterId: activeChapter.id, pdfPage: readingPage }
        : paged
          ? { chapterId: activeChapter.id, pageIndex: snap.pageIndex }
          : { chapterId: activeChapter.id, scrollRatio: snap.scrollRatio },
    )
  }, [
    bookKey,
    activeChapter,
    bookData,
    pendingRestore,
    paged,
    isPdf,
    readingPage,
    pageIndex,
  ])

  const paragraphs = useMemo(() => {
    if (state.status !== 'ready') return []
    return state.blocks
  }, [state])
  const pageBlockCount = useMemo(
    () =>
      paragraphs.filter(
        (block): block is Extract<ContentBlock, { kind: 'page' }> =>
          typeof block !== 'string' && block.kind === 'page',
      ).length,
    [paragraphs],
  )

  const readerStyle = {
    '--reader-font-size': `${fontSize}px`,
    '--reader-line-height': String(lineHeight),
    '--reader-letter-spacing': `${letterSpacing}em`,
    '--reader-font-family': FONTS[fontFamily].stack,
    '--reader-background': THEMES[theme].bg,
    '--reader-foreground': THEMES[theme].fg,
  } as CSSProperties

  return (
    <section
      ref={readerRef}
      className={cn(
        'reader-shell flex h-full min-h-0 flex-col rounded-lg border border-border p-5',
        expanded && 'is-expanded fixed inset-0 z-50 overflow-hidden bg-background',
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="min-w-0 truncate text-lg font-semibold">
          {activeChapter?.title ?? '书籍内容'}
        </h2>
        {activeChapter ? (
          <Badge>
            {activeIndex + 1} / {chapters.length}
          </Badge>
        ) : null}
      </div>
      <div className="reader-toolbar mb-2 flex flex-wrap items-center gap-1">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setFontSize(fontSize - 1)}
          disabled={fontSize <= 15}
          title="减小字号"
        >
          A-
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setFontSize(fontSize + 1)}
          disabled={fontSize >= 22}
          title="增大字号"
        >
          A+
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setLineHeight(cycle(LINE_HEIGHTS, lineHeight))}
          title="循环切换行距"
        >
          行距 {lineHeight}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setLetterSpacing(cycle(LETTER_SPACINGS, letterSpacing))}
          title="循环切换字距"
        >
          字距 {letterSpacing === 0 ? '正常' : letterSpacing}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setFontFamily(cycle(FONT_KEYS, fontFamily))}
          title="循环切换字体"
        >
          字体 {FONTS[fontFamily].label}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setTheme(cycle(THEME_KEYS, theme))}
          title="循环切换主题"
        >
          主题 {THEMES[theme].label}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={resetTypography}
          title="恢复默认排版"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M13.2 8a5.2 5.2 0 1 1-1.7-3.85" />
            <path d="M13.2 2.6V6H9.8" />
          </svg>
          重置
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void toggleFullscreen()}
          title={expanded ? '退出全屏' : '全屏显示阅读区'}
          aria-label={expanded ? '退出全屏' : '全屏'}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {expanded ? (
              <path d="M6 2.5H2.5V6M10 2.5h3.5V6M6 13.5H2.5V10M10 13.5h3.5V10" />
            ) : (
              <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />
            )}
          </svg>
          {expanded ? '退出全屏' : '全屏'}
        </Button>
        <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
        <Button
          size="sm"
          variant="outline"
          onClick={() => goPrevChapter()}
          disabled={activeIndex <= 0}
          title="上一章"
        >
          上一章
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => goNextChapter()}
          disabled={activeIndex < 0 || activeIndex >= chapters.length - 1}
          title="下一章"
        >
          下一章
        </Button>
        <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            paged ? prevScreen() : goToPage(readingPage - pdfStep)
          }
          disabled={
            paged
              ? activeIndex <= 0 && pageIndex === 0
              : !isPdf || readingPage <= 1
          }
          title={paged ? '上一屏' : isPdf ? '上一页' : 'EPUB 无分页'}
        >
          上一页
        </Button>
        <span className="text-xs text-muted-foreground">
          {paged && !isPdf
            ? `第 ${pageIndex + 1} / ${totalScreens} ${twoPage ? '跨页' : '屏'}`
            : isPdf
              ? twoPage
                ? `第 ${readingPage}${
                    readingPage + 1 <= pdfStream.loadedEnd
                      ? `-${readingPage + 1}`
                      : ''
                  } / ${totalPages || '?'} 页`
                : `第 ${readingPage} / ${totalPages || '?'} 页`
              : 'EPUB 无分页'}
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            paged ? nextScreen() : goToPage(readingPage + pdfStep)
          }
          disabled={
            paged
              ? activeIndex < 0 ||
                (activeIndex >= chapters.length - 1 &&
                  pageIndex >= totalScreens - 1 &&
                  pdfStream.reachedEnd)
              : !isPdf || (totalPages > 0 && readingPage + pdfStep > totalPages)
          }
          title={paged ? '下一屏' : isPdf ? '下一页' : 'EPUB 无分页'}
        >
          下一页
        </Button>
        {!paged ? (
          <Button
            size="sm"
            variant={contScroll ? 'secondary' : 'ghost'}
            onClick={() => setContScroll((v) => !v)}
            title="连续滚动：滚到底部自动进入下一章，滚回顶部自动回到上一章"
          >
            连续滚动
          </Button>
        ) : null}
        <Button
          size="sm"
          variant={twoPage ? 'secondary' : 'outline'}
          onClick={() => setTwoPage(!twoPage)}
          title="双页并列显示"
          aria-label="双页并列"
        >
          双页
        </Button>
        <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
        <Button
          size="sm"
          variant={pageMode === 'continuous' ? 'secondary' : 'outline'}
          onClick={() => setPageMode('continuous')}
          title="换页方式：连续滚动"
        >
          连续
        </Button>
        <Button
          size="sm"
          variant={pageMode === 'paged' ? 'secondary' : 'outline'}
          onClick={() => setPageMode('paged')}
          title="换页方式：整屏切换"
        >
          切换
        </Button>
      </div>
      <div
        ref={scrollRef}
        className={cn(
          'reader-content min-h-0 flex-1 rounded-md p-4',
          // 切换模式固定一屏、不可自由滚动（PDF 与 EPUB 同为整屏切换语义）
          paged ? 'overflow-hidden' : 'overflow-y-auto',
        )}
        style={readerStyle}
        onScroll={handleScroll}
        onWheel={handleWheel}
      >
        {isPdf ? (
          pdfStream.blocks.length > 0 ? (
            <div
              ref={contentRef}
              className={cn(
                // 连续模式：双页按“页面对”排成两栏网格（页 N｜页 N+1），逐行追加不重排；
                // 切换模式：当页文字在固定一屏内左右两栏连续排布（columns-2），
                // 靠 translateY/translateX 整屏位移换屏，因此内容高度固定、翻页不回卷。
                paged
                  ? twoPage
                    ? 'columns-2 gap-8'
                    : undefined
                  : twoPage
                    ? 'grid grid-cols-2 gap-8'
                    : undefined,
              )}
              style={
                paged
                  ? twoPage
                    ? {
                        height: viewportH ? `${viewportH}px` : undefined,
                        transform: `translateX(-${pageIndex * spreadW}px)`,
                      }
                    : { transform: `translateY(-${pageIndex * viewportH}px)` }
                  : undefined
              }
            >
              {pdfStream.blocks.map((block) => (
                <p
                  key={block.page}
                  data-pdf-page={block.page}
                  className="reader-para whitespace-pre-wrap"
                >
                  {block.text}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-sm opacity-70">
              {pdfStream.error
                ? `页面内容加载失败：${pdfStream.error}`
                : pdfStream.loading
                  ? '正在加载页面内容…'
                  : '该页没有可提取的文本（可能是图片或空白页）。'}
            </p>
          )
        ) : state.status === 'idle' ? (
          <p className="text-sm opacity-70">
            {bookData
              ? '未解析出可阅读的章节。'
              : book
                ? '书籍文件未驻留（刷新后不保留），请在顶部重新上传以继续阅读与处理。'
                : '请在顶部上传 EPUB 或 PDF 以开始阅读。'}
          </p>
        ) : state.status === 'loading' ? (
          <p className="text-sm opacity-70">正在加载章节内容…</p>
        ) : state.status === 'error' ? (
          <p className="text-sm" style={{ color: '#d94f4f' }}>
            章节内容加载失败：{state.message}
          </p>
        ) : paragraphs.length > 0 ? (
          <div
            ref={contentRef}
            className={cn(
              pageBlockCount > 1
                ? 'grid grid-cols-2 gap-6'
                : twoPage
                  ? 'columns-2 gap-8'
                  : undefined,
            )}
            style={
              paged
                ? twoPage
                  ? {
                      height: viewportH ? `${viewportH}px` : undefined,
                      transform: `translateX(-${pageIndex * spreadW}px)`,
                    }
                  : { transform: `translateY(-${pageIndex * viewportH}px)` }
                : undefined
            }
          >
            {paragraphs.map((block, i) =>
              typeof block === 'string' ? (
                <p key={i} className="reader-para whitespace-pre-wrap">
                  {block}
                </p>
              ) : block.kind === 'markdown' ? (
                <div key={`md-${i}`} className="markdown-body">
                  {renderMarkdown(block.text)}
                </div>
              ) : block.kind === 'page' ? (
                <div key={`pg-${i}`} className="whitespace-pre-wrap">
                  {block.text
                    .split(/\n{2,}/)
                    .map((p, j) => (
                      <p key={j} className="reader-para">
                        {p.trim()}
                      </p>
                    ))}
                </div>
              ) : (
                <ReaderFigure key={`img-${i}`} src={block.src} alt={block.alt} />
              ),
            )}
          </div>
        ) : (
          <p className="text-sm opacity-70">
            该章节没有可提取的文本（可能是图片或空白页）。
          </p>
        )}
      </div>
      {isPdf && pdfStream.reachedEnd ? (
        <p className="mt-1 text-center text-xs text-muted-foreground">
          已到最后一页
        </p>
      ) : null}
      {paged ? (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          第 {pageIndex + 1} / {totalScreens} {twoPage ? '跨页' : '屏'} · 向下滚动或点「下一页」继续查看本章后续内容
        </p>
      ) : null}
    </section>
  )
}


