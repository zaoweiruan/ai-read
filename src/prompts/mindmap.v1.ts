import { SYSTEM_PROMPT } from './system';
import type { PromptTemplate } from './types';

export interface MindMapVars {
  title: string;
  bookContext: string;
}

export const mindMapV1: PromptTemplate<MindMapVars> = {
  id: 'mindmap',
  version: 1,
  label: '思维导图',
  description: '纯 JSON 导图：≤4 层 / 每层 ≤7 节点 / label ≤18 汉字',
  temperature: 0.3,
  system: SYSTEM_PROMPT,
  buildUser: ({ title, bookContext }) => `任务：将以下书籍内容转换为思维导图，供前端渲染。

只输出 JSON，不要 Markdown、解释或代码块。

JSON schema：
{
  "title": "书名或主题",
  "children": [
    {
      "label": "一级主题",
      "children": [
        {
          "label": "二级主题",
          "children": [
            { "label": "具体观点或案例" }
          ]
        }
      ]
    }
  ]
}

约束：
1. 层级最多 4 层。
2. 每层节点不超过 7 个。
3. label 不超过 18 个汉字。
4. 优先呈现论证结构：问题 → 概念 → 论点 → 证据 → 结论。
5. 不得编造章节、人物、书名或数据。

主题：${title}

书籍材料：
${bookContext}`,
};
