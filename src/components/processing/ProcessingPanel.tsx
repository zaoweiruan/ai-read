import { useRef, useState } from 'react';
import { resolveProvider } from '@/services/ai';
import { chatJson } from '@/services/ai/chatJson';
import {
  SYSTEM_PROMPT,
  bookGuideV1,
  chapterSummaryV1,
  mindMapMergeV1,
  mindMapV1,
} from '@/prompts';
import { getChapterContent } from '@/services/epub';
import { getPageText, getPdfDocument } from '@/services/pdf';
import { useBookStore } from '@/stores/book-store';
import { usePromptStore } from '@/stores/prompt-store';
import { useSettingsStore } from '@/stores/settings-store';
import type {
  AdvancedOptions,
  ChapterSummaryCard,
  MindMapNode,
  ProcessingMode,
} from '@/types';
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

interface ChapterCardJson {
  chapter_title?: string;
  core_question?: string;
  thesis?: string;
  key_points?: { point?: string; evidence?: string; location?: string }[];
  terms?: { term?: string; explanation?: string }[];
  connections?: string;
}

interface RawMindNode {
  label?: string;
  topic?: string;
  title?: string;
  children?: RawMindNode[];
}

function makeNode(id: string, topic: string, children?: MindMapNode[]): MindMapNode {
  return children && children.length > 0 ? { id, topic, children } : { id, topic };
}

function cardFromJson(
  chapterId: string,
  chapterTitle: string,
  json: ChapterCardJson,
): ChapterSummaryCard {
  const title = typeof json.chapter_title === 'string' ? json.chapter_title.trim() : '';
  return {
    chapterId,
    chapterTitle: title || chapterTitle,
    coreQuestion: typeof json.core_question === 'string' ? json.core_question : '',
    thesis: typeof json.thesis === 'string' ? json.thesis.trim() : '',
    keyPoints: (Array.isArray(json.key_points) ? json.key_points : []).map((k) => ({
      point: k?.point ?? '',
      evidence: k?.evidence ?? '',
      location: k?.location ?? '',
    })),
    terms: (Array.isArray(json.terms) ? json.terms : []).map((t) => ({
      term: t?.term ?? '',
      explanation: t?.explanation ?? '',
    })),
    connections: typeof json.connections === 'string' ? json.connections : '',
  };
}

function cardToText(card: ChapterSummaryCard): string {
  const lines: string[] = [];
  if (card.thesis) lines.push(card.thesis);
  if (card.coreQuestion) lines.push(`核心问题：${card.coreQuestion}`);
  for (const k of card.keyPoints) {
    if (!k.point) continue;
    lines.push(k.evidence ? `- ${k.point}（${k.evidence}）` : `- ${k.point}`);
  }
  if (card.connections) lines.push(`关联：${card.connections}`);
  return lines.join('\n');
}

function mindDepth(node: RawMindNode): number {
  const children = node.children ?? [];
  if (children.length === 0) return 1;
  return 1 + Math.max(...children.map(mindDepth));
}

function mindMaxWidth(node: RawMindNode): number {
  const children = node.children ?? [];
  if (children.length === 0) return 1;
  return Math.max(children.length, ...children.map(mindMaxWidth));
}

function validateMind(raw: RawMindNode): string | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return '导图 JSON 结构无效';
  }
  const depth = mindDepth(raw);
  if (depth > 4) return `层级 ${depth} 超过上限 4`;
  const width = mindMaxWidth(raw);
  if (width > 7) return `单层节点 ${width} 超过上限 7`;
  return null;
}

function mapMind(raw: RawMindNode, id: string): MindMapNode {
  const label = (raw.label ?? raw.topic ?? raw.title ?? '').trim() || '主题';
  const topic = label.length > 18 ? `${label.slice(0, 18)}…` : label;
  const children = (raw.children ?? []).map((c, i) => mapMind(c, `${id}.${i}`));
  return makeNode(id, topic, children);
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
      const systemMessage = { role: 'system' as const, content: SYSTEM_PROMPT };
      const customActive = mode === 'summary' && Boolean(activePrompt && onlyCustom);

      if (mode === 'summary') {
        const chapterSummaries: Record<string, string> = {};
        const cards: ChapterSummaryCard[] = [];
        for (let i = 0; i < selected.length; i += 1) {
          const chapter = selected[i];
          setProgress({
            completed: i,
            currentStep: `总结章节：${chapter.title}`,
            status: 'running',
          });
          const content = await buildContent(chapter.id);
          if (customActive && activePrompt) {
            const reply = await ai.chat(
              [
                { role: 'system' as const, content: activePrompt.content },
                {
                  role: 'user' as const,
                  content: `章节标题：${chapter.title}\n\n正文：\n${content}`,
                },
              ],
              { signal: controller.signal },
            );
            chapterSummaries[chapter.id] = reply.trim();
          } else {
            const json = await chatJson<ChapterCardJson>(
              ai,
              [
                systemMessage,
                {
                  role: 'user' as const,
                  content: chapterSummaryV1.buildUser({
                    chapterTitle: chapter.title,
                    chapterContext: content,
                  }),
                },
              ],
              {
                temperature: chapterSummaryV1.temperature,
                signal: controller.signal,
                label: '章节摘要',
                validate: (v) => {
                  if (!v || typeof v !== 'object') return '缺少 JSON 对象';
                  if (typeof v.thesis !== 'string' || !v.thesis.trim()) {
                    return '缺少 thesis 字段';
                  }
                  if (!Array.isArray(v.key_points) || v.key_points.length < 1) {
                    return 'key_points 无效';
                  }
                  return null;
                },
              },
            );
            const card = cardFromJson(chapter.id, chapter.title, json);
            cards.push(card);
            chapterSummaries[chapter.id] = cardToText(card);
          }
        }
        setProgress({
          completed: selected.length,
          currentStep: '生成章节关系与全书导读',
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
        const guide = await ai.chat(
          [
            systemMessage,
            {
              role: 'user' as const,
              content: bookGuideV1.buildUser({
                bookTitle: book?.title ?? '未知',
                bookContext: digest,
              }),
            },
          ],
          { temperature: bookGuideV1.temperature, signal: controller.signal },
        );
        const guideText = guide.trim();
        setSummary({
          chapterSummaries,
          chapterRelations: relations.trim(),
          bookSummary: guideText,
          guide: guideText,
          cards,
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
          try {
            const raw = await chatJson<RawMindNode>(
              ai,
              [
                systemMessage,
                {
                  role: 'user' as const,
                  content: mindMapV1.buildUser({
                    title: chapter.title,
                    bookContext: content,
                  }),
                },
              ],
              {
                temperature: mindMapV1.temperature,
                signal: controller.signal,
                label: '思维导图',
                validate: validateMind,
              },
            );
            const node = mapMind(raw, chapter.id);
            node.topic = (raw.title ?? '').trim() || chapter.title;
            roots.push(node);
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            roots.push({
              id: chapter.id,
              topic: chapter.title,
              detail: message.slice(0, 200) || undefined,
            });
          }
        }
        setMindMap({ roots });
      } else {
        const chapterMaps: string[] = [];
        for (let i = 0; i < selected.length; i += 1) {
          const chapter = selected[i];
          setProgress({
            completed: i,
            currentStep: `逐章导图：${chapter.title}`,
            status: 'running',
          });
          const content = await buildContent(chapter.id);
          try {
            const raw = await chatJson<RawMindNode>(
              ai,
              [
                systemMessage,
                {
                  role: 'user' as const,
                  content: mindMapV1.buildUser({
                    title: chapter.title,
                    bookContext: content,
                  }),
                },
              ],
              {
                temperature: mindMapV1.temperature,
                signal: controller.signal,
                label: '思维导图',
                validate: validateMind,
              },
            );
            chapterMaps.push(`## ${chapter.title}\n${JSON.stringify(raw)}`);
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            chapterMaps.push(`## ${chapter.title}\n（该章导图生成失败：${message.slice(0, 120)}）`);
          }
        }
        setProgress({
          completed: selected.length,
          currentStep: '合并全书导图',
          status: 'running',
        });
        const merged = await chatJson<RawMindNode>(
          ai,
          [
            systemMessage,
            {
              role: 'user' as const,
              content: mindMapMergeV1.buildUser({
                chapterMaps: chapterMaps.join('\n\n'),
              }),
            },
          ],
          {
            temperature: mindMapMergeV1.temperature,
            signal: controller.signal,
            label: '导图合并',
            validate: validateMind,
          },
        );
        const root = mapMind(merged, 'book-root');
        root.topic = (merged.title ?? '').trim() || book?.title || '全书';
        setMindMap({ roots: [root] });
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
            onChange={(e) => setOptions({ ...options, subchapterDepth: Number(e.target.value) })}
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
