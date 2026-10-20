import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const STORAGE_KEY = 'ai-read:prompts'

export interface CustomPrompt {
  id: string
  name: string
  description: string
  content: string
  createdAt: number
}

interface PromptState {
  prompts: CustomPrompt[]
  activePromptId?: string
  onlyCustom: boolean
  addPrompt: (prompt: Omit<CustomPrompt, 'id' | 'createdAt'>) => void
  updatePrompt: (id: string, patch: Partial<CustomPrompt>) => void
  removePrompt: (id: string) => void
  setActivePrompt: (id?: string) => void
  setOnlyCustom: (value: boolean) => void
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export const usePromptStore = create<PromptState>()(
  persist(
    (set) => ({
      prompts: [],
      activePromptId: undefined,
      onlyCustom: false,
      addPrompt: (prompt) =>
        set((state) => ({
          prompts: [
            ...state.prompts,
            { ...prompt, id: genId(), createdAt: Date.now() },
          ],
        })),
      updatePrompt: (id, patch) =>
        set((state) => ({
          prompts: state.prompts.map((p) =>
            p.id === id ? { ...p, ...patch } : p,
          ),
        })),
      removePrompt: (id) =>
        set((state) => {
          const prompts = state.prompts.filter((p) => p.id !== id)
          return {
            prompts,
            activePromptId:
              state.activePromptId === id ? undefined : state.activePromptId,
          }
        }),
      setActivePrompt: (id) => set({ activePromptId: id }),
      setOnlyCustom: (value) => set({ onlyCustom: value }),
    }),
    { name: STORAGE_KEY },
  ),
)