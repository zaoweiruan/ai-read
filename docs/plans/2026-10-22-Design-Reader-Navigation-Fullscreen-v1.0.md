# 2026-10-22 设计｜阅读区全屏 + 页/章导航 v1.0

> 源：用户 2026-10-22 指令「为内容窗口添加全屏、页、章导航按钮」。
> 范围：`src/components/content/BookContent.tsx`（工具条 + 导航 + 全屏）、`src/index.css`（全屏态样式）。

## 1. 目标

阅读区工具条新增第二行「导航」：

```text
[◀ 上一章] [下一章 ▶]  |  [◀ 上一页] [第 N / M 页] [下一页 ▶]  |  [全屏]
```

- **章导航**：上一章 / 下一章（首尾禁用）；沿用 `book-store.activeChapterId`，切换后阅读区自动重载该章。
- **页导航**：PDF 逐页阅读 —— 游标 `pdfPage`，上一页 / 下一页在全书页范围内移动，并同步把 `activeChapterId` 切到该页所属章节；EPUB 无分页，按钮禁用并提示「EPUB 无分页」。
- **全屏**：阅读区卡片（含工具条与正文）进入原生 Fullscreen；同结果窗实现（原生 API 优先，失败回退 CSS 覆盖层），Esc 退出，同一 DOM 切换。

## 2. 实现要点

- **PDF 逐页**：原实现按「章节页区间」整段取文本；改为按 `pdfPage` 取单页文本（`getPageText`），章节标题仍显示所属章节。`totalPages` 取自 `getPdfDocument` 的 `numPages`。
- **页/章联动**：`goToPage(p)` 同时设置 `pdfPage` 与所属章节；外部（章节列）切换章节时，页游标回到该章 `startPage`（用 ref 标记来源，避免页导航回环）。
- **全屏状态**：`fullscreenchange` 监听同步按钮文案；`.reader-shell:fullscreen` 铺满视口 + 主题背景 + 内边距，正文区 `flex-1` 撑满。

### 附带修复：PDF 正文窗口全空（重要）

验收 PDF 翻页时暴露真实缺陷：`parsePdf` 把**原始 ArrayBuffer** 直接交给 pdfjs，pdfjs 会 **detach** 该缓冲；随后 `getPdfDocument` 再 `data.slice(0)` 即抛 `Cannot perform ArrayBuffer.prototype.slice on a detached ArrayBuffer` → **PDF 解析成功但正文窗口永远空白**（也是「内容窗口无法显示」在 PDF 上的表现）。

修复：`parsePdf` 与 `getPdfDocument` 一律传副本 `new Uint8Array(data.slice(0))`；`getPdfDocument` 另加 `byteLength === 0` 的明确报错。

### 阅读区工具条精简（2026-10-22 追加）

- **移除「总结」「大纲」两个开关及其相关组件**：阅读区不再有本章总结卡片（摘要仍在右栏结果窗），章节列常驻显示 —— 相应删除 `reader-store` 的 `outlineVisible` / `summaryVisible`、章节列的「« 折叠」按钮与 App 的折叠侧栏（改为固定三栏 grid）。
- **「全屏」按钮移至「重置」右侧**（排版工具条行内），导航行只保留章/页导航。
- **「重置」按钮补图标**（逆时针箭头）。
- **全屏背景色修正**：`.reader-shell:fullscreen` 原用未定义的 `--background`（项目实为 `--color-background`）→ 元素透明 → 透出 Chromium 黑色 backdrop（截图确认工具条区发黑）。改为 `var(--color-background)` / `var(--color-foreground)` 并给 `::backdrop` 着色，全屏工具条区现为主题白 `oklch(1 0 0)`。

## 3. 验收

- 工具条出现导航行；上一章/下一章可切换且首尾禁用；章徽标同步。
- PDF：页码指示随翻页变化，正文为当前页文本；EPUB：页按钮禁用并提示。
- 全屏：阅读区进入 `document.fullscreenElement`（或回退态），工具条与正文铺满；再点恢复，正文滚动位置与内容不丢。
- typecheck / build 绿；写后必查。
