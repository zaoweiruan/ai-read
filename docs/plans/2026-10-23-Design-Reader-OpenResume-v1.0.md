# 2026-10-23 设计｜打开即显示正文 + 阅读进度恢复（上次延续）v1.0

> 源：用户 2026-10-23 指令「打开文件应该显示正文第一页或上次延续，不是『点击左侧章节标题即可查看该章正文。』」（附截图 `log/06a5ead4-613f-4a84-9427-7ba498e36fe4.png`）。
> 范围：`src/components/content/BookContent.tsx`、`src/components/upload/BookUploader.tsx`、`src/stores/`（新增 reading-position-store）、`src/types/index.ts`。
> 粒度（用户已确认）：**章 + 屏内位置**，按 `文件名:大小` 匹配恢复；无记录则显示正文第一页。

## 1. 根因（占位符为何出现）

`BookContent.tsx` 当前章解析为 `chapters.find(c => c.id === (localChapterId ?? activeChapterId))`：

- `localChapterId` 由「上一章 / 下一章」写入（组件本地态），仅在 `chapterRequest` 变化时清除；
- 换书重新上传时 `setChapters` 重置 store 的 `activeChapterId = chapters[0].id`，但**不清 `localChapterId`** → 旧书章节 id 残留 → `find` 失败 → `activeChapter = null` → `bookData` 已就绪仍走 idle 占位分支；
- 边缘情况：`chapters` 为空时 `activeChapterId = null`，同样落占位。

`setChapters` 本身已把 `activeChapterId` 指向第一章，因此修复后「打开即显示第一页正文」是缺省行为。

## 2. 缺陷修复（无条件）

1. `BookContent`：`book.id` / `chapters` 引用变化时清空 `localChapterId`（换书即失效）。
2. 解析兜底：`localChapterId ?? activeChapterId` 查不到时 fallback `chapters[0]`，再查不到才 idle。
3. idle 文案仅保留「未上传」与「文件未驻留（刷新后不保留）」两种场景；「点击左侧章节标题…」在 `chapters` 非空且 `bookData` 就绪时不再出现。

## 3. 存储模型（新增 reading-position-store）

- 新建 `src/stores/reading-position-store.ts`：`create(persist)`，storage key `ai-read:reading-pos`，Zustand store 挂 `globalThis` 单例（沿用四 store HMR 防护写法）。
- 形状：`Record<bookKey, ReadingPosition>`；
  - `bookKey = \`${fileName}:${file.size}\``；
  - `ReadingPosition = { chapterId: string; scrollRatio?: number; pageIndex?: number; pdfPage?: number; updatedAt: number }`。
- LRU：按 `updatedAt` 排序最多保留 20 本，超出即淘汰最旧。
- `BookMeta`（`src/types/index.ts`）新增 `size?: number`，`BookUploader.handleFile` 写入 `file.size`。

## 4. 保存时机（位置类字段节流 500ms；切章为状态变更**即刻保存**；`beforeunload` 冲刷残留节流写入）

| 触发 | 记录内容 |
| --- | --- |
| 连续滚动 `onScroll` | `scrollRatio = scrollTop / (scrollHeight - clientHeight)`（分母为 0 记 0） |
| 分页 `setPageIndex` / `nextScreen` / `prevScreen` | `pageIndex` |
| PDF `goToPage` | `pdfPage` |
| 切章（goNext/goPrev/requestChapter 生效后） | `chapterId` + 当前模式对应位置字段 |
| `beforeunload` | 冲刷未落盘的节流写入 |

- 同一 `bookKey` 记录合并更新（只覆盖变化字段），`updatedAt = Date.now()`。
- 连续模式存 `scrollRatio`，分页模式存 `pageIndex`，PDF 存 `pdfPage`；三种字段互不强制（恢复时按当前模式取用，取不到则回第 1 屏/第 1 页）。

## 5. 恢复流程（上传解析完成后）

1. `handleFile` 解析成功 → 计算 `bookKey` → 查 reading-position-store。
2. 有记录：`requestChapter(record.chapterId)`；内容 `status === 'ready'` 后在 `requestAnimationFrame` 内恢复位置——
   - 连续：`scrollTop = scrollRatio * (scrollHeight - clientHeight)`，并打程序化滚动标记（复用 `markProgrammaticScroll`，防误触发跨章）；
   - 分页：`setPageIndex(clamp(record.pageIndex))`（`measure` effect 的 `Math.min(i, total-1)` 天然 clamp）；
   - PDF：`goToPage(record.pdfPage)`（已有章/页联动）。
3. 无记录 / 记录的 `chapterId` 不在当前 chapters：激活 `chapters[0]` 顶部（即「正文第一页」）。
4. **冲突处理**：现有「切章强制滚顶」effect（`BookContent.tsx` 内 `scrollTo({top:0})`）改为「本次切章带恢复目标时跳过归零，否则保持滚顶」。

## 6. 边界与非目标

- `chapters` 为空 → 维持占位（不可阅读）。
- 换书（不同 `bookKey`）→ 各自独立记录，互不串位；同名同大小但内容被替换 → 视为同一本书（接受：记录错位只需手动点章即可纠正）。
- 「重置排版」只重置字体主题，不触碰阅读位置。
- 非目标：内容 hash 级书标识、跨设备同步、云端存储、目录外的图片/PDF 视觉页缩放状态。

## 7. 验收清单

1. 首次上传 EPUB/PDF/MD → 阅读区直接显示第一页正文，无占位文案。
2. 上传 → 连续滚动翻到第 3 屏 → 刷新 → 重新上传同文件 → 回到第 3 屏同章。
3. 分页模式翻 2 屏 / PDF 翻到第 N 页 → 刷新重传 → 恢复对应屏/页。
4. 上传书 A 翻章 → 上传书 B → B 显示自己第一页（无旧书脏 id 占位）。
5. 删除 localStorage `ai-read:reading-pos` → 一切回到第一页，无报错。
6. `pnpm typecheck` / `pnpm lint` / `pnpm build` 全绿；写后必查（杂散 token 扫描）。
