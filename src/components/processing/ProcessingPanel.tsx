import { useRef, useState } from 'react';
import { resolveProvider } from '@/services/ai';
import { getChapterContent } from '@/services/epub';
import { getPageText, getPdfDocument } from '@/services/pdf';
import { useBookStore } from '@/stores/book-store';
import { usePromptStore } from '@/stores/prompt-store';
import { useSettingsStore } from '@/stores/settings-store';
import type { AdvancedOptions, MindMapNode, ProcessingMode } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

const MODES: { value: ProcessingMode; label: string }[] = [
  { value: 'summary', label: '文字总结模式' },
  { value: 'chapter-mindmap', label: '章节思维导图模式' },
  { value: 'book-mindmap', label: '整书思维导图模式' },
];

const DEFAULT_OPTIONS: AdvancedOptions = {
  smartChapterDetection: false,
  skipIrrelevantChapters: false,
  subchapterDepth: 1,
};

function safeJson<T>(text: string): T | null {
  let candidate = text.trim();
  const fenced = candidate.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    candidate = fenced[1].trim();
  } else {
    candidate = candidate.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  }
  const cleaned = candidate.replace(/,\s*([}\]])/g, '$1');
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function makeNode(id: string, topic: string, children?: MindMapNode[]): MindMapNode {
  return children && children.length > 0 ? { id, topic, children } : { id, topic };
}

export default function ProcessingPanel() {
  const book = useBookStore((s) => s.book);
  const bookData = useBookStore((s) => s.bookData);
  const chapters = useBookStore((s) => s.chapters);
  const selectedChapterIds = useBookStore((s) => s.selectedChapterIds);
  const progress = useBookStore((s) => s.progress);
  const setProgress = useBookStore((s) => s.setProgress);
  const setSummary = useBookStore((s) => s.setSummary);
  const setMindMap = useBookStore((s) => s.setMindMap);

  const providers = useSettingsStore((s) => s.providers);
  const activeProviderId = useSettingsStore((s) => s.activeProviderId);
  const getActiveProvider = useSettingsStore((s) => s.getActiveProvider);
  const isConfigured = useSettingsStore((s) => s.isConfigured);

  const activePromptId = usePromptStore((s) => s.activePromptId);
  const prompts = usePromptStore((s) => s.prompts);
  const onlyCustom = usePromptStore((s) => s.onlyCustom);

  const [mode, setMode] = useState<ProcessingMode>('summary');
  const [options, setOptions] = useState<AdvancedOptions>(DEFAULT_OPTIONS);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  const abortRef = useRef<AbortController | null>(null);

  const selected = chapters.filter((c) => selectedChapterIds.includes(c.id));
  const provider = getActiveProvider();

  async function buildContent(chapterId: string): Promise<string> {
    const chapter = chapters.find((c) => c.id === chapterId);
    if (!chapter || !bookData) return '';
    if (book?.format === 'epub') {
      return getChapterContent(bookData, chapter).catch((e: unknown) => {
        console.warn('章节正文加载失败', chapter.title, e);
        return '';
      });
    }
    const doc = await getPdfDocument(bookData);
    const from = chapter.startPage ?? 1;
    const to = chapter.endPage ?? from;
    const parts: string[] = [];
    for (let page = from; page <= to; page += 1) {
      parts.push(await getPageText(doc, page));
    }
    return parts.join('\n');
  }

  async function run() {
    setError('');
    setSummary(null);
    setMindMap(null);
    if (!isConfigured() || !provider) {
      setError('请先在「配置」中完成 AI 服务设置。');
      return;
    }
    if (!bookData) {
      setError('电子书数据未驻留，请重新上传文件。');
      return;
    }
    if (selected.length === 0) {
      setError('请先选择至少一个章节。');
      return;
    }
    const activePrompt = prompts.find((p) => p.id === activePromptId);
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setProgress({
      total: selected.length,
      completed: 0,
      currentStep: '准备中',
      status: 'running',
    });
    try {
      const ai = resolveProvider({ kind: provider.kind, settings: provider });
      const systemText =
        mode === 'summary' && activePrompt && onlyCustom ? activePrompt.content : null;

      if (mode === 'summary') {
        const chapterSummaries: Record<string, string> = {};
        for (let i = 0; i < selected.length; i += 1) {
          const chapter = selected[i];
          setProgress({
            completed: i,
            currentStep: `总结章节：${chapter.title}`,
            status: 'running',
          });
          const content = await buildContent(chapter.id);
          const userText = activePrompt
            ? `${activePrompt.content}\n\n章节标题：${chapter.title}\n\n正文：\n${content}`
            : `请为以下章节生成中文摘要（200字以内），只输出摘要正文：\n\n章节标题：${chapter.title}\n\n正文：\n${content}`;
          const reply = await ai.chat(
            [
              ...(systemText
                ? [{ role: 'system' as const, content: systemText }]
                : [
                    {
                      role: 'system' as const,
                      content:
                        '你是专业的电子书阅读助手，负责输出准确、简洁的中文总结。只输出要求的内容，不要多余说明。',
                    },
                  ]),
              { role: 'user' as const, content: userText },
            ],
            { signal: controller.signal },
          );
          chapterSummaries[chapter.id] = reply.trim();
        }
        setProgress({
          completed: selected.length,
          currentStep: '生成章节关系与全书总结',
          status: 'running',
        });
        const digest = selected
          .map((c) => `- ${c.title}：${chapterSummaries[c.id] ?? ''}`)
          .join('\n');
        const relations = await ai.chat(
          [
            {
              role: 'system' as const,
              content: '你是电子书结构分析助手，只输出章节关系的中文要点列表（markdown 列表）。',
            },
            {
              role: 'user' as const,
              content: `请概括以下章节之间的关系（承接、对比、递进等），只输出 markdown 列表：\n${digest}`,
            },
          ],
          { signal: controller.signal },
        );
        const bookSummary = await ai.chat(
          [
            {
              role: 'system' as const,
              content: '你是电子书总结助手，只输出全书总结正文（400字以内，中文）。',
            },
            {
              role: 'user' as const,
              content: `书名：${book?.title ?? '未知'}\n\n各章节摘要：\n${digest}`,
            },
          ],
          { signal: controller.signal },
        );
        setSummary({
          chapterSummaries,
          chapterRelations: relations.trim(),
          bookSummary: bookSummary.trim(),
        });
      } else if (mode === 'chapter-mindmap') {
        const roots: MindMapNode[] = [];
        for (let i = 0; i < selected.length; i += 1) {
          const chapter = selected[i];
          setProgress({
            completed: i,
            currentStep: `生成导图：${chapter.title}`,
            status: 'running',
          });
          const content = await buildContent(chapter.id);
          const reply = await ai.chat(
            [
              {
                role: 'system' as const,
                content:
                  '你是思维导图生成助手。只输出 JSON：{"topic":string,"children":[{"topic":string,"children":[...]}]}，topic 为简短中文短语，层级不超过 4，不要输出 JSON 之外的任何文字。',
              },
              {
                role: 'user' as const,
                content: `章节标题：${chapter.title}\n\n正文：\n${content}`,
              },
            ],
            { signal: controller.signal },
          );
          const parsed = safeJson<MindMapNode>(reply);
          if (parsed && parsed.topic) {
            roots.push(
              makeNode(
                chapter.id,
                parsed.topic.trim() || chapter.title,
                parsed.children?.length ? parsed.children : undefined,
              ),
            );
          } else {
            roots.push({
              id: chapter.id,
              topic: chapter.title,
              detail: reply.trim().slice(0, 200) || undefined,
            });
          }
        }
        setMindMap({ roots });
      } else {
        setProgress({
          completed: 0,
          currentStep: '汇总全书章节',
          status: 'running',
        });
        const digestParts: string[] = [];
        for (let i = 0; i < selected.length; i += 1) {
          const chapter = selected[i];
          setProgress({
            completed: i,
            currentStep: `汇总章节：${chapter.title}`,
            status: 'running',
          });
          const content = await buildContent(chapter.id);
          digestParts.push(`## ${chapter.title}\n${content.slice(0, 3000)}`);
        }
        const reply = await ai.chat(
          [
            {
              role: 'system' as const,
              content:
                '你是整书思维导图生成助手。只输出 JSON：{"topic":string,"children":[{"topic":string,"children":[...]}]}，topic 为简短中文短语，层级不超过 5，不要输出 JSON 之外的任何文字。',
            },
            {
              role: 'user' as const,
              content: `书名：${book?.title ?? '未知'}\n\n章节内容摘要：\n${digestParts.join('\n\n')}`,
            },
          ],
          { signal: controller.signal },
        );
        const parsed = safeJson<MindMapNode>(reply);
        const rootTopic = parsed?.topic?.trim() || book?.title || '全书';
        const rootChildren: MindMapNode[] | undefined = parsed?.children?.length
          ? parsed.children
          : undefined;
        setMindMap({ roots: [makeNode('book-root', rootTopic, rootChildren)] });
      }
      setProgress({
        completed: selected.length,
        currentStep: '完成',
        status: 'done',
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (controller.signal.aborted) {
        setProgress({ currentStep: '已暂停', status: 'paused' });
      } else {
        setError(message);
        setProgress({ currentStep: message, status: 'error', error: message });
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  function pause() {
    abortRef.current?.abort();
  }

  const percent =
    progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

  return (
    <section className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto rounded-lg border border-border p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">处理</h2>
        <Badge>{book?.format.toUpperCase() ?? ''}</Badge>
      </div>

      <div className="flex flex-col gap-2">
        {MODES.map((m) => (
          <label
            key={m.value}
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm',
              mode === m.value && 'border-primary bg-primary/5',
            )}
          >
            <input
              type="radio"
              name="mode"
              value={m.value}
              checked={mode === m.value}
              onChange={() => setMode(m.value)}
            />
            {m.label}
          </label>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-2 text-sm">
          服务
          <select
            className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-sm"
            value={activeProviderId ?? provider?.id ?? ''}
            onChange={(e) => useSettingsStore.getState().setActiveProvider(e.target.value)}
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={options.smartChapterDetection}
            onChange={(e) =>
              setOptions({ ...options, smartChapterDetection: e.target.checked })
            }
          />
          智能章节检测
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={options.skipIrrelevantChapters}
            onChange={(e) =>
              setOptions({ ...options, skipIrrelevantChapters: e.target.checked })
            }
          />
          跳过无关章节
        </label>
        <label className="flex items-center gap-2 text-sm">
          子章节深度
          <select
            className="h-8 rounded-md border border-border bg-background px-2 text-sm"
            value={options.subchapterDepth}
            onChange={(e) =>
              setOptions({ ...options, subchapterDepth: Number(e.target.value) })
            }
          >
            <option value={0}>0</option>
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </label>
      </div>

      <div className="mt-auto flex flex-col gap-2 border-t border-border pt-3">
        {!running ? (
          <Button onClick={() => void run()}>开始处理（{selected.length} 章）</Button>
        ) : (
          <Button variant="destructive" onClick={pause}>
            暂停
          </Button>
        )}
        {progress.status === 'running' || progress.status === 'paused' ? (
          <span className="truncate text-xs text-muted-foreground">
            {progress.completed}/{progress.total} {progress.currentStep}
          </span>
        ) : null}
        <Progress value={percent} />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    </section>
  );
}

