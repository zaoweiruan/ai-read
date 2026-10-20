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

export interface AIProvider {
  readonly name: string
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<string>
}

export type ProviderKind = 'openai-compatible' | 'google'

function endpoint(settings: ProviderSettings): string {
  if (settings.baseUrl) return settings.baseUrl.replace(/\/$/, '')
  return 'https://api.openai.com/v1'
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

export class OpenAICompatibleProvider implements AIProvider {
  readonly name: string
  private settings: ProviderSettings
  constructor(settings: ProviderSettings) {
    this.settings = settings
    this.name = settings.name
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
    const res = await fetch(`${endpoint(this.settings)}/chat/completions`, {
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
}

export class GoogleProvider implements AIProvider {
  readonly name: string
  private settings: ProviderSettings
  constructor(settings: ProviderSettings) {
    this.settings = settings
    this.name = settings.name
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
    const base =
      this.settings.baseUrl?.replace(/\/$/, '') ||
      'https://generativelanguage.googleapis.com/v1beta'
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

    const res = await fetch(
      `${base}/models/${this.settings.model}:generateContent?key=${this.settings.apiKey}`,
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
}