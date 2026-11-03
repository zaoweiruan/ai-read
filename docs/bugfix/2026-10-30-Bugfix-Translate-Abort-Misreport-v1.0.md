# 2026-10-30 Bugfix — 翻译失败误报「已取消」与 MyMemory 配额提示缺失 v1.0

## 1. 现象

用户反馈（原话）：「翻译还是不能用，是否使用默认端点？」→ 追问后「没有报错，只有『已取消』」。

- 翻译功能不可用，界面错误区仅显示「已取消」三个字，无任何根因信息。
- 用户怀疑默认翻译端点配置有误。

## 2. 根因链（已实测确认）

1. **默认翻译端点 MyMemory 日配额耗尽**：实测 `https://api.mymemory.translated.net/get?q=Hello&langpair=en|zh-CN` 返回 HTTP 429，body 为 `MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN 01 HOURS 25 MINUTES 34 SECONDS`（约 1h25m 后恢复）。端点配置本身没有错，是服务端限流。
2. `ProcessingPanel.tsx` `run()` translate 分支：`mode=mymemory` 时 `translateMyMemory` 失败进入 catch；若已配置 AI 提供商则回退 `ai.chat`，否则原样 throw。
3. 回退的 `ai.chat` 走 `withTimeout` 包装器（`CHAT_TIMEOUT_MS=60_000`）：60s 定时器触发 `ac.abort(DOMException('...', 'TimeoutError'))`，中止的是**内部** AbortController 的 signal（非外层 `controller.signal`）。
4. `provider.ts` `fetchWithRetry` 的 catch 只把 `name==='AbortError'` 当中止透传，`TimeoutError` 被当成普通网络错误进入退避重试；下一步 `sleep()` 检测到 `signal.aborted` 后 reject `new DOMException('已取消', 'AbortError')`——即界面「已取消」文案的真实来源。
5. `withTimeout` 的 catch 原本只匹配 `e.name==='TimeoutError'`，匹配不上这个被下游改写成 `AbortError` 的中止，于是原样上抛。
6. `run()` 外层 catch：`controller.signal.aborted` 为 `false`（中止发生在内部包装器）→ 走 `setError(message)` → 界面显示「已取消」。

**总结**：60 秒 AI 回退超时 → 下游把中止原因归类成 AbortError（文案「已取消」）→ withTimeout 认不出这是自己触发的超时 → 超时被误报为用户「已取消」，真实根因（MyMemory 配额）完全不可见。

## 3. 修复内容

### 3.1 `src/components/processing/ProcessingPanel.tsx` — `withTimeout` 还原超时语义

- 定时器回调前置 `let timedOut = false`，回调内先置 `true` 再 `ac.abort`。
- catch 块以 `timedOut` 为准判断：命中则抛 `new Error('AI 请求超时（60 秒）：服务响应过慢，请稍后重试。', { cause: e })`，否则原样 rethrow。
- 注释说明：超时由本包装器触发时，下游可能已把中止原因归类成 AbortError（如 `fetchWithRetry` 的 `sleep` 抛「已取消」），以 `timedOut` 为准还原超时语义，避免把 60s 超时误报为用户「已取消」。

### 3.2 同文件 — translate 分支 MyMemory 回退 catch 透出两层原因

- 回退 `ai.chat` 包入内层 try；内层 catch 合并两层消息：
  `throw new Error(\`翻译失败：${m1}\nAI 提供商回退亦失败：${m2}\`, { cause: e2 })`
- 无已配置 provider 时仍原样 `throw e`（保留 MyMemory 原始错误，含配额文案）。
- `mode=ai` 直连分支不变。

### 3.3 `src/services/translate.ts` — 识别 MyMemory 200 响应中的警告文本

- `translateChunk` 的 `res.ok` 分支，在既有 INVALID SOURCE LANGUAGE 判断后新增：`/MYMEMORY WARNING/i.test(translated)` 时抛错——再匹配 `/QUOTA|USED ALL|LIMIT/i` 则抛
  `翻译请求失败: MyMemory 免费额度已用尽，请稍后重试，或在配置中切换为「使用 AI 提供商」`，
  否则抛 `翻译请求失败: ${translated}`。
- 修复前 MyMemory 以 HTTP 200 返回警告文本会被当译文直接显示；现改为显式报错并给出处置建议。
- 既有 429 文案与重试逻辑不变。

## 4. 默认端点答疑

**不需要更换端点。** 默认 MyMemory 端点配置正确，当前不可用是服务端日配额耗尽，约 1h25m 后自动恢复。需要立即可用可在配置中把「翻译端点 → 方式」切到「使用已配置的 AI 提供商」（走 AI 回退路径）。

## 5. 验收

- [x] `pnpm typecheck` 通过（0 error）
- [x] `pnpm lint` 0 error / 3 条既有 exhaustive-deps warning
- [x] `pnpm build` 通过（✓ built in 5.71s）
- [x] 写后必查：三处修复读回确认落盘，代码位无杂散 token
- [ ] 待人工验收：MyMemory 配额恢复后（或切换 AI 提供商）执行一次翻译成功；配额耗尽场景下错误信息显示「MyMemory 免费额度已用尽」或合并的两层原因，而非「已取消」
