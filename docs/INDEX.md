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
- [2026-10-22 设计 思维导图居中与小地图拖拽 v1.0](plans/2026-10-22-Design-MindMap-Center-MiniDrag-v1.0.md) — 新增居中按钮（`toCenter` 不改缩放）、小地图视口框按真实可见区计算并支持跟手拖拽、viewBox 稳定化、导图来源徽标（整书/章节）。
- [2026-10-22 设计 右栏重排（结果窗上移 + 配置组折叠）v1.0](plans/2026-10-22-Design-RightColumn-Layout-v1.0.md) — ResultView 内嵌处理面板置于 tab 下方；原「服务 / 高级选项」降级为底部可折叠配置组；进度行上移。
- [2026-10-22 设计 结果窗口全屏按钮 v1.0](plans/2026-10-22-Design-Result-Fullscreen-v1.0.md) — 结果窗常驻「全屏 / 退出全屏」按钮，优先原生 Fullscreen API、失败回退 CSS 覆盖层；同一 DOM 切换，导图实例不重建。
- [2026-10-22 设计 阅读器图片 + 不自动全选 + 当前章节模式 v1.0](plans/2026-10-22-Design-Reader-Images-CurrentChapter-v1.0.md) — EPUB 内嵌图片解析与渲染（data/blob URL）、打开书籍不再全选章节、当前章模式只处理内容窗口显示的章节。
- [2026-10-22 设计 阅读区全屏 + 页/章导航 v1.0](plans/2026-10-22-Design-Reader-Navigation-Fullscreen-v1.0.md) — 阅读区新增全屏开关、章导航、PDF 逐页阅读与页码指示；附带修复 PDF 数组缓冲被 pdfjs detach 导致正文空白。
- [2026-10-22 设计 阅读区连续滚动 v1.0](plans/2026-10-22-Design-Reader-Continuous-Scroll-v1.0.md) — 滚到底自动进入下一章（连续阅读），「连续滚动」开关；附带修复 zustand store HMR 多实例与模块缓存陈旧两个 dev 基础问题。
- [2026-10-22 设计 Markdown 文档支持 v1.0](plans/2026-10-22-Design-Markdown-Support-v1.0.md) — .md/.markdown 上传解析（front matter + H1/H2 切章）与阅读区 Markdown 渲染（标题/列表/代码块/表格/引用/行内样式）。

## 环境快照（build-env）

（暂无）
