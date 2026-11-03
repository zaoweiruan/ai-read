// src/lib/translate-cache.ts
// 翻译结果本地缓存，避免相同文本重复请求免费端点（减轻 429 限流）。

const CACHE_KEY = 'ai-read:translate-cache'

function load(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

function save(cache: Record<string, string>) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    // ignore quota errors
  }
}

function hash(text: string): string {
  let h = 5381
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) >>> 0
  }
  return h.toString(36)
}

export function makeCacheKey(mode: string, sourceLang: string, targetLang: string, text: string): string {
  return `${mode}|${sourceLang}|${targetLang}|${hash(text)}`
}

export function getCached(mode: string, sourceLang: string, targetLang: string, text: string): string | null {
  const cache = load()
  return cache[makeCacheKey(mode, sourceLang, targetLang, text)] ?? null
}

export function setCached(mode: string, sourceLang: string, targetLang: string, text: string, translated: string) {
  const cache = load()
  cache[makeCacheKey(mode, sourceLang, targetLang, text)] = translated
  // 简单限流：超过 500 条时清空
  const keys = Object.keys(cache)
  if (keys.length > 500) {
    for (let i = 0; i < keys.length - 400; i++) delete cache[keys[i]]
  }
  save(cache)
}