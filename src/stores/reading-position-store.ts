import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export interface ReadingPosition {
  chapterId: string
  scrollRatio?: number
  pageIndex?: number
  pdfPage?: number
  updatedAt: number
}

export interface ReadingPositionPatch {
  chapterId: string
  scrollRatio?: number
  pageIndex?: number
  pdfPage?: number
}

interface ReadingPositionState {
  positions: Record<string, ReadingPosition>
  savePosition: (bookKey: string, patch: ReadingPositionPatch) => void
  getPosition: (bookKey: string) => ReadingPosition | null
}

const MAX_BOOKS = 20

export function bookKeyOf(fileName: string, size?: number): string {
  return `${fileName}:${size ?? ''}`
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

function normalizePosition(raw: unknown): ReadingPosition | null {
  if (typeof raw !== 'object' || raw === null) return null
  const rec = raw as Record<string, unknown>
  if (typeof rec.chapterId !== 'string' || rec.chapterId.length === 0) return null
  const out: ReadingPosition = {
    chapterId: rec.chapterId,
    updatedAt: typeof rec.updatedAt === 'number' ? rec.updatedAt : 0,
  }
  if (typeof rec.scrollRatio === 'number' && Number.isFinite(rec.scrollRatio)) {
    out.scrollRatio = rec.scrollRatio
  }
  if (typeof rec.pageIndex === 'number' && Number.isFinite(rec.pageIndex)) {
    out.pageIndex = rec.pageIndex
  }
  if (typeof rec.pdfPage === 'number' && Number.isFinite(rec.pdfPage)) {
    out.pdfPage = rec.pdfPage
  }
  return out
}

const baseReadingPositionStore = create<ReadingPositionState>()(
  persist(
    (set, get) => ({
      positions: {},
      savePosition: (bookKey, patch) =>
        set((state) => {
          const prev = state.positions[bookKey]
          const next: ReadingPosition = {
            ...prev,
            ...patch,
            updatedAt: Date.now(),
          }
          const positions: Record<string, ReadingPosition> = {
            ...state.positions,
            [bookKey]: next,
          }
          const keys = Object.keys(positions)
          if (keys.length > MAX_BOOKS) {
            keys.sort((a, b) => positions[a].updatedAt - positions[b].updatedAt)
            for (const key of keys.slice(0, keys.length - MAX_BOOKS)) {
              delete positions[key]
            }
          }
          return { positions }
        }),
      getPosition: (bookKey) => {
        const rec = get().positions[bookKey]
        return normalizePosition(rec)
      },
    }),
    {
      name: 'ai-read:reading-pos',
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({ positions: state.positions }),
    },
  ),
)

type ReadingPositionStore = typeof baseReadingPositionStore

const scope = globalThis as typeof globalThis & {
  __aiReadReadingPositionStore?: ReadingPositionStore
}

export const useReadingPositionStore: ReadingPositionStore =
  scope.__aiReadReadingPositionStore ??
  (scope.__aiReadReadingPositionStore = baseReadingPositionStore)

export function saveReadingPosition(
  bookKey: string,
  patch: ReadingPositionPatch,
): void {
  useReadingPositionStore.getState().savePosition(bookKey, patch)
}

export function getReadingPosition(bookKey: string): ReadingPosition | null {
  return useReadingPositionStore.getState().getPosition(bookKey)
}
