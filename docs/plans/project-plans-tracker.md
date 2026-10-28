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

## 阶段 5：思维导图交互（2026-10-21，设计 `plans/2026-10-21-Design-MindMap-Interaction-v1.0.md`）

- [x] 设计文档 + INDEX 登记（方案 A + 小地图视口框拖拽平移）
- [x] ResultView MindMapPanel：toolBar 关闭 + 6 图标工具条（手型/放大/缩小/适应/展开全部/折叠全部）
- [x] 手型开关（spacePressed + space-pressed 类）+ 常驻 grab 光标 CSS
- [x] 双击节点展开/折叠（dblclick 委托 → expandNode；根节点特例走 expandNodeAll 数据层）
- [x] 自研小地图：世界坐标反变换 + rAF 刷新 + 点击居中 + 拖拽视口框平移
- [x] 提示文案更新
- [x] 关键修复：`overflowHidden:false`（原 true 跳过整个 Mt 事件绑定 → 滚轮/拖拽全失效）+ 覆写 `move` 无界平移（原库边界钳制导致适配视图下无法挪动）+ bus 销毁后 removeListener 容错
- [x] 验收（2026-10-21 mock E2E，errors=[]）：滚轮 0.672→0.772、pan 链位移、手型类/光标、根与非根双击（expanded 翻转 + 子树 6→1）、折叠/展开全部、小地图拖拽位移、截图 mindmap-interaction-final

## 阶段 6：处理面板模式标签化（2026-10-21，设计 `plans/2026-10-21-Design-ProcessingPanel-ModeTabs-v1.0.md`）

- [x] 设计文档 + INDEX 登记
- [x] 模式改名（当前章节总结 / 当前章节思维导图 / 整书思维导图）
- [x] 右侧水平 tab 单选 + 点选即处理（`run(modeOverride)`）+ 移除「开始处理」按钮
- [x] 完成后滚到 `#app-result`；ResultView 结果 Tab 自愈（仅 summary 存在时切回）
- [x] 验收（2026-10-21 mock E2E）：三新标签/旧标签消失/无开始按钮/提示与徽标 ✓；点选直跑导读 ✓

## 阶段 7：结果窗右移与三 tab 共用（2026-10-21，设计 `plans/2026-10-21-Design-Result-RightDock-v1.0.md`）

- [x] 设计文档 + INDEX 登记
- [x] App 布局：右栏 360px、三列等高 560/640、处理面板 h-300/320 + 结果窗 flex-1 overflow（下方位置移除）
- [x] book-store `activeMode` 单一事实源（ProcessingPanel 本地 mode state 上提，reset 复位）
- [x] run() 不再清除旧产物：summary/mindMap 独立保留、成功时原子替换
- [x] ResultView 按 activeMode 切换 + 单产物兜底 + 空态文案（暂无总结/导图结果）
- [x] 验收（2026-10-21 mock E2E，errors=[]）：唯一 `#app-result` 位于右栏（left=889 > 0.55vw）；点「当前章节总结」→ 导读；点「整书思维导图」→ 同窗切导图；切回总结即时且两子 tab 并存；截图 result-right-dock

## 阶段 8：tab 消失缺陷修复（2026-10-21，诊断 `bugfix/2026-10-21-Bugfix-ProcessingPanel-Tab-Disappear-v1.0.md`）

- [x] 定位：Vite 日志实证 `page reload docs/INDEX.md` / `tracker.md`（用户报告前 3 分钟）→ 整页 reload 清空内存态致工作台与 tab 卸载
- [x] 修复 1：vite `server.watch.ignored` 忽略 `docs/**`、`log/**`、`.git/**`（探针验证无 reload）
- [x] 修复 2：AI 请求 60 秒看门狗（`withTimeout` + TimeoutError → 中文提示，finally 恢复 running）
- [x] 修复 3：移除完成后 `scrollIntoView('#app-result')`（右栏停靠无需页面滚动）
- [x] 验收：正常链路（无滚动、tab 可用、errs=[]）/ 挂起链路（60s 超时文案 + tab 恢复）/ 再入链路（超时后重跑成功）

## 阶段 9：模式 tab 四层加固（2026-10-21，设计 `plans/2026-10-21-Design-Tab-Persistence-Hardening-v1.0.md`）

- [x] L1 常驻工作台：App 去掉 `chapters.length > 0` 条件，三栏恒渲染（无书也有 tab）
- [x] L2 持久化：book-store 接入 zustand `persist`（`ai-read:book`），存章节/选中/分组/结果/模式，排除 `bookData`；localStorage 读写容错
- [x] L3 防塌陷：处理面板子项全部 `shrink-0`，面板 `overflow-y-auto` 内部滚动；右栏面板高 320/360
- [x] L4 空态引导：BookContent 区分「无书 / 有书无文件」文案；ChapterList 空列表提示
- [x] 验收（2026-10-21 浏览器 E2E）：无书时三 tab 可见（h=44px）+ 空态文案；上传→处理→刷新后 13 章与导读恢复、tab 全部可用、结果窗仍在右栏（x=889）、正文区提示重新上传；tablist `flex-shrink:0`、高 45px；截图 tabs-persistence-hardening

## 阶段 10：思维导图居中 + 小地图拖拽修正（2026-10-22，设计 `plans/2026-10-22-Design-MindMap-Center-MiniDrag-v1.0.md`）

- [x] 工具条新增「居中」按钮（`inst.toCenter()`：根节点居中且不改缩放）
- [x] 小地图视口框按**真实可见区**计算（构造器宿主元素，修复 mind-elixir 覆盖 `position: relative` 导致的 2758px 撑高）
- [x] 小地图 viewBox 只按节点包围盒计算（消除平移时的「呼吸」缩放）
- [x] 视口框内按下不跳位、跟手拖拽；框外按下定位；`MutationObserver` 兜底刷新
- [x] 导图来源徽标（整书 / 章节）：book-store `mindMapScope` + 面板左上角 Badge
- [x] 验收（2026-10-22 mock E2E）：视口框可见尺寸 343×447px ✓；拖拽世界位移 (247,154) 与期望完全一致 ✓、按下不跳位 ✓、缩放稳定 ✓；居中按钮位移生效且 scale 不变 ✓；整书徽标 = 整书 ✓；截图 mindmap-center-minimap、mindmap-minimap-final

## 阶段 11：右栏重排（2026-10-22，设计 `plans/2026-10-22-Design-RightColumn-Layout-v1.0.md`）

- [x] ResultView 内嵌 ProcessingPanel，紧贴模式 tab 下方（App 右栏只保留面板，移除独立结果容器）
- [x] 原「服务 / 高级选项」降级为底部可折叠配置组（默认折叠，折叠头显示当前服务名）
- [x] 进度 / 暂停 / 错误行上移至 tab 正下方；面板外层 `overflow-hidden`，仅结果窗内部滚动
- [x] 验收（2026-10-22 浏览器 E2E）：tablist y=471 → 结果窗 y=572（在其下方）、x=909 右栏内；配置组默认折叠（服务/子章节深度不可见）→ 展开可见 → 再折叠隐藏；跑「当前章节总结」后导读渲染于 `#app-result` 内（resultTop 572 ≥ tablistBottom 516）且配置组保持折叠；截图 right-column-result-dock

## 阶段 12：结果窗口全屏按钮（2026-10-22，设计 `plans/2026-10-22-Design-Result-Fullscreen-v1.0.md`）

- [x] 结果窗顶部 sticky 条 + 「全屏 / 退出全屏」按钮（图标随状态切换）
- [x] 原生 Fullscreen API 优先，不可用/被拒时回退 CSS 覆盖层（`is-expanded`）；Esc 退出
- [x] 同一 DOM 节点切换 → 思维导图实例不重建、结果不丢失
- [x] `index.css`：全屏态铺满视口 + 导图高度 `calc(100vh - 170px)`
- [x] 验收（2026-10-22 浏览器 E2E）：点击后容器成为 `document.fullscreenElement`（1280×720 = 视口）、按钮文案切为「退出全屏」、导读内容保留；再次点击恢复原位（319×407）且内容仍在；截图 result-fullscreen
- [x] 修正：全屏背景变量写错（`--background` 未定义 → 元素透明 → 透出 Chromium 黑色 backdrop）；改用 `--color-background` / `--color-foreground` 并给 `::backdrop` 着色，实测全屏背景 `oklch(1 0 0)`、文字 `oklch(0.145 0 0)`；截图 result-fullscreen-fixed-bg

## 阶段 13：阅读器图片 + 不自动全选 + 当前章节模式（2026-10-22，设计 `plans/2026-10-22-Design-Reader-Images-CurrentChapter-v1.0.md`）

- [x] `ContentBlock` 内容模型（文本块 + 图片块）；`epub.ts` 块提取识别 `img`（含 `<p>` 内嵌图片）与相对路径资源解析（`book.resolve` + `archive.createUrl`）
- [x] `BookContent` 按块渲染：文本段落 + `<figure><img loading="lazy">`；修复块缓存跨重新上传未失效
- [x] 打开书籍不再自动全选章节（徽标 `0 / N`）
- [x] 模式 → 处理目标：当前章节总结 / 当前章节思维导图 = 内容窗口当前章节；整书思维导图 = 勾选章节（未勾选按全书）；单章不生成章节关系、导读标题为「本章导读」
- [x] 关键修复：XHTML 以 XML 解析（默认命名空间）→ `querySelector('img')` 命名空间敏感永远失配 → 改为 tagName 遍历
- [x] 验收（2026-10-22 浏览器 E2E）：批评与真实 版权页图片 naturalWidth 543×85 ✓；一神论的影子 第 8 章图片滚入视口后 complete=true / 28×31 ✓；徽标 `0 / 13` ✓；提示「当前章节：第五封信 文化的边界」✓；本章导读 ✓、章节关系已隐藏 ✓

## 阶段 14：阅读区全屏 + 页/章导航（2026-10-22，设计 `plans/2026-10-22-Design-Reader-Navigation-Fullscreen-v1.0.md`）

- [x] 阅读区工具条新增导航行：上一章 / 下一章 / 上一页 / 页码指示 / 下一页 / 全屏
- [x] 章导航沿用 `activeChapterId`；页导航为 PDF 逐页阅读（游标 `pdfPage` + 章节联动），EPUB 显示「EPUB 无分页」且按钮禁用
- [x] 阅读区全屏：原生 Fullscreen API 优先 + CSS 回退，Esc 退出，同一 DOM（导图/滚动不丢）
- [x] 附带修复：PDF 正文窗口全空（pdfjs detach 原始 ArrayBuffer → 后续 slice 抛错）→ 改为始终传副本
- [x] 验收（2026-10-22 浏览器 E2E）：EPUB 上一章禁用/下一章切章（扉页→目录）✓；页按钮 EPUB 禁用 ✓；阅读区全屏 1280×720 且退出后正文仍在 ✓；PDF 样本：第 1/2 页 ⇄ 第 2/2 页、正文与页码同步、末页下一页禁用、detached 报错消失 ✓
- [x] 工具条精简：移除「总结」「大纲」开关及本章总结卡片、章节列折叠侧栏（章节列常驻）；全屏按钮移至「重置」右侧；重置补逆时针箭头图标
- [x] 修正阅读区全屏背景（`--background` 未定义 → 透出 Chromium 黑色 backdrop）：改用 `--color-background`/`--color-foreground` + `::backdrop` 着色，实测全屏工具条区 `oklch(1 0 0)`；截图 reader-fullscreen-fixed-bg

## 阶段 15：阅读区连续滚动（2026-10-22，设计 `plans/2026-10-22-Design-Reader-Continuous-Scroll-v1.0.md`）

- [x] 阅读区滚动到底自动进入下一章（新章从顶部开始）；短章节可用滚轮继续
- [x] 导航行「连续滚动」开关（默认开启，关闭后不跳章）
- [x] 防回环：静默窗口 + 程序化滚动标记（切章/内容重排引发的滚动不触发跳章）
- [x] 底层修复：四个 zustand store 改为 `globalThis` 单例（修 HMR 多实例）；Vite `server.headers` 加 `Cache-Control: no-store`（修模块缓存陈旧）
- [x] 验收（2026-10-22 浏览器 E2E）：滚到底 → 第二封信（scrollTop=0）✓；滚轮到底 → 第三封信 ✓；关闭开关后滚到底不跳章 ✓；末章不越界 ✓
- [x] 向上自动跳章（用户要求保留）：取消「跳上一章后自动定位底部」的程序化滚动（它被误判为用户下滚导致弹回），向上跳章从上一章顶部开始；程序化标记窗口收紧为切章 2.5s / 内容就绪 0.8s
- [x] 双向验收（2026-10-22）：滚轮上 第二封信⇒第一封信 ✓、滚轮下 ✓、滚动事件上/下 ✓、关闭「连续滚动」后滚到底不跳章 ✓
- [x] 向上切章定位到上一章末尾（连续向上阅读）：程序化定位底部的滚动用标记整体屏蔽（切章 2.5s / 内容就绪 0.8s / 定位 2s），不再被误判为用户下滚；实测 第二封信⇒第一封信 定位末尾（scrollTop 13213/13619）✓、继续向上⇒前言 同样定位末尾 ✓、无回弹 ✓

## 阶段 16：Markdown 文档支持（2026-10-22，设计 `plans/2026-10-22-Design-Markdown-Support-v1.0.md`）

- [x] `BookFormat` 增加 `markdown`；`ContentBlock` 增加 `{ kind: 'markdown'; text }`
- [x] `src/services/markdown.ts`：front matter（title/author）解析 + 按 H1/H2 切章 + 无标题整篇单章；章节保存 Markdown 原文
- [x] `src/lib/markdown.tsx` 新增 `renderMarkdown`：标题 / 围栏代码块 / GFM 表格 / 引用 / 有序无序列表 / 分隔线 / 段落 + 行内（粗体、斜体、代码、删除线、链接、图片、自动链接）
- [x] 接入：上传（accept `.md/.markdown` + 解析分发 + 文案）、阅读区 markdown 块渲染、AI 取材（`buildContent` 返回章节原文）
- [x] 验收（2026-10-22 浏览器 E2E，样本 `test/sample.md`）：章节列 4 节（H1+3×H2）✓；第一章 列表 2/条目 6/链接 1/删除线 1 ✓；第二章 代码块 1/表格 1/引用 1/分隔线 1/行内代码 1 ✓；短章节滚轮续读 第一章⇒第二章 ✓；「当前章节总结」以 Markdown 正文生成导读、无报错 ✓

## 阶段 17：恢复章节列折叠 + 移除封面框（2026-10-22，设计 `plans/2026-10-22-Design-Outline-Restore-Cover-Remove-v1.0.md`）

- [x] `reader-store` 恢复 `outlineVisible` / `setOutlineVisible`（持久化）
- [x] `ChapterList` 恢复「«」折叠按钮；`App` 恢复两态 grid 与 40px「章节」导轨（点击再展开）
- [x] `BookUploader` 移除封面图片框（解析与字段保留，不展示）
- [x] 验收（2026-10-22 浏览器 E2E）：折叠按钮存在 ✓ → 折叠后 grid 变为 40px 且导轨可见 ✓ → 点击导轨恢复三栏、章节列可见 ✓；页面封面图数量 0 ✓

## 阶段 18：图标缩放 · AI 面板折叠 · 双页并列 · 换页方式（2026-10-22，设计 `plans/2026-10-22-Design-Reader-PageModes-v1.0.md`）

- [x] `ReaderImage`：自然宽度 ≤200px 的小图标按 `min(自然宽, 1.5em)` 收敛（「注」记号不再过大），插图保持原尺寸
- [x] `reader-store` 增加 `processingVisible` / `twoPage` / `pageMode`（均持久化）
- [x] AI 处理面板折叠按钮（面板头右侧）→ 右栏收为 40px「处理」导轨，点击恢复 360px 面板
- [x] 「双页」按钮：PDF 当前页 + 下一页并列（两栏网格）；EPUB / Markdown 正文 `columns-2` 双栏
- [x] 双页改为**连续页对**（1-2、3-4…）：翻页与滚轮按 2 页步进，指示器显示「第 N-M 页」，末对后禁用；样本 `test/nav-4p.pdf` 实测 第 1-2 页 → 第 3-4 页 → 回退 第 1-2 页 ✓
- [x] 按用户最新要求再调整为「**连续内容分两栏**」：同一页/同一屏内容左右两栏连续排版（左栏→右栏→下一屏），不再左右各放一页不同内容；翻页回到原页序（PDF 每次一页、EPUB 按屏）；实测 PDF 第 2/4 页 columnCount=2 ✓、EPUB columnCount=2 / 26 段 ✓
- [x] 修复「切换+双页看不到剩余内容」：改为**书页式横向分页**（栏高=视口高、内容向右溢出、每屏推进一个跨页，translateX 位移）；实测 columnCount=2、高 383=视口高、scrollWidth 17032、翻页 translateX(-449)=一跨页、提示 1/38 → 2/38 跨页 ✓；文案区分「跨页 / 屏」
- [x] 优化靠近窗口边缘的行显示：栏高改为**行高整数倍**（`floor((视口高-内边距)/行高) × 行高`），上下边缘整行起排不再切半行；实测 342px = 10 × 34.2px（18px 字号 × 1.9 行距）✓；截图 reader-spread-edge-aligned
- [x] 阅读区工具条合并为**单行**（排版 + 导航 + 双页 + 换页方式 + 连续滚动 同处一行），并按宽度自适应：1200px → 1 行、900px → 2 行、600px → 2 行、449px → 3 行；按钮紧凑化（高 1.75rem / 字号 0.75rem），控件总宽 1100px → 793px；截图 reader-toolbar-merged-row
- [x] 换页方式「连续 / 切换」：切换模式按视口高度分屏（translateY 位移 + overflow-hidden），滚轮/按钮逐屏翻，末屏进下一章、首屏回上一章（定位末屏）；PDF 在切换模式下按**页**翻
- [x] 切换模式补充常驻提示「第 N / M 屏 · 向下滚动或点「下一页」继续查看本章后续内容」（实测 1/37 屏 → 滚轮 2/37 → 下一页 3/37）
- [x] 验收（2026-10-22 浏览器 E2E）：小图标 styleWidth=min(20px,1.5em) 渲染 20px（不放大、且 ≤1.5em）✓；双页：PDF 两栏并排且内容为第 1/2 页 ✓、EPUB columnCount=2 ✓；切换：EPUB 第 1/1 屏 → 滚轮 → 第 1/2 屏 ✓、切回连续恢复「EPUB 无分页」✓；AI 面板折叠 → 导轨出现、grid 40px ✓ → 恢复 ✓

## 阶段 19：打开即显示正文 + 阅读进度恢复（2026-10-23，设计 `plans/2026-10-23-Design-Reader-OpenResume-v1.0.md`，计划 `plans/2026-10-23-Plan-Reader-OpenResume-v1.0.md`）

- [x] U1 修复当前章解析：`localChapterId` 换书即清 + fallback `chapters[0]`（消除占位；idle 文案改为「未解析出可阅读的章节。」）
- [x] U2 `reading-position-store`（`ai-read:reading-pos`，LRU 20，`bookKeyOf`，`globalThis` 单例 + safeStorage + 记录归一化校验）+ `BookMeta.size` + `ReadingRestore` 类型
- [x] U3 保存接线：连续 scrollRatio 节流 500ms + 切章/分页/PDF 页码即刻 + `beforeunload`/卸载冲刷（`BookContent` `flushPendingSave`/`schedulePositionSave`）
- [x] U4 恢复流程：`BookUploader` 解析后 `getPosition` 匹配 → `setPendingRestore` + `requestChapter`；`BookContent` ready 后 rAF 一次性消费（连续 `scrollTop`+程序化标记 / 分页 `setPageIndex(clamp)` / PDF `goToPage(clamp)`），滚顶 effect 存在 pending 时跳过；`pendingRestore` 存 book-store（不持久化、reset 清空）
- [x] U5 验收：`pnpm typecheck` / `pnpm lint` / `pnpm build` 全绿（lint 原缺 ESLint 依赖 → 补装 `eslint`+`typescript-eslint`+`eslint-plugin-react-hooks` 并新增 `eslint.config.js`；关闭 `set-state-in-effect` 新规则以适配既有 effect 模式；0 errors / 3 条既有 exhaustive-deps 警告）；写后必查杂散 token 扫描通过；设计 §7 清单 1–6 待浏览器人工验收

## 阶段 20：PDF 视口接续流 · 修复下部空白（2026-10-26，设计 `plans/2026-10-26-Design-Reader-Pdf-Continuation-v1.0.md`）

- [x] 设计文档入库并登记 `docs/INDEX.md`；定位根因：`getPageText` 一页只产出一个字符串 → 一页文字不足一屏时 `flex-1` 容器下部即纯背景空白（双页 `columns-2` 使高度再减半）
- [x] 新增 `src/components/content/use-pdf-stream.ts`：锚点页 `anchor` + 装载末页 `end` + 按页文本缓存；`grow()` 追加一页、`rearm()` 重置追加计数（上限 12 页/锚点）、`reachedEnd` 终止判断、单页提取失败按空页跳过
- [x] `BookContent` PDF 分支改由 hook 渲染，块上打 `data-pdf-page`；`readingPage` 与装载锚点解耦（视口首个可见块推导），工具栏页码与右上徽标同源
- [x] 追加闭环：`measure()` 内容高 < 目标（连续 `视口×1.5` / 切换 `(屏+2)×行栅格`、双页比 `scrollWidth`）→ `grow()` → 内容变化再度量；连续滚动接近底部先追加，只要未到 `totalPages` 就不跳章
- [x] 章节归属按页区间推导（outline 无 `endPage` 时取下一章 `startPage-1`），同步 `activeChapterId` 时置 `streamSyncRef` 抑制「重设锚点」与「滚回顶部」两个副作用；`goToPage` 同步 `localChapterId` 避免显示回退
- [x] 翻页/导航：上一页·下一页 = `readingPage ± 1` 重置锚点并回顶；流顶部向上滚动改为 `readingPage - 1`（修掉误触发「上一章」导致徽标与页码不同步）
- [x] 验收（2026-10-26 浏览器 E2E，样本 `fill-24p.pdf` 24 页 × 3 行/页、`nav-4p.pdf`）：打开即装载 1..9 页、内容高 745px ≥ 1.5 × 415px 视口（无空白）✓；下滚逐次追加 1 页且页码 3 → 6 → 7 跟随视口、章节同步不回顶 ✓；读到 24/24 显示「已到最后一页」✓；双页 `columnCount=2`、gap 32px、块 12/12 分栏 ✓；切换栏高 376.2px=行栅格、translateX/translateY 正常、滚轮 3 → 4 页 ✓；上一页/下一页 1 → 2 → 3 且徽标与页码一致 ✓；重开同文件恢复至第 9 页（首块 `data-pdf-page=9`、装载 9..17）✓
- [x] `pnpm typecheck` / `pnpm lint`（0 error）/ `pnpm build` 全绿；写后必查杂散 token 扫描通过
- [x] **v1.1 补丁**（用户反馈「双页模式下翻页不应该有上页内容」）：定位为 `columns-2` 平衡双栏导致页边界非线性、锚点 +2 仍落回旧页；PDF + 双页 + 连续改为**页面对网格**（`grid grid-cols-2`，第 N 行 = 页 N｜页 N+1），追加不触发重排；双页切换保留 `columns-2` + 横向 `translateX`
- [x] v1.1 配套：`pdfStep = isPdf && twoPage && !paged ? 2 : 1`；双页连续装载需成对（`blocks.length % 2 === 1` 继续 `grow()`）；页码显示 `第 N-(N+1) / T 页`
- [x] v1.1 验收（样本 `dense-30p.pdf` 30 页 × 12 行）：双页连续 `1-2 → 3-4 → 5-6 → 7-8 → 9-10 → 11-12` 无重复、反向一致；连续滚动 `scrollTop` 0 → 1400 可见页 `5,6 → 7,8` 且页码同步；双页切换 `5 → 6 → 7 → 8`；单页 `8 → 9 → 10` 无回归；`typecheck` 通过、`lint` 0 error / 4 条既有 warning
- [x] **v1.2 补丁**（用户再次反馈「翻页后，还是有前页面内容」）：定位为双页 + **切换** 仍走 `columns-2`，追加下一页触发平衡分栏整篇重排，而 PDF 的 `translateX` 恒为 0（锚点重置后 `pageIndex=0`），于是屏上残留上一页文字（实测 `scrollWidth` 1111 → 2253、`translateX(0px)`）
- [x] v1.2 实现：PDF 分支 `twoPage ? 'grid grid-cols-2 gap-8' : undefined`，删除 PDF 的 paged 位移块与按栏宽预取分支；PDF 切换模式容器改 `overflow-y-auto`（网格行不被 `overflow-hidden` 裁切）；`pdfStep = isPdf && twoPage ? 2 : 1`（连续/切换统一跨页步进）；`handleScroll` 与 `syncReadingPage` 统一按纵向判定（删除横向分支）；两个 readingPage 同步 effect 合并；页码区间仅在下一页已装载（`readingPage + 1 <= loadedEnd`）时显示 `N-(N+1)`，且不再限定 `!paged`
- [x] v1.2 验收（样本 `long-20p.pdf` 20 页 × 18 行，浏览器 5173）：双页切换 `13-14 → 15-16 → 17-18`、双页连续 `7-8 → 9-10`、单页连续 `18 → 19`、单页切换 `17 → 18`，四种组合翻页后 `scrollTop=0` 且 `inView` 不含旧页；双页连续滚到底显示 `19-20 / 20` 与「已到最后一页」；`typecheck` 通过、`lint` 0 error / 3 条既有 warning
- [x] **v1.3 补丁**（用户反馈「这次变更改变了切换的意义，变成了类似连续翻页？」）：用户定案「双页 + 切换 = 当页文字分左右两栏」；恢复 PDF 切换模式为**整屏切换**：容器 `overflow-hidden`，PDF 双页 `columns-2 gap-8` + `height: viewportH` + `translateX(-pageIndex*spreadW)`，单页 `translateY(-pageIndex*viewportH)`；`syncReadingPage` 在切换模式下直接返回（页码取流起始页）；`setSpreadW` PDF 切换+双页按 `clientWidth`
- [x] v1.3 实现：measure 预取分支（切换+双页按列宽 / 切换单页按屏高 / 连续按 1.5 屏 / 成对装载仅连续）；`nextScreen`/`prevScreen` 为 PDF 在末屏时 `grow()` + `pendingNextScreenRef` 推进一屏、真末尾进下一章、回退到上一页开头；工具栏上一页/下一页与 `handleWheel` 切换模式一律走 `prevScreen()`/`nextScreen()`（含 PDF）；底部提示扩展到 PDF 切换模式
- [x] v1.3 验收（样本 `long-20p.pdf`，5173）：双页切换 `transform 0 → -539 → -1078` 无残留上页文字，上下翻页一致；单页切换 `translateY(0) → translateY(-307.8)`；连续双页 `grid grid-cols-2`、`overflow: auto` 不回归；`typecheck` 通过、`lint` 0 error / 3 条既有 warning、`build` 通过

## 阶段 21：修复 刷新后目录有内容、正文与处理均无内容（2026-10-27，bugfix `bugfix/2026-10-27-Bugfix-Book-Data-Resident-v1.0.md`）

- [x] 复现与定位：用户刷新页面后左侧目录树 165 章正常、徽章 7/165，但正文「该页没有可提取的文本」、处理面板「电子书数据未驻留」、页码「第 9 / ? 页」；根因是 `book-store.ts` 的 persist `partialize` 不含 `bookData`（JSONStorage 无法序列化 ArrayBuffer），刷新后恢复 book/chapters 但二进制缺失，`use-pdf-stream` 在 `data=null` 时静默空态
- [x] 修复：`book-store.ts` persist 新增 `merge`——持久化数据含 `book` 即判定陈旧（bookData 永远不持久化），返回干净默认态并 `safeStorage.removeItem('ai-read:book')` 清除陈旧 blob；`BookContent.tsx` PDF 空态补 `!bookData` 一档，文案与非 PDF 分支一致（「书籍文件未驻留（刷新后不保留），请在顶部重新上传以继续阅读与处理。」）
- [x] 验收：`typecheck` 通过；`lint` 0 error / 3 条既有 exhaustive-deps warning；`build` 通过
- [x] E2E（浏览器 5173，标签页 `tab_76dff399-06cc-4c0b-af82-d4804e8f108e`）：种入陈旧 `ai-read:book` blob（379 B）→ 刷新 → `ai-read:book` = null、章节选择「0 / 0 · 尚未加载书籍章节。」、正文「请在顶部上传 EPUB 或 PDF 以开始阅读。」；重新上传 `long-20p.pdf` → `[data-pdf-page]` 块装载页 1-3、首块文本正常、工具条「第 1 / 20 页」，无「该页没有可提取的文本」「电子书数据未驻留」提示

## 阶段 22：最近打开文件（2026-10-27，设计 `plans/2026-10-27-Design-Recent-Files-v1.0.md`）

- [x] 需求澄清（question 工具定案）：点击记录 = 唤起文件选择器重新选择同一文件（沿用 文件名:大小 匹配恢复阅读位置）；记录数量默认 10、范围 1–50
- [x] 设计文档入库并登记 `docs/INDEX.md`
- [x] `src/lib/recent-limit.ts`：DEFAULT_RECENT_LIMIT=10 / MAX_RECENT_LIMIT=50 / clampRecentLimit（中立模块，避免 settings-store 与 recent-files-store 循环依赖）
- [x] `src/stores/recent-files-store.ts`（`ai-read:recent-files`，globalThis 单例 + safeStorage + 记录归一化校验）：addRecent 去重置顶（键 文件名:大小）+ 按 settings 的 limit 裁剪、removeRecent / clearRecent / trimTo
- [x] settings-store 增加 `recentFilesLimit` / `setRecentFilesLimit`（默认 10，clamp 1–50）；`types/settings.ts` settingsSchema 同步
- [x] ConfigDialog 新增「最近打开文件」配置组：数字输入（1–50 越界不写入、草稿回显 store 值）+「清空记录」
- [x] BookUploader：「选择文件」右侧新增「最近打开文件 / 收起最近文件」切换按钮；列表区含计数 `N/limit 条`、清空、单条（书名 + 格式·大小·时间·原始名）与「打开 / 移除」、空态与提示文案；解析成功后 addRecent
- [x] 验收：`pnpm typecheck` / `pnpm build` 通过；写后必查杂散 token 扫描通过（recent-files-store / BookUploader / ConfigDialog）；浏览器 E2E 待人工验收

## 阶段 23：最近打开文件 v1.1 —「打开」直接重开文件（2026-10-27，设计 `plans/2026-10-27-Design-Recent-Files-v1.1.md`）

- [x] 用户反馈（原话）：「点击文件旁『打开』按钮时应该打开文件，不是打开对话框」——v1.0 的「打开」实现为触发隐藏 file input 弹系统选择器，不符合预期
- [x] 浏览器安全边界定案：无法凭路径直读本地文件；`showOpenFilePicker` 仅 Chromium 且需持续授权，与「同一套前端双端可用」边界冲突，不采纳为主路径；**点击事件获得的 File 对象在会话内可持有** → 会话级缓存为无后端最优解
- [x] 新建 `src/lib/recent-file-cache.ts`：模块级 Map（键 `文件名:size`）`cacheRecentFile`（LRU 上限 MAX_RECENT_LIMIT=50）/ `getCachedFile`（命中刷新 recency）/ `dropCachedFile` / `clearCachedFiles`；**不持久化**（File 不可序列化）
- [x] `recent-files-store.ts`：`recentKeyOf` 增加 export；`removeRecent` 先 `dropCachedFile(key)` 再过滤；`clearRecent` 先 `clearCachedFiles()` 再清空
- [x] `BookUploader.tsx`：`handleFile` 在 addRecent 之后 `cacheRecentFile(recentKeyOf(file.name,file.size), file)`（仅解析成功才缓存）；「打开」按钮改为 `getCachedFile` 命中 → `void handleFile(cached)` 直接重开（复用解析 + 阅读位置恢复全流水线），未命中 → `inputRef.current?.click()` 回退选择器；底部提示改为「同一标签页内点击『打开』会直接重新打开该文件；刷新或重启浏览器后，需重新选择同一文件，将自动恢复上次阅读位置。」
- [x] 设计文档 v1.1 入库并登记 `docs/INDEX.md`（§6 变更清单 / §8 backlog：File System Access API 后续增强）
- [x] 验收：`pnpm typecheck` 0 error；`pnpm lint` 0 error / 3 条既有 warning；`pnpm build` 通过（✓ built in 4.91s，仅既有 chunk >500kB 提示）；写后必查全量重读 recent-file-cache.ts / recent-files-store.ts / BookUploader.tsx，代码位无杂散 token
- [x] Agent E2E 自测（playwright + 间谍计数 `HTMLInputElement.prototype.click`，localStorage 持久化命中 'ai-read:recent-files'）：①上传 `test/nav-4p.pdf` → 展开最近列表 → 点「打开」：`__inputClicks` = 0，**未唤起系统选择器，直接重开**（4 页内容即恢复）✓；②刷新页面（会话缓存清空、localStorage 保留记录）→ 点「打开」：`__inputClicks` = 1，按设计回退系统选择器 ✓。结论：用户反馈的「还是打开对话框」为跨会话（刷新/新标签页/旧页面）场景，属浏览器安全硬约束；同会话路径已验证可用
- [x] 用户定案（2026-10-28，question 工具答复）：浏览器为 Chrome/Edge；File System Access API 跨会话直开增强**不实施，保持 v1.1 现状**（v1.1 §8 backlog 保留为后续可选项）
## 阶段 24：最近打开文件 v1.2 —— 点击文件名直接打开（2026-10-28，设计 \plans/2026-10-28-Design-Recent-Files-v1.2.md\）

- [x] 用户需求（原话）：「优化，可以通过点击文件名直接打开」
- [x] 设计文档 v1.2 入库并登记 \docs/INDEX.md\（提取 \openRecord(r)\ 辅助函数；主行由 \<p>\ 改为可点击 \<button>\；点击文件名与「打开」按钮共用同一逻辑；跨会话仍回退选择器）
- [x] \BookUploader.tsx\ 5 处编辑：import \RecentFileRecord\ 类型；新增 \openRecord(r)\；「打开」按钮 onClick 改为 \openRecord(r)\；主行改为可点击按钮（\cursor-pointer hover:underline\，disabled=busy）；底部提示文案同步更新
- [x] 写后必查：重读 BookUploader.tsx 行 160-234，代码位无杂散 token（仅注释/UI 文案含中文）
- [x] 顺手修复既有 lint 错误：\BookMeta.id\ 的 \Math.random().toString(36).slice(2,10)\ 触发 React 19 \eact-hooks/purity\ 规则，改为 \crypto.randomUUID().slice(0, 8)\
- [x] 验收：\pnpm typecheck\ 0 error；\pnpm lint\ 0 error / 3 条既有 warning；\pnpm build\ 通过（✓ built in 4.59s）
- [ ] 待用户确认的新 bug（2026-10-28）：「保存的文件名有问题，应该是扩展名前所有字符，不是第一个'.'前字符串」——已 OCR 用户截图（\log/c5c85780-...png\），最近列表显示条目「马克思入门」（EPUB 212.7KB）；src 全仓库 grep 未发现 first-dot 截断逻辑（markdown fallbackTitle 与 BookUploader 行 78 均用 anchored \/\.(md|markdown)\$/i\；epub/pdf 标题来自 metadata）。需用户指明「保存的文件名」所在界面/操作以定位
## 阶段 25：最近打开文件 v1.3 —— File System Access API 直开 + 文件名完整显示（2026-10-28，设计 `plans/2026-10-28-Design-Recent-Files-v1.3.md`）

- [x] 用户定案：「1.选 A」实施 File System Access API（Chromium 无对话框直开、非 Chromium 回退）；「2.目前显示的文件名不是完整名称」确认显示名不完整
- [x] 设计文档 v1.3 入库并登记 `docs/INDEX.md`
- [x] 新增 `src/lib/file-handle-store.ts`：IndexedDB 封装（put/get/delete/clear）+ `isFsaaSupported()`
- [x] `recent-files-store.ts`：removeRecent/clearRecent 联动删除 IndexedDB handle
- [x] `BookUploader.tsx`：`pickFileWithFsaa()`（showOpenFilePicker）；`openRecord()` 优先缓存 → IndexedDB handle → requestPermission → getFile；失败回退文件选择器；「选择文件」按钮走 FSAA
- [x] 文件名完整显示：新增 `stripExtension()`，主行显示扩展名前完整文件名，按钮 `title={fileName}` tooltip
- [ ] 待验收：pnpm typecheck / lint / build；Chromium E2E（刷新后点击条目无对话框）；非 Chromium 回退
