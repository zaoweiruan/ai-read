# 2026-10-20 计划｜优化需求：分任务·可校验·可流式提示词体系（P0–P4）

> 源需求：`docs/spec/ai-read 优化需求.md` —— 5 大功能（全书概览 / 章节摘要 / 思维导图 / 引用问答 / 翻译·术语解释）+ 工程约束（分块、两层摘要、JSON schema、引用防幻觉、SSE 流式、缓存、Prompt 版本化）。
> 本文为实施方案；进度勾选只写入 `docs/plans/project-plans-tracker.md` 阶段 4。
> 红线前提（不可突破）：纯前端 SPA、无后端、浏览器直连 BYO-Key（严禁任何代理/中转）、技术栈锁定、依赖只用 pnpm、文档先行 + 写后必查。

## 1. 需求解析

| # | 功能 | 规格要点 | 优先级 |
| --- | --- | --- | --- |
| F1 | 全书概览 | 结构化导读：一句话核心（≤40字）/ 解决什么问题 / 核心论点（含**章节定位**）/ 关键概念表 / 阅读路径 / 常见误解 | P1 |
| F2 | 章节摘要 | 输出 JSON 卡片（core_question / thesis≤60字 / key_points 3–7 条带 location / terms / connections），可校验，解析失败重试 1 次 | P1 |
| F3 | 思维导图 | 纯 JSON、≤4 层、每层 ≤7 节点、label ≤18 汉字、论证结构优先；长书先逐章生成再合并 | P1 |
| F4 | 引用问答 | 检索增强 + `[片段ID]` 引用 + quote 精确匹配防幻觉 + 点击引用跳原文 + ≤300 字 + ≤3 个后续问题 | P3（最关键） |
| F5 | 翻译/术语解释 | 划词 → 4 段式：通俗解释≤80字 / 语境含义≤120字 / 原文依据 / 相关概念≤3 | P4 |

工程约束：E1 分块 800–1500 tokens（保留章节/位置元数据）；E2 两层摘要（块→章→书）；E3 JSON schema 校验 + 失败重试 1 次；E4 引用 quote 必须为原 chunk 子串；E5 SSE 流式（导读 + 问答）；E6 结果缓存（同书同模型同 prompt 版本）；E7 Prompt 版本化独立模板。

通用 System Prompt：直接采用规格原文（7 条规则），作为所有任务的统一 system 消息。

## 2. 冲突裁决（需求 vs 项目红线）

| 需求原文 | 冲突 | 裁决 |
| --- | --- | --- |
| “后端切分章节和语义块；每个块生成 embedding” | 无后端红线 | 浏览器端新建 `src/services/chunking.ts`，按标题+段落切块（约 800–1500 字≈tokens，中文按 ≈1.5 字/token 估算），元数据 `{id, chapterId, chapterTitle, seq, text, page?}`；检索 **v1 用本地词法检索**（BM25-lite + 中文 bigram 分词，零网络、零 CORS 风险），embedding 检索列为 **v2 可选项**（仅当 provider 支持 `/embeddings` 且 CORS 放行时启用，不满足则静默回退词法检索） |
| “SSE 流式输出” | `provider.chat` 目前一次性 `res.json()` | `provider.ts` 新增 `chatStream(messages, options, onChunk)`：openai-compatible 用 `stream:true` 解析 `text/event-stream`；google 用 `:streamGenerateContent?alt=sse`；**流式失败自动回退非流式**（部分中转会缓冲 SSE） |
| “缓存避免重复计费” | 无后端 | localStorage `ai-read:cache:*`，key = SHA-1(bookId + model + promptId@version + task + chapterId)，LRU 上限约 4MB，命中时 UI 标「缓存」徽标 |
| “JSON schema 约束 + 解析失败重试” | 无 SDK | 新建 `src/services/ai/chatJson.ts`：safeJson（自 ProcessingPanel 抽出为 `src/lib/safeJson.ts`）+ schema 校验函数 + 失败时带错误信息**重试 1 次** |

## 3. 现状差距（gap）

- Prompt 全部硬编码在 `ProcessingPanel.run()` 字符串里，无版本、无统一 system → 需要 `src/prompts/` 版本化模板模块。
- `SummaryResult` 纯文本（chapterSummaries: Record<string,string> + relations + bookSummary）→ 需要结构化导读 guide + `ChapterSummaryCard` 卡片。
- `book-mindmap` 每章正文截断 3000 字拼接一次生成 → 违反“先逐章再合并”，改为逐章导图 → `mindmap-merge` 模板合并。
- 无分块、无检索、无问答、无划词解释、无流式、无缓存、无引用跳转。
- 引用跳转依赖的 `highlightQuote`、逐章两层摘要的 `chunks` 均不存在。
- **前序遗留**：ConfigDialog「验证服务」按钮（连通 + CORS 通过才允许保存）尚未实现 → 纳入 P0。

## 4. 分期实施方案

### P0 基建与校验地基

1. ConfigDialog 验证服务（前序需求）：
   - 两步探测：`fetch(baseUrl, {method:'GET', mode:'no-cors', 8s timeout})` 判网络可达 → 最小真实 `chat` 请求（maxTokens=1）判 CORS/鉴权；
   - 草稿编辑 + 指纹比对：字段变化后需重新验证，**通过才允许保存**；结果区分 `网络不可达 / 端点不支持 CORS / 401 鉴权失败 / HTTP 错误 / 超时` 五类文案（401 放行但黄字警告）；
   - 不写入任何 apiKey 到日志/文档。
2. `src/lib/safeJson.ts` 从 ProcessingPanel 抽出；`src/services/ai/chatJson.ts` 实现 schema 校验 + 重试 1 次（E3 地基）。
3. `src/prompts/` 版本化模板：`system.ts`（通用 System Prompt 规格原文）+ `book-guide.v1.ts` / `chapter-summary.v1.ts` / `mindmap.v1.ts` / `mindmap-merge.v1.ts` / `qa.v1.ts` / `glossary.v1.ts`，统一导出 `{ id, version, temperature, system, buildUser(vars) }`；PromptManager 中内置模板只读展示 + 版本号，自定义提示词仍走 prompt-store。
4. `provider.ts` 增加 `chatStream`（E5 前置）。

验收：`pnpm typecheck` / `pnpm build` 绿；验证服务对 4 类端点表现正确（正常 CORS 端点通过 / 不支持 CORS 端点拦截保存 / 错误 key 报 401 警告 / 不可达地址报网络错误）。

### P1 结构化输出（F1 / F2 / F3）

1. 类型扩展（`src/types/index.ts`）：`ChapterSummaryCard`、`SummaryResult` 增加 `guide: string`、`cards: ChapterSummaryCard[]`。
2. summary 流程升级（ProcessingPanel）：逐章 `chapter-summary.v1` JSON → 卡片（>阈值章先按 E1/E2 块级两层）；章关系；`book-guide.v1` 生成结构化导读（含章节定位）→ `guide`。
3. 导图 prompt 强约束（mindmap.v1：纯 JSON / ≤4 层 / 每层 ≤7 / label ≤18 汉字 / 论证结构优先 / 不编造）+ 解析失败重试 1 次。
4. `book-mindmap` 改为：逐章导图 → `mindmap-merge.v1`（去重、归组、不新增原文没有的内容），废除 3000 字截断拼接。
5. UI：ResultView「文字总结」Tab 渲染导读 markdown（`#` 分区 + 关键概念表格），核心论点中章节名点击 → `setActiveChapterId` 跳章；BookContent 本章总结卡片升级为结构化卡片（thesis / key_points / terms 折叠展示）。

验收（test/一神论的影子 13 章）：卡片含 thesis/key_points/terms；导图层级 ≤4、每层 ≤7、label ≤18 字；导读含全部 6 个分区；重试路径可在 Console 观察到。

### P2 分块与缓存（E1 / E2 / E6）

1. `src/services/chunking.ts`：解析后按标题+段落生成 `BookChunk[]`，写入 book-store（内存，不持久化 ArrayBuffer 以外的体积）。
2. 超长章（估算 tokens > 阈值）：块摘要 → 合并章摘要（两层）；普通章单次直出。
3. `src/services/cache.ts`：SHA-1 key + LRU（约 4MB）；summary / guide / mindmap 命中即复用；ProcessingPanel 对命中项显示「缓存」徽标并跳过调用。

验收：同书同模型二次运行，DevTools 观察 AI fetch 次数显著下降（命中部分为 0）。

### P3 引用问答（F4，最关键）

1. `src/services/retrieval.ts`：BM25-lite（中文 bigram + 英文词元），top-k=6，产出带 `[chunk_n]` 的 contexts。
2. ResultView 新增「问答」Tab（现有 summary/mindmap 双 Tab 扩展为三 Tab）+ `src/components/results/QAPanel.tsx`：问题输入 → 检索 → `qa.v1` 模板（`<contexts>` 规则按规格原文）→ `chatJson<QAAnswer>` + `verifyCitations`（quote 必须能在对应原 chunk 中 `includes` 精确匹配，不匹配丢弃该引用并触发整体重试 1 次）。
3. 渲染：answer 正文（流式优先，回退非流式）、citations chips、follow_ups 点击即追问；材料不足时展示模型规范 JSON 的引导文案而非报错。
4. 引用跳转：chip → 解析 chapter/quote → `setActiveChapterId(chapterId)` + book-store 新增 `highlightQuote` → BookContent 滚动到含该 quote 的段落并高亮闪烁（3 秒后恢复）。

验收：点击 `[chunk]` chip 跳转原文并高亮；篡改 quote 的负向样例被 `verifyCitations` 拦截；不足材料问题返回规范引导。

### P4 流式体验 + 术语解释（F5 / E5）

1. 全书导读与问答答案接入 `chatStream` 增量渲染（失败静默回退非流式）。
2. BookContent 划词 → 浮动「解释」按钮 → `glossary.v1` → 右侧抽屉 4 段式展示（无依据时显示“材料中未提供直接依据”）。
3. 统一错误/暂停文案（含 Failed to fetch 中文诊断增强）；`pnpm typecheck` / `pnpm build` / 浏览器 E2E（一神论 + 批评与真实）+ 截图；tracker 勾选收尾。

## 5. 新增 / 修改文件清单

| 文件 | 动作 | 阶段 |
| --- | --- | --- |
| `src/components/config/ConfigDialog.tsx` | 修改：草稿编辑 + 验证服务 + 门禁保存 | P0 |
| `src/lib/safeJson.ts`、`src/services/ai/chatJson.ts` | 新增 | P0 |
| `src/prompts/*.ts`（system + 6 模板） | 新增 | P0 |
| `src/services/ai/provider.ts` | 修改：+`chatStream` | P0 |
| `src/types/index.ts` | 修改：ChapterSummaryCard / BookChunk / QAAnswer / GlossResult；SummaryResult 扩展 | P1 起 |
| `src/components/processing/ProcessingPanel.tsx` | 修改：模板接线、两层摘要、merge 导图、缓存 | P1/P2 |
| `src/components/results/ResultView.tsx` | 修改：导读 markdown、卡片、三 Tab | P1/P3 |
| `src/components/content/BookContent.tsx` | 修改：结构化卡片、引用高亮、划词解释 | P1/P3/P4 |
| `src/services/chunking.ts`、`retrieval.ts`、`cache.ts` | 新增 | P2/P3 |
| `src/stores/book-store.ts` | 修改：chunks / highlightQuote | P2/P3 |
| `src/components/results/QAPanel.tsx` | 新增 | P3 |

## 6. 风险与对策

- 长书两层摘要调用次数上升 → 缓存（E6）+ 只对超长章启用块级层。
- 中转层缓冲 SSE 导致流式无增量 → 自动回退非流式，功能不降级。
- localStorage 5MB 上限 → LRU 淘汰 + 只缓存文本结果。
- 模型 JSON 输出不稳 → chatJson 重试 1 次 + 失败降级为纯文本文案（卡片仍可渲染兜底）。
- bigram 词法检索召回一般 → 预留 v2 embedding 槽位（provider 支持且 CORS 放行才启用）。
- 每次改动后必须：读回文件扫非 ASCII 杂散 token → `pnpm typecheck` → `pnpm build` → 浏览器验证。

## 7. 总验收清单

- [ ] F1 导读 6 分区齐全、章节定位可点击跳转
- [ ] F2 章节 JSON 卡片渲染、失败重试 1 次可观察
- [ ] F3 导图满足 4 层 / 7 节点 / 18 字三约束，整书走 merge 路径
- [ ] F4 引用 chip 跳转高亮、quote 防幻觉校验、后续问题可追问
- [ ] F5 划词解释 4 段式输出
- [ ] E5 导读与问答可见流式增量（或回退后功能等价）
- [ ] E6 二次运行缓存命中、无重复计费调用
- [ ] E7 内置 prompt 均带版本号、模板独立文件
- [ ] P0 验证服务：不连通 / 不支持 CORS 的服务无法保存
- [ ] `pnpm typecheck` / `pnpm build` 全绿，文档登记齐全
