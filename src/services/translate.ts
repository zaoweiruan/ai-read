// src/services/translate.ts
// 免费翻译端点封装（MyMemory / Google）。浏览器直连，无需 API Key，无 CORS 限制。
// 约束（实测）：MyMemory 不支持 auto 源语言；源/目标语言必须显式指定 ISO/RFC3066 码。

import { getCached, setCached } from '@/lib/translate-cache'

export interface TranslateOptions {
  sourceLang: string
  targetLang: string
  signal?: AbortSignal
}

const MYMEMORY_ENDPOINT = 'https://api.mymemory.translated.net/get'

// 单段翻译（MyMemory 单次请求建议 ≤ 500 字符）
async function translateChunk(
  text: string,
  sourceLang: string,
  targetLang: string,
  signal?: AbortSignal,
): Promise<string> {
  const cached = getCached('mymemory', sourceLang, targetLang, text)
  if (cached) return cached
  const url =
    `${MYMEMORY_ENDPOINT}?q=${encodeURIComponent(text)}` +
    `&langpair=${encodeURIComponent(sourceLang)}|${encodeURIComponent(targetLang)}`
  const maxAttempts = 4
  let lastErr: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (signal?.aborted) throw new DOMException('已取消', 'AbortError')
    let res: Response
    try {
      res = await fetch(url, { signal })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e
      lastErr = e
      if (attempt < maxAttempts - 1) {
        await sleep(1000 * 2 ** attempt, signal)
        continue
      }
      throw e
    }
    if (res.ok) {
      const data = (await res.json()) as {
        responseData?: { translatedText?: string }
      }
      const translated = data.responseData?.translatedText
      if (!translated) throw new Error('翻译返回为空')
      if (/INVALID SOURCE LANGUAGE/i.test(translated)) {
        throw new Error(`不支持的源语言: ${sourceLang}`)
      }
      // 配额耗尽时 MyMemory 可能以 200 返回警告文本冒充译文——识别为错误而非结果
      if (/MYMEMORY WARNING/i.test(translated)) {
        throw new Error(
          /QUOTA|USED ALL|LIMIT/i.test(translated)
            ? '翻译请求失败: MyMemory 免费额度已用尽，请稍后重试，或在配置中切换为「使用 AI 提供商」'
            : `翻译请求失败: ${translated}`,
        )
      }
      setCached('mymemory', sourceLang, targetLang, text, translated)
      return translated
    }
    // 429 限流 / 5xx 服务端瞬时错误 → 退避重试
    if ((res.status === 429 || res.status >= 500) && attempt < maxAttempts - 1) {
      await res.text().catch(() => {})
      await sleep(1000 * 2 ** attempt, signal)
      continue
    }
    const body = await res.text().catch(() => '')
    if (res.status === 429) {
      if (attempt < maxAttempts - 1) {
        await sleep(3000 * (attempt + 1), signal)
        continue
      }
      throw new Error(
        '翻译请求失败: 429（MyMemory 免费端点限流）。请稍后重试，或在配置中切换为「使用 AI 提供商」',
      )
    }
    throw new Error(`翻译请求失败: ${res.status} ${body}`)
  }
  throw (lastErr as Error) ?? new Error('翻译请求失败')
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('已取消', 'AbortError'))
      return
    }
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(t)
      reject(new DOMException('已取消', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

// 按段落/句子切分，每段 ≤ maxLen
export function chunkText(text: string, maxLen = 450): string[] {
  const chunks: string[] = []
  const paragraphs = text.split(/\n{2,}/)
  for (const para of paragraphs) {
    if (para.length <= maxLen) {
      chunks.push(para)
      continue
    }
    // 按句子切
    const sentences = para.split(/(?<=[。！？.!?])\s*/)
    let buf = ''
    for (const s of sentences) {
      if (buf && buf.length + s.length > maxLen) {
        chunks.push(buf)
        buf = s
      } else {
        buf += s
      }
    }
    if (buf) chunks.push(buf)
  }
  return chunks.filter((c) => c.trim().length > 0)
}

export async function translateMyMemory(
  text: string,
  opts: TranslateOptions,
): Promise<string> {
  const chunks = chunkText(text)
  const out: string[] = []
  for (let i = 0; i < chunks.length; i++) {
    // 串行，避免触发限流
    const t = await translateChunk(chunks[i], opts.sourceLang, opts.targetLang, opts.signal)
    out.push(t)
    if (i < chunks.length - 1) await sleep(400, opts.signal)
  }
  return out.join('\n\n')
}

const GOOGLE_ENDPOINT = 'https://translate.googleapis.com/translate_a/single'

// 单段翻译（Google 免费端点，client=gtx，无需 Key）
async function translateGoogleChunk(
  text: string,
  sourceLang: string,
  targetLang: string,
  signal?: AbortSignal,
): Promise<string> {
  const cached = getCached('google', sourceLang, targetLang, text)
  if (cached) return cached
  const url =
    `${GOOGLE_ENDPOINT}?client=gtx&sl=${encodeURIComponent(sourceLang)}` +
    `&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`
  const maxAttempts = 4
  let lastErr: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (signal?.aborted) throw new DOMException('已取消', 'AbortError')
    let res: Response
    try {
      res = await fetch(url, { signal })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e
      lastErr = e
      if (attempt < maxAttempts - 1) {
        await sleep(1000 * 2 ** attempt, signal)
        continue
      }
      throw (lastErr as Error) ?? new Error('翻译请求失败')
    }
    if (res.ok) {
      try {
        const data = (await res.json()) as unknown
        // gtx 响应形如 [[["译文","原文",...],...], null, "src", ...]
        const sentences = Array.isArray(data) && Array.isArray(data[0]) ? data[0] : []
        const translated = sentences
          .map((s) => (Array.isArray(s) && typeof s[0] === 'string' ? s[0] : ''))
          .join('')
        if (!translated.trim()) throw new Error('翻译返回为空')
        setCached('google', sourceLang, targetLang, text, translated)
        return translated
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') throw e
        if (e instanceof Error && e.message === '翻译返回为空') throw e
        lastErr = e
        if (attempt < maxAttempts - 1) {
          await sleep(1000 * 2 ** attempt, signal)
          continue
        }
        throw (lastErr as Error) ?? new Error('翻译请求失败')
      }
    }
    const body = await res.text().catch(() => '')
    if (res.status === 429) {
      if (attempt < maxAttempts - 1) {
        await sleep(3000 * (attempt + 1), signal)
        continue
      }
      throw new Error(
        '翻译请求失败: 429（Google 免费端点限流）。请稍后重试，或在配置中切换翻译方式',
      )
    }
    if (res.status >= 500) {
      lastErr = new Error(`翻译请求失败: ${res.status} ${body}`)
      if (attempt < maxAttempts - 1) {
        await sleep(1000 * 2 ** attempt, signal)
        continue
      }
      throw lastErr
    }
    throw new Error(`翻译请求失败: ${res.status} ${body}`)
  }
  throw (lastErr as Error) ?? new Error('翻译请求失败')
}

export async function translateGoogle(
  text: string,
  opts: TranslateOptions,
): Promise<string> {
  const chunks = chunkText(text)
  const out: string[] = []
  for (let i = 0; i < chunks.length; i++) {
    // 串行，避免触发限流
    const t = await translateGoogleChunk(chunks[i], opts.sourceLang, opts.targetLang, opts.signal)
    out.push(t)
    if (i < chunks.length - 1) await sleep(400, opts.signal)
  }
  return out.join('\n\n')
}

export interface FreeTranslateVerifyResult {
  ok: boolean
  message: string
}

// 测试免费翻译端点可用性（MyMemory / Google）
export async function verifyFreeTranslate(
  mode: 'mymemory' | 'google',
  sourceLang: string,
  targetLang: string,
): Promise<FreeTranslateVerifyResult> {
  const timeoutMs = 8000
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    if (mode === 'mymemory') {
      const sl = sourceLang === 'auto' ? 'en' : sourceLang
      const url =
        `${MYMEMORY_ENDPOINT}?q=${encodeURIComponent('hello')}` +
        `&langpair=${encodeURIComponent(sl)}|${encodeURIComponent(targetLang)}`
      const res = await fetch(url, { signal: ctrl.signal })
      const data = (await res.json().catch(() => null)) as
        | { responseData?: { translatedText?: string } }
        | null
      const translated = data?.responseData?.translatedText ?? ''
      if (!res.ok) return { ok: false, message: `不可用：HTTP ${res.status}` }
      if (!translated) return { ok: false, message: '不可用：返回为空' }
      if (/MYMEMORY WARNING/i.test(translated)) {
        return { ok: false, message: `配额受限：${translated}` }
      }
      return { ok: true, message: `可用：${translated}` }
    }
    // google
    const sl = sourceLang || 'auto'
    const url =
      `${GOOGLE_ENDPOINT}?client=gtx&sl=${encodeURIComponent(sl)}` +
      `&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent('hello')}`
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) return { ok: false, message: `不可用：HTTP ${res.status}` }
    const data = (await res.json().catch(() => null)) as unknown
    const sentences =
      Array.isArray(data) && Array.isArray((data as unknown[])[0])
        ? ((data as unknown[])[0] as unknown[])
        : []
    const translated = sentences
      .map((s) => (Array.isArray(s) && typeof s[0] === 'string' ? s[0] : ''))
      .join('')
    if (!translated.trim()) return { ok: false, message: '不可用：返回为空' }
    return { ok: true, message: `可用：${translated}` }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      return { ok: false, message: `超时（${timeoutMs / 1000}s）：无法访问端点` }
    }
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, message: `网络错误：${msg}` }
  } finally {
    clearTimeout(timer)
  }
}
