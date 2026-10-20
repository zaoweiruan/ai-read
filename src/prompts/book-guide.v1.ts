import { SYSTEM_PROMPT } from './system';
import type { PromptTemplate } from './types';

export interface BookGuideVars {
  bookTitle: string;
  bookContext: string;
}

export const bookGuideV1: PromptTemplate<BookGuideVars> = {
  id: 'book-guide',
  version: 1,
  label: '全书导读',
  description: '3–5 分钟结构化全书导读，核心论点带章节定位',
  temperature: 0.4,
  system: SYSTEM_PROMPT,
  buildUser: ({ bookTitle, bookContext }) => `任务：基于以下书籍材料，生成一份适合 3–5 分钟阅读的全书导读。

输出格式：
# 一句话核心
用不超过 40 字概括全书核心命题。

# 本书解决什么问题
- 3–5 条，说明作者关注的问题和现实背景。

# 核心论点
- 3–6 条；每条包含：观点、支撑理由或案例、所在章节。

# 关键概念
| 概念 | 含义 | 为什么重要 |
|---|---|---|

# 阅读路径
- 按阅读顺序给出 3–5 个阶段，说明每阶段应关注的章节和问题。

# 常见误解
- 2–4 条，指出读者容易误读的地方。

要点：要求模型输出章节定位，便于前端跳转；限制条目数量，避免摘要膨胀。

书名：${bookTitle}

材料：
${bookContext}`,
};
