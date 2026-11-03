# 设计：Lara 翻译 API 配置接入

- 日期：2026-11-02
- 模块：Translate / ConfigDialog / ProcessingPanel
- 版本：v1.0
- 状态：已实施

## 1. 目标

在翻译方式中新增「Lara 翻译 API（需 Access Key）」，置于 Google 之前；支持配置 Access Key ID/Secret，并接入翻译处理与回退链。

## 2. 方案

- `src/types/settings.ts`：mode 枚举新增 `lara`；新增 `laraAccessKeyId` / `laraAccessKeySecret`。
- `src/stores/settings-store.ts`：merge 校验与默认值同步。
- `src/services/lara.ts`（新）：签名认证（HMAC-SHA256）+ `/v2/auth` + `/v2/translate`；`translateLara` 与 `verifyLara`。
- `ConfigDialog.tsx`：下拉新增 Lara 选项（位于 Google 前）；mode=lara 时显示 Key/Secret 输入；测试端点支持 Lara。
- `ProcessingPanel.tsx`：免费端点回退链扩展为 `mymemory → lara → google → AI 提供商`。

## 3. 验收

- [x] `pnpm typecheck` 0 error；`pnpm lint` 0 error/3 既有 warning；`pnpm build` 通过。
- [ ] 人工：配置 Lara Key 后翻译成功；测试端点显示可用/不可用。