# 2026-10-26 设计 阅读器 PDF 视口接续流 v1.0

## 1. 背景与现象

打开 PDF 书籍后，阅读区正文只占上半屏，下半屏为纯背景空白。

- 截图状态：主题「米黄」、行距 1.9、字体黑体、双页 + 连续滚动；工具栏显示「第 11 / 163 页」，右上徽标「10 / 165」。
- 正文在 `columns-2` 双栏下排布，两栏合计高度约半屏，下方是大块空白。

## 2. 根因

1. `src/services/pdf.ts` 的 `getPageText(doc, page)` 把该页 `getTextContent()` 的所有 `str` 用空格 join 成一个字符串，**一页只产出一个文本块**。
2. `BookContent.tsx` 的 PDF 分支按 `/\n{2,}/` 切分该字符串，结果仍是 1 段，整页文字作为一个 `<p>` 渲染。
3. 阅读容器 `div.reader-content` 是 `flex-1` 撑满剩余高度，背景为 `--reader-background`。文字不足一屏时，剩余部分即为主题色空白。
4. `twoPage` 时内容走 CSS `columns-2`，一页文字被均衡分成两栏，高度再减半，空白更明显。
5. 附带问题：右上徽标读 `activeIndex + 1 / chapters.length`（165），工具栏页码读 `pdfPage / totalPages`（163），两者不同源。

结论：不是裁切、不是解析失败，而是「一页内容装不满一屏」的自然结果。

## 3. 方案选择

| 方案 | 说明 | 结论 |
| --- | --- | --- |
| A 视口接续流 | 本页不足一屏时自动把后续页文字接在下方，连续阅读 | **采纳** |
| B 按屏补页 | 只在整屏切换模式下补页 | 否，连续滚动仍有空白 |
| C 整章预载 | 预载整章内容 | 否，本 PDF 一章≈一页，等同方案 A 但更重 |

## 4. 设计：视口接续流

### 4.1 状态模型（PDF 专属）

- `pdfPage`（锚点页）：当前流的起始页，决定从哪一页开始装载。
- `loadedEnd`：已经装载到的页号，只随追加递增。
- `readingPage`：视口顶部（双栏时为左上）所在页，仅用于页码显示、章节归属与阅读位置保存，**不触发重新装载**。

装载页与阅读页解耦：追加内容不会改变页码归属逻辑，页码变化也不会重置已装载内容。

### 4.2 装载与追加

- 装载区间 `[anchor .. loadedEnd]`，每页文本产出一个块，块上带 `data-pdf-page` 标记。
- 追加上限：单次连续自动追加最多 12 页（防空白页死循环），阅读页变化后计数重置。
- 目标高度：
  - 连续滚动：`视口高 × 1.5`（一屏 + 半屏预取）。
  - 整屏切换单栏：`(当前屏 + 2) × 行栅格高度`。
  - 整屏切换双页：`(当前屏 + 2) × 展开宽度`（比较 `scrollWidth`）。
- 循环由「度量 → 不足则追加 → 内容变化 → 再度量」构成，`loadedEnd` 单调递增，必然收敛。
- 页面文本按页缓存（`Map<number, string>`），重复装载不重复解析。
- 单页提取失败按空页处理并继续，不阻塞后续页。

### 4.3 页码与章节归属

- 取内容区第一个 `bottom > 视口顶边` 的 `[data-pdf-page]` 块（双栏整屏切换时比较 `right` 与视口左边），其页号即 `readingPage`。
- 章节归属由「页号落在哪个章节区间」推导；outline 章节没有 `endPage`，按下一章 `startPage - 1` 推导，末章到 `totalPages`。
- 归属章节与当前 `activeChapterId` 不一致时同步过去，并置 `streamSyncRef` 抑制位，跳过既有的两个副作用：`activeChapterId` 变化 → 重设 `pdfPage` 为章节首页、以及滚回顶部。
- 工具栏页码与右上徽标都随 `readingPage` 变化，二者同源。

### 4.4 翻页、导航与恢复

- 上一页 / 下一页：跳 `readingPage ± 1`，重置流锚点并回到顶部。
- 上一章 / 下一章 / 目录点击：锚点设为该章 `startPage`，流重置。
- 连续滚动：接近底部时先追加；只要 `loadedEnd < totalPages` 就不触发「滚到底进下一章」，读完整个 PDF 自然停止。
- 整屏切换：本屏之后继续追加，到最后一页由按钮禁用兜底。
- 打开文件恢复位置：以保存的 `pdfPage` 为锚点装载，首屏即上次位置。
- 到末页：在阅读区下方提示「已到最后一页」。

### 4.5 改动范围

- 新增 `src/components/content/use-pdf-stream.ts`：装载、追加、页缓存、终止判断。
- `src/components/content/BookContent.tsx`：PDF 分支改用 hook 渲染，页码与章节来源改为 `readingPage`，新增锚点变化回顶。
- 不改 `reader-store` 持久化结构（沿用 `pageMode` / `twoPage`）。
- 不改 `reading-position-store` 结构（`pdfPage` 字段语义变为阅读页，更准确）。

## 5. 验收标准

1. 打开同一 PDF（第 11 页起）首屏自动补满，下部无大块空白。
2. 连续滚动跨页无跳章、无回顶，页码随视口更新且与右上徽标同源。
3. 双页（双栏）、整屏切换、全屏三种状态下均正常。
4. 到书末提示「已到最后一页」，向上回滚不闪跳。
5. `pnpm typecheck` / `pnpm build` 通过。

## 6. 风险与取舍

- 双栏连续滚动时，左右两栏内容交错，「阅读页」取左栏顶部，指示为近似值（单调递增，不回退）。
- 双栏连续滚动下追加内容会触发多栏平衡重排，右栏内容可能整体后移；依赖浏览器滚动锚定（`overflow-anchor: auto`，Chrome 默认开启）缓解。
- 连续滚动会把整本 PDF 的文本逐页装载进内存（仅文本，不含位图），163 页量级可接受。
- 章节同步抑制位若在极端时序下未被消费，可能导致下一次章节切换不回顶；以「消费即清除」保证不会累积。

## 7. 迭代记录（v1.1，2026-10-26 补丁）

### 7.1 问题

双页 + 连续模式下翻页会重复显示上一屏的页面（实测 `dense-30p.pdf`：可见页 `{14,15}` → `{16,18}` → `{18,19}`，页 18 重复出现，页 17 掉进折叠线下方未被看到）。

根因：连续模式用 `columns-2` 让正文按**平衡双栏**排布，栏高由内容总高决定，页面边界被切碎且非线性；锚点 +2 后右栏仍从旧页开始，于是重复。

### 7.2 方案

- PDF + 双页 + 连续：改为**页面对网格**（`grid grid-cols-2`），每页一个格子，第 N 行 = 第 N 页 | 第 N+1 页；翻页步进 2 页，页与页严格不重叠、追加内容不触发重排。
- PDF + 双页 + 切换：保留 `columns-2` + 固定屏高 + 横向 `translateX`（该路径实测干净，步进仍为 1 页）。
- 单页模式步进仍为 1 页。
- 双页连续时装载需成对（`blocks.length % 2 === 1` 继续 `grow()`），避免末行只有左栏、右栏留白。
- 页码显示：`twoPage && !paged` 显示 `第 N-(N+1) / T 页`。

### 7.3 验收（实测）

- 双页 + 连续：`1-2 → 3-4 → 5-6 → 7-8 → 9-10 → 11-12`，无重复页，`scrollTop` 归零；反向 `9-10 → 7-8 → 5-6` 一致。
- 双页 + 连续滚动：`scrollTop` 0 → 1400 时可见页 `5,6 → 7,8`，页码同步。
- 双页 + 切换：`5 → 6 → 7 → 8` 单页步进，无重叠。
- 单页模式：`8 → 9 → 10` 正常，无回归。
- `pnpm typecheck` 通过，`pnpm lint` 0 error（4 条既有 exhaustive-deps warning）。

## 8. 迭代记录（v1.2，2026-10-26 补丁）

### 8.1 问题

用户反馈「翻页后，还是有前页面内容」：双页 + 切换模式下 `columns-2` 平衡分栏 + 追加内容导致整篇重排，而切换分支 `transform: translateX(-pageIndex*spreadW)` 始终为 0（锚点重设后 pageIndex 回 0），屏幕上前一页文字仍残留。

### 8.2 方案

- PDF 双页一律改为页面对网格 `grid grid-cols-2 gap-8`（连续模式）；切换模式恢复 `columns-2 gap-8` + 固定屏高 + 整屏位移。
- 滚动容器切换模式 `overflow-hidden`；连续模式 `overflow-y-auto`。
- `syncReadingPage` 统一用 `rect.bottom > boxRect.top + 2`（删除 horizontal 分支）。
- 两个 readingPage 同步 effect 合并为一个。

### 8.3 验收

- `pnpm typecheck` / `pnpm lint`（0 error）/ `pnpm build` 全绿；E2E：双页+切换 `13-14 → 15-16 → 17-18` 步进 2、无残留；双页+连续 `7-8 → 9-10`；单页模式 `8 → 9 → 10`。

## 9. 迭代记录（v1.3，2026-10-26 补丁）

### 9.1 问题

v1.2 把 PDF 切换容器改成 `overflow-y-auto`，导致切换模式可自由滚动、退化成连续翻页。用户选择「双页 + 切换 = 当页文字分左右两栏」：恢复 `columns-2` 固定一屏整屏切换语义。

### 9.2 方案

- 滚动容器：`paged ? 'overflow-hidden' : 'overflow-y-auto'`（PDF 与 EPUB 同为整屏切换）。
- PDF 内容容器：连续模式 `grid grid-cols-2 gap-8`；切换模式 `columns-2 gap-8` + `height: viewportH` + `translateX(-pageIndex*spreadW)`（双页）/ `translateY(-pageIndex*viewportH)`（单页）。
- `syncReadingPage`：切换模式下直接返回（页码取流起始页 anchor），避免 DOM 采样错页。
- `setSpreadW`：PDF 切换+双页与 EPUB 一致，按 `clientWidth + gap`（col3 起始于 clientWidth + gap，避免边缘残留/裁切）。
- measure 预取：切换+双页按列宽 `scrollWidth < (pageIndex+2)*clientWidth`；切换单页按屏高；连续按 1.5 屏；成对装载仅连续模式。
- `nextScreen`/`prevScreen`：PDF 在末屏时 `grow()` + `pendingNextScreenRef` 推进一屏，真末尾进下一章；回退到上一页开头。
- 工具栏上一页/下一页：切换模式一律走 `prevScreen()`/`nextScreen()`（含 PDF）；连续模式走 `goToPage(±pdfStep)`。
- `handleWheel` 切换模式：一律 `nextScreen()`/`prevScreen()`。
- 页码标签：PDF 仍显示 `第 N / T 页`（切换模式 N 取 anchor）；底部提示扩展到 PDF 切换模式。

### 9.3 验收

- E2E（long-20p.pdf，tab `tab_f328f2b6-...`，5173）：
  - 双页+切换：transform `0 → -539 → -1078`，无残留上页文字；上下翻页一致。
  - 单页+切换：`translateY(0) → translateY(-307.8)`。
  - 连续双页：`grid grid-cols-2`、`overflow: auto` 不回归。
- `pnpm typecheck` 通过、`pnpm lint` 0 error / 3 条既有 warning、`pnpm build` 通过。

## 8. 迭代记录（v1.2，2026-10-26 补丁）

### 8.1 问题

v1.1 只把「双页 + 连续」改成页面对网格，「双页 + 切换」仍走 `columns-2`。切换模式下追加下一页会让平衡分栏整篇重排（`scrollWidth` 1111 → 2253、列数翻倍），而 PDF 的 `translateX(-pageIndex * spreadW)` 恒为 0（锚点重置后 `pageIndex` 归零），于是翻页后屏幕上仍残留上一页文字，用户看到「翻页后还有前页面内容」。

### 8.2 方案

- PDF 双页**不再区分连续/切换**，统一用页面对网格 `grid grid-cols-2 gap-8`；PDF 分支删除 `columns-2` 与 paged 位移块，网格逐行追加不触发重排。
- PDF 切换模式的滚动容器改为 `overflow-y-auto`（网格行高可变，`overflow-hidden` 会裁掉后续行），连续模式不变。
- 翻页步进统一：`pdfStep = isPdf && twoPage ? 2 : 1`。
- `handleScroll` 与 `syncReadingPage` 统一按纵向判定，删除双栏横向分支；两个 readingPage 同步 effect 合并为一个。
- 页码区间仅在下一页确实已装载时显示 `N-(N+1)`，且不再限定连续模式。
- 删除按栏宽（`scrollWidth`）预取的分支，双页成对装载规则对连续/切换同时生效。

### 8.3 验收（实测 `long-20p.pdf`，20 页 × 18 行，视口 415px）

| 组合 | 翻页序列 | 结果 |
| --- | --- | --- |
| 双页 + 切换 | 13-14 → 15-16 → 17-18 | 无重叠，`scrollTop=0` |
| 双页 + 连续 | 7-8 → 9-10 | 无重叠，`scrollTop=0` |
| 单页 + 连续 | 18 → 19 | 正常 |
| 单页 + 切换 | 17 → 18 | 正常 |

双页连续滚到底：可见 `19-20 / 20`，提示「已到最后一页」。`pnpm typecheck` 通过，`pnpm lint` 0 error（3 条既有 exhaustive-deps warning）。
