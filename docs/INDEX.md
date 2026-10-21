# docs/INDEX.md — 静态文档唯一主索引

> 所有静态文档 / 历史 / 变更记录的唯一分类入口。新文档创建后必须在此登记路径。
> 进度状态不在本文记录，一律写入 `docs/plans/project-plans-tracker.md`。

## 需求与规格（spec）

- [ai-read 需求](spec/ai-read%20需求.md) — 唯一需求源，功能与技术栈的最终依据。

## 计划与进度（plans）

- [项目计划与进度跟踪](plans/project-plans-tracker.md) — 唯一允许记录进度勾选的文件。
- [2026-10-20 计划 优化需求提示词体系 P0–P4 v1.0](plans/2026-10-20-Plan-Optimization-Prompt-RAG-v1.0.md) — 源自 `spec/ai-read 优化需求.md`：5 大功能（全书概览/章节摘要/思维导图/引用问答/术语解释）+ RAG·分块·两层摘要·JSON 校验·SSE 流式·缓存·Prompt 版本化的无后端化实施方案。

## 缺陷修复（bugfix）

- [2026-10-19 诊断 AI 请求 Failed to fetch v1.0](bugfix/2026-10-19-Bugfix-AI-Provider-CORS-v1.0.md) — Kilo 网关端点不支持浏览器 CORS 导致 fetch 网络层拦截；附端点探测矩阵与解决方案。
- [2026-10-21 修复 处理面板 tab 消失 v1.0](bugfix/2026-10-21-Bugfix-ProcessingPanel-Tab-Disappear-v1.0.md) — 根因：Vite 监听 `docs/**` 变更触发整页 reload 清空内存态 + AI 请求无超时导致 tab 永久禁用 + 完成后自动滚动推离 tab；修复含 watcher ignore、60s 看门狗、移除自动滚动。

## 设计 / 分析 / 参考（按需登记）

- [2026-10-19 设计 布局-工作台 v1.0](plans/2026-10-19-Design-Layout-Workbench-v1.0.md) — 章节选择 / 书籍内容 / 处理模式三区域水平工作台布局与联动设计。
- [2026-10-19 设计 阅读体验优化 v1.0](plans/2026-10-19-Design-Reader-Experience-v1.0.md) — 仿 3min.top：大纲列折叠、友好排版（字号/行距/字距/字体/主题/段落）、大纲与总结开关。
- [2026-10-19 调研 3min.top Prompt 反推重建 v1.0](plans/2026-10-19-Research-3min-Prompt-Reconstruction-v1.0.md) — 由公开总结页输出样本反推其总结/章节/大纲/导图 prompt 结构（重建稿，非原文）。
- [2026-10-21 设计 思维导图交互 v1.0](plans/2026-10-21-Design-MindMap-Interaction-v1.0.md) — 滚轮缩放 / 手型拖拽开关 / 双击节点展开折叠 / 自研小地图（含视口框拖拽平移），基于 mind-elixir 6.0.0-next.4 源码盘点。
- [2026-10-21 设计 处理面板模式标签化 v1.0](plans/2026-10-21-Design-ProcessingPanel-ModeTabs-v1.0.md) — 三模式改名 + 右侧水平 tab 单选、点选即处理、完成滚到结果、ResultView 结果 Tab 自愈。
- [2026-10-21 设计 结果窗右移与三 tab 共用 v1.0](plans/2026-10-21-Design-Result-RightDock-v1.0.md) — ResultView 移入右栏与处理面板共列；activeMode 单一事实源驱动结果窗切换；summary/mindMap 产物独立保留原子替换。
- [2026-10-21 设计 模式 tab 永不再消失（四层加固）v1.0](plans/2026-10-21-Design-Tab-Persistence-Hardening-v1.0.md) — 常驻工作台 + book-store 持久化章节与结果 + 面板子项防 flex 塌陷 + 空态引导，四层保证模式 tab 任何状态下可见可点。

## 环境快照（build-env）

（暂无）
