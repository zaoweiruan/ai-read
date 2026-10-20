export { SYSTEM_PROMPT } from './system';
export type { PromptTemplate } from './types';
export { bookGuideV1 } from './book-guide.v1';
export { chapterSummaryV1 } from './chapter-summary.v1';
export { mindMapV1 } from './mindmap.v1';
export { mindMapMergeV1 } from './mindmap-merge.v1';
export { qaV1 } from './qa.v1';
export { glossaryV1 } from './glossary.v1';

import { bookGuideV1 } from './book-guide.v1';
import { chapterSummaryV1 } from './chapter-summary.v1';
import { mindMapV1 } from './mindmap.v1';
import { mindMapMergeV1 } from './mindmap-merge.v1';
import { qaV1 } from './qa.v1';
import { glossaryV1 } from './glossary.v1';

export const BUILTIN_PROMPTS = [
  bookGuideV1,
  chapterSummaryV1,
  mindMapV1,
  mindMapMergeV1,
  qaV1,
  glossaryV1,
];
