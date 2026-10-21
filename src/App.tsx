import { useState } from 'react'
import { useSettingsStore } from '@/stores/settings-store'
import { useBookStore } from '@/stores/book-store'
import { useReaderStore } from '@/stores/reader-store'
import { cn } from '@/lib/utils'
import { ConfigDialog } from '@/components/config/ConfigDialog'
import { BookUploader } from '@/components/upload/BookUploader'
import { ChapterList } from '@/components/chapters/ChapterList'
import { BookContent } from '@/components/content/BookContent'
import ProcessingPanel from '@/components/processing/ProcessingPanel'
import ResultView from '@/components/results/ResultView'
import PromptManager from '@/components/prompts/PromptManager'
import { Button } from '@/components/ui/button'

type Tab = 'read' | 'prompts'

export default function App() {
  const [tab, setTab] = useState<Tab>('read')
  const [configOpen, setConfigOpen] = useState(false)
  const configured = useSettingsStore((s) => s.isConfigured())
  const chapters = useBookStore((s) => s.chapters)
  const outlineVisible = useReaderStore((s) => s.outlineVisible)
  const setOutlineVisible = useReaderStore((s) => s.setOutlineVisible)

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">AI Read</h1>
          <span className="text-xs text-muted-foreground">
            智能电子书解析
          </span>
        </div>
        <nav className="flex items-center gap-2">
          <Button
            variant={tab === 'read' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setTab('read')}
          >
            阅读
          </Button>
          <Button
            variant={tab === 'prompts' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setTab('prompts')}
          >
            自定义提示词
          </Button>
          <Button size="sm" onClick={() => setConfigOpen(true)}>
            配置{configured ? '' : ' *'}
          </Button>
        </nav>
      </header>

      <main className="flex-1 p-4 max-w-7xl w-full mx-auto">
        {tab === 'prompts' ? (
          <PromptManager />
        ) : (
          <div className="flex flex-col gap-4">
            <BookUploader />
            {chapters.length > 0 && (
              <>
                <div
                  className={cn(
                    'grid gap-4',
                    outlineVisible
                      ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_360px]'
                      : 'lg:grid-cols-[40px_minmax(0,1fr)_360px]',
                  )}
                >
                  {outlineVisible ? (
                    <div className="h-[560px] lg:h-[640px]">
                      <ChapterList />
                    </div>
                  ) : (
                    <div className="hidden h-[560px] items-center justify-center lg:flex lg:h-[640px]">
                      <button
                        type="button"
                        onClick={() => setOutlineVisible(true)}
                        title="展开章节列"
                        className="rounded-md border border-border px-1.5 py-3 text-sm text-muted-foreground hover:bg-muted"
                      >
                        <span
                          style={{ writingMode: 'vertical-rl' }}
                          className="tracking-widest"
                        >
                          章节
                        </span>
                      </button>
                    </div>
                  )}
                  <div className="h-[560px] lg:h-[640px]">
                    <BookContent />
                  </div>
                  <div className="flex h-[560px] flex-col gap-4 lg:h-[640px]">
                    <div className="h-[300px] shrink-0 lg:h-[320px]">
                      <ProcessingPanel />
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto">
                      <ResultView />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>

      <ConfigDialog open={configOpen} onOpenChange={setConfigOpen} />
    </div>
  )
}