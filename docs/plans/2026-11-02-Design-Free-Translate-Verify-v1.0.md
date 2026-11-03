# 设计：免费翻译端点可用性测试

- 日期：2026-11-02
- 模块：ConfigDialog / translate
- 版本：v1.0
- 状态：已实施

## 1. 目标

在配置页翻译端点组增加「测试端点」按钮，判断当前选中的免费端点（MyMemory / Google）是否可用，并显示结果。

## 2. 方案

- `src/services/translate.ts` 新增 `verifyFreeTranslate(mode, sourceLang, targetLang)`：
  - 8s 超时；MyMemory 用 `hello` 样本请求，识别配额警告；Google 用 gtx 样本请求。
  - 返回 `{ ok, message }`。
- `ConfigDialog.tsx` 翻译组新增按钮与结果显示；mode 为 `ai` 时禁用。

## 3. 验收

- [x] `pnpm typecheck` 0 error；`pnpm lint` 0 error/3 既有 warning；`pnpm build` 通过。
- [ ] 人工：点击测试端点显示可用/不可用/配额受限/超时。