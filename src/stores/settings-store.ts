import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ProviderSettings } from '@/types/settings'

const STORAGE_KEY = 'ai-read:settings'

interface SettingsState {
  providers: ProviderSettings[]
  activeProviderId?: string
  addProvider: (provider: ProviderSettings) => void
  updateProvider: (id: string, patch: Partial<ProviderSettings>) => void
  removeProvider: (id: string) => void
  setActiveProvider: (id: string) => void
  getActiveProvider: () => ProviderSettings | undefined
  isConfigured: () => boolean
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      providers: [],
      activeProviderId: undefined,
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
      getActiveProvider: () => {
        const { providers, activeProviderId } = get()
        return providers.find((p) => p.id === activeProviderId) ?? providers[0]
      },
      isConfigured: () => {
        const p = get().getActiveProvider()
        return Boolean(p?.model && p?.apiKey)
      },
    }),
    { name: STORAGE_KEY },
  ),
)