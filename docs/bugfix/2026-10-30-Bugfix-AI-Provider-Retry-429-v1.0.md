# 2026-10-30-Bugfix-AI-Provider-Retry-429-v1.0

## 现象

自动翻译（及其他模式）在请求 AI 时偶发：

```
AI 请求失败: 429 {"error":{"message":"***.RateLimitError: RateLimitError: OpenAIException - max connections reached: 666",...}}
```

端点返回 429 限流，错误直接抛出到 UI，翻译中断、无自动恢复。

## 根因

`src/services/ai/provider.ts` 的 `OpenAICompatibleProvider` / `GoogleProvider` 在 `chat` / `chatStream` 中直接 `fetch`，`!res.ok` 立即 `throw`，无任何重试。限流/瞬时 5xx/网络异常均直接失败。

## 修复

- 新增 `sleep(ms, signal)` 与 `fetchWithRetry(url, init, signal)` 工具函数。
- `fetchWithRetry`：最多 4 次请求；对 429 与 ≥500 以及网络层异常做指数退避（1s / 2s / 4s）；遵守 `AbortSignal`；最终失败仍抛出 `AI 请求失败: <status> <body>` 保留原始错误。
- 新增全局串行队列 `aiQueue` + `enqueue`：同一时刻只允许一个 AI 请求在途（含重试与流式），避免触发端点的并发连接上限。
- `chat` / `chatStream`（OpenAI 兼容与 Google 两实现，共 4 处）改为调用 `fetchWithRetry`，去掉重复的 `if (!res.ok) throw`。

## 设计取舍

- 不引入代理/后端，保持 BYO-key 浏览器直连红线。
- 重试仅针对限流与瞬时错误；4xx（除 429）与业务错误不重试，避免放大。
- `verifyProvider` 同样经 `createProvider().chat`，会继承重试，可能延长验证时间，但其 15s `AbortSignal` 仍为上限。

## 校验

- `pnpm typecheck`：通过。
- `pnpm lint`：0 error / 3 条既有 `react-hooks/exhaustive-deps` warning（BookContent.tsx）。
- `pnpm build`：✓ built in 4.55s。
- 写后重读 `provider.ts` L89-307，代码位无杂散 token。

## 残留风险

- 若端点持续限流（全局并发上限），重试后仍可能失败；需用户降低并发或更换端点。
- 单次翻译请求仍携带整章正文；超长章节可能触发 token/超时限制，必要时再做分块翻译。