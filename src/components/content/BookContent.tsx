import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { getChapterContent } from '@/services/epub'
import { getPageText, getPdfDocument } from '@/services/pdf'
import { useBookStore } from '@/stores/book-store'
import {
  useReaderStore,
  type ReaderFontFamily,
  type ReaderTheme,
} from '@/stores/reader-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; text: string };

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

export function BookContent() {
  const book = useBookStore((s) => s.book)
  const bookData = useBookStore((s) => s.bookData)
  const chapters = useBookStore((s) => s.chapters)
  const activeChapterId = useBookStore((s) => s.activeChapterId)
  const summary = useBookStore((s) => s.summary)
  const fontSize = useReaderStore((s) => s.fontSize)
  const lineHeight = useReaderStore((s) => s.lineHeight)
  const letterSpacing = useReaderStore((s) => s.letterSpacing)
  const fontFamily = useReaderStore((s) => s.fontFamily)
  const theme = useReaderStore((s) => s.theme)
  const outlineVisible = useReaderStore((s) => s.outlineVisible)
  const summaryVisible = useReaderStore((s) => s.summaryVisible)
  const setFontSize = useReaderStore((s) => s.setFontSize)
  const setLineHeight = useReaderStore((s) => s.setLineHeight)
  const setLetterSpacing = useReaderStore((s) => s.setLetterSpacing)
  const setFontFamily = useReaderStore((s) => s.setFontFamily)
  const setTheme = useReaderStore((s) => s.setTheme)
  const setOutlineVisible = useReaderStore((s) => s.setOutlineVisible)
  const setSummaryVisible = useReaderStore((s) => s.setSummaryVisible)
  const resetTypography = useReaderStore((s) => s.resetTypography)
  const [state, setState] = useState<LoadState>({ status: 'idle' })
  const cacheRef = useRef<Map<string, string>>(new Map())
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const activeChapter = chapters.find((c) => c.id === activeChapterId) ?? null
  const activeIndex = activeChapter ? chapters.indexOf(activeChapter) : -1
  const chapterSummary = activeChapter
    ? summary?.chapterSummaries[activeChapter.id]
    : undefined
  const chapterCard = activeChapter
    ? summary?.cards?.find((c) => c.chapterId === activeChapter.id)
    : undefined

  useEffect(() => {
    if (!activeChapter || !bookData || !book) {
      setState({ status: 'idle' })
      return
    }
    const cached = cacheRef.current.get(activeChapter.id)
    if (cached !== undefined) {
      setState({ status: 'ready', text: cached })
      return
    }
    let cancelled = false
    setState({ status: 'loading' })
    ;(async () => {
      try {
        let text = ''
        if (book.format === 'epub') {
          text = await getChapterContent(bookData, activeChapter)
        } else {
          const doc = await getPdfDocument(bookData)
          const from = activeChapter.startPage ?? 1
          const to = activeChapter.endPage ?? from
          const parts: string[] = []
          for (let page = from; page <= to; page += 1) {
            parts.push(await getPageText(doc, page))
          }
          text = parts.join('\n')
        }
        cacheRef.current.set(activeChapter.id, text)
        if (!cancelled) setState({ status: 'ready', text })
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
  }, [activeChapter, bookData, book])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [activeChapterId])

  const paragraphs = useMemo(() => {
    if (state.status !== 'ready') return []
    return state.text
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
  }, [state])

  const readerStyle = {
    '--reader-font-size': `${fontSize}px`,
    '--reader-line-height': String(lineHeight),
    '--reader-letter-spacing': `${letterSpacing}em`,
    '--reader-font-family': FONTS[fontFamily].stack,
    '--reader-background': THEMES[theme].bg,
    '--reader-foreground': THEMES[theme].fg,
  } as CSSProperties

  return (
    <section className="flex h-full min-h-0 flex-col rounded-lg border border-border p-5">
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
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <Button
          size="sm"
          variant={summaryVisible ? 'secondary' : 'ghost'}
          onClick={() => setSummaryVisible(!summaryVisible)}
          title="显示 / 隐藏本章总结"
        >
          总结
        </Button>
        <Button
          size="sm"
          variant={outlineVisible ? 'secondary' : 'ghost'}
          onClick={() => setOutlineVisible(!outlineVisible)}
          title="显示 / 隐藏章节列"
        >
          大纲
        </Button>
        <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
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
          重置
        </Button>
      </div>
      <div
        ref={scrollRef}
        className="reader-content min-h-0 flex-1 overflow-y-auto rounded-md p-4"
        style={readerStyle}
      >
        {state.status === 'idle' ? (
          <p className="text-sm opacity-70">
            点击左侧章节标题即可查看该章正文。
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
        {state.status === 'ready' && summaryVisible && activeChapter ? (
          <div className="reader-card mb-4 rounded-md p-3">
            <p className="mb-1 text-xs font-semibold tracking-wide opacity-70">
              本章总结
            </p>
            {chapterCard ? (
              <div className="space-y-1.5" style={{ fontSize: '0.92em' }}>
                {chapterCard.coreQuestion ? (
                  <p className="opacity-80">核心问题：{chapterCard.coreQuestion}</p>
                ) : null}
                {chapterCard.thesis ? <p className="font-medium">{chapterCard.thesis}</p> : null}
                {chapterCard.keyPoints.length > 0 ? (
                  <ul className="list-disc space-y-0.5 pl-4 opacity-90">
                    {chapterCard.keyPoints.map((k, i) => (
                      <li key={`${chapterCard.chapterId}-kp-${i}`}>{k.point}</li>
                    ))}
                  </ul>
                ) : null}
                {chapterCard.terms.length > 0 ? (
                  <p className="opacity-75">
                    术语：
                    {chapterCard.terms.map((t, i) => (
                      <span key={`${chapterCard.chapterId}-tm-${i}`}>
                        {i > 0 ? '；' : ''}
                        {t.term}
                      </span>
                    ))}
                  </p>
                ) : null}
              </div>
            ) : chapterSummary ? (
              <div className="whitespace-pre-wrap" style={{ fontSize: '0.92em' }}>
                {chapterSummary}
              </div>
            ) : (
              <p className="opacity-70" style={{ fontSize: '0.92em' }}>
                尚无总结。请在右侧运行「文字总结」模式并勾选本章后生成。
              </p>
            )}
          </div>
        ) : null}
        {state.status === 'ready' ? (
          paragraphs.length > 0 ? (
            <div>
              {paragraphs.map((p, i) => (
                <p key={i} className="reader-para whitespace-pre-wrap">
                  {p}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-sm opacity-70">
              该章节没有可提取的文本（可能是图片或空白页）。
            </p>
          )
        ) : null}
      </div>
    </section>
  )
}
