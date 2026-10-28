import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { BookFormat } from '@/types'
import { clampRecentLimit, MAX_RECENT_LIMIT } from '@/lib/recent-limit'
import { clearCachedFiles, dropCachedFile } from '@/lib/recent-file-cache'
import { deleteHandle, clearHandles } from '@/lib/file-handle-store'
import { useSettingsStore } from './settings-store'

export interface RecentFileRecord {
  id: string
  fileName: string
  size: number
  format: BookFormat
  title?: string
  author?: string
  openedAt: number
}

export type RecentFileInput = Omit<RecentFileRecord, 'id' | 'openedAt'>

interface RecentFilesState {
  records: RecentFileRecord[]
  addRecent: (input: RecentFileInput) => void
  removeRecent: (id: string) => void
  clearRecent: () => void
  trimTo: (limit: number) => void
}

const STORAGE_KEY = 'ai-read:recent-files'

export function recentKeyOf(fileName: string, size: number): string {
  return `${fileName}:${size}`
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10)
}

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

function normalizeRecord(raw: unknown): RecentFileRecord | null {
  if (typeof raw !== 'object' || raw === null) return null
  const rec = raw as Record<string, unknown>
  if (typeof rec.fileName !== 'string' || rec.fileName.length === 0) return null
  if (typeof rec.size !== 'number' || !Number.isFinite(rec.size)) return null
  if (
    rec.format !== 'epub' &&
    rec.format !== 'pdf' &&
    rec.format !== 'markdown'
  ) {
    return null
  }
  const out: RecentFileRecord = {
    id: typeof rec.id === 'string' && rec.id.length > 0 ? rec.id : genId(),
    fileName: rec.fileName,
    size: rec.size,
    format: rec.format,
    openedAt: typeof rec.openedAt === 'number' && Number.isFinite(rec.openedAt) ? rec.openedAt : 0,
  }
  if (typeof rec.title === 'string') out.title = rec.title
  if (typeof rec.author === 'string') out.author = rec.author
  return out
}

function normalizeRecords(raw: unknown): RecentFileRecord[] | undefined {
  if (!Array.isArray(raw)) return undefined
  return raw
    .map(normalizeRecord)
    .filter((r): r is RecentFileRecord => r !== null)
    .slice(0, MAX_RECENT_LIMIT)
}

const baseRecentFilesStore = create<RecentFilesState>()(
  persist(
    (set) => ({
      records: [],
      addRecent: (input) =>
        set((state) => {
          const key = recentKeyOf(input.fileName, input.size)
          const rest = state.records.filter(
            (r) => recentKeyOf(r.fileName, r.size) !== key,
          )
          const record: RecentFileRecord = {
            ...input,
            id: genId(),
            openedAt: Date.now(),
          }
          const limit = clampRecentLimit(
            useSettingsStore.getState().recentFilesLimit,
          )
          return { records: [record, ...rest].slice(0, limit) }
        }),
      removeRecent: (id) =>
        set((state) => {
          const target = state.records.find((r) => r.id === id)
          if (target) {
            const key = recentKeyOf(target.fileName, target.size)
            dropCachedFile(key)
            void deleteHandle(key).catch(() => {})
          }
          return { records: state.records.filter((r) => r.id !== id) }
        }),
      clearRecent: () => {
        clearCachedFiles()
        void clearHandles().catch(() => {})
        set({ records: [] })
      },
      trimTo: (limit) =>
        set((state) => ({
          records: state.records.slice(0, clampRecentLimit(limit)),
        })),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => safeStorage),
      merge: (persisted, current) => {
        if (!persisted || typeof persisted !== 'object') return current
        const rec = persisted as Partial<RecentFilesState>
        const records = normalizeRecords(rec.records)
        return records ? { ...current, records } : current
      },
      partialize: (state) => ({ records: state.records }),
    },
  ),
)

type RecentFilesStore = typeof baseRecentFilesStore

const scope = globalThis as typeof globalThis & {
  __aiReadRecentFilesStore?: RecentFilesStore
}

export const useRecentFilesStore: RecentFilesStore =
  scope.__aiReadRecentFilesStore ??
  (scope.__aiReadRecentFilesStore = baseRecentFilesStore)
