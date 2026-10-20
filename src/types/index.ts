export type BookFormat = 'epub' | 'pdf'

export type ProcessingMode = 'summary' | 'chapter-mindmap' | 'book-mindmap'

export interface Chapter {
  id: string
  title: string
  level: number
  startPage?: number
  endPage?: number
  href?: string
  content?: string
  groupId?: string
}

export interface ChapterGroup {
  id: string
  name: string
  chapterIds: string[]
}

export interface BookMeta {
  id: string
  fileName: string
  format: BookFormat
  title?: string
  author?: string
  cover?: string
}

export interface AdvancedOptions {
  smartChapterDetection: boolean
  skipIrrelevantChapters: boolean
  subchapterDepth: number
}

export interface SummaryResult {
  chapterSummaries: Record<string, string>
  chapterRelations: string
  bookSummary: string
}

export interface MindMapNode {
  id: string
  topic: string
  children?: MindMapNode[]
  detail?: string
}

export interface MindMapResult {
  roots: MindMapNode[]
}

export interface ProcessingProgress {
  total: number
  completed: number
  currentStep: string
  status: 'idle' | 'running' | 'paused' | 'done' | 'error'
  error?: string
}