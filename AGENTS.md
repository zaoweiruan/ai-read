# AGENTS.md — 长期记忆与 AI 上下文注入点

> 本文档是 ai-read 项目的长期记忆与 AI 上下文注入入口，供所有 AI 模型、MCP、技能在会话启动时读取。
> 静态文档索引一律指向 `docs/INDEX.md`；进度状态一律写入 `docs/plans/project-plans-tracker.md`。本文件不记录任何动态跟踪状态。

## 1. 项目概述与技术栈边界

| 关键要素 | 规范与版本 | 备注 / 约束限制 |
| --- | --- | --- |
| 项目名称 | ai-read（AI 智能电子书解析） | EPUB / PDF → 结构化思维导图 + 文字总结 |
| 语言与标准 | TypeScript 5.7+ / ES2022，React 19 函数组件 + Hooks | `strict` 全开，`verbatimModuleSyntax`，禁止 any 滥用 |
| 构建工具 | Vite 6（`@vitejs/plugin-react`） | 脚本：`pnpm dev` / `pnpm build` / `pnpm typecheck` / `pnpm lint` |
| UI 框架 | Tailwind CSS 4（`@tailwindcss/vite`）+ shadcn/ui 风格组件（`src/components/ui/*`） | 主题令牌在 `src/index.css` 的 `@theme` 块 |
| 状态管理 | Zustand（persist 中间件：settings-store / prompt-store；book-store 非持久化） | 禁止引入 Redux 等其他状态库 |
| EPUB 解析 | `@smoores/epub` + `epubjs`（`src/services/epub.ts`） | TOC 展平为 Chapter[] |
| PDF 解析 | `pdfjs-dist`（`src/services/pdf.ts`，worker 用 `pdf.worker.min.mjs`） | Outline 优先，无目录则按页拆分 |
| 思维导图 | `mind-elixir`（ResultView 渲染 MindMapResult） | 交互：缩放 / 拖拽 / 展开折叠 |
| AI 服务 | 自研 `src/services/ai/provider.ts`（openai-compatible / google 两种 ProviderKind） | **Bring-Your-Own-Key，全部请求浏览器直连 Provider，严禁引入任何代理/后端转发** |
| 处理模式 | `summary`（文字总结）/ `chapter-mindmap`（章节思维导图）/ `book-mindmap`（整书思维导图） | 类型见 `src/types/index.ts` `ProcessingMode` |
| 目标平台 | 同一套前端代码同时支持 Web 与桌面应用 | 不使用任何仅 Node 可用的 API |
| 运行环境要求 | Node 20+，pnpm 9+（当前机：Node v24.16.0 / pnpm 10.33.2，Windows/win32） | 默认终端 PowerShell —— 所有模型/MCP/技能命令必须使用 PowerShell 语法 |
| 需求文档 | `docs/spec/ai-read 需求.md` | 唯一需求源，改功能前先对照 |
| 文档主索引 | `docs/INDEX.md` ⭐ | 所有静态文档 / 历史 / 变更记录的唯一分类索引 |
| 系统版本与入口 | v0.1.0；入口 `index.html` → `src/main.tsx` → `src/App.tsx` | 单页应用，无后端 |

## 2. 目录结构与设计规范

```text
ai-read/
├── AGENTS.md                 # 本文件：长期记忆与 AI 上下文注入点（不含动态状态）
├── package.json              # 依赖与脚本（pnpm）
├── vite.config.ts            # react + tailwindcss 插件，别名 @ -> src
├── tsconfig.json             # solution 引用 app + node
├── tsconfig.app.json         # 应用侧 TS 配置（strict）
├── tsconfig.node.json        # vite.config.ts 侧 TS 配置
├── index.html                # zh-CN，标题「AI Read - 智能电子书解析」
├── docs/
│   ├── INDEX.md              # ⭐ 静态文档唯一主索引
│   ├── spec/                 # 需求与规格
│   ├── plans/                # 计划与 project-plans-tracker.md（动态进度）
│   ├── bugfix/               # 缺陷修复记录（YYYY-MM-DD-Bugfix-<Module>-v1.0.md）
│   └── ...                   # 仅允许在 docs/ 下已有子目录放文档，禁止在 docs/ 直接新建顶层目录
└── src/
    ├── main.tsx              # React 19 createRoot 入口
    ├── App.tsx               # 页头 + Tab(阅读/自定义提示词) + 配置入口
    ├── index.css             # Tailwind @import + @theme 设计令牌
    ├── types/                # index.ts（Book/Chapter/ProcessingMode 等）、settings.ts（zod schema）
    ├── lib/utils.ts          # cn() = clsx + tailwind-merge
    ├── stores/               # settings-store / book-store / prompt-store（Zustand）
    ├── services/
    │   ├── epub.ts           # parseEpub / getChapterContent
    │   ├── pdf.ts            # parsePdf / getPageText
    │   └── ai/               # provider.ts（OpenAICompatible/Google）、index.ts（resolveProvider）
    └── components/
        ├── ui/               # shadcn 风格基础件：button/input/select/textarea/dialog/progress/badge
        ├── config/           # ConfigDialog（AI 服务配置）
        ├── upload/           # BookUploader（.epub/.pdf 上传解析）
        ├── chapters/         # ChapterList（章节选择 + Ctrl+G 分组）
        ├── processing/       # ProcessingPanel（处理模式与进度）
        ├── results/          # ResultView（总结 + mind-elixir 导图）
        └── prompts/          # PromptManager（自定义提示词 CRUD）
```

### 2.1 测试目录与文档约束

- **红线**：AGENTS.md 不记录任何动态跟踪状态（进度、任务勾选、当前分支进度等）。静态文档索引 → `docs/INDEX.md`；进度状态 → `docs/plans/project-plans-tracker.md`。
- 文档约束：只能把文档放进 `docs/` 下已存在的子目录（spec / plans / bugfix 等），禁止在 `docs/` 根下直接新建目录。
- 文档命名：`[YYYY-MM-DD]-[DocType]-[Module]-[Version].md`（如 `2026-10-16-Design-Processing-Panel-v1.0.md`）。

## 3. 核心模块与文件映射

### 3.1 业务核心逻辑

- `parseEpub(data: ArrayBuffer)`（`src/services/epub.ts`）：epubjs 打开电子书，读取 metadata / TOC / 封面，TOC 递归展平为 `Chapter[]`。
- `getChapterContent(data, chapter)`（`src/services/epub.ts`）：按 href 加载单章纯文本。
- `parsePdf(data: ArrayBuffer)`（`src/services/pdf.ts`）：pdfjs `getDocument` + `getOutline`，目录展平为 `Chapter[]`；无目录则逐页生成 `第 N 页`。
- `getPageText(doc, page)`（`src/services/pdf.ts`）：取单页文本内容。
- `createProvider(kind, settings)` / `resolveProvider({kind, settings})`（`src/services/ai/provider.ts` / `index.ts`）：构造 `AIProvider.chat(messages, options)`，OpenAI 兼容与 Google Gemini 两种实现，均支持 `AbortSignal`。

### 3.2 数据模型（Data Models）

- `src/types/index.ts`：`BookFormat`、`ProcessingMode`、`Chapter`、`ChapterGroup`、`BookMeta`、`AdvancedOptions`、`SummaryResult`、`MindMapNode`、`MindMapResult`、`ProcessingProgress`。
- `src/types/settings.ts`：`providerSettingsSchema`（含 `kind: 'openai-compatible' | 'google'`）、`settingsSchema` → 导出 `ProviderSettings`、`Settings`。
- `src/stores/prompt-store.ts`：`CustomPrompt { id, name, description, content, createdAt }`。

### 3.3 UI 表现层

- `src/components/ui/*`：shadcn 风格基础件（Button 变体 default/secondary/outline/ghost/destructive）。
- `src/components/config/ConfigDialog.tsx`：AI 服务增删改选（props `{open, onOpenChange}`）。
- `src/components/upload/BookUploader.tsx`：文件选择 → 解析 → `setBook`/`setChapters`。
- `src/components/chapters/ChapterList.tsx`：章节勾选、全选/清空、Ctrl+G 分组对话框。
- `src/components/processing/ProcessingPanel.tsx`：处理模式 + 高级选项 + 进度。
- `src/components/results/ResultView.tsx`：文字总结与 mind-elixir 思维导图。
- `src/components/prompts/PromptManager.tsx`：自定义提示词列表与编辑器。

## 4. 自动化运维与 CLI 常用命令

> 默认终端 PowerShell —— 以下命令及所有 AI/MCP/技能执行命令均使用 PowerShell 语法。

### 4.1 构建与测试命令（PowerShell）

```powershell
# 1. 安装依赖
pnpm install

# 2. 开发服务器（Vite）
pnpm dev

# 3. 类型检查
pnpm typecheck

# 4. 代码检查
pnpm lint

# 5. 生产构建（tsc -b && vite build）
pnpm build

# 6. 预览构建产物
pnpm preview
```

### 4.2 调试命令（PowerShell）

```powershell
# 查看 pnpm 与 Node 版本
pnpm -v; node -v

# 查看已安装依赖
pnpm list --depth 0

# 只重装并校验 lockfile
pnpm install --frozen-lockfile

# 清理后重装
Remove-Item -Recurse -Force node_modules; Remove-Item -Force pnpm-lock.yaml; pnpm install
```

### 4.3 CLI 工具参数速查表

```text
pnpm dev              启动 Vite 开发服务器（HMR）
pnpm build            tsc -b 类型检查 + vite 生产构建
pnpm typecheck        仅类型检查（tsc -b --noEmit）
pnpm lint             ESLint 检查全仓库
pnpm preview          本地预览 dist/ 构建产物
pnpm install          按 pnpm-lock.yaml 安装依赖
```

## 5. 数据源与环境配置文件路由

| 数据 / 环境 | 相对路径 | 核心物理说明 |
| --- | --- | --- |
| 需求文档（唯一需求源） | `docs/spec/ai-read 需求.md` | 178 行，功能与技术栈的最终依据 |
| 优化需求文档 | `docs/spec/ai-read 优化需求.md` | 分任务/可校验/可流式提示词体系 + RAG 问答的增量需求 |
| 远端仓库 | `https://github.com/zaoweiruan/ai-read.git` | 账号 `zaoweiruan`，私有库；主分支 `main`；本机 443 直连不通，推送需带代理 `-c http.proxy=http://127.0.0.1:10808` |
| 静态文档主索引 | `docs/INDEX.md` | 所有文档的唯一分类入口 |
| 进度跟踪（动态） | `docs/plans/project-plans-tracker.md` | 唯一允许记录进度勾选的文件 |
| 用户 AI 服务配置 | localStorage `ai-read:settings` | zod 校验；含 apiKey —— **禁止写入任何文档或记忆** |
| 自定义提示词 | localStorage `ai-read:prompts` | prompt-store 持久化 |
| 需求规定的 AI 端点 | （用户自填，浏览器直连） | 无代理、无后端；OpenAI 兼容默认 `https://api.openai.com/v1`，Google 默认 `https://generativelanguage.googleapis.com/v1beta` |
| 构建环境记录 | `docs/` 下 `build-env-*.md` | 机位 / Node / pnpm 版本快照 |

## 6. AI 行为规范与核心研发路由表

### 6.1 文档先行与命名规范

- **强制**：任何代码变更前，先在 `docs/` 对应子目录创建或更新设计文档，命名为 `[YYYY-MM-DD]-[DocType]-[Module]-[Version].md`，然后在 `docs/INDEX.md` 登记其路径。
- 需求疑问一律回到 `docs/spec/ai-read 需求.md` 求证，不得凭空扩展需求。

### 6.2 智能路由跳转表（关键词定向约束）

> **强制前置检查**：扫描用户输入中的关键词；命中任一行时，先调用 `skill` 工具加载对应技能，再按其约束执行。

| 关键词 | 技能 / 方法论 | AI 行为约束 |
| --- | --- | --- |
| 头脑风暴 / 想法 / 该怎么做 / brainstorm | `brainstorming` / `ce-brainstorm` | 实现前必须先澄清意图与方案 |
| 实现功能 / 加功能 / 修改行为 / creating features | `brainstorming` | 创造性工作前先过需求澄清 |
| 调试 / 报错 / 修复 bug / debug / stack trace | `ce-debug` | 先定位根因再改代码，禁止盲改 |
| 出计划 / 拆解 / plan this | `ce-plan` | 先产出结构化计划再动手 |
| Git / 提交 / 分支 / 冲突 / commit | `git-master` / `ce-commit` | 遵守分支与提交安全红线，禁止擅自 force-push |
| 代码评审 / review | `ce-code-review` / 建议本地评审 | 只评审不擅自提交推送 |
| 思维导图渲染 / mind-elixir | mind-elixir 集成约定 | 仅在 `ResultView` 内实例化，节点数据来自 `MindMapResult` |
| EPUB / PDF 解析异常 | `src/services/epub.ts` / `src/services/epub` / `src/services/pdf.ts` | 先复现，再对照需求 4.3 章节提取逻辑 |
| AI 请求失败 / 401 / 跨域 | `src/services/ai/provider.ts` | 确认浏览器直连与 BYO-key，严禁引入代理后端 |
| 生成图片 / 画图 | `agnes-image-gen` | 加载技能后执行 |
| 生成视频 / 动画 | `agnes-video-gen` | 加载技能后执行 |
| 发布 / release / bump version / 推送 | `release-skills` | 按技能的版本与 changelog 流程 |
| 记忆 / 回忆 / 上下文长期记忆 | `caura-memory` | 按 6.3 节 Caura 规范读写 |
| UI 截图 / 界面测试 | （暂无 —— 本项目 UI 测试待建） | 先记录到 plans，不得虚构技能 |

### 6.3 跨会话记忆（Caura）使用规范

#### 6.3.1 读取时机（`caura_recall`）

复杂任务开始前**必须**先 `caura_recall`，检索关键词建议：`ai-read 需求`、`项目初始化`、`技术栈边界`、`stray token 教训`、`AGENTS.md`。

#### 6.3.2 写入时机（`caura_write`）

确认下来的决策、可复用命令、踩坑教训、用户偏好应当**主动持久化**，例如：技术栈选型决策、浏览器直连 BYO-key 约束、"写文件后必须复查杂散 token" 纪律、构建命令。

#### 6.3.3 安全红线（禁止写入内容）

- **严禁**将 apiKey / token / 密码 / 证书原文写入任何记忆或文档；泄露时以 `<REDACTED>` 占位。
- localStorage 中的 `ai-read:settings`（含用户真实 apiKey）永远只留在浏览器本地。

#### 6.3.4 工作流闭环

```text
检索(caura_recall) -> 执行(编码/命令) -> 复查(读回文件验证) -> 沉淀(caura_write)
```

### 6.4 本项目特有红线（ai-read）

1. **写后必查**：每次写入/编辑源码文件后，必须重新读取该文件，扫描代码位（标识符、关键字、属性、字符串）中的非 ASCII 杂散 token（历史已出现：`估值`/`年度`/`半岛`/`能吃`/`timing`/`的一致`/`都不要` 等中英文垃圾词），发现立即修复。
2. **无代理原则**：AI 请求全部由浏览器直连用户配置的 Provider 端点，不得引入任何服务端中转。
3. **同一套前端**：不得引入仅 Node 可用的 API，保证 Web 与桌面双端可用。
4. **依赖安装以 pnpm 为准**：新增依赖必须写入 `package.json` 并用 `pnpm install`，不得用 npm/yarn。
5. **提交红线**：禁止将 `.epub` / `.pdf` / 缓存产物（`node_modules` `dist` `*.tsbuildinfo` `log/` `*.cache`）/ 含 token、key、密码等密钥的文件提交入库；`.env*`、`*.pem`、`*.key`、`credentials*` 等一律进 `.gitignore`；提交前用 grep 扫描密钥特征（`sk-`、`Bearer`、`apiKey=...`）。
