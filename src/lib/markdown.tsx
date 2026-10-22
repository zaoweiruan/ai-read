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

const INLINE_PATTERN =
  /(`[^`]+`)|(\*\*[^*]+\*\*)|(~~[^~]+~~)|(!\[[^\]]*\]\([^)]+\))|(\[[^\]]*\]\([^)]+\))|(\*[^*\n]+\*)|(_[^_\n]+_)|(<https?:\/\/[^>]+>)/g

const HEADING_CLASS: Record<number, string> = {
  1: 'mt-4 mb-2 text-2xl font-bold',
  2: 'mt-4 mb-2 text-xl font-bold',
  3: 'mt-3 mb-1.5 text-lg font-semibold',
  4: 'mt-3 mb-1 text-base font-semibold',
  5: 'mt-2 mb-1 text-sm font-semibold',
  6: 'mt-2 mb-1 text-xs font-semibold',
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let last = 0
  let index = 0
  INLINE_PATTERN.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = INLINE_PATTERN.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index))
    const token = match[0]
    const key = `${keyPrefix}-${index}`
    index += 1
    if (token.startsWith('`')) {
      nodes.push(
        <code key={key} className="rounded bg-muted px-1 py-0.5 text-[0.9em]">
          {token.slice(1, -1)}
        </code>,
      )
    } else if (token.startsWith('**')) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('~~')) {
      nodes.push(<del key={key}>{token.slice(2, -2)}</del>)
    } else if (token.startsWith('![')) {
      const parts = token.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
      nodes.push(
        <img
          key={key}
          src={parts?.[2] ?? ''}
          alt={parts?.[1] ?? ''}
          loading="lazy"
          className="my-2 max-h-[70vh] w-auto max-w-full rounded-md"
        />,
      )
    } else if (token.startsWith('[')) {
      const parts = token.match(/^\[([^\]]*)\]\(([^)]+)\)$/)
      nodes.push(
        <a
          key={key}
          href={parts?.[2] ?? '#'}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2 hover:text-primary"
        >
          {parts?.[1] ?? ''}
        </a>,
      )
    } else if (token.startsWith('<')) {
      nodes.push(
        <a
          key={key}
          href={token.slice(1, -1)}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2 hover:text-primary"
        >
          {token.slice(1, -1)}
        </a>,
      )
    } else {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>)
    }
    last = match.index + token.length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

export function renderMarkdown(text: string): ReactNode[] {
  const lines = text.split(/\r?\n/)
  const out: ReactNode[] = []
  const paragraph: string[] = []
  let key = 0
  let index = 0

  const flushParagraph = (): void => {
    const value = paragraph.join(' ').trim()
    if (value) {
      out.push(
        <p key={`md-p-${key}`} className="my-1.5 whitespace-pre-wrap leading-relaxed">
          {renderInline(value, `md-p-${key}`)}
        </p>,
      )
      key += 1
    }
    paragraph.length = 0
  }

  while (index < lines.length) {
    const line = lines[index]

    const fence = line.match(/^```(\w*)\s*$/)
    if (fence) {
      flushParagraph()
      const buffer: string[] = []
      index += 1
      while (index < lines.length && !/^```\s*$/.test(lines[index])) {
        buffer.push(lines[index])
        index += 1
      }
      index += 1
      out.push(
        <pre
          key={`md-code-${key}`}
          className="my-3 overflow-x-auto rounded-md bg-muted p-3 text-xs leading-relaxed"
        >
          <code className="font-mono">{buffer.join('\n')}</code>
        </pre>,
      )
      key += 1
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/)
    if (heading) {
      flushParagraph()
      const level = heading[1].length
      out.push(
        <h3 key={`md-h-${key}`} className={HEADING_CLASS[level] ?? HEADING_CLASS[6]}>
          {renderInline(heading[2], `md-h-${key}`)}
        </h3>,
      )
      key += 1
      index += 1
      continue
    }

    if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(line)) {
      flushParagraph()
      out.push(<hr key={`md-hr-${key}`} className="my-4 border-border" />)
      key += 1
      index += 1
      continue
    }

    if (/^\s*>\s?/.test(line)) {
      flushParagraph()
      const buffer: string[] = []
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        buffer.push(lines[index].replace(/^\s*>\s?/, ''))
        index += 1
      }
      out.push(
        <blockquote
          key={`md-bq-${key}`}
          className="my-3 border-l-2 border-border pl-3 opacity-90"
        >
          {renderInline(buffer.join(' '), `md-bq-${key}`)}
        </blockquote>,
      )
      key += 1
      continue
    }

    if (
      line.includes('|') &&
      index + 1 < lines.length &&
      lines[index + 1].includes('-') &&
      /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(lines[index + 1])
    ) {
      flushParagraph()
      const header = splitTableRow(line)
      index += 2
      const rows: string[][] = []
      while (index < lines.length && lines[index].includes('|') && lines[index].trim() !== '') {
        rows.push(splitTableRow(lines[index]))
        index += 1
      }
      out.push(
        <table key={`md-table-${key}`} className="my-3 w-full border-collapse text-sm">
          <thead>
            <tr>
              {header.map((cell, i) => (
                <th
                  key={`md-th-${key}-${i}`}
                  className="border border-border bg-muted/40 px-2 py-1 text-left font-medium"
                >
                  {renderInline(cell, `md-th-${key}-${i}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={`md-tr-${key}-${ri}`}>
                {row.map((cell, ci) => (
                  <td
                    key={`md-td-${key}-${ri}-${ci}`}
                    className="border border-border px-2 py-1 align-top"
                  >
                    {renderInline(cell, `md-td-${key}-${ri}-${ci}`)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>,
      )
      key += 1
      continue
    }

    const listItem = line.match(/^\s*([-*+]|\d+[.)])\s+(.*)$/)
    if (listItem) {
      flushParagraph()
      const ordered = /\d/.test(listItem[1])
      const items: string[] = []
      while (index < lines.length) {
        const item = lines[index].match(/^\s*([-*+]|\d+[.)])\s+(.*)$/)
        if (!item) break
        items.push(item[2])
        index += 1
      }
      out.push(
        ordered ? (
          <ol key={`md-ol-${key}`} className="my-2 list-decimal space-y-1 pl-5">
            {items.map((item, i) => (
              <li key={`md-li-${key}-${i}`}>{renderInline(item, `md-li-${key}-${i}`)}</li>
            ))}
          </ol>
        ) : (
          <ul key={`md-ul-${key}`} className="my-2 list-disc space-y-1 pl-5">
            {items.map((item, i) => (
              <li key={`md-li-${key}-${i}`}>{renderInline(item, `md-li-${key}-${i}`)}</li>
            ))}
          </ul>
        ),
      )
      key += 1
      continue
    }

    if (line.trim() === '') {
      flushParagraph()
      index += 1
      continue
    }

    paragraph.push(line.trim())
    index += 1
  }

  flushParagraph()
  return out
}
