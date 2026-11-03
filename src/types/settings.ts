import { z } from 'zod'

export const providerSettingsSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  kind: z.enum(['openai-compatible', 'google']).default('openai-compatible'),
  apiKey: z.string().default(''),
  baseUrl: z.string().default(''),
  model: z.string().min(1),
})

export const translationSettingsSchema = z.object({
  // 'ai' 使用已配置的 AI 提供商；'mymemory' 免费 MyMemory；'lara' Lara 翻译 API（需 Key）；'google' 免费 Google
  mode: z.enum(['ai', 'mymemory', 'lara', 'google']).default('mymemory'),
  sourceLang: z.string().default('en'),
  targetLang: z.string().default('zh-CN'),
  laraAccessKeyId: z.string().default(''),
  laraAccessKeySecret: z.string().default(''),
})

export const settingsSchema = z.object({
  providers: z.array(providerSettingsSchema).default([]),
  activeProviderId: z.string().optional(),
  recentFilesLimit: z.number().int().min(1).max(50).default(10),
  translation: translationSettingsSchema.default({ mode: 'mymemory', sourceLang: 'en', targetLang: 'zh-CN', laraAccessKeyId: '', laraAccessKeySecret: '' }),
})

export type ProviderSettings = z.infer<typeof providerSettingsSchema>
export type TranslationSettings = z.infer<typeof translationSettingsSchema>
export type Settings = z.infer<typeof settingsSchema>