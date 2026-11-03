// src/services/lara.ts
// Lara 翻译 API 封装（签名认证 + /v2/translate）。浏览器直连，BYO access key/secret。

import type { TranslateOptions } from './translate'
import { chunkText, sleep } from './translate'
import { getCached, setCached } from '@/lib/translate-cache'

const LARA_BASE = 'https://api.laratranslate.com'

interface TokenCache {
  token: string
  refreshToken?: string
  expiresAt: number
}

const tokenCache = new Map<string, TokenCache>()

async function sha256First16Base64(data: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))
  const first16 = buf.slice(0, 16)
  return btoa(String.fromCharCode(...new Uint8Array(first16)))
}

async function hmacBase64(key: string, data: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: { name: 'SHA-256' } },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data))
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
}

function decodeJwtExp(token: string): number {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return Date.now() + 5 * 60 * 1000
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    while (b64.length % 4) b64 += '='
    const decoded = typeof Buffer !== 'undefined' ? Buffer.from(b64, 'base64').toString('utf-8') : atob(b64)
    const { exp } = JSON.parse(decoded)
    return typeof exp === 'number' ? exp * 1000 : Date.now() + 5 * 60 * 1000
  } catch {
    return Date.now() + 5 * 60 * 1000
  }
}

async function authenticate(accessKeyId: string, secret: string): Promise<TokenCache> {
  const body = { id: accessKeyId }
  const bodyStr = JSON.stringify(body)
  const contentMD5 = await sha256First16Base64(bodyStr)
  const date = new Date().toUTCString()
  const challenge = `POST\n/v2/auth\n${contentMD5}\napplication/json\n${date}`
  const signature = await hmacBase64(secret, challenge)
  const res = await fetch(`${LARA_BASE}/v2/auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Lara-Date': date,
      'Content-MD5': contentMD5,
      Authorization: `Lara:${signature}`,
    },
    body: bodyStr,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Lara 认证失败: ${res.status} ${text}`)
  }
  const data = (await res.json()) as { token?: string }
  if (!data?.token) throw new Error('Lara 认证返回无 token')
  const refreshToken = res.headers.get('x-lara-refresh-token') || undefined
  const cache: TokenCache = {
    token: data.token,
    refreshToken,
    expiresAt: decodeJwtExp(data.token),
  }
  tokenCache.set(accessKeyId, cache)
  return cache
}

async function getToken(accessKeyId: string, secret: string): Promise<string> {
  let cache = tokenCache.get(accessKeyId)
  if (!cache || Date.now() >= cache.expiresAt - 5000) {
    if (cache?.refreshToken) {
      try {
        const date = new Date().toUTCString()
        const res = await fetch(`${LARA_BASE}/v2/auth/refresh`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cache.refreshToken}`,
            'X-Lara-Date': date,
          },
        })
        if (res.ok) {
          const data = (await res.json()) as { token?: string }
          if (data?.token) {
            const newCache: TokenCache = {
              token: data.token,
              refreshToken: res.headers.get('x-lara-refresh-token') || cache.refreshToken,
              expiresAt: decodeJwtExp(data.token),
            }
            tokenCache.set(accessKeyId, newCache)
            return newCache.token
          }
        }
      } catch {
        // fall through to re-auth
      }
    }
    tokenCache.delete(accessKeyId)
    cache = await authenticate(accessKeyId, secret)
  }
  return cache.token
}

async function translateLaraChunk(
  text: string,
  sourceLang: string,
  targetLang: string,
  signal: AbortSignal | undefined,
  accessKeyId: string,
  secret: string,
): Promise<string> {
  const cached = getCached('lara', sourceLang, targetLang, text)
  if (cached) return cached
  let token = await getToken(accessKeyId, secret)
  const url = `${LARA_BASE}/v2/translate`
  const maxAttempts = 4
  let lastErr: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (signal?.aborted) throw new DOMException('已取消', 'AbortError')
    const date = new Date().toUTCString()
    const body = {
      q: text,
      source: sourceLang === 'auto' ? null : sourceLang,
      target: targetLang,
    }
    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Lara-Date': date,
          Authorization: `Bearer ${token}`,
          'X-Lara-SDK-Name': 'ai-read',
        },
        body: JSON.stringify(body),
        signal,
      })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e
      lastErr = e
      if (attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt))
        continue
      }
      throw (lastErr as Error) ?? new Error('翻译请求失败')
    }
    if (res.ok) {
      const data = (await res.json().catch(() => null)) as { translation?: string } | null
      const translated = data?.translation
      if (typeof translated === 'string' && translated.trim()) {
        setCached('lara', sourceLang, targetLang, text, translated)
        return translated
      }
      throw new Error('翻译返回为空')
    }
    const bodyText = await res.text().catch(() => '')
    if (res.status === 401) {
      tokenCache.delete(accessKeyId)
      token = await getToken(accessKeyId, secret)
      if (attempt < maxAttempts - 1) continue
    }
    if (res.status === 429) {
      if (attempt < maxAttempts - 1) {
        await sleep(3000 * (attempt + 1), signal)
        continue
      }
      throw new Error('翻译请求失败: 429（Lara API 限流）。请稍后重试，或切换翻译方式')
    }
    if (res.status >= 500) {
      lastErr = new Error(`翻译请求失败: ${res.status} ${bodyText}`)
      if (attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt))
        continue
      }
      throw lastErr
    }
    throw new Error(`翻译请求失败: ${res.status} ${bodyText}`)
  }
  throw (lastErr as Error) ?? new Error('翻译请求失败')
}

export async function translateLara(
  text: string,
  opts: TranslateOptions,
  credentials: { accessKeyId: string; accessKeySecret: string },
): Promise<string> {
  const chunks = chunkText(text, 1500)
  const out: string[] = []
  for (let i = 0; i < chunks.length; i++) {
    const t = await translateLaraChunk(
      chunks[i],
      opts.sourceLang,
      opts.targetLang,
      opts.signal,
      credentials.accessKeyId,
      credentials.accessKeySecret,
    )
    out.push(t)
    if (i < chunks.length - 1) await sleep(400, opts.signal)
  }
  return out.join('\n\n')
}

export interface LaraVerifyResult {
  ok: boolean
  message: string
}

export async function verifyLara(
  accessKeyId: string,
  secret: string,
  sourceLang: string,
  targetLang: string,
): Promise<LaraVerifyResult> {
  const timeoutMs = 10000
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const token = await getToken(accessKeyId, secret)
    const res = await fetch(`${LARA_BASE}/v2/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Lara-Date': new Date().toUTCString(),
        Authorization: `Bearer ${token}`,
        'X-Lara-SDK-Name': 'ai-read',
      },
      body: JSON.stringify({ q: 'hello', source: sourceLang === 'auto' ? null : sourceLang, target: targetLang }),
      signal: ctrl.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { ok: false, message: `不可用：HTTP ${res.status} ${text}` }
    }
    const data = (await res.json().catch(() => null)) as { translation?: string } | null
    if (typeof data?.translation === 'string' && data.translation.trim()) {
      return { ok: true, message: `可用：${data.translation}` }
    }
    return { ok: false, message: '不可用：返回为空' }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      return { ok: false, message: `超时（${timeoutMs / 1000}s）：无法访问端点` }
    }
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, message: `网络/认证错误：${msg}` }
  } finally {
    clearTimeout(timer)
  }
}