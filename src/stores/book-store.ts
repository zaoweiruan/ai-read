import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type {
  BookMeta,
  Chapter,
  ChapterGroup,
  MindMapResult,
  ProcessingMode,
  ProcessingProgress,
  ReadingRestore,
  SummaryResult,
} from '@/types'

interface BookState {
  book: BookMeta | null
  bookData: ArrayBuffer | null
  chapters: Chapter[]
  selectedChapterIds: string[]
  activeChapterId: string | null
  chapterRequest: number
  groups: ChapterGroup[]
  progress: ProcessingProgress
  summary: SummaryResult | null
  mindMap: MindMapResult | null
  mindMapScope: 'book' | 'chapter' | null
  activeMode: ProcessingMode
  pendingRestore: ReadingRestore | null
  setBook: (book: BookMeta | null) => void
  setBookData: (data: ArrayBuffer | null) => void
  setChapters: (chapters: Chapter[]) => void
  setActiveChapterId: (id: string | null) => void
  requestChapter: (id: string) => void
  setPendingRestore: (restore: ReadingRestore | null) => void
  setSummary: (summary: SummaryResult | null) => void
  setMindMap: (mindMap: MindMapResult | null) => void
  setMindMapScope: (scope: 'book' | 'chapter' | null) => void
  setActiveMode: (mode: ProcessingMode) => void
  toggleChapter: (id: string) => void
  selectAllChapters: () => void
  clearSelection: () => void
  addGroup: (group: ChapterGroup) => void
  removeGroup: (id: string) => void
  setProgress: (progress: Partial<ProcessingProgress>) => void
  reset: () => void
}

const initialProgress: ProcessingProgress = {
  total: 0,
  completed: 0,
  currentStep: '',
  status: 'idle',
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

const baseBookStore = create<BookState>()(
  persist(
    (set) => ({
      book: null,
      bookData: null,
      chapters: [],
      selectedChapterIds: [],
      activeChapterId: null,
      chapterRequest: 0,
      groups: [],
      progress: initialProgress,
      summary: null,
      mindMap: null,
      mindMapScope: null,
      activeMode: 'summary',
      pendingRestore: null,
      setBook: (book) => set({ book }),
      setBookData: (data) => set({ bookData: data }),
      setChapters: (chapters) =>
        set({
          chapters,
          selectedChapterIds: [],
          activeChapterId: chapters[0]?.id ?? null,
          summary: null,
          mindMap: null,
          mindMapScope: null,
        }),
      setActiveChapterId: (id) => set({ activeChapterId: id }),
      requestChapter: (id) =>
        set((state) => ({ activeChapterId: id, chapterRequest: state.chapterRequest + 1 })),
      setPendingRestore: (restore) => set({ pendingRestore: restore }),
      setSummary: (summary) => set({ summary }),
      setMindMap: (mindMap) => set({ mindMap }),
      setMindMapScope: (mindMapScope) => set({ mindMapScope }),
      setActiveMode: (activeMode) => set({ activeMode }),
      toggleChapter: (id) =>
        set((state) => ({
          selectedChapterIds: state.selectedChapterIds.includes(id)
            ? state.selectedChapterIds.filter((x) => x !== id)
            : [...state.selectedChapterIds, id],
        })),
      selectAllChapters: () =>
        set((state) => ({ selectedChapterIds: state.chapters.map((c) => c.id) })),
      clearSelection: () => set({ selectedChapterIds: [] }),
      addGroup: (group) => set((state) => ({ groups: [...state.groups, group] })),
      removeGroup: (id) =>
        set((state) => ({ groups: state.groups.filter((g) => g.id !== id) })),
      setProgress: (progress) =>
        set((state) => ({ progress: { ...state.progress, ...progress } })),
      reset: () =>
        set({
          book: null,
          bookData: null,
          chapters: [],
          selectedChapterIds: [],
          activeChapterId: null,
          chapterRequest: 0,
          groups: [],
          progress: initialProgress,
          summary: null,
          mindMap: null,
          mindMapScope: null,
          activeMode: 'summary',
          pendingRestore: null,
        }),
    }),
    {
      name: 'ai-read:book',
      storage: createJSONStorage(() => safeStorage),
      merge: (persisted, current) => {
        // bookData（PDF/EPUB 二进制）不参与持久化，页面刷新后必然丢失；
        // 若此时仍恢复 book/chapters，界面会出现「目录看似已加载、正文却无内容」的矛盾状态，
        // 因此直接丢弃陈旧数据回到统一的未加载界面，并把陈旧 blob 从 localStorage 清除
        if (persisted && typeof persisted === 'object' && (persisted as BookState).book) {
          safeStorage.removeItem('ai-read:book')
          return current
        }
        return (persisted ?? current) as BookState
      },
      partialize: (state) => ({
        book: state.book,
        chapters: state.chapters,
        selectedChapterIds: state.selectedChapterIds,
        activeChapterId: state.activeChapterId,
        groups: state.groups,
        summary: state.summary,
        mindMap: state.mindMap,
        mindMapScope: state.mindMapScope,
        activeMode: state.activeMode,
      }),
    },
  ),
)

type BookStore = typeof baseBookStore

const scope = globalThis as typeof globalThis & { __aiReadBookStore?: BookStore }

export const useBookStore: BookStore =
  scope.__aiReadBookStore ?? (scope.__aiReadBookStore = baseBookStore)