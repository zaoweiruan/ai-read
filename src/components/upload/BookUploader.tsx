import { useRef, useState } from 'react'
import { cacheRecentFile, getCachedFile } from '@/lib/recent-file-cache'
import {
  getHandle,
  isFsaaSupported,
  putHandle,
} from '@/lib/file-handle-store'
import { useBookStore } from '@/stores/book-store'
import { bookKeyOf, getReadingPosition } from '@/stores/reading-position-store'
import { recentKeyOf, useRecentFilesStore } from '@/stores/recent-files-store'
import type { RecentFileRecord } from '@/stores/recent-files-store'
import { useSettingsStore } from '@/stores/settings-store'
import { Button } from '@/components/ui/button'
import { parseEpub } from '@/services/epub'
import { parsePdf } from '@/services/pdf'
import { parseMarkdown } from '@/services/markdown'
import type { BookFormat } from '@/types'

function stripExtension(fileName: string): string {
  const i = fileName.lastIndexOf('.')
  if (i <= 0) return fileName
  return fileName.slice(0, i)
}

function detectFormat(fileName: string): BookFormat | null {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.epub')) return 'epub'
  if (lower.endsWith('.pdf')) return 'pdf'
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'markdown'
  return null
}

function hasCover(parsed: unknown): parsed is { cover?: string } {
  return typeof parsed === 'object' && parsed !== null && 'cover' in parsed
}

function formatLabel(format: BookFormat): string {
  if (format === 'epub') return 'EPUB'
  if (format === 'pdf') return 'PDF'
  return 'Markdown'
}

function formatSize(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function BookUploader() {
  const inputRef = useRef<HTMLInputElement>(null)
  const book = useBookStore((s) => s.book)
  const setBook = useBookStore((s) => s.setBook)
  const setBookData = useBookStore((s) => s.setBookData)
  const setChapters = useBookStore((s) => s.setChapters)
  const requestChapter = useBookStore((s) => s.requestChapter)
  const setPendingRestore = useBookStore((s) => s.setPendingRestore)
  const reset = useBookStore((s) => s.reset)
  const recentRecords = useRecentFilesStore((s) => s.records)
  const addRecent = useRecentFilesStore((s) => s.addRecent)
  const removeRecent = useRecentFilesStore((s) => s.removeRecent)
  const clearRecent = useRecentFilesStore((s) => s.clearRecent)
  const recentLimit = useSettingsStore((s) => s.recentFilesLimit)
  const fsaaSupported = isFsaaSupported()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recentVisible, setRecentVisible] = useState(false)

  async function handleFile(file: File, handle?: FileSystemFileHandle) {
    const format = detectFormat(file.name)
    if (!format) {
      setError('仅支持 .epub、.pdf 或 .md 文件')
      return
    }
    setBusy(true)
    setError(null)
    reset()
    try {
      const data = await file.arrayBuffer()
      const parsed =
        format === 'epub'
          ? await parseEpub(data)
          : format === 'pdf'
            ? await parsePdf(data)
            : await parseMarkdown(data, file.name.replace(/\.(md|markdown)$/i, ''))
      setBook({
        id: crypto.randomUUID().slice(0, 8),
        fileName: file.name,
        format,
        size: file.size,
        title: parsed.title ?? undefined,
        author: parsed.author ?? undefined,
        cover: hasCover(parsed) ? parsed.cover : undefined,
      })
      setBookData(data.slice(0))
      setChapters(parsed.chapters)
      addRecent({
        fileName: file.name,
        size: file.size,
        format,
        title: parsed.title ?? undefined,
        author: parsed.author ?? undefined,
      })
      cacheRecentFile(recentKeyOf(file.name, file.size), file)
      if (handle && fsaaSupported) {
        void putHandle(recentKeyOf(file.name, file.size), handle).catch(() => {})
      }
      const position = getReadingPosition(bookKeyOf(file.name, file.size))
      if (position && parsed.chapters.some((c) => c.id === position.chapterId)) {
        setPendingRestore({
          chapterId: position.chapterId,
          scrollRatio: position.scrollRatio,
          pageIndex: position.pageIndex,
          pdfPage: position.pdfPage,
        })
        requestChapter(position.chapterId)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '解析失败')
    } finally {
      setBusy(false)
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) void handleFile(file)
    e.target.value = ''
  }

  async function openRecord(r: RecentFileRecord) {
    const key = recentKeyOf(r.fileName, r.size)
    const cached = getCachedFile(key)
    if (cached) {
      void handleFile(cached)
      return
    }
    if (fsaaSupported) {
      try {
        const handle = await getHandle(key)
        if (handle) {
          const permission = await (
            handle as unknown as {
              requestPermission: (o: { mode: string }) => Promise<string>
            }
          ).requestPermission({ mode: 'read' })
          if (permission === 'granted') {
            const file = await handle.getFile()
            cacheRecentFile(key, file)
            void handleFile(file, handle)
            return
          }
        }
      } catch {
        // 回退到文件选择器
      }
    }
    inputRef.current?.click()
  }

  async function pickFileWithFsaa() {
    if (!fsaaSupported) {
      inputRef.current?.click()
      return
    }
    try {
      const [handle] = await (
        window as unknown as {
          showOpenFilePicker: (o: unknown) => Promise<FileSystemFileHandle[]>
        }
      ).showOpenFilePicker({
        types: [
          {
            description: '电子书',
            accept: {
              'application/epub+zip': ['.epub'],
              'application/pdf': ['.pdf'],
              'text/markdown': ['.md', '.markdown'],
            },
          },
        ],
        multiple: false,
      })
      const file = await handle.getFile()
      void handleFile(file, handle)
    } catch (e) {
      // 用户取消（AbortError）不回退；其他错误回退选择器
      if (e instanceof DOMException && e.name === 'AbortError') return
      inputRef.current?.click()
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">上传电子书</h2>
        <p className="text-sm text-muted-foreground">
          支持 EPUB、PDF 与 Markdown 格式，解析在本地完成后按需发送给 AI 服务。
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".epub,.pdf,.md,.markdown"
        className="hidden"
        onChange={onInputChange}
      />

      <div className="flex items-center gap-3">
        <Button disabled={busy} onClick={() => void pickFileWithFsaa()}>
          {busy ? '解析中…' : '选择文件'}
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => setRecentVisible((v) => !v)}
        >
          {recentVisible ? '收起最近文件' : '最近打开文件'}
        </Button>
        {book?.title ? (
          <span className="text-sm">
            {book.title}
            {book.author ? ` · ${book.author}` : ''}
          </span>
        ) : null}
      </div>

      {recentVisible ? (
        <div className="flex flex-col gap-2 rounded-md border border-border p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">最近打开文件</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {recentRecords.length}/{recentLimit} 条
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={!recentRecords.length}
                onClick={clearRecent}
              >
                清空
              </Button>
            </div>
          </div>
          {recentRecords.length === 0 ? (
            <p className="text-xs text-muted-foreground">暂无记录</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {recentRecords.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-2 py-2"
                >
                  <div className="min-w-0">
                    <button
                      type="button"
                      title={r.fileName}
                      className="block w-full cursor-pointer truncate text-left text-sm hover:underline disabled:pointer-events-none disabled:opacity-50"
                      disabled={busy}
                      onClick={() => void openRecord(r)}
                    >
                      {stripExtension(r.fileName)}
                    </button>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatLabel(r.format)} · {formatSize(r.size)} ·{' '}
                      {formatTime(r.openedAt)} · {r.fileName}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void openRecord(r)}
                    >
                      打开
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeRecent(r.id)}
                    >
                      移除
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            同一标签页内点击文件名或「打开」会直接重新打开该文件；刷新或重启浏览器后，需重新选择同一文件，将自动恢复上次阅读位置。
          </p>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </section>
  )
}