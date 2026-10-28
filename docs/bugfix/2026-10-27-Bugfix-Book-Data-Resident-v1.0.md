# 2026-10-27 修复 刷新后目录有内容、正文与处理均无内容 v1.0

## 1. 现象

用户上传 PDF（165 章，真实书籍）后刷新页面：

- 左侧「章节选择」有内容：0 / 165，章节树正常展开；阅读器标题与徽章（7 / 165）正常。
- 正文区域提示：「该页没有可提取的文本（可能是图片或空白页）。」
- 右侧「处理」面板提示：「电子书数据未驻留，请重新上传文件。」
- 工具栏页码显示「第 9 / ? 页」（`totalPages = 0`）。

即「目录看似已加载、正文却读不了、处理也不可用」的自相矛盾状态。

## 2. 根因

1. `src/stores/book-store.ts` 的 persist 配置（`name: 'ai-read:book'`）`partialize` 只持久化
   `book / chapters / selectedChapterIds / activeChapterId / groups / summary / mindMap / mindMapScope / activeMode`，
   **`bookData: ArrayBuffer | null` 不在持久化列表**（JSONStorage 也无法序列化 ArrayBuffer）。
2. 刷新后 zustand persist 从 localStorage 恢复了 `book` + `chapters`，所以左侧目录树、标题、徽章一切正常；
   但 `bookData = null`：
   - `src/components/content/use-pdf-stream.ts` 的装载 effect 在 `!enabled || !data` 时静默置空
     （`setBlocks([]); setTotalPages(0)`）→ 正文进入 PDF 空态提示；
   - `src/components/processing/ProcessingPanel.tsx:277` 在 `!bookData` 时报「电子书数据未驻留」；
   - `totalPages = 0` → 工具栏页码退化为「第 9 / ? 页」。
3. 这是既有设计缺陷（非 v1.0–v1.3 PDF 视口接续流引入的回归），但界面表现误导用户以为是提取失败。

## 3. 修复方案

方向：「刷新后回到统一未加载状态」——`bookData` 缺失时直接丢弃已持久化的 `book/chapters`，
让界面统一回到「请重新上传」，消除矛盾。

| # | 文件 | 旧行为 | 新行为 |
| --- | --- | --- | --- |
| 1 | `src/stores/book-store.ts` | persist options 无 `merge`，恢复时无条件采用持久化数据 | 新增 `merge`：若持久化数据含 `book`（而 `bookData` 永远不在持久化数据里），判定为陈旧烂摊子 → 返回干净的默认态，并 `safeStorage.removeItem('ai-read:book')` 清掉陈旧 blob |
| 2 | `src/components/content/BookContent.tsx` | PDF 空态提示优先级 = error > loading > 「该页没有可提取的文本」 | 插入 `!bookData` 一档：「书籍文件未驻留（刷新后不保留），请在顶部重新上传以继续阅读与处理。」（与非 PDF 分支文案一致），防止 `bookData` 缺失时给出误导性的「图片或空白页」提示 |
| 3 | `src/components/processing/ProcessingPanel.tsx` | 不变 | `book` 清空后该面板不会展示此错误；保留防御性文案 |

不改动：`partialize` 列表、`reset()`、上传链路（`BookUploader.tsx` 的 `reset() → parse → setBook → setBookData(data.slice(0))`）。

## 4. 验收

1. `pnpm typecheck` 通过；`pnpm lint` 0 error / 3 条既有 exhaustive-deps warning（BookContent.tsx 595/623/746，v1.x 遗留）；`pnpm build` 通过（chunk 体积 warning 既有）。
2. E2E（tag `tab_76dff399-06cc-4c0b-af82-d4804e8f108e`，dev server 5173）：在浏览器 localStorage 种入含 `book/chapters` 的 `ai-read:book` 陈旧数据（379 B）→ 刷新 →
   - `localStorage.getItem('ai-read:book')` = `null`（陈旧 blob 已被 merge 清除）；
   - 章节选择回到「0 / 0 · 尚未加载书籍章节。」，checkbox 数 0；
   - 正文显示「请在顶部上传 EPUB 或 PDF 以开始阅读。」；不再出现「该页没有可提取的文本」。
3. E2E：重新上传 PDF（`long-20p.pdf`，20 页 × 18 行）→ `[data-pdf-page]` 块装载页 1-3、首块文本正常、工具条显示「第 1 / 20 页」；未出现「该页没有可提取的文本」「电子书数据未驻留」提示；PDF 视口接续流回归用例不受影响。
