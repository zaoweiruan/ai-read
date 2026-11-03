# 设计：翻译请求端点与回落实时展示

- 日期：2026-11-02
- 模块：ProcessingPanel
- 版本：v1.0
- 状态：已实施

## 1. 目标

在翻译处理进度中实时展示当前请求的端点及回退情况（如「正在请求：Lara 端点」「Lara 失败，回落 MyMemory」「免费端点均失败，回落 AI 提供商」）。

## 2. 方案

- 在免费端点回退链循环中，每次尝试前通过 `setProgress` 更新 `currentStep`，显示端点名称与「（回落）」标记。
- 端点失败且存在下一个时，显示「X 失败，回落 Y」。
- 进入 AI 提供商回退前，显示「免费端点均失败，回落 AI 提供商」。

## 3. 验收

- [x] `pnpm typecheck` 0 error；`pnpm lint` 0 error/3 既有 warning；`pnpm build` 通过。