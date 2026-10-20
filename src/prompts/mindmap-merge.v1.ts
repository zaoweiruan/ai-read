import { SYSTEM_PROMPT } from './system';
import type { PromptTemplate } from './types';

export interface MindMapMergeVars {
  chapterMaps: string;
}

export const mindMapMergeV1: PromptTemplate<MindMapMergeVars> = {
  id: 'mindmap-merge',
  version: 1,
  label: '导图合并',
  description: '将逐章导图合并为全书导图（去重归组，不新增原文内容）',
  temperature: 0.2,
  system: SYSTEM_PROMPT,
  buildUser: ({ chapterMaps }) => `任务：将以下章节思维导图合并为全书思维导图。
保留各章核心逻辑，去重、归组，不新增原文没有的内容。

只输出 JSON，不要 Markdown、解释或代码块。
输出 schema 与输入一致：{"title":string,"children":[{"label":string,"children":[...]}]}
约束：层级最多 4 层；每层节点不超过 7 个；label 不超过 18 个汉字。

章节导图：
${chapterMaps}`,
};
