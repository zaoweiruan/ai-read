# 2026-10-22 设计｜阅读器图片 + 不自动全选 + 当前章节模式 v1.0

> 源：用户 2026-10-22 指令三项：① 内容窗口无法显示图片 ② 打开书籍时不要全选章节 ③ 只对内容窗口显示的章节做「当前章节总结」，不再从章节窗口点选。
> 范围：`src/types/index.ts`、`src/services/epub.ts`、`src/components/content/BookContent.tsx`、`src/stores/book-store.ts`、`src/components/processing/ProcessingPanel.tsx`、`src/components/results/ResultView.tsx`。

## 1. 图片支持（EPUB）

- **内容模型**：新增 `ContentBlock = string | { kind: 'image'; src: string; alt: string }`；`epub.ts` 的块提取从「纯字符串数组」升级为「文本块 + 图片块」。
- **提取**：`extractRawBlocks` 遍历 DOM 时识别 `img` → 产出图片块（`src`/`alt`）；含图片的容器（`figure`/`picture`）不再按纯文本叶节点处理，改为继续下钻（`figcaption` 仍作为文本块）。
- **资源解析**（epubjs 0.3.93 实测 API）：
  - 章节 zip 路径 = `book.resolve(manifestHref)`（如 `/OEBPS/Text/ch1.xhtml`）；
  - 图片 src 相对**章节所在目录**拼接 → 归一化 → 候选路径：① 直接根路径 ② manifest 精确匹配（`book.resolve(item.href)`）③ basename 唯一匹配；
  - 取二进制：`book.archive.createUrl(path, { base64: true })` → data URL（无 blob 泄漏，无需 revoke）。
- **渲染**：`BookContent` 的正文区按块渲染 —— 文本块 → `<p class="reader-para">`；图片块 → `<figure>` + `<img loading="lazy" class="max-h-[70vh] w-auto max-w-full rounded-md">`。
- PDF 暂不涉及（PDF 为按页取文本，无内嵌图片管线），文档中说明。

## 2. 打开书籍不自动全选

- `book-store.setChapters` 不再写入 `selectedChapterIds`（改为空数组），章节列徽标显示 `0 / N`；「全选 / 清空 / 分组」按钮保留可用。

## 3. 模式 → 处理目标

| 模式 | 处理目标 | 提示文案 |
| --- | --- | --- |
| 当前章节总结 | **内容窗口当前显示的章节**（`activeChapterId`） | `当前章节：<标题> · 点击上方标签页立即处理` |
| 当前章节思维导图 | 同上 | 同上 |
| 整书思维导图 | 章节列表**勾选项**；未勾选时按全书全部章节 | `整书 · N 章（未勾选则按全书）` |

- 无当前章节时给出明确提示「请先在左侧打开一个章节」。
- 单章模式下不生成「章节关系」（结果窗隐藏该区块），导读标题按处理章数显示「本章导读 / 全书导读」。

## 4. 验收

- 打开含图 EPUB：正文出现图片且 `naturalWidth > 0`（用 test/ 两本真实书验收）。
- 打开书籍后章节徽标为 `0 / N`（未全选）。
- 切到某章 → 点「当前章节总结」→ 只处理该章（结果卡片标题为该章；提示为「当前章节：…」）；「整书思维导图」在未勾选时处理全书。
- typecheck / build 绿；写后必查。
