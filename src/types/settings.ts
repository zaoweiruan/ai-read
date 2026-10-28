import { z } from 'zod'

export const providerSettingsSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  kind: z.enum(['openai-compatible', 'google']).default('openai-compatible'),
  apiKey: z.string().default(''),
  baseUrl: z.string().default(''),
  model: z.string().min(1),
})

export const settingsSchema = z.object({
  providers: z.array(providerSettingsSchema).default([]),
  activeProviderId: z.string().optional(),
  recentFilesLimit: z.number().int().min(1).max(50).default(10),
})

export type ProviderSettings = z.infer<typeof providerSettingsSchema>
export type Settings = z.infer<typeof settingsSchema>