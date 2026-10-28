# 2026-10-27 设计 最近打开文件 v1.0

> 模块：上传区（BookUploader）+ 配置对话框（ConfigDialog）+ 新增 recent-files-store。

## 1. 需求

1. 在「选择文件」按钮右侧新增「最近打开文件」按钮。
2. 该按钮显隐（toggle）最近文件列表。
3. 记录数量暴露在配置对话框（ConfigDialog）中可编辑，默认 10 条，范围 1–50，越界自动钳制。
4. 点击列表中某条记录：唤起系统文件选择器，用户重新选择同一文件后打开，并沿用已有的「文件名 + 大小」匹配恢复上次阅读位置（见 `reading-position-store`）。

## 2. 边界与约束

- 浏览器安全模型禁止直接重开本地文件路径；`bookData`（EPUB/PDF 二进制）不参与持久化，刷新后必然丢失（见 `2026-10-27-Bugfix-Book-Data-Resident-v1.0`）。因此列表只持久化**元数据**（文件名 / 大小 / 格式 / 标题 / 作者 / 打开时间），不持久化文件内容。
- 记录去重键为 `文件名:大小`（复用 `reading-position-store` 的 `bookKeyOf` 思路）：重复打开同一文件时置顶刷新而非追加。
- 记录数量唯一事实源在 settings-store（`recentFilesLimit`），recent-files-store 写入时读取该值裁剪；配置对话框改小数量时同步裁剪存量记录。

## 3. 数据模型

新增 `src/stores/recent-files-store.ts`（持久化键 `ai-read:recent-files`）：

```ts
interface RecentFileRecord {
  id: string            // 随机 id（列表 key）
  fileName: string      // 原始文件名
  size: number          // 文件字节数（去重键组成部分）
  format: BookFormat    // 'epub' | 'pdf' | 'markdown'
  title?: string        // 解析出的书名，缺省时回退 fileName
  author?: string
  openedAt: number      // 打开时间戳（排序与展示）
}
```

Store 动作：`addRecent(input)`（去重置顶 + 按 limit 裁剪）、`removeRecent(id)`、`clearRecent()`、`trimTo(limit)`（配置改小数量时裁剪存量）。

settings-store 新增 `recentFilesLimit: number`（默认 10，`setRecentFilesLimit` 钳制 1–50）；`src/types/settings.ts` 的 `settingsSchema` 同步增加该字段。

## 4. UI 变更

### 4.1 BookUploader

- 「选择文件」按钮右侧新增 outline 变体按钮「最近打开文件」，点击切换 `recentVisible`。
- 列表显隐区位于按钮行下方：标题行（左「最近打开文件」+ 计数 `N/limit 条`，右「清空」），条目行（主行：书名或文件名；副行：格式 · 大小 · 时间 · 原始文件名；右侧操作：「打开」「移除」）。
- 「打开」= 触发同一个隐藏 file input；选文件后走既有 `handleFile` 流程，阅读位置按 `文件名:大小` 自动恢复。
- 空态文案「暂无记录」；底部提示浏览器无法直接重开本地文件、重新选择同一文件将恢复阅读位置。
- 打开成功（解析完成）后调用 `addRecent`，解析失败不记录。

### 4.2 ConfigDialog

- 新增「最近打开文件」配置组：数字输入框（1–50，输入即时生效）+ 「清空记录」按钮。
- 数量变小时调用 `trimRecentFiles(limit)` 裁剪存量，避免展示超过设定数量的记录。

## 5. 验收

1. 打开任一支持格式文件后，列表出现该记录；重复打开同文件置顶不重复。
2. 超过上限时最旧记录被挤出；配置把数量改小后列表立即裁剪，改大后最多回填到裁剪前数量。
3. 点击记录「打开」→ 选同一文件 → 正常渲染且阅读位置恢复。
4. 「移除」删单条，「清空」删全部，计数同步。
5. `pnpm typecheck` / `pnpm build` 通过；写后复查无杂散 token。
