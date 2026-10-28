import { MAX_RECENT_LIMIT } from '@/lib/recent-limit'

/**
 * 最近打开文件的 File 句柄内存缓存（会话级，不持久化）。
 *
 * 浏览器安全模型禁止直接重开本地文件路径，但同一标签页会话内可以持有
 * 本次点击事件获得的 File 对象；命中缓存时点击「打开」即可直接重新解析，
 * 无需再弹系统文件选择器。刷新 / 重启浏览器后缓存丢失，回退到选择器。
 */

const cache = new Map<string, File>()

export function cacheRecentFile(key: string, file: File): void {
  cache.delete(key)
  cache.set(key, file)
  while (cache.size > MAX_RECENT_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.delete(oldest)
  }
}

export function getCachedFile(key: string): File | undefined {
  const file = cache.get(key)
  if (file) {
    cache.delete(key)
    cache.set(key, file)
  }
  return file
}

export function dropCachedFile(key: string): void {
  cache.delete(key)
}

export function clearCachedFiles(): void {
  cache.clear()
}
