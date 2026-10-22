# 2026-10-22 设计｜阅读区：图标缩放 · AI 面板折叠 · 双页并列 · 换页方式 v1.0

> 源：用户 2026-10-22 指令四项：①「注」图标太大 ② AI 处理窗口加折叠按钮 ③ 内容窗口加「同时并列显示两页」按钮 ④ 内容窗口加换页方式配置（连续、切换）。
> 范围：`src/stores/reader-store.ts`、`src/types/index.ts`、`src/components/content/BookContent.tsx`、`src/components/processing/ProcessingPanel.tsx`、`src/App.tsx`。

## 1. 小图标缩放（"注" 图标）

EPUB 的 CSS 未被保留，图片按**原始像素**渲染，导致书中的小图标（注 记号）显得过大。
修复：新增 `ReaderImage` 组件 —— 图片载入后若 `naturalWidth ≤ 200`（图标类）则限宽 **2em**（随正文字号缩放）；插图类保持原尺寸，仍受 `max-h-[70vh] max-w-full` 约束。

## 2. AI 处理窗口折叠

- `reader-store` 增加 `processingVisible`（持久化，默认 true）。
- `ProcessingPanel` 标题行右侧新增折叠按钮（收起图标）→ 面板隐藏。
- `App` 第三列在折叠时收为 **40px「处理」导轨**（竖排文字按钮），点击恢复 360px 面板（与章节列折叠同一交互范式）。

## 3. 双页并列（连续页对）

- `reader-store` 增加 `twoPage`（持久化，默认 false）；工具条新增「双页」按钮。
- **PDF**：双页开启时同时加载**当前页与下一页**（连续页对 1-2、3-4…），两块以两栏网格并列；翻页按 **2 页步进**（不跳页、不重复），页码指示显示「第 N-M 页」；到最后一对后「下一页」禁用。
- **EPUB / Markdown**：正文容器加 `columns-2`（CSS 多栏），同样呈现并列阅读。

## 4. 换页方式（连续 / 切换）

- `reader-store` 增加 `pageMode: 'continuous' | 'paged'`（持久化，默认 continuous）；工具条提供 [连续] / [切换] 两个切换按钮。
- **连续**：现有行为（自由滚动，滚到底自动进下一章，滚到顶回上一章）。
- **切换**：整屏翻页 —— 内容按视口高度分屏（`translateY` 位移，滚动容器 `overflow-hidden`），滚轮/上一页/下一页按屏翻；末屏再向下 → 下一章；首屏再向上 → 上一章并**落在其末屏**（连续向上阅读）。屏幕数由内容高度 ÷ 视口高度实时计算（ResizeObserver）。

## 5. 验收

- 书中「注」图标显示为约 2em（≈36px）而非原始 80px；插图不受影响。
- AI 面板可折叠为 40px 导轨并可再展开。
- 「双页」：PDF 两页并列、EPUB 正文双栏。
- 「切换」模式：滚轮/按钮逐屏翻页，末屏进下一章、首屏回上一章（定位末屏）；「连续」模式行为不变。
- typecheck / build 绿；写后必查。
