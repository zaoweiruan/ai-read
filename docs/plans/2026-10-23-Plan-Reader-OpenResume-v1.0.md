---
title: "fix: 打开即显示正文 + 阅读进度恢复（上次延续）"
type: fix
status: active
date: 2026-10-23
origin: docs/plans/2026-10-23-Design-Reader-OpenResume-v1.0.md
---

# fix: 打开即显示正文 + 阅读进度恢复（上次延续）

## Summary

修复换书后阅读区显示「点击左侧章节标题即可查看该章正文。」占位的缺陷（打开即显示正文第一页），并新增按 `文件名:大小` 持久化的阅读进度恢复：重传同一文件后回到上次阅读的章与屏内位置（scrollRatio / pageIndex / pdfPage），无记录则显示第一页。origin 见设计文档（见下 Sources）。

---

## Problem Frame

用户上传文件后阅读区停留在占位文案而非正文（截图 `log/06a5ead4-613f-4a84-9427-7ba498e36fe4.png`）。根因：`BookContent` 当前章解析 `localChapterId ?? activeChapterId` 中 `localChapterId`（上/下一章写入的组件本地态）在换书时不清理，旧章 id 导致 `find` 失败落入 idle 分支。同时项目完全没有「上次延续」能力：`bookData` 不持久化、滚动/页码不记录，刷新重传后只能从头开始。

---

## Requirements

- R1. 上传解析完成后（`chapters` 非空 + `bookData` 就绪），阅读区直接显示正文（记录章或第一页），不出现「点击左侧章节标题…」占位。
- R2. 换书（重新上传）不出现旧书脏 `localChapterId` 导致的解析失败；`chapters` 为空时维持占位。
- R3. 阅读位置按「章 + 屏内位置」持久化：key = `fileName:file.size`，字段 `chapterId` + 模式对应位置（连续 `scrollRatio` / 分页 `pageIndex` / PDF `pdfPage`），LRU 保留最近 20 本。
- R4. 重新上传同一文件（同 key）→ 恢复到记录的章与屏内位置；无记录或 `chapterId` 无效 → 第一页顶部。
- R5. 保存时机：位置字段节流 500ms、切章即刻、`beforeunload` 冲刷；刷新后重传可恢复（localStorage 跨刷新）。
- R6. `pnpm typecheck` / `pnpm lint` / `pnpm build` 全绿；写后必查（杂散 token 扫描）通过。

---

## Scope Boundaries

- 内容 hash 级书标识、跨设备同步、云端存储。
- 图片/PDF 视觉页缩放等阅读偏好（仍归 reader-store，与位置记录无关）。
- 「重置排版」不触碰阅读位置（保持现状，仅确认不回归）。
- 同名同大小但内容被替换的文件 → 接受视为同一本书（错位后手动点章即可纠正）。

### Deferred to Follow-Up Work

- scrollRatio 在懒加载图片撑高内容后的精度漂移：接受近似（恢复基于当时比例），不引入段落锚点定位。
- 项目无测试运行器（pnpm 无 test 脚本；UI 测试待建，见 AGENTS 路由表）：本计划全部场景为浏览器手动验收，自动化测试不在本计划内。

---

## Context & Research

### Relevant Code and Patterns

- `src/components/content/BookContent.tsx` — 章解析（`localChapterId ?? activeChapterId`）、加载 effect（idle/loading/ready 三分支）、切章滚顶 effect、`markProgrammaticScroll` / `lockScroll` 程序化滚动防护、`goToPage`（PDF 章页联动 + `pageNavRef`）、`computeSpreads`/`measure`（分页 clamp 天然在此）。
- `src/stores/book-store.ts` — `setChapters` 已置 `activeChapterId = chapters[0]?.id`；`safeStorage` 容错读写；`reset()` 只清 book 态（位置 store 独立于它，刷新重传流程依赖这一点）。
- `src/stores/reader-store.ts` — persist + `globalThis` 单例模式（新 store 照抄）。
- `src/components/upload/BookUploader.tsx` — `handleFile`：`reset()` → 解析 → `setBook`/`setBookData`/`setChapters`（恢复动作插入点在 `setChapters` 之后）。
- `src/components/chapters/ChapterList.tsx` — `requestChapter(id)`（章激活 + `chapterRequest` 自增，BookContent 据此清 `localChapterId`）。

### Institutional Learnings

- 写后必查（stray-token 纪律，docs/CONTEXT.md §3.1）：每次写/改源码后 Read 重读并扫描非 ASCII 杂散 token。
- store HMR 多实例教训（阶段 15）：新 store 必须挂 `globalThis` 单例。
- 连续滚动防回环（阶段 15 设计）：恢复性滚动必须走 `markProgrammaticScroll`，否则被误判为用户滚动触发跨章。

### External References

- 无外部研究：Zustand persist / localStorage 模式在本仓库已有三处成熟先例，本地模式足够。

---

## Key Technical Decisions

- **key = `fileName:size`**：用户已确认；无需读文件内容，零成本；hash 方案（方案 C）已否决（大文件成本，YAGNI）。
- **独立 `reading-position-store`（`ai-read:reading-pos`）而非并入 book-store**：`reset()` 与刷新流程会动 book-store，位置记录必须独立存活才能实现「重传即恢复」；LRU 20 本防 localStorage 膨胀。
- **三字段并存（scrollRatio / pageIndex / pdfPage）按模式取用**：连续与分页模式的「屏」语义不同，跨模式恢复无意义 → 取不到对应字段回第 1 屏/第 1 页。
- **切章即刻保存、位置字段节流 500ms**：章 id 是状态变更不频繁，位置高频；`beforeunload` 冲刷残留节流。
- **恢复目标一次性消费（pending restore ref）**：内容 `ready` + `measure` 后应用一次即清除，跳过该次切章滚顶，之后一切滚动行为照旧——把恢复窗口收敛到最小，避免长期污染滚动监听。
- **idle 占位仅限不可阅读场景**（无书 / 文件未驻留 / chapters 空），行为见设计文档 §2。

---

## Open Questions

### Resolved During Planning

- 恢复粒度：章 + 屏内位置（用户 2026-10-23 确认）。
- 切章保存时机：即刻（设计自查修正，位置字段仍 500ms 节流）。
- `reset()` 是否清位置记录：不清（清了恢复流程就不成立）。

### Deferred to Implementation

- `goToPage` 恢复时 `pdfPage` 越界 clamp 的确切位置（恢复路径前置 `min/max` vs 复用按钮 disabled 逻辑）——实现时取更自然者。
- 懒加载图片撑高后 scrollRatio 漂移（见 Scope Boundaries，接受近似）。

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```text
上传完成 ──> bookKey = fileName:size ──> reading-position-store.getPosition
   │                                        │
   │  无记录 / chapterId 无效                 │  有记录
   ▼                                        ▼
setChapters（chapters[0] 顶部）      requestChapter(record.chapterId)
                                             │
                                             ▼
                                  content ready + measure 后（一次性）
                                  ├ 连续: scrollTop = scrollRatio × 可滚高（打程序化标记）
                                  ├ 分页: setPageIndex(clamp)
                                  └ PDF:  goToPage(clamp(pdfPage))
                                  （跳过该次切章滚顶）

阅读中: onScroll/翻页(节流500ms) · 切章(即刻) ──> savePosition(bookKey, patch)
        beforeunload ──> flush
```

---

## Implementation Units

- U1. **修复当前章解析（打开即显示）**

**Goal:** `chapters` 非空且 `bookData` 就绪时阅读区必显正文，杜绝脏 `localChapterId` 占位。

**Requirements:** R1, R2

**Dependencies:** None

**Files:**
- Modify: `src/components/content/BookContent.tsx`

**Approach:**
- `book.id` / `chapters` 引用变化时清空 `localChapterId`（沿用 `chapterRequest` effect 的写法新增依赖）。
- 解析兜底：`localChapterId ?? activeChapterId` 查找失败 → fallback `chapters[0]`；仍无才 idle。
- idle 文案保持三种既有场景（无书 / 文件未驻留 / chapters 空），不新增分支。

**Patterns to follow:**
- `BookContent.tsx` 现有 `useEffect(..., [chapterRequest])` 清 `localChapterId` 的模式。

**Test scenarios:**（仓库无测试运行器 → 手动浏览器验收）
- Happy path：首次上传 EPUB → 阅读区直接显示第一章正文，无占位。
- Integration：上传书 A → 点「下一章」（写入 `localChapterId`）→ 上传书 B → 显示 B 第一章正文而非占位（原缺陷复现路径转绿）。
- Edge case：`chapters` 为空的解析结果 → 仍显示占位（不可阅读场景保留）。

**Verification:** 验收清单第 1、4 条通过。

---

- U2. **位置存储：reading-position-store + BookMeta.size**

**Goal:** 落地持久化模型（key、字段、LRU、容错）。

**Requirements:** R3

**Dependencies:** None

**Files:**
- Create: `src/stores/reading-position-store.ts`
- Modify: `src/types/index.ts`（`BookMeta.size?: number`）
- Modify: `src/components/upload/BookUploader.tsx`（`setBook` 写入 `size: file.size`）

**Approach:**
- `create(persist)`，storage key `ai-read:reading-pos`，`globalThis` 单例；storage 读写容错照抄 `book-store.safeStorage`。
- 形状 `Record<string, { chapterId; scrollRatio?; pageIndex?; pdfPage?; updatedAt }>`；`savePosition(bookKey, patch)` 合并更新 + `updatedAt`；写入后按 `updatedAt` LRU 截断至 20 条。
- 构造 key 的 helper（`bookKeyOf(fileName, size)`）与 store 同处导出，供 uploader 与 BookContent 复用（保证两端 key 同源）。

**Patterns to follow:**
- `src/stores/reader-store.ts`（persist + globalThis 单例）、`src/stores/book-store.ts`（safeStorage、partialize）。

**Test scenarios:**
- Happy path：上传任意书后 `localStorage['ai-read:reading-pos']` 结构可读，`BookMeta` 带 `size`。
- Edge case：`savePosition` 连写 25 个不同 key → 仅存 20 条且为最近 20 条。
- Error path：localStorage 被禁用（safeStorage 抛错路径）→ 写入静默失败，应用不崩。

**Verification:** 控制台验证记录结构与 LRU 截断；typecheck 绿。

---

- U3. **位置保存接线（阅读中记录）**

**Goal:** 连续/分页/PDF 三模式的阅读位置与切章事件按规则落盘。

**Requirements:** R3, R5

**Dependencies:** U2

**Files:**
- Modify: `src/components/content/BookContent.tsx`

**Approach:**
- `bookKey` 用 `bookKeyOf(book.fileName, book.size)`（`size` 缺失时 fallback `fileName:` 空段，仅防御历史数据）。
- 连续模式 `onScroll` → `scrollRatio = scrollTop / max(1, scrollHeight - clientHeight)`，500ms 节流；分页 `pageIndex` 变更、`goToPage` 的 `pdfPage` 变更同节流（或直接写，字段小）。
- `activeChapterId` 变化且解析出有效章 → 即刻 `savePosition(key, { chapterId, …当前模式位置 })`。
- `beforeunload` 注册一次性 flush（useEffect 挂载/卸载对称清理）。

**Patterns to follow:**
- `handleScroll` 现有滚动方向/静默窗口读法；`book-store.setProgress` 式 patch 合并思路。

**Test scenarios:**
- Happy path：连续滚动 3 屏 → 记录 `scrollRatio` 落在 0.2–0.5 区间且随滚动增大。
- Happy path：分页翻到第 3 屏 → `pageIndex=2`（0 基）落盘；PDF 翻到第 4 页 → `pdfPage=4`。
- Edge case：连续快速滚动 2s → 仅多次覆盖同一 key 且间隔 ≥ 500ms（节流生效），无重复 key 堆积。
- Integration：切章（点目录 / 上一章 / 下一章）→ 记录 `chapterId` 立即更新（无 500ms 延迟）。

**Verification:** 逐模式操作后读 localStorage 验证字段与时序。

---

- U4. **恢复流程（上传匹配 → 激活 → 屏内定位）**

**Goal:** 重传同文件精确回到上次位置；无记录/无效记录回第一页；恢复不被滚顶效应打断、不误触发跨章。

**Requirements:** R4, R5, R1

**Dependencies:** U1, U2, U3

**Files:**
- Modify: `src/components/upload/BookUploader.tsx`（解析成功后查记录并驱动激活）
- Modify: `src/components/content/BookContent.tsx`（一次性消费恢复目标 + 屏内定位 + 滚顶冲突处理）

**Approach:**
- `handleFile` 在 `setChapters` 后：`getPosition(bookKey)` → `chapterId` 存在于 `parsed.chapters` → `requestChapter(chapterId)`，并设置 pending restore（章 id + 三位置字段）供 BookContent 消费；无记录则不设（`setChapters` 默认第一章顶部即 R4 的「第一页」分支）。
- BookContent：内容 `state === 'ready'` 且 `measure` 完成后（rAF）**一次性**消费 pending restore——连续：`scrollTop` 按 `scrollRatio` 恢复并 `markProgrammaticScroll` + `lockScroll`；分页：`setPageIndex(clamp(记录值))`（`measure` 的 `Math.min` 兜底）；PDF：`goToPage(clamp(pdfPage, 1, totalPages || 记录值))`。
- 滚顶冲突：现有「切章 `scrollTo({top:0})`」effect 改为「存在未消费 restore 时跳过，否则照旧」。
- 恢复消费后清除 pending，后续滚动/翻页行为与平常无异。

**Patterns to follow:**
- `pendingBottomRef` / `pendingLastScreenRef` 一次性旗标（既有「跳章后定位底部」机制）即本单元的消费模型；`markProgrammaticScroll` 程序化标记。

**Test scenarios:**
- Happy path：连续滚到第 3 屏 → 刷新 → 重传同文件 → 停留同章、屏位误差 ≤ 1 屏内。
- Happy path：分页翻 2 屏 / PDF 第 4 页 → 刷新重传 → 恢复 `pageIndex=1` / `pdfPage=4`。
- Happy path：全新文件（无记录）→ 第一章第 1 屏顶部。
- Edge case：记录 `chapterId` 不在新解析章节（文件被替换）→ 回第一章，不报错。
- Edge case：记录 `scrollRatio=0.9` 但当前为分页模式（字段缺失/模式不符）→ 第 1 屏，不崩溃。
- Error path：`pdfPage` 记录 999 越界 → clamp 到总页数。
- Integration：恢复后的程序化 `scrollTop` 不触发连续滚动跨章（回到同章、无连跳）。

**Verification:** 验收清单第 2、3、5 条通过；恢复后继续滚动/翻页行为正常。

---

- U5. **全量验证与验收**

**Goal:** 静态检查全绿 + 设计验收清单逐条打勾 + 写后必查。

**Requirements:** R1–R6

**Dependencies:** U1, U2, U3, U4

**Files:**
- 无代码变更（验证单元）

**Approach:** 依次执行 `pnpm typecheck`、`pnpm lint`、`pnpm build`；按设计文档 §7 验收清单 1–6 手动过一遍（EPUB/PDF/MD 三格式各至少一次）；重读本次全部改动文件扫描非 ASCII 杂散 token。

**Test scenarios:**
- 设计文档 §7 验收清单 1–6 全部通过。
- Error path：删除 `ai-read:reading-pos` 后重传 → 回第一页、控制台无异常。

**Verification:** 六条命令/验收全绿；tracker 勾选。

---

## System-Wide Impact

- **Interaction graph:** `BookUploader`（解析后驱动恢复）→ `book-store.requestChapter` → `BookContent`（消费 pending restore）；`reader-store.pageMode/twoPage` 决定恢复字段语义；连续滚动的静默窗口/程序化标记与恢复共用。
- **Error propagation:** localStorage 读写失败一律静默（safeStorage 模式）；恢复记录损坏（非法 JSON / 字段类型错）→ persist 外层容错，按无记录处理回第一页。
- **State lifecycle risks:** `book-store.reset()` 在每次上传前执行——位置 store 必须独立，不随 reset 清空（这是恢复成立的前提）；pending restore 跨「上传→解析→ready」异步窗口，组件卸载（切 tab）时必须可丢弃不残留。
- **Unchanged invariants:** 连续滚动跨章、程序化标记窗口、「上一章定位末尾」、AI 处理链路、reader-store 排版偏好、idle 三种既有文案语义均不改变；恢复只在「上传完成后的首次 ready」消费一次。

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| 恢复性 `scrollTop` 被判为用户滚动 → 连跳章 | 复用 `markProgrammaticScroll` + `lockScroll`，且 pending 只消费一次 |
| 图片懒加载撑高导致 scrollRatio 漂移 | 接受近似（Scope Boundaries 明示）；不引入锚点方案 |
| localStorage 超限 | 单记录 <1KB、LRU 20 条、safeStorage 静默容错 |
| 恢复旗标残留污染后续切章 | 一次性消费（ready+measure 后 rAF 应用即清），卸载/换书路径同时清 |

---

## Documentation / Operational Notes

- 完成后在 `docs/INDEX.md` 登记本计划、在 `docs/plans/project-plans-tracker.md` 记进度（阶段 19）。
- 设计文档 `docs/plans/2026-10-23-Design-Reader-OpenResume-v1.0.md` 为行为唯一依据；实现若偏离须先改设计再改码。

---

## Sources & References

- **Origin document:** [docs/plans/2026-10-23-Design-Reader-OpenResume-v1.0.md](2026-10-23-Design-Reader-OpenResume-v1.0.md)
- Related code: `src/components/content/BookContent.tsx`、`src/stores/book-store.ts`、`src/stores/reader-store.ts`、`src/components/upload/BookUploader.tsx`
- Related plans: `docs/plans/2026-10-22-Design-Reader-Continuous-Scroll-v1.0.md`（程序化滚动标记机制来源）
