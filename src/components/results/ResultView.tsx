import { useEffect, useRef, useState } from 'react';
import type { MindMapNode, MindMapResult, SummaryResult } from '@/types';
import { useBookStore } from '@/stores/book-store';
import { Badge } from '@/components/ui/badge';

type ResultPayload = {
  summary?: SummaryResult | null;
  mindMap?: MindMapResult | null;
};

declare global {
  interface Window {
    __aiReadResult?: ResultPayload;
  }
}

function readResult(): ResultPayload {
  return window.__aiReadResult ?? {};
}

export function publishResult(payload: ResultPayload) {
  window.__aiReadResult = payload;
}

export default function ResultView({
  summary,
  mindMap,
}: {
  summary?: SummaryResult | null;
  mindMap?: MindMapResult | null;
}) {
  const [tab, setTab] = useState<'summary' | 'mindmap'>('summary');
  const book = useBookStore((s) => s.book);
  const storeSummary = useBookStore((s) => s.summary);
  const storeMindMap = useBookStore((s) => s.mindMap);
  const resolvedSummary = summary ?? storeSummary ?? readResult().summary ?? null;
  const resolvedMindMap = mindMap ?? storeMindMap ?? readResult().mindMap ?? null;

  useEffect(() => {
    if (!resolvedSummary && resolvedMindMap) setTab('mindmap');
  }, [resolvedSummary, resolvedMindMap]);

  if (!resolvedSummary && !resolvedMindMap) {
    return (
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">结果</h2>
        <p className="text-sm text-muted-foreground">处理完成后将在此展示总结与思维导图。</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">结果</h2>
        <div className="flex gap-1">
          {resolvedSummary ? (
            <button
              type="button"
              className={
                tab === 'summary'
                  ? 'rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground'
                  : 'rounded-md px-3 py-1 text-sm text-muted-foreground'
              }
              onClick={() => setTab('summary')}
            >
              文字总结
            </button>
          ) : null}
          {resolvedMindMap ? (
            <button
              type="button"
              className={
                tab === 'mindmap'
                  ? 'rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground'
                  : 'rounded-md px-3 py-1 text-sm text-muted-foreground'
              }
              onClick={() => setTab('mindmap')}
            >
              思维导图
            </button>
          ) : null}
        </div>
      </div>

      {tab === 'summary' && resolvedSummary ? (
        <SummaryPanel result={resolvedSummary} />
      ) : null}
      {tab === 'mindmap' && resolvedMindMap ? (
        <MindMapPanel result={resolvedMindMap} title={book?.title ?? '思维导图'} />
      ) : null}
    </section>
  );
}

function SummaryPanel({ result }: { result: SummaryResult }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const chapters = useBookStore((s) => s.chapters);
  const titleOf = (id: string) => chapters.find((c) => c.id === id)?.title ?? id;
  const entries = Object.entries(result.chapterSummaries);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border p-4">
        <div className="mb-1 flex items-center gap-2">
          <h3 className="font-semibold">全书总结</h3>
          <Badge>book</Badge>
        </div>
        <p className="whitespace-pre-wrap text-sm">{result.bookSummary}</p>
      </div>
      <div className="rounded-lg border border-border p-4">
        <div className="mb-1 flex items-center gap-2">
          <h3 className="font-semibold">章节关系</h3>
          <Badge>relations</Badge>
        </div>
        <p className="whitespace-pre-wrap text-sm">{result.chapterRelations}</p>
      </div>
      <div className="rounded-lg border border-border">
        <div className="border-b border-border px-4 py-2">
          <h3 className="font-semibold">章节摘要（{entries.length}）</h3>
        </div>
        <ul>
          {entries.map(([id, text]) => (
            <li key={id} className="border-b border-border last:border-b-0">
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-muted/50"
                onClick={() => setOpenId(openId === id ? null : id)}
              >
                  <span className="truncate">{titleOf(id)}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {openId === id ? '收起' : '展开'}
                </span>
              </button>
              {openId === id ? (
                <p className="whitespace-pre-wrap px-4 pb-3 text-sm text-muted-foreground">{text}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

type MindElixirInstance = {
  init: (data: { nodeData: MindMapNode; direction?: number }) => Promise<Error | undefined>;
  scaleFit: () => void;
  destroy: () => void;
};

type MindElixirCtor = new (opts: {
  el: HTMLElement;
  direction?: number;
  editable?: boolean;
  toolBar?: boolean;
  contextMenu?: boolean;
  keypress?: boolean;
  overflowHidden?: boolean;
}) => MindElixirInstance;

function normalizeNodes(roots: MindMapNode[], fallbackTitle: string): MindMapNode {
  let seq = 0;
  const walk = (node: MindMapNode, prefix: string): MindMapNode => {
    const id = node.id?.trim() ? node.id : `node-${prefix}-${seq}`;
    seq += 1;
    const copy: MindMapNode = { ...node, id };
    if (node.children?.length) {
      copy.children = node.children.map((child, i) => walk(child, `${id}.${i}`));
    }
    return copy;
  };
  const single = roots.length === 1 ? roots[0] : null;
  if (single) return walk(single, 'root');
  return {
    id: 'root',
    topic: fallbackTitle,
    children: roots.map((root, i) => walk(root, `root.${i}`)),
  };
}

function MindMapPanel({ result, title }: { result: MindMapResult; title: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let disposed = false;
    let instance: MindElixirInstance | null = null;
    setStatus('loading');
    Promise.all([import('mind-elixir'), import('mind-elixir/style.css')])
      .then(([mod]) => {
        if (disposed || !containerRef.current) return undefined;
        const Ctor = ((mod as { default?: unknown }).default ?? mod) as MindElixirCtor;
        const inst = new Ctor({
          el: containerRef.current,
          direction: 1,
          editable: false,
          toolBar: true,
          contextMenu: false,
          keypress: false,
          overflowHidden: true,
        });
        instance = inst;
        return inst.init({
          nodeData: normalizeNodes(result.roots, title),
          direction: 1,
        });
      })
      .then((initError) => {
        if (disposed) return;
        if (initError) {
          setStatus('error');
          setMessage(initError.message || '思维导图初始化失败');
          return;
        }
        requestAnimationFrame(() => {
          if (disposed) return;
          instance?.scaleFit();
          setStatus('ready');
        });
      })
      .catch((e: unknown) => {
        if (disposed) return;
        setStatus('error');
        setMessage(e instanceof Error ? e.message : String(e));
      });
    return () => {
      disposed = true;
      try {
        instance?.destroy();
      } catch {
        // 忽略销毁异常
      }
    };
  }, [result, title, version]);

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="relative h-[28rem] overflow-hidden rounded-lg border border-border"
      >
        {status === 'error' ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4">
            <p className="text-sm text-red-600">思维导图渲染失败：{message}</p>
            <button
              type="button"
              className="rounded-md border border-border px-3 py-1 text-sm"
              onClick={() => setVersion((v) => v + 1)}
            >
              重试
            </button>
          </div>
        ) : null}
      </div>
      {status === 'error' ? (
        <details>
          <summary className="cursor-pointer text-sm text-muted-foreground">节点数据</summary>
          <pre className="mt-2 max-h-64 overflow-auto text-xs">
            {JSON.stringify(result, null, 2)}
          </pre>
        </details>
      ) : null}
      <p className="text-xs text-muted-foreground">
        {status === 'loading' ? '正在加载 mind-elixir…' : '可缩放 / 拖拽 / 展开折叠'}
      </p>
    </div>
  );
}
