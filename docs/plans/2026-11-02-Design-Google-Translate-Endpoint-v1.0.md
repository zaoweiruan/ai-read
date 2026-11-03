# 设计：Google 免费翻译端点接入（方案 A）

- 日期：2026-11-02
- 模块：Translate（翻译端点 / 配置）
- 版本：v1.0
- 状态：已获用户批准（方案 A）
- 关联需求：`docs/spec/ai-read 需求.md` 翻译处理模式；阶段 29 bugfix `docs/bugfix/2026-10-30-Bugfix-Translate-Abort-Misreport-v1.0.md`

## 1. 背景与目标

现状翻译免费端点仅有 MyMemory（日配额 429，实测约 1h25m 恢复）。目标：

1. 翻译方式新增「Google 免费端点」（`translate.googleapis.com`，无需 Key），作为 `ai` / `mymemory` 之外第三选项。
2. 「代理配置」以**说明文字**呈现：浏览器 JS 的 `fetch` 无法指定 HTTP 代理，代理只能由系统/浏览器/扩展层接管；不写任何代理代码，不破坏 AGENTS.md §1「浏览器直连、严禁代理/后端转发」红线。

## 2. 端点连通性依据（已实测 2026-10-30）

- `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=hello` 经本机代理 HTTP 200（2.24s），返回 `[[["你好","hello",...]]]`。
- `translate.google.com/translate_a/single` 同参数亦 200（1.46s）。选用 `translate.googleapis.com`（无重定向、CORS 友好）。

## 3. 方案设计

### 3.1 类型与持久化（`src/types/settings.ts` / `src/stores/settings-store.ts`）

- `translationSettingsSchema.mode`：`z.enum(['ai', 'mymemory'])` → `z.enum(['ai', 'mymemory', 'google'])`，默认仍为 `mymemory`（不改变存量用户默认值）。
- `settings-store.ts` merge 校验（L133）同步三值合法化：`mode: t.mode === 'ai' || t.mode === 'google' ? t.mode : 'mymemory'`（旧持久化数据不受影响）。

### 3.2 服务层（`src/services/translate.ts`）

新增 `translateGoogle(text, opts)`，与 `translateMyMemory` 同构：

- 复用既有 `chunkText`（450 字分段）与 `sleep`（带 AbortSignal 的退避等待）。
- 单段 URL：`https://translate.googleapis.com/translate_a/single?client=gtx&sl={sourceLang}&tl={targetLang}&dt=t&q={encodeURIComponent(chunk)}`；`sourceLang` 为 `auto` 时传 `auto`（Google 支持，MyMemory 不支持）。
- 响应解析：`data[0]` 为句子数组，取每项 `[0]` 拼接；空结果抛「翻译返回为空」。
- 重试：同款 4 次指数退避（1s/2s/4s），网络异常与 5xx 重试；429 抛「翻译请求失败: 429（Google 免费端点限流）…可切换端点」；AbortError 原样上抛。
- 不修改 `translateMyMemory` 的对外行为。

### 3.3 处理分支（`src/components/processing/ProcessingPanel.tsx`）

- `mode === 'mymemory' || mode === 'google'` 走免费端点分支（`translateMyMemory` / `translateGoogle`）。
- 三级回退链：当前免费端点 → 另一个免费端点（MyMemory↔Google）→ AI 提供商；失败时合并各层原因（`{ cause }`），避免根因被掩盖。

### 3.4 配置 UI（`src/components/config/ConfigDialog.tsx`）

- 方式下拉新增 `<option value="google">Google 免费端点（无需 Key）</option>`，`onChange` 断言扩为 `'ai' | 'mymemory' | 'google'`。
- 端点配置组追加说明文字：「Google 端点需浏览器可直连 translate.googleapis.com；无法访问时请把浏览器/系统代理或扩展（如 SwitchyOmega）指向 127.0.0.1:10808 放行该域名。本应用请求始终直连，不内置代理。」

## 4. 非目标（明确不做）

- 不实现任何代理中转 URL / 后端转发（红线 §1）。
- （已迭代）三级回退链已实施：任一免费端点失败 → 另一个免费端点 → AI 提供商。
- 不改 MyMemory 默认端点与默认语言对。

## 5. 验收标准

- [ ] 配置中可选「Google 免费端点」，刷新后持久化生效。
- [ ] `mode='google'` 时翻译章节成功显示译文（网络可达环境）。
- [ ] Google 429/超时回退 AI 提供商，失败时两层错误同时透出。
- [ ] `pnpm typecheck` 0 error；`pnpm lint` 0 error（3 条既有 warning 除外）；`pnpm build` 通过。
- [ ] `docs/INDEX.md` 登记本文档；tracker 更新阶段 30。
