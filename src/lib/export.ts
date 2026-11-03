// src/lib/export.ts
// 处理结果导出：TXT / Markdown / PDF（PDF 由浏览器打印另存为实现，此处仅提供文本构建）。

import type { MindMapNode, MindMapResult, SummaryResult } from '@/types';

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'result';
}

export function downloadText(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function indentMindMap(node: MindMapNode, level: number): string[] {
  const lines: string[] = [];
  const prefix = '  '.repeat(level);
  lines.push(`${prefix}- ${node.topic}${node.detail ? ` — ${node.detail}` : ''}`);
  for (const c of node.children ?? []) lines.push(...indentMindMap(c, level + 1));
  return lines;
}

export function mindMapToMarkdown(result: MindMapResult, title = '思维导图'): string {
  const lines: string[] = [`# ${title}`, ''];
  for (const root of result.roots) lines.push(...indentMindMap(root, 0));
  return lines.join('\n');
}

export function mindMapToText(result: MindMapResult, title = '思维导图'): string {
  return mindMapToMarkdown(result, title);
}

export function summaryToMarkdown(result: SummaryResult, title = 'ai-read'): string {
  const lines: string[] = [`# ${title}`, ''];
  if (result.guide) {
    lines.push('## 导读', '', result.guide, '');
  } else if (result.bookSummary) {
    lines.push('## 全书总结', '', result.bookSummary, '');
  }
  if (result.chapterRelations?.trim()) {
    lines.push('## 章节关系', '', result.chapterRelations, '');
  }
  const cards = result.cards ?? [];
  const entries = Object.entries(result.chapterSummaries);
  if (cards.length > 0) {
    lines.push('## 章节摘要', '');
    for (const card of cards) {
      lines.push(`### ${card.chapterTitle}`, '');
      if (card.coreQuestion) lines.push(`- 核心问题：${card.coreQuestion}`);
      if (card.thesis) lines.push(`- 论点：${card.thesis}`);
      for (const kp of card.keyPoints) {
        lines.push(`- 要点：${kp.point}${kp.evidence ? `（${kp.evidence}）` : ''}${kp.location ? ` @${kp.location}` : ''}`);
      }
      for (const t of card.terms) lines.push(`- 术语：${t.term}${t.explanation ? `：${t.explanation}` : ''}`);
      if (card.connections) lines.push(`- 关联：${card.connections}`);
      lines.push('');
    }
  } else if (entries.length > 0) {
    lines.push('## 章节摘要', '');
    for (const [id, text] of entries) {
      lines.push(`### ${id}`, '', text, '');
    }
  }
  return lines.join('\n').trim() + '\n';
}

export function summaryToText(result: SummaryResult, title = 'ai-read'): string {
  // 纯文本：去掉 Markdown 标题符号，保留结构
  return summaryToMarkdown(result, title)
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*/g, '');
}

export function buildFileName(bookTitle: string | undefined, kind: string, ext: string): string {
  const base = sanitizeFileName(bookTitle ?? 'ai-read');
  const date = new Date().toISOString().slice(0, 10);
  return `${base}-${kind}-${date}.${ext}`;
}