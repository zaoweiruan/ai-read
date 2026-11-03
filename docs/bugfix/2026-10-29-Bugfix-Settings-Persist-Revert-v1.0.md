# 2026-10-29 修复 配置保存后刷新还原 v1.0

> **后续更正**：本修复（持久化管道对齐）必要但不充分，用户反馈现象未消除。真正根因在 `src/components/config/ConfigDialog.tsx` 的保存门禁，见 `2026-10-30-Bugfix-ConfigDialog-SaveGate-v1.0.md`。

## 现象

用户反馈「无法正确保存配置，刷新后配置还原」：在配置对话框保存 AI 服务（`ai-read:settings`）后刷新页面，providers / activeProviderId / recentFilesLimit 回到默认值。

## 根因

`src/stores/settings-store.ts` 是唯一一个**裸 `persist`**（仅 `{ name: STORAGE_KEY }`）的持久化 store：

- 无 `storage` 守卫：默认 `createJSONStorage(() => localStorage)` 直读 `window.localStorage`，在非浏览器 / 桌面 / 受限上下文里访问 `window` 失败或静默不写，配置无法落盘。
- 无 `partialize`：整个 state（含 action 函数）参与序列化，JSON 往返后函数丢失，且污染持久化结构。
- 无 `merge`：重载时缺省浅合并，读到不合法 / 被污染的陈旧数据时不做归一化，恢复结果不稳定。

同仓其余持久化 store（`recent-files-store` / `reading-position-store` / `book-store`）均已采用「`safeStorage` 守卫 + `createJSONStorage` + `partialize` + `merge` 归一化」的既定约定，唯独 `settings-store` 未对齐。

## 修复

`src/stores/settings-store.ts` 对齐既定约定：

1. `import { createJSONStorage, persist } from 'zustand/middleware'`。
2. 新增 `safeStorage`：`getItem/setItem/removeItem` 各自 `try/catch` 包裹 `window.localStorage`，异常时安全降级（读返回 null / 写忽略）。
3. 新增 `normalizeProviders(raw)`：把任意持久化值归一为合法 `ProviderSettings[]`（校验 id/name 非空字符串，kind 收敛为 `openai-compatible|google`，apiKey/baseUrl/model 缺省空串）。
4. `persist` 选项补齐：
   - `storage: createJSONStorage(() => safeStorage)`
   - `partialize` 只持久化 `{ providers, activeProviderId, recentFilesLimit }`（剔除 action）
   - `merge(persisted, current)`：无有效 persisted 时保留 current；否则用 `normalizeProviders` 归一 `providers`，`activeProviderId`/`recentFilesLimit` 仅在类型合法时覆盖。

## 安全红线

`ai-read:settings` 含用户 apiKey，本文档不记录任何 apiKey 原文；修复不涉及密钥，仅改持久化管道。

## 校验

- `pnpm typecheck`：通过（tsc -b --noEmit 无错误）
- `pnpm lint`：0 error（既有 3 条 `react-hooks/exhaustive-deps` warning 均在 `BookContent.tsx`，与本修复无关）
- `pnpm build`：成功（187 模块；既有 `>500kB chunk` 提示，非错误）
