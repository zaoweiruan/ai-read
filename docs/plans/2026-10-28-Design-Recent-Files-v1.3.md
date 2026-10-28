# 设计文档：最近打开文件 v1.3 — File System Access API 直开 + 文件名完整显示

**版本**：v1.3
**日期**：2026-10-28
**对应需求**：用户确认「1.选 A」（实施 File System Access API）+「2.目前显示的文件名不是完整名称」
**前置**：v1.0 / v1.1 / v1.2（`docs/plans/2026-10-27-Design-Recent-Files-v1.0.md` 等）

## 1. 目标

1. Chromium（Chrome / Edge）用户在任意会话（含刷新 / 新标签页）点击最近列表的「文件名」或「打开」时，**直接重新打开文件，不再弹出系统文件选择器**。
2. 非 Chromium / 不支持 File System Access API 的环境，回退现有「选择文件」流程，行为不变。
3. 最近列表主行显示**扩展名前的完整文件名**（`fileName` 去掉末尾扩展名），而非可能更短的元数据标题；完整 `fileName` 通过 tooltip 可见。

## 2. 方案

### 2.1 File System Access API（FSAA）

- 能力检测：`typeof window.showOpenFilePicker === 'function'`。
- 选择文件：`showOpenFilePicker({ types })` 返回 `FileSystemFileHandle[]`，取 `[0]`，再 `handle.getFile()` 得到 `File`。
- 持久化 handle：`FileSystemFileHandle` 可结构化克隆，存入 **IndexedDB**（不能进 localStorage / JSON）。以 `recentKeyOf(fileName, size)` 为 key。
- 重新打开：`getHandle(key)` → `handle.requestPermission({ mode: 'read' })`；`granted` 则 `handle.getFile()` + `handleFile(file, handle)`；否则回退文件选择器。
- 取消/拒绝/异常：一律回退到隐藏 `<input type="file">` 的点击，保证功能可用。

### 2.2 handle 生命周期

- `addRecent` 不感知 handle；handle 的读写集中在 `BookUploader`（唯一持有 File/Handle 的入口）。
- `removeRecent(id)` / `clearRecent()` 同步删除 IndexedDB 中对应 handle（fire-and-forget，失败不阻塞 UI）。
- 浏览器清除站点数据 / IndexedDB 失效时，`getHandle` 返回 null → 自动回退选择器，无崩溃。

### 2.3 文件名完整显示

- 新增 `stripExtension(fileName)`：去掉末尾 `.\w+`（仅当存在扩展名时），否则原样返回。
- 最近列表主行按钮文本：`stripExtension(r.fileName)`（替代 `r.title || r.fileName`）。
- 按钮增加 `title={r.fileName}`，hover 显示完整文件名（含扩展名）。
- 副行仍显示完整 `r.fileName`。

## 3. 变更文件

- 新增 `src/lib/file-handle-store.ts`：IndexedDB 封装（put/get/delete/clear）。
- 修改 `src/components/upload/BookUploader.tsx`：FSAA 选择/打开流程 + 显示名调整。
- 修改 `src/stores/recent-files-store.ts`：removeRecent/clearRecent 联动删除 handle。
- 文档：本文件 + `docs/INDEX.md` + `docs/plans/project-plans-tracker.md` 阶段 25。

## 4. 验收

- Chromium：刷新页面后点击最近列表条目，无系统选择器，文件直接打开并恢复阅读位置。
- 非 Chromium：行为与 v1.2 一致（回退选择器）。
- 权限被拒 / handle 失效：回退选择器，不抛未捕获错误。
- 主行显示完整扩展名前文件名；hover 显示完整 fileName。
- `pnpm typecheck` / `pnpm lint` / `pnpm build` 全绿。

## 5. 已知边界

- FSAA 仅 Chromium + 安全上下文（localhost / HTTPS）；Safari/Firefox 永久回退。
- handle 存储在 IndexedDB，浏览器「清除站点数据」后丢失（回退选择器，不丢记录）。
- `requestPermission` 可能触发浏览器权限弹窗，用户拒绝则回退。