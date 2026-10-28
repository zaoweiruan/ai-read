# 设计文档：最近打开文件 v1.2（点击文件名直接打开）

- 日期：2026-10-28
- 模块：上传 / 最近打开文件（BookUploader + recent-files-store + recent-file-cache）
- 版本：v1.2（增量，基于 v1.1 会话级 File 缓存方案）
- 状态：已实现

## 1. 背景与需求

用户反馈（原话）：

> 优化，可以通过点击文件名直接打开

v1.1 已实现最近列表条目右侧「打开」按钮直接重开文件（会话内缓存命中时免弹系统选择器）。v1.2 将同一行为扩展到条目主行文件名/书名本身，提升点击效率与可发现性。

## 2. 方案

1. 在 `BookUploader` 组件内提取辅助函数 `openRecord(r: RecentFileRecord)`：逻辑与 v1.1「打开」按钮完全一致——`getCachedFile(recentKeyOf(r.fileName, r.size))` 命中则 `void handleFile(cached)` 直接重开并恢复阅读位置；未命中则 `inputRef.current?.click()` 回退系统文件选择器。
2. 「打开」按钮 onClick 改为调用 `openRecord(r)`，消除重复代码。
3. 条目主行（`r.title || r.fileName`）由静态 `<p>` 改为 `<button type="button">`：`truncate text-left hover:underline cursor-pointer`、`disabled={busy}`（与「打开」按钮一致），onClick 调用 `openRecord(r)`。
4. 底部提示文案同步更新为「同一标签页内点击文件名或『打开』会直接重新打开该文件；刷新或重启浏览器后，需重新选择同一文件，将自动恢复上次阅读位置。」

## 3. 边界约束（沿用 v1.1，不变更）

- 仅持有同一标签页会话内的 `File` 对象引用，不持久化文件内容；刷新 / 重启浏览器 / 新标签页后缓存为空，点击文件名与「打开」一致回退系统选择器（浏览器安全硬约束）。
- 记录数据、去重键（`文件名:大小`）、`recentFilesLimit` 配置（1–50，默认 10，超出钳制）均不变。

## 4. 验收标准

1. `pnpm typecheck` / `pnpm lint` / `pnpm build` 全部通过。
2. 同会话内点击列表条目文件名，直接重新打开文件且不弹出系统文件选择对话框（Playwright 间谍计数 `__inputClicks` 不增加）。
3. 刷新页面后点击文件名，按设计回退系统选择器。
4. 「打开」按钮行为与文件名点击行为完全一致。
5. 写后必查：无杂散 token。
