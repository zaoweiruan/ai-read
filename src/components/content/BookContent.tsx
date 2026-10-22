import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, WheelEvent as ReactWheelEvent } from 'react'
import { getChapterBlocks } from '@/services/epub'
import { getMarkdownBlocks } from '@/services/markdown'
import { getPageText, getPdfDocument } from '@/services/pdf'
import { renderMarkdown } from '@/lib/markdown'
import { useBookStore } from '@/stores/book-store'
import type { ContentBlock } from '@/types'
import {
  useReaderStore,
  type ReaderFontFamily,
  type ReaderTheme,
} from '@/stores/reader-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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

function ReaderImage({ src, alt }: { src: string; alt: string }) {
  const [iconWidth, setIconWidth] = useState<string | undefined>(undefined)
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onLoad={(e) => {
        const el = e.currentTarget
        if (el.naturalWidth > 0 && el.naturalWidth <= 200) {
          setIconWidth(`min(${el.naturalWidth}px, 1.5em)`)
        }
      }}
      style={iconWidth ? { width: iconWidth, maxWidth: iconWidth } : undefined}
      className="max-h-[70vh] w-auto max-w-full rounded-md"
    />
  )
}

export function BookContent() {
  const book = useBookStore((s) => s.book)
  const bookData = useBookStore((s) => s.bookData)
  const chapters = useBookStore((s) => s.chapters)
  const activeChapterId = useBookStore((s) => s.activeChapterId)
  const chapterRequest = useBookStore((s) => s.chapterRequest)
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
  const [totalPages, setTotalPages] = useState(0)
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

  const activeChapter = chapters.find((c) => c.id === (localChapterId ?? activeChapterId)) ?? null
  const activeIndex = activeChapter ? chapters.indexOf(activeChapter) : -1
  const isPdf = book?.format === 'pdf'
  const paged = pageMode === 'paged'
  const pdfStep = 1

  useEffect(() => {
    setLocalChapterId(null)
    pendingBottomRef.current = false
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

  function goToPage(page: number) {
    if (!isPdf) return
    pageNavRef.current = true
    setPdfPage(page)
    const target = chapters.find(
      (c) => (c.startPage ?? 1) <= page && page <= (c.endPage ?? c.startPage ?? 1),
    )
    if (target && target.id !== activeChapterId) {
      setActiveChapterId(target.id)
    }
  }

  function goNextChapter() {
    if (activeIndex < 0 || activeIndex >= chapters.length - 1) return
    lockScroll(1200)
    markProgrammaticScroll(2500)
    pendingBottomRef.current = false
    pendingLastScreenRef.current = false
    setPageIndex(0)
    const target = chapters[activeIndex + 1]
    setLocalChapterId(target.id)
    useBookStore.setState({ activeChapterId: target.id })
  }

  function goPrevChapter() {
    if (activeIndex <= 0) return
    lockScroll(1200)
    markProgrammaticScroll(2500)
    pendingBottomRef.current = true
    pendingLastScreenRef.current = paged
    setPageIndex(0)
    const target = chapters[activeIndex - 1]
    setLocalChapterId(target.id)
    useBookStore.setState({ activeChapterId: target.id })
  }

  function handleScroll() {
    const el = scrollRef.current
    if (!el || !contScroll) return
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
    const atBottom = cur + el.clientHeight >= el.scrollHeight - 24
    const atTop = cur <= 24
    if (atBottom && dirRef.current === 1) {
      goNextChapter()
    } else if (atTop && dirRef.current === -1) {
      goPrevChapter()
    }
  }

  function handleWheel(e: ReactWheelEvent<HTMLDivElement>) {
    const el = scrollRef.current
    if (!el || !contScroll) return
    if (paged) {
      if (isPdf) {
        if (e.deltaY > 0) goToPage(pdfPage + pdfStep)
        else if (e.deltaY < 0) goToPage(pdfPage - pdfStep)
        return
      }
      if (e.deltaY > 0) nextScreen()
      else if (e.deltaY < 0) prevScreen()
      return
    }
    if (Date.now() < lockUntilRef.current) return
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 24
    const atTop = el.scrollTop <= 24
    if (e.deltaY > 0 && atBottom) {
      goNextChapter()
    } else if (e.deltaY < 0 && atTop) {
      goPrevChapter()
    }
  }

  function nextScreen() {
    if (pageIndex < totalScreens - 1) {
      setPageIndex(pageIndex + 1)
      return
    }
    goNextChapter()
  }

  function prevScreen() {
    if (pageIndex > 0) {
      setPageIndex(pageIndex - 1)
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
    const target = chapters.find((c) => c.id === activeChapterId)
    if (target?.startPage) setPdfPage(target.startPage)
  }, [activeChapterId, chapters, isPdf])

  useEffect(() => {
    cacheRef.current.clear()
  }, [bookData])

  useEffect(() => {
    if (!activeChapter || !bookData || !book) {
      setState({ status: 'idle' })
      return
    }
    const cacheKey = isPdf ? `${activeChapter.id}:${pdfPage}` : activeChapter.id
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
        } else {
          const doc = await getPdfDocument(bookData)
          setTotalPages(doc.numPages)
          const text = await getPageText(doc, pdfPage)
          blocks = text
            .split(/\n{2,}/)
            .map((p) => p.trim())
            .filter((p) => p.length > 0)
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
  }, [activeChapter, bookData, book, pdfPage])

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
      setSpreadW(el.clientWidth + COLUMN_GAP)
      const total = computeSpreads(el, paged && twoPage, usableH)
      setTotalScreens(total)
      setPageIndex((i) => Math.min(i, total - 1))
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
  }, [state, paged, twoPage, fontSize, lineHeight])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [activeChapterId])

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
            paged
              ? isPdf
                ? goToPage(pdfPage - pdfStep)
                : prevScreen()
              : goToPage(pdfPage - pdfStep)
          }
          disabled={paged ? activeIndex <= 0 && pageIndex === 0 : !isPdf || pdfPage <= 1}
          title={paged ? '上一屏' : isPdf ? '上一页' : 'EPUB 无分页'}
        >
          上一页
        </Button>
        <span className="text-xs text-muted-foreground">
          {paged && !isPdf
            ? `第 ${pageIndex + 1} / ${totalScreens} ${twoPage ? '跨页' : '屏'}`
            : isPdf
              ? `第 ${pdfPage} / ${totalPages || '?'} 页`
              : 'EPUB 无分页'}
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            paged
              ? isPdf
                ? goToPage(pdfPage + pdfStep)
                : nextScreen()
              : goToPage(pdfPage + pdfStep)
          }
          disabled={
            paged
              ? activeIndex < 0 || (activeIndex >= chapters.length - 1 && pageIndex >= totalScreens - 1)
              : !isPdf || (totalPages > 0 && pdfPage + pdfStep - 1 >= totalPages)
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
          paged ? 'overflow-hidden' : 'overflow-y-auto',
        )}
        style={readerStyle}
        onScroll={handleScroll}
        onWheel={handleWheel}
      >
        {state.status === 'idle' ? (
          <p className="text-sm opacity-70">
            {bookData
              ? '点击左侧章节标题即可查看该章正文。'
              : book
                ? '书籍文件未驻留（刷新后不保留），请在顶部重新上传以继续阅读与处理。'
                : '请在顶部上传 EPUB 或 PDF 以开始阅读。'}
          </p>
        ) : null}
        {state.status === 'loading' ? (
          <p className="text-sm opacity-70">正在加载章节内容…</p>
        ) : null}
        {state.status === 'error' ? (
          <p className="text-sm" style={{ color: '#d94f4f' }}>
            章节内容加载失败：{state.message}
          </p>
        ) : null}
        {state.status === 'ready' ? (
          paragraphs.length > 0 ? (
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
                  <figure key={`img-${i}`} className="my-3 flex flex-col items-center">
                    <ReaderImage src={block.src} alt={block.alt} />
                    {block.alt ? (
                      <figcaption className="mt-1 text-xs opacity-70">
                        {block.alt}
                      </figcaption>
                    ) : null}
                  </figure>
                ),
              )}
            </div>
          ) : (
            <p className="text-sm opacity-70">
              该章节没有可提取的文本（可能是图片或空白页）。
            </p>
          )
        ) : null}
      </div>
      {paged ? (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          第 {pageIndex + 1} / {totalScreens} {twoPage ? '跨页' : '屏'} · 向下滚动或点「下一页」继续查看本章后续内容
        </p>
      ) : null}
    </section>
  )
}
