import type { ReactNode } from 'react';
import type { Chapter } from '@/types';

function inline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    nodes.push(<strong key={`${keyPrefix}-b${i}`}>{match[1]}</strong>);
    last = match.index + match[0].length;
    i += 1;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function linkifyChapters(
  text: string,
  chapters: Chapter[],
  onJump: (chapterId: string) => void,
  keyPrefix: string,
): ReactNode[] {
  const titles = chapters
    .filter((c) => c.title.trim().length >= 2)
    .map((c) => c.title)
    .sort((a, b) => b.length - a.length);
  const nodes: ReactNode[] = [];
  let rest = text;
  let cursor = 0;
  let guard = 0;
  while (rest.length > 0 && guard < 500) {
    guard += 1;
    let bestIndex = -1;
    let bestTitle = '';
    for (const title of titles) {
      const idx = rest.indexOf(title);
      if (idx >= 0 && (bestIndex < 0 || idx < bestIndex)) {
        bestIndex = idx;
        bestTitle = title;
      }
    }
    if (bestIndex < 0) {
      nodes.push(...inline(rest, `${keyPrefix}-${cursor}`));
      break;
    }
    if (bestIndex > 0) {
      nodes.push(...inline(rest.slice(0, bestIndex), `${keyPrefix}-${cursor}`));
    }
    const chapter = chapters.find((c) => c.title === bestTitle);
    nodes.push(
      <button
        key={`${keyPrefix}-jump-${cursor}`}
        type="button"
        className="cursor-pointer underline decoration-dotted underline-offset-2 hover:text-primary"
        onClick={() => chapter && onJump(chapter.id)}
      >
        {bestTitle}
      </button>,
    );
    rest = rest.slice(bestIndex + bestTitle.length);
    cursor += 1;
  }
  return nodes;
}

export function renderGuideMarkdown(
  text: string,
  chapters: Chapter[],
  onJump: (chapterId: string) => void,
): ReactNode[] {
  const lines = text.split(/\r?\n/);
  const out: ReactNode[] = [];
  let listBuffer: { ordered: boolean; items: string[] } | null = null;
  let tableBuffer: string[][] = [];
  let key = 0;

  function flushList() {
    if (!listBuffer) return;
    const items = listBuffer.items.map((item, i) => (
      <li key={`li-${key}-${i}`}>
        {linkifyChapters(item, chapters, onJump, `l-${key}-${i}`)}
      </li>
    ));
    out.push(
      listBuffer.ordered ? (
        <ol key={`ul-${key}`} className="list-decimal space-y-1 pl-5">
          {items}
        </ol>
      ) : (
        <ul key={`ul-${key}`} className="list-disc space-y-1 pl-5">
          {items}
        </ul>
      ),
    );
    listBuffer = null;
    key += 1;
  }

  function flushTable() {
    if (tableBuffer.length === 0) return;
    const [head, ...rows] = tableBuffer;
    out.push(
      <table key={`tbl-${key}`} className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {head.map((cell, i) => (
              <th
                key={`th-${i}`}
                className="border border-border bg-muted/40 px-2 py-1 text-left font-medium"
              >
                {cell.trim()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={`tr-${ri}`}>
              {row.map((cell, ci) => (
                <td key={`td-${ci}`} className="border border-border px-2 py-1 align-top">
                  {linkifyChapters(cell.trim(), chapters, onJump, `t-${key}-${ri}-${ci}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>,
    );
    tableBuffer = [];
    key += 1;
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (/^\s*\|.*\|\s*$/.test(line)) {
      flushList();
      const cells = line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|');
      if (cells.every((c) => /^:?-{2,}:?$/.test(c.trim()))) continue;
      tableBuffer.push(cells);
      continue;
    }
    flushTable();
    if (!line.trim()) {
      flushList();
      continue;
    }
    const h1 = line.match(/^#\s+(.*)/);
    const h2 = line.match(/^##\s+(.*)/);
    const h3 = line.match(/^###\s+(.*)/);
    const li = line.match(/^\s*(?:[-*]|\d+[.)])\s+(.*)/);
    if (h1) {
      flushList();
      out.push(
        <h3 key={`h-${key}`} className="pt-2 text-base font-semibold">
          {linkifyChapters(h1[1], chapters, onJump, `h-${key}`)}
        </h3>,
      );
      key += 1;
      continue;
    }
    if (h2) {
      flushList();
      out.push(
        <h4 key={`h-${key}`} className="pt-1.5 text-sm font-semibold">
          {linkifyChapters(h2[1], chapters, onJump, `h-${key}`)}
        </h4>,
      );
      key += 1;
      continue;
    }
    if (h3) {
      flushList();
      out.push(
        <h5 key={`h-${key}`} className="pt-1 text-sm font-medium">
          {linkifyChapters(h3[1], chapters, onJump, `h-${key}`)}
        </h5>,
      );
      key += 1;
      continue;
    }
    if (li) {
      const ordered = /^\s*\d+[.)]\s/.test(line);
      if (!listBuffer || listBuffer.ordered !== ordered) {
        flushList();
        listBuffer = { ordered, items: [] };
      }
      listBuffer.items.push(li[1]);
      continue;
    }
    flushList();
    out.push(
      <p key={`p-${key}`} className="whitespace-pre-wrap">
        {linkifyChapters(line, chapters, onJump, `p-${key}`)}
      </p>,
    );
    key += 1;
  }
  flushList();
  flushTable();
  return out;
}
