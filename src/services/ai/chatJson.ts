import { safeJson } from '@/lib/safeJson';
import type { AIProvider, ChatMessage, ChatOptions } from './provider';

export interface ChatJsonOptions<T> extends ChatOptions {
  label?: string;
  validate?: (value: T) => string | null;
}

export async function chatJson<T>(
  ai: AIProvider,
  messages: ChatMessage[],
  options: ChatJsonOptions<T> = {},
): Promise<T> {
  const { label = '输出', validate, ...chatOptions } = options;
  let lastError = '';
  for (let attempt = 0; attempt <= 1; attempt += 1) {
    const attemptMessages: ChatMessage[] =
      attempt === 0
        ? messages
        : [
            ...messages,
            {
              role: 'user' as const,
              content: `上一次${label}无法解析（${lastError}）。请重新输出：只输出合法 JSON，不要 Markdown 代码块，不要任何解释文字。`,
            },
          ];
    const reply = (await ai.chat(attemptMessages, chatOptions)).trim();
    const parsed = safeJson<T>(reply);
    if (parsed === null) {
      lastError = 'JSON 解析失败';
      continue;
    }
    const problem = validate ? validate(parsed) : null;
    if (problem) {
      lastError = problem;
      continue;
    }
    return parsed;
  }
  throw new Error(`${label}解析失败（已重试 1 次）：${lastError}`);
}
