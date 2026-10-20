import { useRef, useState } from 'react'
import { useBookStore } from '@/stores/book-store'
import { Button } from '@/components/ui/button'
import { parseEpub } from '@/services/epub'
import { parsePdf } from '@/services/pdf'
import type { BookFormat } from '@/types'

function detectFormat(fileName: string): BookFormat | null {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.epub')) return 'epub'
  if (lower.endsWith('.pdf')) return 'pdf'
  return null
}

export function BookUploader() {
  const inputRef = useRef<HTMLInputElement>(null)
  const book = useBookStore((s) => s.book)
  const setBook = useBookStore((s) => s.setBook)
  const setBookData = useBookStore((s) => s.setBookData)
  const setChapters = useBookStore((s) => s.setChapters)
  const reset = useBookStore((s) => s.reset)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    const format = detectFormat(file.name)
    if (!format) {
      setError('仅支持 .epub 或 .pdf 文件')
      return
    }
    setBusy(true)
    setError(null)
    reset()
    try {
      const data = await file.arrayBuffer()
      const parsed = format === 'epub' ? await parseEpub(data) : await parsePdf(data)
      setBook({
        id: Math.random().toString(36).slice(2, 10),
        fileName: file.name,
        format,
        title: parsed.title ?? undefined,
        author: parsed.author ?? undefined,
        cover: 'cover' in parsed ? parsed.cover : undefined,
      })
      setBookData(data.slice(0))
      setChapters(parsed.chapters)
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

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">上传电子书</h2>
        <p className="text-sm text-muted-foreground">
          支持 EPUB 与 PDF 格式，解析在本地完成后按需发送给 AI 服务。
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".epub,.pdf"
        className="hidden"
        onChange={onInputChange}
      />

      <div className="flex items-center gap-3">
        <Button disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? '解析中…' : '选择文件'}
        </Button>
        {book?.title ? (
          <span className="text-sm">
            {book.title}
            {book.author ? ` · ${book.author}` : ''}
          </span>
        ) : null}
      </div>

      {book?.cover ? (
        <img src={book.cover} alt="封面" className="h-40 w-auto rounded-md border" />
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </section>
  )
}