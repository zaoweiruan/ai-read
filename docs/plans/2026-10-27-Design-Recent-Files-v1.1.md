# 2026-10-27 设计 最近打开文件 v1.1 —「打开」直接重开文件（会话 File 缓存）

> 前置文档：`2026-10-27-Design-Recent-Files-v1.0.md`（同目录，v1.0 已交付列表与 limit 配置）。

## 1. 背景与用户反馈

- v1.0 已交付：上传区「选择文件」右侧新增「最近打开文件」按钮显隐列表；记录仅存元数据（去重键 `文件名:大小`）；记录数量默认 10、范围 1–50，在配置对话框编辑。
- 用户反馈（原话）：「点击文件旁『打开』按钮时应该打开文件，不是打开对话框」。
- v1.0 中「打开」的实现为触发隐藏 `<input type="file">`，唤起系统文件选择对话框；用户预期是像 IDE 最近文件列表那样直接打开，而非再经过一次文件选择。

## 2. 浏览器能力边界（为什么 v1.0 只能弹选择器）

Web 页面安全模型禁止通过文件路径直接读取本地文件，无法凭已知路径构造 File；文件只能来自用户手势：

1. `<input type="file">` 用户选择 → 得到 File 句柄；
2. File System Access API（`showOpenFilePicker`）：仅 Chromium 可用、需用户手势与持续授权、每次仍要用户在系统对话框中确认，且与「同一套前端代码同时支持 Web 与桌面、无仅 Node 可用 API」的项目边界冲突，**不采纳为主路径**（仅作 backlog 记录，见 §8）；
3. 拖放 `DataTransfer.files`；
4. **同一会话内已持有的 File 对象** —— 本文方案。

推论：点击事件获得的 File 对象在会话内是活的。把它缓存下来，「打开」即可直接复用重开，这是无后端纯前端能到达的最优解。

## 3. 方案：会话级 File 缓存

### 3.1 新模块 `src/lib/recent-file-cache.ts`

模块级 `Map<string, File>`，键 = `文件名:大小`（复用 `recentKeyOf`），**不持久化**：

| API | 行为 |
| --- | --- |
| `cacheRecentFile(key, file)` | `delete` + `set`（刷新 recency）；`size > MAX_RECENT_LIMIT`(50) 时从最旧端挤出（LRU） |
| `getCachedFile(key)` | 命中即 `delete` + `set` 刷新 recency 后返回 |
| `dropCachedFile(key)` | 单键移除 |
| `clearCachedFiles()` | 全清 |

### 3.2 边界约束

- 不持久化：File 不可 JSON 序列化；刷新 / 重启浏览器 / 新标签页后缓存丢失，回退 v1.0 选择器路径（底部提示文案已同步变更，见 §4）。
- 上限 50（与 `recentFilesLimit` 上限对齐），超过按最旧挤出，避免大文件二进制无上限驻留内存。
- 记录删除 / 清空时同步丢弃缓存，防止「列表已移除、重开仍可用」的不一致。

### 3.3 代码改动

- `src/stores/recent-files-store.ts`：`recentKeyOf` 增加 `export`；`removeRecent` 先按目标 key `dropCachedFile` 再过滤；`clearRecent` 先 `clearCachedFiles()` 再清空记录。
- `src/components/upload/BookUploader.tsx`：
  - `handleFile` 在 `addRecent` 之后调用 `cacheRecentFile(recentKeyOf(file.name, file.size), file)` —— 仅解析成功的文件才缓存。
  - 「打开」按钮 `onClick`：先 `getCachedFile(recentKeyOf(r.fileName, r.size))`；命中 → `void handleFile(cached)` 直接重开（复用既有完整流水线：解析 → setBook → 恢复阅读位置）；未命中 → `inputRef.current?.click()` 回退选择器。
- 兜底一致性：重开走同一 `handleFile`，文件名 / 大小不变 → 阅读位置按 `文件名:大小` 命中恢复，与 v1.0 约定一致。

## 4. UI 文案变更

列表底部提示：

- 旧：「浏览器无法直接重开本地文件，点击『打开』后请选择同一文件，将自动恢复上次阅读位置。」
- 新：「同一标签页内点击『打开』会直接重新打开该文件；刷新或重启浏览器后，需重新选择同一文件，将自动恢复上次阅读位置。」

## 5. 数据流

```
首次打开：用户选择文件 → parse → setBook/addRecent → cacheRecentFile(key, file)
会话内重开：点击「打开」→ getCachedFile(key) 命中 → handleFile(cached) → 解析 → 恢复阅读位置（无系统对话框）
回退：未命中（刷新 / 重启 / 跨标签页）→ 隐藏 input 唤起系统选择器
联动清理：移除单条 → dropCachedFile(key)；清空 → clearCachedFiles()
```

## 6. 变更清单

| 文件 | 类型 | 说明 |
| --- | --- | --- |
| `src/lib/recent-file-cache.ts` | 新增 | 会话级 File 缓存（LRU 50，不持久化，无杂副作用） |
| `src/stores/recent-files-store.ts` | 修改 | `export recentKeyOf`；`removeRecent` / `clearRecent` 联动清理缓存 |
| `src/components/upload/BookUploader.tsx` | 修改 | `handleFile` 解析成功后缓存 File；「打开」命中缓存直接重开、未命中回退选择器；底部提示文案 |

## 7. 验收

1. 会话内：打开 A → 打开 B → 在列表中点 A 的「打开」→ A 直接重新加载，**无系统文件对话框**，阅读位置恢复。
2. 刷新页面 → 列表仍在（localStorage 持久化）→ 点「打开」→ 回退为系统选择器，选同一文件后正常打开且恢复阅读位置。
3. 移除单条 / 清空记录后缓存同步失效（无脏 File 泄漏）。
4. `pnpm typecheck` / `pnpm lint` / `pnpm build` 全绿；写后必查杂散 token 扫描通过。
5. 浏览器 E2E：待人工验收。

## 8. 已知限制与 backlog

- 刷新 / 重启 / 跨标签页后必须重选文件 —— 浏览器安全模型硬约束，非实现缺陷。
- File System Access API（`showOpenFilePicker` + IndexedDB 持久句柄）可作为后续增强：Chromium 下可跨刷新记住句柄，但非全端可用，需能力检测 + 降级，本版不引入。
