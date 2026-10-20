import { createProvider, effectiveBaseUrl } from './provider';
import type { ProviderSettings } from '@/types/settings';

export type VerifyStatus =
  | 'ok'
  | 'auth'
  | 'http'
  | 'cors'
  | 'unreachable'
  | 'timeout'
  | 'invalid';

export interface VerifyResult {
  ok: boolean;
  status: VerifyStatus;
  message: string;
}

const REACH_TIMEOUT_MS = 8000;
const CHAT_TIMEOUT_MS = 15000;

function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError';
}

export async function verifyProvider(
  settings: ProviderSettings,
): Promise<VerifyResult> {
  if (settings.baseUrl.trim() && !/^https?:\/\//i.test(settings.baseUrl.trim())) {
    return {
      ok: false,
      status: 'invalid',
      message: 'API 地址必须以 http:// 或 https:// 开头',
    };
  }
  if (!settings.model.trim()) {
    return { ok: false, status: 'invalid', message: '请填写模型名称' };
  }

  const base = effectiveBaseUrl(settings);

  const reach = new AbortController();
  const reachTimer = setTimeout(() => reach.abort(), REACH_TIMEOUT_MS);
  let reachable = true;
  try {
    await fetch(`${base}/`, { mode: 'no-cors', signal: reach.signal });
  } catch (e) {
    if (isAbortError(e)) {
      return {
        ok: false,
        status: 'timeout',
        message: `连接超时（${REACH_TIMEOUT_MS / 1000}s）：无法访问该 API 地址`,
      };
    }
    reachable = false;
  } finally {
    clearTimeout(reachTimer);
  }

  const chat = new AbortController();
  const chatTimer = setTimeout(() => chat.abort(), CHAT_TIMEOUT_MS);
  try {
    const ai = createProvider(settings.kind, settings);
    await ai.chat(
      [{ role: 'user', content: 'ping' }],
      { maxTokens: 1, temperature: 0, signal: chat.signal },
    );
    return { ok: true, status: 'ok', message: '连通正常且支持浏览器 CORS' };
  } catch (e) {
    if (chat.signal.aborted || isAbortError(e)) {
      return {
        ok: false,
        status: 'timeout',
        message: `请求超时（${CHAT_TIMEOUT_MS / 1000}s）`,
      };
    }
    const message = e instanceof Error ? e.message : String(e);
    const http = message.match(/AI 请求失败:\s*(\d+)/);
    if (http) {
      const code = Number(http[1]);
      if (code === 401 || code === 403) {
        return {
          ok: true,
          status: 'auth',
          message: `连通且支持 CORS，但鉴权被拒（HTTP ${code}）：请检查 API Key`,
        };
      }
      return {
        ok: true,
        status: 'http',
        message: `连通且支持 CORS，端点返回 HTTP ${code}：请检查模型名或参数`,
      };
    }
    if (!reachable) {
      return {
        ok: false,
        status: 'unreachable',
        message: '网络不可达：请检查 API 地址、网络或系统代理',
      };
    }
    return {
      ok: false,
      status: 'cors',
      message: '端点不支持浏览器 CORS 跨域调用，应用无法直连使用',
    };
  } finally {
    clearTimeout(chatTimer);
  }
}
