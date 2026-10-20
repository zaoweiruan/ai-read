import { SYSTEM_PROMPT } from './system';
import type { PromptTemplate } from './types';

export interface ChapterSummaryVars {
  chapterTitle: string;
  chapterContext: string;
}

export const chapterSummaryV1: PromptTemplate<ChapterSummaryVars> = {
  id: 'chapter-summary',
  version: 1,
  label: '章节摘要',
  description: '1 分钟掌握要点的结构化 JSON 卡片',
  temperature: 0.3,
  system: SYSTEM_PROMPT,
  buildUser: ({ chapterTitle, chapterContext }) => `任务：总结以下章节，帮助读者在 1 分钟内掌握要点。

输出 JSON：
{
  "chapter_title": "章节标题",
  "core_question": "本章试图回答的核心问题",
  "thesis": "作者的核心主张，不超过 60 字",
  "key_points": [
    {
      "point": "关键观点",
      "evidence": "论据、案例或推理",
      "location": "章节内大致位置或小节标题"
    }
  ],
  "terms": [
    { "term": "术语", "explanation": "简明解释" }
  ],
  "connections": "本章与全书主题或其他章节的关系"
}

规则：
- key_points 数量为 3–7。
- 不得添加材料中没有的案例或引用。
- 若材料是节选，明确说明结论可能不完整。
- 只输出 JSON，不要 Markdown 代码块或任何解释文字。

章节标题：${chapterTitle}

章节材料：
${chapterContext}`,
};
