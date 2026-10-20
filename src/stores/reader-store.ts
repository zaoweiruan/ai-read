import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ReaderFontFamily = 'sans' | 'serif' | 'kai'
export type ReaderTheme = 'day' | 'sepia' | 'green' | 'night'

interface TypographyState {
  fontSize: number
  lineHeight: number
  letterSpacing: number
  fontFamily: ReaderFontFamily
  theme: ReaderTheme
}

interface ReaderState extends TypographyState {
  outlineVisible: boolean
  summaryVisible: boolean
  setFontSize: (size: number) => void
  setLineHeight: (v: number) => void
  setLetterSpacing: (v: number) => void
  setFontFamily: (v: ReaderFontFamily) => void
  setTheme: (v: ReaderTheme) => void
  setOutlineVisible: (v: boolean) => void
  setSummaryVisible: (v: boolean) => void
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

export const useReaderStore = create<ReaderState>()(
  persist(
    (set) => ({
      ...DEFAULT_TYPOGRAPHY,
      outlineVisible: true,
      summaryVisible: true,
      setFontSize: (size) => set({ fontSize: clampFontSize(size) }),
      setLineHeight: (lineHeight) => set({ lineHeight }),
      setLetterSpacing: (letterSpacing) => set({ letterSpacing }),
      setFontFamily: (fontFamily) => set({ fontFamily }),
      setTheme: (theme) => set({ theme }),
      setOutlineVisible: (outlineVisible) => set({ outlineVisible }),
      setSummaryVisible: (summaryVisible) => set({ summaryVisible }),
      resetTypography: () => set({ ...DEFAULT_TYPOGRAPHY }),
    }),
    { name: 'ai-read:reader' },
  ),
)
