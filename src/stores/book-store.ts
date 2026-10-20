import { create } from 'zustand'
import type {
  BookMeta,
  Chapter,
  ChapterGroup,
  MindMapResult,
  ProcessingProgress,
  SummaryResult,
} from '@/types'

interface BookState {
  book: BookMeta | null
  bookData: ArrayBuffer | null
  chapters: Chapter[]
  selectedChapterIds: string[]
  activeChapterId: string | null
  groups: ChapterGroup[]
  progress: ProcessingProgress
  summary: SummaryResult | null
  mindMap: MindMapResult | null
  setBook: (book: BookMeta | null) => void
  setBookData: (data: ArrayBuffer | null) => void
  setChapters: (chapters: Chapter[]) => void
  setActiveChapterId: (id: string | null) => void
  setSummary: (summary: SummaryResult | null) => void
  setMindMap: (mindMap: MindMapResult | null) => void
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

export const useBookStore = create<BookState>((set) => ({
  book: null,
  bookData: null,
  chapters: [],
  selectedChapterIds: [],
  activeChapterId: null,
  groups: [],
  progress: initialProgress,
  summary: null,
  mindMap: null,
  setBook: (book) => set({ book }),
  setBookData: (data) => set({ bookData: data }),
  setChapters: (chapters) =>
    set({
      chapters,
      selectedChapterIds: chapters.map((c) => c.id),
      activeChapterId: chapters[0]?.id ?? null,
      summary: null,
      mindMap: null,
    }),
  setActiveChapterId: (id) => set({ activeChapterId: id }),
  setSummary: (summary) => set({ summary }),
  setMindMap: (mindMap) => set({ mindMap }),
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
      groups: [],
      progress: initialProgress,
      summary: null,
      mindMap: null,
    }),
}))