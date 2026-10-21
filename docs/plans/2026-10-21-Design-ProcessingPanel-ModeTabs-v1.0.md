# 2026-10-21 设计｜处理面板模式标签化（点击即处理）v1.0

> 源：用户 2026-10-21 指令。范围：`ProcessingPanel.tsx` + `ResultView.tsx` 小改；无新依赖、不改 `ProcessingMode` 类型。

## 1. 需求

1. 模式改名：`文字总结模式 → 当前章节总结`、`章节思维导图模式 → 当前章节思维导图`、`整书思维导图模式 → 整书思维导图`（用户原文「整书思维导」按去「模式」后缀规律补全为「整书思维导图」）。
2. 控件由纵向 radio 改为 **tab 单选开关**，在屏幕右侧面板内**水平并列**；**点选标签即开始处理**，完成后自动展示结果。

## 2. 设计

- **标签栏**：`role="tablist"` + 3 个 `role="tab"` 按钮水平 flex 等分；选中态 `bg-primary text-primary-foreground`，未选中 `text-muted-foreground hover:bg-muted`；`running` 时全部禁用。
- **点选即处理**：`onClick → setMode(v); void run(v)`；`run(modeOverride?)` 内用 `effectiveMode = modeOverride ?? mode` 解决 setState 异步旧值问题。
- **移除「开始处理」按钮**；空闲态改为提示「已选 N 章 · 点击上方标签页立即处理」；运行中仍显示「暂停」+ 进度；再次点标签 = 以该模式重跑。
- **展示结果**：运行成功后 `setTimeout 300ms` `document.querySelector('#app-result')?.scrollIntoView({behavior:'smooth'})`（给 ResultView 两个 `<section>` 加 `id="app-result"`）。
- **ResultView 标签自愈**：现有 effect 只处理「仅有 mindMap」；补对称分支「仅有 summary → 切回文字总结」，避免 stale tab 导致内容区空白（点标签即跑新流程必经此路径）。

## 3. 验收

- 3 个新标签名正确、旧「…模式」与「开始处理」按钮消失；点标签直接跑（mock E2E 三模式各一）；完成平滑滚到结果区；结果 Tab 与产物自动匹配；`pnpm typecheck` / `pnpm build` 绿；写后必查。
