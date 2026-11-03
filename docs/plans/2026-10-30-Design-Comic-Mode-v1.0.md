# 2026-10-30 设计 漫画模式 v1.0

## 1. 需求

用户反馈（2026-10-30）：

- 「给 epub 和 pdf 文件浏览页面增加『漫画模式』按钮」
- 「正文章节（如序言）能正常显示文字，加『漫画模式』优化」

即：以漫画为主的 EPUB（本仓样本 `OEBPS/Text/chapter97.xhtml`，含 76 张连续条漫大图 + 大量纯装饰文本块）在当前 70vh 高度限制下单屏只能看到一小截；开启「漫画模式」后大图按当前视口宽度铺满展示，并隐藏 `____` 之类的纯装饰文本块；正文章节文字显示不受影响。

## 2. 勘察结论（只读）

- `src/components/content/BookContent.tsx`
  - 行 110 `ReaderFigure({ src, alt })`：非 icon 图（`naturalWidth > 200`）className 为 `max-h-[70vh] w-auto max-w-full rounded-md`，外层 `figure.my-3.flex.flex-col.items-center`；icon 图约束为 1em 行内；`alt` 以 `mt-1 text-xs opacity-70` caption 展示。
  - 行 771-774 `paragraphs = useMemo(() => state.status !== 'ready' ? [] : state.blocks, [state])`：章节 blocks → 段落数组。
  - 行 986-994 工具栏「双页」按钮（`size="sm"`、variant `secondary`/`outline`、含 title）；行 995 分隔 span；行 996-1009「连续/分页」按钮组。
  - 行 1051 PDF 分支 `pdfStream.blocks.map` 只渲染 `text`（PDF 无 image block）。
  - 行 1107-1129 EPUB 分支 blocks 渲染：`string → p.reader-para`；`markdown → div.markdown-body`；`page → 逐段`；`else → ReaderFigure`（行 1127 `<ReaderFigure key={`img-${i}`} src={block.src} alt={block.alt} />`）。
- `src/stores/reader-store.ts`（72 行）：persist `ai-read:reader`；已有 `outlineVisible`/`processingVisible`/`twoPage`/`pageMode` + DEFAULT_TYPOGRAPHY，globalThis 单例。
- `src/services/epub.ts` 行 310-357 `getChapterBlocks`：RawBlock（text|image）→ ContentBlock；`p.calibre4` 等纯下划线占位产出 string 块（截图左侧横线来源）。

## 3. 方案

1. **持久化开关**：`reader-store` 增加 `comicMode: boolean`（默认 `false`）与 `setComicMode`，随既有 `ai-read:reader` 持久化，刷新后保留。
2. **大图铺满**：`ReaderFigure` 新增可选 prop `comic?: boolean`；开启后非 icon 图去掉 `max-h-[70vh]` 高度上限，className 改为 `w-full max-w-none rounded-md`（按视口宽度铺满、保留原始宽高比）；icon 图（`naturalWidth <= 200`）判定不变，仍按 1em 行内处理；`alt` caption 保留。
3. **装饰线过滤**：组件层 `paragraphs` useMemo 中过滤：`comicMode` 为 true 时剔除满足 `isDecorativeLine` 的 string 块——trim 后仅由 `_ - — – ─ ━ ＿` 与空白构成，且至少含一个下划线类字符（避免误伤正常正文）。过滤只影响阅读渲染，不进入 `getChapterContent`（AI 处理链路）与解析服务。
4. **工具栏按钮**：在「双页」按钮之后插入「漫画模式」按钮：`size="sm"`、`variant={comicMode ? 'secondary' : 'outline'}`、`title` 提示「漫画模式：大图铺满展示，隐藏装饰线」；与既有图标按钮视觉一致。对 PDF 也显示（PDF blocks 无 image 类型，仅装饰线过滤可能生效），文档注明该边界。

## 4. 边界与取舍

- 浏览器无 Node API、无后端；纯前端开关，无传输成本。
- 不做「自动检测漫画章节」：显式开关更可控，避免误伤正常带图章节。
- 不修改解析服务：装饰线属内容提取产物，改服务会污染 AI 输入；过滤仅限阅读层。
- PDF 的 image block 当前不渲染（行 1051 只渲染 text），漫画模式对 PDF 的正文字符块同样生效，但不会让 PDF 内嵌图变大——文档如实注明。

## 5. 验收

- [x] `pnpm typecheck` 0 error；`pnpm lint` 0 error（既有 3 条 exhaustive-deps warning 除外）；`pnpm build` 通过
- [x] 写后必查：reader-store.ts / BookContent.tsx 重读，代码位无杂散 token
- [ ] 人工 E2E：上传漫画 EPUB → 开「漫画模式」→ 条漫大图铺满屏宽、`____` 装饰行消失；关掉后恢复 70vh 与原文本；正文 EPUB（chapter1 序言）两种模式下文字均正常
