# 2026-10-21 设计｜结果窗右移与三 tab 共用（Right Dock）v1.0

> 源：用户指令「结果窗口挪到屏幕右侧，通过 tab 开关切换」「三个 tab 开关共用一个结果窗口」。
> 范围：`App.tsx`（布局）+ `book-store.ts`（activeMode）+ `ProcessingPanel.tsx`（模式状态上提）+ `ResultView.tsx`（按 activeMode 切换 + 空态兜底）。无新依赖。

## 1. 需求解读

- `ResultView` 从三栏下方整体移到**屏幕右侧栏**（处理面板下方），成为唯一的**结果窗口**。
- 处理面板顶部的 3 个模式 tab（当前章节总结 / 当前章节思维导图 / 整书思维导图）**共用**这一个结果窗：点哪个 tab，结果窗就切到对应产物视图并触发该模式处理。
- summary / mindMap 两种产物**独立保留、互不清除**——点 tab 可在已有产物间即时切换，再跑则原子替换同类产物。

## 2. 设计

### 2.1 状态（book-store）

- 新增 `activeMode: ProcessingMode`（初始 `'summary'`，非持久化）+ `setActiveMode`；`reset` 复位为 `summary`。
- `ProcessingPanel` 删除本地 `mode` state，改读/写 store `activeMode`（单一事实源）。
- `run(modeOverride?)` 逻辑不变；**删除开头的 `setSummary(null); setMindMap(null)`**——产物仅在成功时被 `setSummary`/`setMindMap` 原子替换，失败保留旧结果（进度条与错误文案已示失败态）。

### 2.2 布局（App.tsx）

- 三栏 grid 第三列 `260px → 360px`；三列统一加高 `h-[560px] lg:h-[640px]`（右栏需同时容纳处理面板与结果窗，等高避免底边参差）。
- 第三列改为纵向 flex：
  - 处理面板：`h-[300px] shrink-0 lg:h-[320px]`（内部自带 overflow-y-auto）
  - 结果窗：`flex-1 min-h-0 overflow-y-auto` 包裹 `<ResultView />`（原下方位置移除）
- `#app-result` 滚动定位逻辑沿用（结果窗已在视口右侧，scrollIntoView 自动对齐）。

### 2.3 结果窗切换（ResultView）

- 读 `activeMode`；effect：`activeMode==='summary' → tab='summary'`，否则 `tab='mindmap'`（产物已存在时即时切换，满足「通过 tab 开关切换」）。
- 保留既有「仅单产物存在 → 强制对应 tab」的兑底 effect（两者并存时以 activeMode 为准）。
- 内容区空态兜底：`tab='summary'` 但无 summary 产物 → 显示「暂无总结结果…」提示，mindmap 同理（避免空白内容区）。
- 子 tab 按钮（文字总结 / 思维导图）仍按产物存在与否渲染；两产物并存时两按钮可见，点击子 tab 也可手动切视图。

## 3. 验收

- 仅一个 `#app-result`，且 `left > innerWidth*0.55`（右栏内）。
- 点「当前章节总结」→ 自动跑 → 结果窗出现导读；点「整书思维导图」→ 同一结果窗切到导图；再点「当前章节总结」→ 即时切回（两产物按钮并存证明共用且独立保留）。
- `pnpm typecheck` / `pnpm build` 绿；写后必查（读回扫杂散 token）。
