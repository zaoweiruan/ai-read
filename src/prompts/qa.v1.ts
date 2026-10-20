import { SYSTEM_PROMPT } from './system';
import type { PromptTemplate } from './types';

export interface QAVars {
  question: string;
  contexts: string;
}

export const qaV1: PromptTemplate<QAVars> = {
  id: 'qa',
  version: 1,
  label: '引用问答',
  description: '检索增强问答：[片段ID] 引用 + 防幻觉 + 后续问题',
  temperature: 0.2,
  system: SYSTEM_PROMPT,
  buildUser: ({ question, contexts }) => `任务：根据检索到的书籍片段回答用户问题。

规则：
1. 只使用 <contexts> 中的内容；不要使用模型先验知识补充书中观点。
2. 每个实质性结论后标注来源，格式：[片段ID]。
3. 若片段之间冲突，说明冲突及各自出处。
4. 若无法回答，输出：
   {
     "answer": "提供的材料不足以回答该问题。",
     "citations": [],
     "follow_ups": ["可以尝试询问……"]
   }
5. 回答长度不超过 300 字，除非用户明确要求详细解释。
6. 最后给出最多 3 个后续问题。

输出 JSON：
{
  "answer": "回答正文，内嵌 [片段ID]",
  "citations": [
    { "id": "chunk_12", "chapter": "第2章", "quote": "不超过 50 字的原文摘录" }
  ],
  "follow_ups": ["问题1", "问题2"]
}

用户问题：
${question}

检索片段：
<contexts>
${contexts}
</contexts>`,
};
