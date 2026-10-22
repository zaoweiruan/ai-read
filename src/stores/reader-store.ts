import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ReaderFontFamily = 'sans' | 'serif' | 'kai'
export type ReaderTheme = 'day' | 'sepia' | 'green' | 'night'
export type ReaderPageMode = 'continuous' | 'paged'

interface TypographyState {
  fontSize: number
  lineHeight: number
  letterSpacing: number
  fontFamily: ReaderFontFamily
  theme: ReaderTheme
}

interface ReaderState extends TypographyState {
  outlineVisible: boolean
  processingVisible: boolean
  twoPage: boolean
  pageMode: ReaderPageMode
  setFontSize: (size: number) => void
  setLineHeight: (v: number) => void
  setLetterSpacing: (v: number) => void
  setFontFamily: (v: ReaderFontFamily) => void
  setTheme: (v: ReaderTheme) => void
  setOutlineVisible: (v: boolean) => void
  setProcessingVisible: (v: boolean) => void
  setTwoPage: (v: boolean) => void
  setPageMode: (v: ReaderPageMode) => void
  resetTypography: () => void
}

export const DEFAULT_TYPOGRAPHY: TypographyState = {
  fontSize: 18,
  lineHeight: 1.9,
  letterSpacing: 0.02,
  fontFamily: 'sans',
  theme: 'day',
}

const clampFontSize = (size: number): number =>
  Math.min(22, Math.max(15, Math.round(size)))

const baseReaderStore = create<ReaderState>()(
  persist(
    (set) => ({
      ...DEFAULT_TYPOGRAPHY,
      outlineVisible: true,
      processingVisible: true,
      twoPage: false,
      pageMode: 'continuous',
      setFontSize: (size) => set({ fontSize: clampFontSize(size) }),
      setLineHeight: (lineHeight) => set({ lineHeight }),
      setLetterSpacing: (letterSpacing) => set({ letterSpacing }),
      setFontFamily: (fontFamily) => set({ fontFamily }),
      setTheme: (theme) => set({ theme }),
      setOutlineVisible: (outlineVisible) => set({ outlineVisible }),
      setProcessingVisible: (processingVisible) => set({ processingVisible }),
      setTwoPage: (twoPage) => set({ twoPage }),
      setPageMode: (pageMode) => set({ pageMode }),
      resetTypography: () => set({ ...DEFAULT_TYPOGRAPHY }),
    }),
    { name: 'ai-read:reader' },
  ),
)

type ReaderStore = typeof baseReaderStore

const scope = globalThis as typeof globalThis & { __aiReadReaderStore?: ReaderStore }

export const useReaderStore: ReaderStore =
  scope.__aiReadReaderStore ?? (scope.__aiReadReaderStore = baseReaderStore)
