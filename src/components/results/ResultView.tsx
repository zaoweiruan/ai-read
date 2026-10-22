import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { MindMapNode, MindMapResult, SummaryResult } from '@/types';
import { useBookStore } from '@/stores/book-store';
import { renderGuideMarkdown } from '@/lib/markdown';
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
  const activeMode = useBookStore((s) => s.activeMode);
  const storeSummary = useBookStore((s) => s.summary);
  const storeMindMap = useBookStore((s) => s.mindMap);
  const resolvedSummary = summary ?? storeSummary ?? readResult().summary ?? null;
  const resolvedMindMap = mindMap ?? storeMindMap ?? readResult().mindMap ?? null;

  useEffect(() => {
    if (activeMode === 'summary' && resolvedSummary) setTab('summary');
    else if (activeMode !== 'summary' && resolvedMindMap) setTab('mindmap');
  }, [activeMode, resolvedSummary, resolvedMindMap]);

  useEffect(() => {
    if (resolvedMindMap && !resolvedSummary) setTab('mindmap');
    else if (resolvedSummary && !resolvedMindMap) setTab('summary');
  }, [resolvedSummary, resolvedMindMap]);

  if (!resolvedSummary && !resolvedMindMap) {
    return (
      <section id="app-result" className="space-y-2">
        <h2 className="text-lg font-semibold">结果</h2>
        <p className="text-sm text-muted-foreground">处理完成后将在此展示总结与思维导图。</p>
      </section>
    );
  }

  return (
    <section id="app-result" className="space-y-4">
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

      {tab === 'summary' ? (
        resolvedSummary ? (
          <SummaryPanel result={resolvedSummary} />
        ) : (
          <p className="text-sm text-muted-foreground">暂无总结结果，完成处理后在此展示。</p>
        )
      ) : null}
      {tab === 'mindmap' ? (
        resolvedMindMap ? (
          <MindMapPanel result={resolvedMindMap} title={book?.title ?? '思维导图'} />
        ) : (
          <p className="text-sm text-muted-foreground">暂无导图结果，完成处理后在此展示。</p>
        )
      ) : null}
    </section>
  );
}

function SummaryPanel({ result }: { result: SummaryResult }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const chapters = useBookStore((s) => s.chapters);
  const titleOf = (id: string) => chapters.find((c) => c.id === id)?.title ?? id;
  const entries = Object.entries(result.chapterSummaries);
  const cards = result.cards ?? [];
  const jumpTo = (id: string) => useBookStore.getState().setActiveChapterId(id);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border p-4">
        <div className="mb-1 flex items-center gap-2">
          <h3 className="font-semibold">
            {result.guide
              ? Object.keys(result.chapterSummaries).length === 1
                ? '本章导读'
                : '全书导读'
              : '全书总结'}
          </h3>
          <Badge>{result.guide ? 'guide' : 'book'}</Badge>
        </div>
        {result.guide ? (
          <div className="space-y-1.5 text-sm">
            {renderGuideMarkdown(result.guide, chapters, jumpTo)}
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-sm">{result.bookSummary}</p>
        )}
      </div>
      {result.chapterRelations.trim() ? (
        <div className="rounded-lg border border-border p-4">
          <div className="mb-1 flex items-center gap-2">
            <h3 className="font-semibold">章节关系</h3>
            <Badge>relations</Badge>
          </div>
          <p className="whitespace-pre-wrap text-sm">{result.chapterRelations}</p>
        </div>
      ) : null}
      <div className="rounded-lg border border-border">
        <div className="border-b border-border px-4 py-2">
          <h3 className="font-semibold">
            章节摘要（{cards.length > 0 ? cards.length : entries.length}）
          </h3>
        </div>
        {cards.length > 0 ? (
          <ul>
            {cards.map((card) => (
              <li key={card.chapterId} className="border-b border-border last:border-b-0">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-muted/50"
                  onClick={() => setOpenId(openId === card.chapterId ? null : card.chapterId)}
                >
                  <span className="truncate">{card.chapterTitle}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {openId === card.chapterId ? '收起' : '展开'}
                  </span>
                </button>
                {openId === card.chapterId ? (
                  <div className="space-y-2 px-4 pb-3 text-sm">
                    {card.coreQuestion ? (
                      <p>
                        <span className="font-medium">核心问题：</span>
                        <span className="text-muted-foreground">{card.coreQuestion}</span>
                      </p>
                    ) : null}
                    {card.thesis ? (
                      <p>
                        <span className="font-medium">论点：</span>
                        {card.thesis}
                      </p>
                    ) : null}
                    {card.keyPoints.length > 0 ? (
                      <ul className="list-disc space-y-1 pl-5">
                        {card.keyPoints.map((k, i) => (
                          <li key={`${card.chapterId}-kp-${i}`}>
                            {k.point}
                            {k.evidence ? (
                              <span className="text-muted-foreground">（{k.evidence}）</span>
                            ) : null}
                            {k.location ? (
                              <span className="ml-1 text-xs text-muted-foreground">
                                @{k.location}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {card.terms.length > 0 ? (
                      <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
                        {card.terms.map((t, i) => (
                          <li key={`${card.chapterId}-tm-${i}`}>
                            <span className="font-medium text-foreground">{t.term}</span>
                            {t.explanation ? `：${t.explanation}` : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {card.connections ? (
                      <p className="text-muted-foreground">
                        <span className="font-medium text-foreground">关联：</span>
                        {card.connections}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
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
        )}
      </div>
    </div>
  );
}

type MindElixirInstance = {
  init: (data: { nodeData: MindMapNode; direction?: number }) => Promise<Error | undefined>;
  scaleFit: () => void;
  toCenter: () => void;
  destroy: () => void;
  viewportEl?: HTMLElement;
  scale: (scaleVal: number, offset?: { x: number; y: number }) => void;
  scaleVal: number;
  expandNode: (el: HTMLElement, isExpand?: boolean) => void;
  expandNodeAll: (el: HTMLElement, isExpand?: boolean) => void;
  move: (dx: number, dy: number, smooth?: boolean) => boolean;
  spacePressed: boolean;
  container: HTMLElement;
  map: HTMLElement;
  nodeData: { id: string; topic?: string };
  findEle: (id: string) => HTMLElement;
  bus: {
    addListener: (type: string, handler: () => void) => void;
    removeListener: (type: string, handler: () => void) => void;
    fire: (type: string, payload?: unknown) => void;
  };
};

type MindElixirCtor = new (opts: {
  el: HTMLElement;
  direction?: number;
  editable?: boolean;
  toolBar?: boolean;
  contextMenu?: boolean;
  keypress?: boolean;
  overflowHidden?: boolean;
  handleWheel?: (e: WheelEvent) => void;
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

type MiniRect = { x: number; y: number; w: number; h: number; root?: boolean };

type MiniState = { rects: MiniRect[]; view: MiniRect; vb: string };

function parseTranslate(transform: string): { x: number; y: number } {
  const m = transform.match(/translate(?:3d)?\(\s*(-?[\d.]+)px\s*,\s*(-?[\d.]+)px/);
  return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : { x: 0, y: 0 };
}

function parseOrigin(origin: string, width: number, height: number): { x: number; y: number } {
  const parts = origin.trim().split(/\s+/);
  const axis = (v: string | undefined, size: number): number => {
    if (!v) return 0;
    if (v.endsWith('%')) return (parseFloat(v) / 100) * size;
    return parseFloat(v) || 0;
  };
  return { x: axis(parts[0], width), y: axis(parts[1], height) };
}

function makeInverse(inst: MindElixirInstance): (screen: { x: number; y: number }) => { x: number; y: number } {
  const map = inst.map;
  const s = inst.scaleVal || 1;
  const t = parseTranslate(map.style.transform || '');
  const origin = parseOrigin(
    getComputedStyle(map).transformOrigin,
    map.offsetWidth,
    map.offsetHeight,
  );
  const off = { x: map.offsetLeft, y: map.offsetTop };
  return (screen) => ({
    x: origin.x + (screen.x - off.x - t.x - origin.x) / s,
    y: origin.y + (screen.y - off.y - t.y - origin.y) / s,
  });
}

function visibleSize(inst: MindElixirInstance): { width: number; height: number } {
  const host = inst.viewportEl ?? inst.container.parentElement ?? inst.container;
  const cw = inst.container.clientWidth || host.clientWidth;
  const ch = inst.container.clientHeight || host.clientHeight;
  const hw = host.clientWidth || cw;
  const hh = host.clientHeight || ch;
  return { width: Math.min(cw, hw), height: Math.min(ch, hh) };
}

function computeMini(inst: MindElixirInstance): MiniState | null {
  const inv = makeInverse(inst);
  const box = inst.container.getBoundingClientRect();
  const topics = Array.from(inst.container.querySelectorAll<HTMLElement>('.me-tpc'));
  if (topics.length === 0) return null;
  let rootEl: HTMLElement | null = null;
  try {
    rootEl = inst.findEle(inst.nodeData.id);
  } catch {
    rootEl = null;
  }
  const rects: MiniRect[] = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const tp of topics) {
    const r = tp.getBoundingClientRect();
    const a = inv({ x: r.left - box.left, y: r.top - box.top });
    const b = inv({ x: r.right - box.left, y: r.bottom - box.top });
    const rect: MiniRect = {
      x: a.x,
      y: a.y,
      w: Math.max(b.x - a.x, 1),
      h: Math.max(b.y - a.y, 1),
      root: rootEl !== null && tp === rootEl,
    };
    rects.push(rect);
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.w);
    maxY = Math.max(maxY, rect.y + rect.h);
  }
  const size = visibleSize(inst);
  const v0 = inv({ x: 0, y: 0 });
  const v1 = inv({ x: size.width, y: size.height });
  const view: MiniRect = { x: v0.x, y: v0.y, w: Math.max(v1.x - v0.x, 1), h: Math.max(v1.y - v0.y, 1) };
  const padX = (maxX - minX) * 0.1 || 10;
  const padY = (maxY - minY) * 0.1 || 10;
  return {
    rects,
    view,
    vb: `${minX - padX} ${minY - padY} ${maxX - minX + padX * 2} ${maxY - minY + padY * 2}`,
  };
}

function clientToWorld(
  inst: MindElixirInstance,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const box = inst.container.getBoundingClientRect();
  return makeInverse(inst)({ x: clientX - box.left, y: clientY - box.top });
}

function centerOn(inst: MindElixirInstance, point: { x: number; y: number }): void {
  const inv = makeInverse(inst);
  const size = visibleSize(inst);
  const c = inv({ x: size.width / 2, y: size.height / 2 });
  const s = inst.scaleVal || 1;
  inst.move((point.x - c.x) * s, (point.y - c.y) * s, false);
}

function installFreePan(inst: MindElixirInstance): void {
  inst.move = (dx: number, dy: number) => {
    if (dx === 0 && dy === 0) return false;
    const cur = parseTranslate(inst.map.style.transform || '');
    inst.map.style.transform = `translate3d(${cur.x + dx}px, ${cur.y + dy}px, 0) scale(${inst.scaleVal})`;
    inst.bus.fire('move', { dx, dy });
    return true;
  };
}

function MindMapPanel({ result, title }: { result: MindMapResult; title: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scope = useBookStore((s) => s.mindMapScope);
  const miniRef = useRef<SVGSVGElement | null>(null);
  const instanceRef = useRef<MindElixirInstance | null>(null);
  const rafRef = useRef(0);
  const handRef = useRef(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [version, setVersion] = useState(0);
  const [handMode, setHandMode] = useState(false);
  const [mini, setMini] = useState<MiniState | null>(null);

  function scheduleRefresh() {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const inst = instanceRef.current;
      if (!inst) return;
      setMini(computeMini(inst));
    });
  }

  function toggleHand() {
    const next = !handRef.current;
    handRef.current = next;
    setHandMode(next);
    const inst = instanceRef.current;
    if (inst) {
      inst.spacePressed = next;
      inst.container.classList.toggle('space-pressed', next);
    }
  }

  function zoomBy(delta: number) {
    const inst = instanceRef.current;
    if (!inst) return;
    const next = Math.min(1.4, Math.max(0.2, Math.round((inst.scaleVal + delta) * 100) / 100));
    const box = inst.container.getBoundingClientRect();
    inst.scale(next, { x: box.left + box.width / 2, y: box.top + box.height / 2 });
    scheduleRefresh();
  }

  function fit() {
    const inst = instanceRef.current;
    if (!inst) return;
    inst.scaleFit();
    scheduleRefresh();
  }

  function center() {
    const inst = instanceRef.current;
    if (!inst) return;
    inst.toCenter();
    scheduleRefresh();
  }

  function setExpandAll(expand: boolean) {
    const inst = instanceRef.current;
    if (!inst) return;
    try {
      const root = inst.findEle(inst.nodeData.id);
      inst.expandNodeAll(root, expand);
    } catch {
      return;
    }
    scheduleRefresh();
  }

  function onMiniDown(e: ReactMouseEvent<SVGSVGElement>) {
    const inst = instanceRef.current;
    if (!inst) return;
    e.preventDefault();
    const p = clientToWorld(inst, e.clientX, e.clientY);
    const viewEl = miniRef.current?.querySelector('rect.mm-view');
    let inView = false;
    if (viewEl) {
      const vx = parseFloat(viewEl.getAttribute('x') ?? '0');
      const vy = parseFloat(viewEl.getAttribute('y') ?? '0');
      const vw = parseFloat(viewEl.getAttribute('width') ?? '0');
      const vh = parseFloat(viewEl.getAttribute('height') ?? '0');
      inView =
        p.x >= vx && p.x <= vx + vw && p.y >= vy && p.y <= vy + vh;
    }
    if (!inView) {
      centerOn(inst, p);
      scheduleRefresh();
    }
    let last = p;
    const onMove = (ev: MouseEvent) => {
      const q = clientToWorld(inst, ev.clientX, ev.clientY);
      inst.move((q.x - last.x) * (inst.scaleVal || 1), (q.y - last.y) * (inst.scaleVal || 1), false);
      last = q;
      scheduleRefresh();
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let disposed = false;
    let instance: MindElixirInstance | null = null;
    setStatus('loading');
    setMini(null);
    Promise.all([import('mind-elixir'), import('mind-elixir/style.css')])
      .then(([mod]) => {
        if (disposed || !containerRef.current) return undefined;
        const Ctor = ((mod as { default?: unknown }).default ?? mod) as MindElixirCtor;
        const inst = new Ctor({
          el: containerRef.current,
          direction: 1,
          editable: false,
          toolBar: false,
          contextMenu: false,
          keypress: false,
          overflowHidden: false,
          handleWheel: (ev: WheelEvent) => {
            const live = instanceRef.current;
            if (!live) return;
            ev.preventDefault();
            const raw =
              ev.deltaMode === 1
                ? ev.deltaY * 40
                : ev.deltaMode === 2
                  ? ev.deltaY * live.container.clientHeight
                  : ev.deltaY;
            const delta = Math.max(-0.1, Math.min(0.1, (-raw / 10) * 0.1));
            if (delta === 0) return;
            live.scale(live.scaleVal + delta, { x: ev.clientX, y: ev.clientY });
          },
        });
        instance = inst;
        instanceRef.current = inst;
        inst.viewportEl = containerRef.current;
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
          if (disposed || !instance) return;
          installFreePan(instance);
          instance.spacePressed = handRef.current;
          instance.container.classList.toggle('space-pressed', handRef.current);
          instance.scaleFit();
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
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      instanceRef.current = null;
      try {
        instance?.destroy();
      } catch {
        return;
      }
    };
  }, [result, title, version]);

  useEffect(() => {
    const inst = instanceRef.current;
    const el = containerRef.current;
    if (status !== 'ready' || !inst || !el) return;
    const bus = inst.bus;
    inst.spacePressed = handRef.current;
    inst.container.classList.toggle('space-pressed', handRef.current);

    const onDbl = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const tpc = target.closest('.me-tpc') as
        | (HTMLElement & {
            nodeObj?: { id?: string; children?: unknown[]; expanded?: boolean };
          })
        | null;
      if (!tpc) return;
      const children = tpc.nodeObj?.children;
      if (!Array.isArray(children) || children.length === 0) return;
      if (tpc.nodeObj?.id === inst.nodeData.id) {
        const cur = tpc.nodeObj.expanded !== false;
        inst.expandNodeAll(tpc, !cur);
      } else {
        inst.expandNode(tpc);
      }
      scheduleRefresh();
    };
    const events = ['scale', 'move', 'expandNode', 'linkDiv'] as const;
    const onBus = () => scheduleRefresh();
    el.addEventListener('dblclick', onDbl);
    el.addEventListener('pointermove', onBus);
    el.addEventListener('wheel', onBus, { passive: true });
    for (const ev of events) bus?.addListener(ev, onBus);
    const ro = new ResizeObserver(() => scheduleRefresh());
    ro.observe(el);
    const mo = new MutationObserver(() => scheduleRefresh());
    mo.observe(el, { childList: true, subtree: true });
    scheduleRefresh();
    return () => {
      el.removeEventListener('dblclick', onDbl);
      el.removeEventListener('pointermove', onBus);
      el.removeEventListener('wheel', onBus);
      for (const ev of events) bus?.removeListener(ev, onBus);
      ro.disconnect();
      mo.disconnect();
    };
  }, [status]);

  const iconCls =
    'inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background/90 p-0 text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground disabled:opacity-40';

  return (
    <div className="space-y-2">
      <div className="mm-shell relative h-[28rem] overflow-hidden rounded-lg border border-border">
        <div ref={containerRef} className="h-full w-full overflow-hidden" />
        {scope ? (
          <Badge className="absolute left-2 top-2 z-10">
            {scope === 'book' ? '整书' : '章节'}
          </Badge>
        ) : null}
        <div className="absolute right-2 top-2 z-10 flex gap-1">
          <button
            type="button"
            className={`${iconCls}${handMode ? ' bg-primary text-primary-foreground hover:bg-primary' : ''}`}
            title={handMode ? '关闭手型拖拽' : '手型拖拽（按住平移）'}
            aria-label="手型拖拽开关"
            disabled={status !== 'ready'}
            onClick={toggleHand}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5.5 7.5V4.2a1.1 1.1 0 0 1 2.2 0v3.1" />
              <path d="M7.7 7.3V3.6a1.1 1.1 0 0 1 2.2 0v3.7" />
              <path d="M9.9 7.6V4.9a1.1 1.1 0 0 1 2.2 0v4.4c0 2.6-1.9 4.3-4.4 4.3S3.6 12.3 3.6 10.4V8.6a1.1 1.1 0 0 1 2.2 0v1.1" />
            </svg>
          </button>
          <button
            type="button"
            className={iconCls}
            title="放大"
            aria-label="放大"
            disabled={status !== 'ready'}
            onClick={() => zoomBy(0.1)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
              <circle cx="7" cy="7" r="4.4" />
              <path d="M10.4 10.4 14 14M7 5.2v3.6M5.2 7h3.6" />
            </svg>
          </button>
          <button
            type="button"
            className={iconCls}
            title="缩小"
            aria-label="缩小"
            disabled={status !== 'ready'}
            onClick={() => zoomBy(-0.1)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
              <circle cx="7" cy="7" r="4.4" />
              <path d="M10.4 10.4 14 14M5.2 7h3.6" />
            </svg>
          </button>
          <button
            type="button"
            className={iconCls}
            title="适应画布"
            aria-label="适应画布"
            disabled={status !== 'ready'}
            onClick={fit}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2.5 6V3.5A1 1 0 0 1 3.5 2.5H6M10 2.5h2.5a1 1 0 0 1 1 1V6M13.5 10v2.5a1 1 0 0 1-1 1H10M6 13.5H3.5a1 1 0 0 1-1-1V10" />
            </svg>
          </button>
          <button
            type="button"
            className={iconCls}
            title="居中（保持当前缩放）"
            aria-label="居中"
            disabled={status !== 'ready'}
            onClick={center}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="8" cy="8" r="2.4" />
              <path d="M8 1.5v2.2M8 12.3v2.2M1.5 8h2.2M12.3 8h2.2" />
            </svg>
          </button>
          <button
            type="button"
            className={iconCls}
            title="展开全部"
            aria-label="展开全部"
            disabled={status !== 'ready'}
            onClick={() => setExpandAll(true)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 3.5 8 7.5l4-4M4 9l4 4 4-4" />
            </svg>
          </button>
          <button
            type="button"
            className={iconCls}
            title="折叠全部"
            aria-label="折叠全部"
            disabled={status !== 'ready'}
            onClick={() => setExpandAll(false)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 7 8 3l4 4M4 12.5 8 8.5l4 4" />
            </svg>
          </button>
        </div>
        {mini ? (
          <svg
            ref={miniRef}
            className="absolute bottom-2 right-2 z-10 h-[110px] w-[160px] cursor-crosshair rounded-md border border-border bg-background/90 shadow-sm"
            viewBox={mini.vb}
            preserveAspectRatio="xMidYMid meet"
            onMouseDown={onMiniDown}
            role="presentation"
            aria-label="小地图"
          >
            {mini.rects.map((r, i) => (
              <rect
                key={`n-${i}`}
                x={r.x}
                y={r.y}
                width={r.w}
                height={r.h}
                rx={4}
                fill={r.root ? 'var(--color-primary)' : 'hsl(220 14% 70%)'}
              />
            ))}
            <rect
              className="mm-view"
              x={mini.view.x}
              y={mini.view.y}
              width={mini.view.w}
              height={mini.view.h}
              fill="color-mix(in srgb, var(--color-primary) 10%, transparent)"
              stroke="var(--color-primary)"
              strokeWidth={Math.max(Math.max(mini.view.w, mini.view.h) * 0.012, 2)}
              style={{ cursor: 'grab' }}
            />
          </svg>
        ) : null}
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
        {status === 'loading'
          ? '正在加载 mind-elixir…'
          : '滚轮缩放 · 拖拽平移（手型）· 双击节点展开/折叠 · 右下角小地图导航'}
      </p>
    </div>
  );
}
