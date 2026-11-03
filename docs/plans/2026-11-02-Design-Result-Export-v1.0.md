# 设计：处理结果保存导出（TXT / Markdown / PDF）

- 日期：2026-11-02
- 模块：ResultView / 导出
- 版本：v1.0
- 状态：已实施

## 1. 目标

为处理结果增加保存功能，支持 `.txt` / `.md` / `.pdf` 三种格式，覆盖文字总结与思维导图。

## 2. 方案

- 新增 `src/lib/export.ts`：`summaryToMarkdown/Text`、`mindMapToMarkdown/Text`、`downloadText`、`buildFileName`。
- `ResultView` 头部新增三个按钮：保存 TXT、保存 MD、保存 PDF；若总结与导图同时存在，额外提供「保存全部 MD」。
- TXT/MD：下载当前显示 tab 的结果（总结或导图）。
- PDF：浏览器打印另存为 PDF（`window.print()`），打印容器 `.print-only` 仅在打印时可见，包含总结与导图（Markdown 文本）。
- 打印样式在 `src/index.css` 的 `@media print` 中定义。

## 3. 非目标

- 不引入 PDF 生成库（jsPDF 等），避免新增依赖。
- 不导出图片/PNG。

## 4. 验收

- [x] `pnpm typecheck` 0 error；`pnpm lint` 0 error/3 既有 warning；`pnpm build` 通过。
- [ ] 人工：点击保存 TXT/MD 下载对应文件；保存 PDF 打开打印对话框可另存为 PDF。