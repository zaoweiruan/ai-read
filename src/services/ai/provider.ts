import type { ProviderSettings } from '@/types/settings'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatOptions {
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
}

export interface ChatStreamOptions extends ChatOptions {
  onChunk: (delta: string) => void
}

export interface AIProvider {
  readonly name: string
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<string>
  chatStream?(messages: ChatMessage[], options: ChatStreamOptions): Promise<string>
}

export type ProviderKind = 'openai-compatible' | 'google'

export function effectiveBaseUrl(settings: ProviderSettings): string {
  if (settings.baseUrl) return settings.baseUrl.replace(/\/+$/, '')
  if (settings.kind === 'google') {
    return 'https://generativelanguage.googleapis.com/v1beta'
  }
  return 'https://api.openai.com/v1'
}

async function readSse(
  res: Response,
  onEvent: (data: string) => void,
): Promise<void> {
  if (!res.body) throw new Error('响应无数据流，无法解析 SSE')
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split(/\r?\n/)
    buffer = parts.pop() ?? ''
    for (const part of parts) {
      const line = part.trim()
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (!data || data === '[DONE]') continue
      onEvent(data)
    }
  }
}

export function createProvider(
  kind: ProviderKind,
  settings: ProviderSettings,
): AIProvider {
  switch (kind) {
    case 'google':
      return new GoogleProvider(settings)
    case 'openai-compatible':
    default:
      return new OpenAICompatibleProvider(settings)
  }
}

export async function chatStreamWithFallback(
  ai: AIProvider,
  messages: ChatMessage[],
  options: ChatOptions,
  onChunk: (delta: string) => void,
): Promise<string> {
  if (ai.chatStream) {
    try {
      return await ai.chatStream(messages, { ...options, onChunk })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e
      const message = e instanceof Error ? e.message : String(e)
      if (message.startsWith('AI 请求失败')) throw e
    }
  }
  return ai.chat(messages, options)
}

export class OpenAICompatibleProvider implements AIProvider {
  readonly name: string
  private settings: ProviderSettings
  constructor(settings: ProviderSettings) {
    this.settings = settings
    this.name = settings.name
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
    const res = await fetch(`${effectiveBaseUrl(this.settings)}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.settings.apiKey}`,
      },
      body: JSON.stringify({
        model: this.settings.model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens,
      }),
      signal: options.signal,
    })
    if (!res.ok) {
      throw new Error(`AI 请求失败: ${res.status} ${await res.text()}`)
    }
    const data = await res.json()
    return data.choices?.[0]?.message?.content ?? ''
  }

  async chatStream(
    messages: ChatMessage[],
    options: ChatStreamOptions,
  ): Promise<string> {
    const res = await fetch(`${effectiveBaseUrl(this.settings)}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.settings.apiKey}`,
      },
      body: JSON.stringify({
        model: this.settings.model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens,
        stream: true,
      }),
      signal: options.signal,
    })
    if (!res.ok) {
      throw new Error(`AI 请求失败: ${res.status} ${await res.text()}`)
    }
    let full = ''
    await readSse(res, (data) => {
      try {
        const json = JSON.parse(data) as {
          choices?: { delta?: { content?: string } }[]
        }
        const delta = json.choices?.[0]?.delta?.content
        if (delta) {
          full += delta
          options.onChunk(delta)
        }
      } catch {
        // SSE 行解析失败则忽略，继续处理后续数据块
      }
    })
    return full
  }
}

export class GoogleProvider implements AIProvider {
  readonly name: string
  private settings: ProviderSettings
  constructor(settings: ProviderSettings) {
    this.settings = settings
    this.name = settings.name
  }

  private splitMessages(messages: ChatMessage[]): {
    system: string
    contents: { role: string; parts: { text: string }[] }[]
  } {
    const system = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n')
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }))
    return { system, contents }
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
    const { system, contents } = this.splitMessages(messages)
    const res = await fetch(
      `${effectiveBaseUrl(this.settings)}/models/${this.settings.model}:generateContent?key=${this.settings.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: system ? { parts: [{ text: system }] } : undefined,
          generationConfig: {
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.maxTokens,
          },
        }),
        signal: options.signal,
      },
    )
    if (!res.ok) {
      throw new Error(`AI 请求失败: ${res.status} ${await res.text()}`)
    }
    const data = await res.json()
    return (
      data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? ''
    )
  }

  async chatStream(
    messages: ChatMessage[],
    options: ChatStreamOptions,
  ): Promise<string> {
    const { system, contents } = this.splitMessages(messages)
    const res = await fetch(
      `${effectiveBaseUrl(this.settings)}/models/${this.settings.model}:streamGenerateContent?alt=sse&key=${this.settings.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: system ? { parts: [{ text: system }] } : undefined,
          generationConfig: {
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.maxTokens,
          },
        }),
        signal: options.signal,
      },
    )
    if (!res.ok) {
      throw new Error(`AI 请求失败: ${res.status} ${await res.text()}`)
    }
    let full = ''
    await readSse(res, (data) => {
      try {
        const json = JSON.parse(data) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[]
        }
        const text =
          json.candidates?.[0]?.content?.parts
            ?.map((p) => p.text ?? '')
            .join('') ?? ''
        if (text) {
          full += text
          options.onChunk(text)
        }
      } catch {
        // SSE 行解析失败则忽略，继续处理后续数据块
      }
    })
    return full
  }
}
