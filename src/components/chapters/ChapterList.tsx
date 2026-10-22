import { useEffect, useState } from 'react'
import { useBookStore } from '@/stores/book-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export function ChapterList() {
  const chapters = useBookStore((s) => s.chapters)
  const selectedChapterIds = useBookStore((s) => s.selectedChapterIds)
  const activeChapterId = useBookStore((s) => s.activeChapterId)
  const setActiveChapterId = useBookStore((s) => s.setActiveChapterId)
  const groups = useBookStore((s) => s.groups)
  const toggleChapter = useBookStore((s) => s.toggleChapter)
  const selectAllChapters = useBookStore((s) => s.selectAllChapters)
  const clearSelection = useBookStore((s) => s.clearSelection)
  const addGroup = useBookStore((s) => s.addGroup)
  const removeGroup = useBookStore((s) => s.removeGroup)

  const [groupOpen, setGroupOpen] = useState(false)
  const [groupName, setGroupName] = useState('')

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault()
        if (selectedChapterIds.length > 0) setGroupOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedChapterIds])

  function confirmGroup() {
    const name = groupName.trim()
    if (!name || selectedChapterIds.length === 0) return
    addGroup({
      id: Math.random().toString(36).slice(2, 10),
      name,
      chapterIds: [...selectedChapterIds],
    })
    setGroupOpen(false)
    setGroupName('')
  }

  return (
    <section className="flex h-full min-h-0 flex-col gap-3 rounded-lg border border-border p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">章节选择</h2>
        <div className="flex items-center gap-2">
          <Badge>{selectedChapterIds.length} / {chapters.length}</Badge>
          <Button size="sm" variant="outline" onClick={selectAllChapters}>
            全选
          </Button>
          <Button size="sm" variant="outline" onClick={clearSelection}>
            清空
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={selectedChapterIds.length === 0}
            onClick={() => setGroupOpen(true)}
          >
            分组 (Ctrl+G)
          </Button>
        </div>
      </div>

      <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1">
        {chapters.length === 0 ? (
          <li className="px-2 py-1 text-sm text-muted-foreground">
            尚未加载书籍章节。
          </li>
        ) : null}
        {chapters.map((c) => {
          const checked = selectedChapterIds.includes(c.id)
          const isActive = activeChapterId === c.id
          const group = groups.find((g) => g.chapterIds.includes(c.id))
          return (
            <li
              key={c.id}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-md px-2 py-1',
                isActive ? 'bg-primary/10' : 'hover:bg-muted',
              )}
              style={{ paddingLeft: `${c.level * 16 + 8}px` }}
            >
              <input
                type="checkbox"
                className="shrink-0"
                checked={checked}
                onChange={() => toggleChapter(c.id)}
                aria-label={`选择章节：${c.title}`}
              />
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left text-sm hover:underline"
                title="点击查看该章内容"
                onClick={() => setActiveChapterId(c.id)}
              >
                {c.title}
              </button>
              {group ? <Badge>{group.name}</Badge> : null}
            </li>
          )
        })}
      </ul>

      {groups.length > 0 ? (
        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          {groups.map((g) => (
            <span
              key={g.id}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
            >
              {g.name}
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => removeGroup(g.id)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <Dialog
        open={groupOpen}
        onClose={() => setGroupOpen(false)}
        title="创建分组"
      >
        <div className="flex flex-col gap-3">
          <Input
            value={groupName}
            placeholder="分组名称"
            onChange={(e) => setGroupName(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setGroupOpen(false)}>
              取消
            </Button>
            <Button size="sm" onClick={confirmGroup}>
              确定
            </Button>
          </div>
        </div>
      </Dialog>
    </section>
  )
}