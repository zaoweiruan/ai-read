# 2026-10-22 设计｜Markdown 文档支持（.md 上传 / 解析 / 渲染）v1.0

> 源：用户 2026-10-22 指令「添加 markdown 格式文档及解析」。
> 范围：`src/types/index.ts`、`src/services/markdown.ts`（新）、`src/lib/markdown.tsx`（新增渲染器）、`src/components/upload/BookUploader.tsx`、`src/components/content/BookContent.tsx`、`src/components/processing/ProcessingPanel.tsx`。

## 1. 目标

应用除 EPUB / PDF 外，**支持 .md / .markdown 文档**：上传 → 本地解析（按标题切章）→ 阅读区按 Markdown 渲染（标题/列表/代码块/表格/引用/行内样式）→ AI 总结与思维导图照常可用。

## 2. 解析规则（`src/services/markdown.ts`）

- 解码：UTF-8（`TextDecoder`，兼容 BOM）。
- **Front matter**：文件以 `---` 开头时，解析 `key: value`（识别 `title` / `author`）。
- **切章**：以 ATX 标题（`#` ~ `######`）为界，**仅 level 1–2 作为章节**；level 3+ 留在章节正文内。
  - 每章：`title` = 标题文本，`level` = 标题层级，`content` = 该章 Markdown 原文（不含标题行）。
  - 首个标题前的内容若非空 → 生成「前言」章。
  - 无任何标题 → 整篇作为单章（标题取 front matter 或文件名）。
- 文档标题：第一个 H1 > front matter `title` > 文件名。

## 3. 渲染（`src/lib/markdown.tsx` 新增 `renderMarkdown`）

块级：`#`~`######` 标题、围栏代码块（```lang）、GFM 表格、`>` 引用、`-/*/+` 与 `1.` 列表、`---` 分隔线、段落（Markdown 段落不缩进，区别于正文的 `reader-para` 两字缩进）。
行内：`**粗体**`、`*斜体*`/`_斜体_`、`` `代码` ``、`~~删除线~~`、`[文本](链接)`、`![alt](图片)`、`<https://…>`。

## 4. 接入点

| 位置 | 改动 |
| --- | --- |
| `types/index.ts` | `BookFormat` 增加 `'markdown'`；`ContentBlock` 增加 `{ kind: 'markdown'; text: string }` |
| `BookUploader` | `accept=".epub,.pdf,.md,.markdown"`；`detectFormat` 识别 `.md/.markdown`；解析分发到 `parseMarkdown`；提示文案更新 |
| `BookContent` | EPUB/PDF 之外增加 markdown 分支：块 = `[{kind:'markdown', text: chapter.content}]`；渲染时用 `renderMarkdown` |
| `ProcessingPanel.buildContent` | markdown 分支返回章节原文，供 AI 总结/导图使用 |

## 5. 验收

- 上传 `test/sample.md` → 章节列按 H1/H2 列出各节；阅读区显示标题/列表/代码块/表格等渲染结果（非源码文本）。
- 切章、连续滚动（滚到底进下一章）、「当前章节总结」（mock）均可用。
- EPUB / PDF 既有行为不受影响。
- typecheck / build 绿；写后必查。
