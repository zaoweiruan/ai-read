# 2026-10-30 设计 翻译端点可配置 v1.0

## 背景

自动翻译模式（`ProcessingPanel` `effectiveMode === 'translate'`）原先固定使用已配置的 AI 提供商，整章正文送入 LLM，受 CORS/429/Token 上限影响。会话 `session-bf251efc-...` 实测发现 MyMemory 免费翻译端点（`https://api.mymemory.translated.net/get`）浏览器直连可用、无需 Key、无 CORS 限制，但**不支持 `auto` 源语言**，必须显式传 ISO/RFC3066 码。

## 设计

- 新增 `src/services/translate.ts`：`translateMyMemory(text, { sourceLang, targetLang, signal })`，按段落/句子切分（≤450 字符）串行请求，合并输出。
- `settings` 新增 `translation: { mode: 'ai' | 'mymemory', sourceLang, targetLang }`，默认 `mymemory` / `en` / `zh-CN`；经 `settings-store` 持久化（partialize + merge 归一化）。
- `ConfigDialog` 新增「翻译端点」区块：方式选择 + 源/目标语言输入。
- `ProcessingPanel` 翻译分支：`mode === 'mymemory'` 走 `translateMyMemory`，否则走 AI 提供商（原逻辑）。

## 红线

- 浏览器直连，不引入代理/后端；MyMemory 无 Key，符合 BYO-key 但属于免 Key 公共端点。
- apiKey 不写入文档/记忆。

## 验收

- typecheck 通过、lint 0 error、build ✓。