import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { ProviderSettings, TranslationSettings } from '@/types/settings'
import { DEFAULT_RECENT_LIMIT, clampRecentLimit } from '@/lib/recent-limit'

const STORAGE_KEY = 'ai-read:settings'

const safeStorage = {
  getItem: (name: string): string | null => {
    try {
      return window.localStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      window.localStorage.setItem(name, value)
    } catch {
      return
    }
  },
  removeItem: (name: string): void => {
    try {
      window.localStorage.removeItem(name)
    } catch {
      return
    }
  },
}

function normalizeProviders(raw: unknown): ProviderSettings[] {
  if (!Array.isArray(raw)) return []
  const out: ProviderSettings[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const p = item as Record<string, unknown>
    if (typeof p.id !== 'string' || p.id.length === 0) continue
    if (typeof p.name !== 'string' || p.name.length === 0) continue
    const kind = p.kind === 'google' ? 'google' : 'openai-compatible'
    out.push({
      id: p.id,
      name: p.name,
      kind,
      apiKey: typeof p.apiKey === 'string' ? p.apiKey : '',
      baseUrl: typeof p.baseUrl === 'string' ? p.baseUrl : '',
      model: typeof p.model === 'string' ? p.model : '',
    })
  }
  return out
}

interface SettingsState {
  providers: ProviderSettings[]
  activeProviderId?: string
  addProvider: (provider: ProviderSettings) => void
  updateProvider: (id: string, patch: Partial<ProviderSettings>) => void
  removeProvider: (id: string) => void
  setActiveProvider: (id: string) => void
  getActiveProvider: () => ProviderSettings | undefined
  recentFilesLimit: number
  setRecentFilesLimit: (limit: number) => void
  translation: TranslationSettings
  setTranslation: (patch: Partial<TranslationSettings>) => void
  isConfigured: () => boolean
}

const baseSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      providers: [],
      activeProviderId: undefined,
      recentFilesLimit: DEFAULT_RECENT_LIMIT,
      translation: { mode: 'mymemory', sourceLang: 'en', targetLang: 'zh-CN', laraAccessKeyId: '', laraAccessKeySecret: '' },
      addProvider: (provider) =>
        set((state) => ({
          providers: [...state.providers, provider],
          activeProviderId: state.activeProviderId ?? provider.id,
        })),
      updateProvider: (id, patch) =>
        set((state) => ({
          providers: state.providers.map((p) =>
            p.id === id ? { ...p, ...patch } : p,
          ),
        })),
      removeProvider: (id) =>
        set((state) => {
          const providers = state.providers.filter((p) => p.id !== id)
          return {
            providers,
            activeProviderId:
              state.activeProviderId === id
                ? providers[0]?.id
                : state.activeProviderId,
          }
        }),
      setActiveProvider: (id) => set({ activeProviderId: id }),
      setRecentFilesLimit: (limit) => set({ recentFilesLimit: clampRecentLimit(limit) }),
      setTranslation: (patch) => set((state) => ({ translation: { ...state.translation, ...patch } })),
      getActiveProvider: () => {
        const { providers, activeProviderId } = get()
        return providers.find((p) => p.id === activeProviderId) ?? providers[0]
      },
      isConfigured: () => {
        const p = get().getActiveProvider()
        return Boolean(p?.model && p?.apiKey)
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        providers: state.providers,
        activeProviderId: state.activeProviderId,
        recentFilesLimit: state.recentFilesLimit,
        translation: state.translation,
      }),
      merge: (persisted, current) => {
        if (!persisted || typeof persisted !== 'object') return current
        const p = persisted as Record<string, unknown>
        const next: Partial<SettingsState> = {
          providers: normalizeProviders(p.providers),
        }
        if (typeof p.activeProviderId === 'string' && p.activeProviderId.length > 0) {
          next.activeProviderId = p.activeProviderId
        }
        if (typeof p.recentFilesLimit === 'number' && Number.isFinite(p.recentFilesLimit)) {
          next.recentFilesLimit = p.recentFilesLimit
        }
        if (p.translation && typeof p.translation === 'object') {
          const t = p.translation as Record<string, unknown>
          next.translation = {
            mode:
              t.mode === 'ai'
                ? 'ai'
                : t.mode === 'lara'
                  ? 'lara'
                  : t.mode === 'google'
                    ? 'google'
                    : 'mymemory',
            sourceLang: typeof t.sourceLang === 'string' ? t.sourceLang : 'en',
            targetLang: typeof t.targetLang === 'string' ? t.targetLang : 'zh-CN',
            laraAccessKeyId: typeof t.laraAccessKeyId === 'string' ? t.laraAccessKeyId : '',
            laraAccessKeySecret: typeof t.laraAccessKeySecret === 'string' ? t.laraAccessKeySecret : '',
          }
        }
        return { ...current, ...next }
      },
    },
  ),
)

type SettingsStore = typeof baseSettingsStore

const scope = globalThis as typeof globalThis & { __aiReadSettingsStore?: SettingsStore }

export const useSettingsStore: SettingsStore =
  scope.__aiReadSettingsStore ?? (scope.__aiReadSettingsStore = baseSettingsStore)