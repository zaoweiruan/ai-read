import { createProvider, type AIProvider, type ProviderKind } from './provider'
import type { ProviderSettings } from '@/types/settings'

export interface AIRegistryOptions {
  kind: ProviderKind
  settings: ProviderSettings
}

export function resolveProvider(options: AIRegistryOptions): AIProvider {
  return createProvider(options.kind, options.settings)
}

export type { AIProvider, ProviderKind }