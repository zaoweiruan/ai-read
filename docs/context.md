# ai-read — 环境与上下文长期记忆

> 本文是 ai-read 项目的环境/上下文长期记忆（Caura 不可用时的本地落地副本）。
> 行为规范与路由表见根目录 `AGENTS.md`；静态文档索引见 `docs/INDEX.md`；进度见 `docs/plans/project-plans-tracker.md`。

## 1. 环境快照（build-env）

| 要素 | 值 |
| --- | --- |
| 操作系统 | Windows / win32 |
| 默认终端 | PowerShell（所有模型/MCP/技能命令使用 PowerShell 语法） |
| Node | v24.16.0（要求 20+） |
| pnpm | 10.33.2（要求 9+；依赖安装只用 pnpm，禁 npm/yarn） |
| 工作目录 | E:\eclipse_workspace\ai-read |
| 工作区根 | E:\eclipse_workspace |
| 参考工程 | E:\eclipse_workspace\multiple_thread_validproxy（AGENTS.md / docs 结构范本） |

## 2. 项目上下文

- 产品：EPUB / PDF → 结构化思维导图 + 文字总结；三种处理模式 `summary` / `chapter-mindmap` / `book-mindmap`。
- 架构：纯前端 SPA，无后端。AI 请求全部浏览器直连用户配置的 Provider（Bring-Your-Own-Key），**严禁引入任何代理/服务端中转**。
- Provider：`openai-compatible`（默认 `https://api.openai.com/v1`）与 `google`（默认 `https://generativelanguage.googleapis.com/v1beta`），实现在 `src/services/ai/provider.ts`。
- 持久化：localStorage `ai-read:settings`（含用户 apiKey —— 禁止写入任何文档/记忆，泄露用 `<REDACTED>`）、`ai-read:prompts`。
- 数据流：BookUploader 解析（`parseEpub`/`parsePdf`）→ book-store（chapters + 选中 + 分组）→ ProcessingPanel（模式 + 高级选项 → resolveProvider.chat 逐章处理 → progress）→ ResultView（SummaryResult 文本 / MindMapResult 经 mind-elixir 渲染）。

## 3. 关键纪律（教训沉淀）

1. **写后必查（stray-token 纪律）**：本会话反复向代码位注入非 ASCII/外语杂散 token（估值/年度/半岛/能吃/timing/的一致/都不要/whales/达标/脚尖/一系列/doświad/outlineista/filtervalued/classNameruch 等）。每次写/改源码后必须 Read 重读、扫描代码位非 ASCII 字符并立即修复，才能继续。
2. 技术栈已按需求锁定（React 19 / Vite 6 / Tailwind 4 / shadcn 风格 / Zustand / epubjs / pdfjs-dist / mind-elixir / pnpm），不得擅自替换。
3. 文档先行：改代码前先在 `docs/` 子目录建 `[YYYY-MM-DD]-[DocType]-[Module]-[Version].md` 并登记 `docs/INDEX.md`；禁止在 `docs/` 根新建目录。
4. 需求疑问回到 `docs/spec/ai-read 需求.md`，不得凭空扩展需求。
5. Caura 工作流（可用时）：`caura_recall`（任务前）→ 执行 → 复查读回 → `caura_write`（沉淀决策/命令/教训）。

## 4. 当前初始化状态（快照，动态进度以 tracker 为准）

- 已完成：脚手架（package.json/vite/tsconfig/index.html/main.tsx/index.css）、types、services（epub/pdf/ai）、stores、ui 基础件、ConfigDialog、BookUploader、ChapterList、AGENTS.md、docs/INDEX.md、docs/plans/project-plans-tracker.md。
- 待办：重写损坏的 `PromptManager.tsx`；新建 `ProcessingPanel.tsx`、`ResultView.tsx`；补齐依赖并 `pnpm install`；`pnpm typecheck` / `pnpm build`；README。
