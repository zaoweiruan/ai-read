import { SYSTEM_PROMPT } from './system';
import type { PromptTemplate } from './types';

export interface GlossaryVars {
  target: string;
  context: string;
}

export const glossaryV1: PromptTemplate<GlossaryVars> = {
  id: 'glossary',
  version: 1,
  label: '术语解释',
  description: '划词解释：通俗 / 语境 / 原文依据 / 相关概念四段式',
  temperature: 0.3,
  system: SYSTEM_PROMPT,
  buildUser: ({ target, context }) => `任务：解释以下术语或段落。

输出：
1. 通俗解释：不超过 80 字。
2. 在本书语境中的含义：不超过 120 字。
3. 原文依据：引用提供的片段；无依据则写"材料中未提供直接依据"。
4. 相关概念：最多 3 个。

术语/段落：
${target}

上下文：
${context}`,
};
