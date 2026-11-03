# 2026-10-29 设计 自动翻译模式 v1.0

> 设计文档：处理模式新增「自动翻译」，选中时自动检测当前章节正文并整体翻译成简体中文，译文在结果窗口（ResultView）展示。

## 1. 需求来源

用户指令（原文）：「新增功能：增加翻译功能，当自动翻译功能被选择时，自动检测页面文字，全部翻译成中文，并在结果窗口显示」。

## 2. 方案

- **模式扩展**：`ProcessingMode` 由 `'summary' | 'chapter-mindmap' | 'book-mindmap'` 增加 `'translate'`（`src/types/index.ts`）。
- **UI 入口**：`ProcessingPanel.tsx` 的 `MODES` 增加 `{ value: 'translate', label: '自动翻译' }`，点选即触发 `run('translate')`（复用既有「点选即处理」交互，与其余模式一致）。
- **目标范围**：`targetsFor('translate')` 走默认分支，取当前打开章节（`activeChapter`），与「当前章节总结/导图」一致；未打开章节时报错提示先在左侧打开章节。
- **正文检测**：复用 `buildContent(chapterId)` 按格式（epub/pdf/markdown）取当前章节正文；正文为空时不请求 AI，直接给出「未检测到正文文本」说明。
- **翻译调用**：浏览器直连 BYO-key（`withTimeout(resolveProvider(...))`），system 提示固定为「将文字翻译为简体中文，保持原意与段落/列表结构，只输出译文」，temperature 0.2；60s 看门狗与其它模式一致。
- **结果落盘**：译文写入 `setSummary({ bookSummary: 译文, chapterSummaries: {[章]: 译文}, chapterRelations: '' })`，复用 `SummaryResult` 通道，无需新增结果类型。
- **结果展示**：`ResultView` 在 `activeMode === 'translate'` 时：顶部 tab 标签显示「翻译结果」，`SummaryPanel` 主块标题为「翻译结果」、以 `whitespace-pre-wrap` 渲染整段译文，并隐藏「章节摘要」列表段（避免译文重复展示）；tab 自愈逻辑无需改动（无导图、有 summary 即落 summary tab）。

## 3. 涉及文件

| 文件 | 改动 |
| --- | --- |
| `src/types/index.ts` | `ProcessingMode` 增加 `'translate'` |
| `src/components/processing/ProcessingPanel.tsx` | `MODES` 加「自动翻译」；`run()` 增加 translate 分支 |
| `src/components/results/ResultView.tsx` | tab 标签、`SummaryPanel` 标题与「章节摘要」段按 translate 态调整 |

## 4. 校验

`pnpm typecheck` 通过；`pnpm lint` 0 error（3 个既有 warning 位于 `BookContent.tsx`，与本改动无关）；`pnpm build` 成功（仅既有 >500kB chunk 提示）。

## 5. 约束遵守

浏览器直连、无代理/后端；仅用 pnpm；未引入 Node-only API；无新增依赖。
