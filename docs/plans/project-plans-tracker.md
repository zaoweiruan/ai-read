# 项目计划与进度跟踪

> 唯一允许记录进度勾选的文件。静态文档索引见 `docs/INDEX.md`。

## 阶段 1：项目初始化（进行中）

- [x] 阅读需求文档 `docs/spec/ai-read 需求.md`
- [x] 手动脚手架：package.json / vite.config.ts / tsconfig* / index.html / src/main.tsx / src/index.css
- [x] 类型定义：src/types/index.ts、src/types/settings.ts
- [x] 服务层：src/services/epub.ts、src/services/pdf.ts、src/services/ai/*
- [x] 状态：src/stores/settings-store.ts、book-store.ts、prompt-store.ts
- [x] UI 基础件：src/components/ui/*
- [x] ConfigDialog / BookUploader / ChapterList
- [x] AGENTS.md 长期记忆与上下文注入点
- [x] docs/INDEX.md 主索引
- [x] PromptManager.tsx（当前损坏，需重写）
- [x] ProcessingPanel.tsx（未创建）
- [x] ResultView.tsx（未创建）
- [x] 补齐依赖（zustand / clsx / tailwind-merge / zod / tailwindcss / @tailwindcss/vite / @smoores/epub / epubjs / pdfjs-dist / mind-elixir）并 pnpm install
- [x] pnpm typecheck / pnpm build 通过
- [x] README.md

## 阶段 2：工作台布局（2026-10-19）

- [x] 设计文档 `plans/2026-10-19-Design-Layout-Workbench-v1.0.md` + INDEX 登记
- [x] book-store 增加 activeChapterId（联动状态）
- [x] 新建 BookContent 书籍内容区
- [x] ChapterList：点标题看内容 + 高亮 + 内部滚动
- [x] ProcessingPanel：模式纵向一组 + 底部操作区
- [x] App.tsx：三区域水平工作台
- [x] typecheck / build / 浏览器联动验证

## 阶段 3：阅读体验优化（2026-10-19，仿 3min.top）

- [x] 设计文档 `plans/2026-10-19-Design-Reader-Experience-v1.0.md` + INDEX 登记
- [x] epub.ts 段落化文本提取（按块提取，`\n\n` 分隔）
- [x] reader-store（排版偏好持久化 `ai-read:reader`）
- [x] BookContent 工具栏（大纲/总结开关 + 排版控件 + 主题 + 本章总结卡片）
- [x] ChapterList 折叠 + App 细栏恢复
- [x] typecheck / build / 浏览器验证（65 段/章、四主题、折叠恢复、持久化、截图）

## 阶段 4：优化需求实施（2026-10-20，计划 `plans/2026-10-20-Plan-Optimization-Prompt-RAG-v1.0.md`）

### P0 基建与校验地基

- [x] 计划文档 `plans/2026-10-20-Plan-Optimization-Prompt-RAG-v1.0.md` + INDEX 登记
- [x] ConfigDialog 验证服务（no-cors 探针 + 最小 chat 探测 + 草稿门禁保存）
- [x] `src/lib/safeJson.ts` 抽出 + `src/services/ai/chatJson.ts`（schema 校验 + 重试 1 次）
- [x] `src/prompts/` 版本化模板（system + 6 任务模板）
- [x] `provider.ts` 增加 `chatStream`（openai SSE / google alt=sse，失败回退）
- [x] P0 验收：typecheck / build + 验证服务 4 类端点行为（2026-10-20 浏览器 E2E 七用例全过）

### P1 结构化输出（F1/F2/F3）

- [x] 类型：ChapterSummaryCard + SummaryResult.guide/cards
- [x] summary 流程：章节 JSON 卡片 + 结构化导读（含章节定位）
- [x] mindmap.v1 强约束（4 层/7 节点/18 字）+ 重试
- [x] book-mindmap 改逐章导图 → mindmap-merge 合并
- [x] ResultView 导读 markdown + 跳章；BookContent 结构化卡片
- [x] P1 验收：一神论 13 章 mock E2E（6 分区/表格/章节链接跳章/卡片展开/章节导图 4 层节点/整书 merge-ready；截图 p1-summary-guide-cards、p1-chapter-mindmap）

### P2 分块与缓存（E1/E2/E6）

- [ ] `src/services/chunking.ts`（800–1500 tokens，元数据齐全）
- [ ] 超长章两层摘要（块 → 章）
- [ ] `src/services/cache.ts`（SHA-1 key + LRU + 缓存徽标）
- [ ] P2 验收：二次运行 fetch 次数下降

### P3 引用问答（F4）

- [ ] `src/services/retrieval.ts`（BM25-lite，中文 bigram）
- [ ] ResultView 三 Tab + `QAPanel.tsx`（流式答案 + citations + follow_ups）
- [ ] `verifyCitations` quote 精确匹配防幻觉 + 重试
- [ ] 引用 chip 跳转：setActiveChapterId + highlightQuote + 段落高亮闪烁
- [ ] P3 验收：跳转高亮 / 篡改 quote 负向拦截 / 不足材料引导

### P4 流式体验 + 术语解释（F5/E5）

- [ ] 导读与问答接入 chatStream 增量渲染（失败回退）
- [ ] 划词 → glossary.v1 → 4 段式解释抽屉
- [ ] Failed to fetch 中文诊断增强
- [ ] 终验：typecheck / build / E2E（一神论 + 批评与真实）/ 截图 / 验收清单全勾
