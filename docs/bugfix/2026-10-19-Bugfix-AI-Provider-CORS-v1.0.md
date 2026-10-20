# 2026-10-19 诊断报告 AI 请求 Failed to fetch（Provider CORS）v1.0

- 日期：2026-10-19
- 模块：`src/services/ai/provider.ts`（调用方）/ 用户 Provider 配置
- 状态：**已定位根因，应用代码无需变更**（解决方案为更换端点/服务）

## 1. 现象

1. 工作台点击「开始处理」（文字总结，1 章）→ 处理面板显示红色错误 `Failed to fetch`。
2. 浏览器 DevTools 网络面板中该 AI 请求「没有内容」（无响应体）——用户先后以
   「为什么当前请求没有内容」「检查 localhost:5173 为啥失败」反馈。
3. 页面本身功能正常（章节解析、排版、主题、折叠均可用）；故障仅发生在 AI 请求发出时。

## 2. 排查过程

| 步骤 | 结果 |
| --- | --- |
| dev 服务器健康检查（`/`、`/src/index.css`、`/src/main.tsx`、`/src/App.tsx`） | 全部 200，模块内容完整（初期无样式截图为标签页 HMR 陈旧状态，强刷解决，与本故障无关） |
| 干净浏览器会话复现 | 渲染与样式正常 → 排除应用代码/构建问题 |
| 读取真实 Provider 配置（Edge localStorage LevelDB：`User Data\Default\Local Storage\leveldb\*.log`，双编码检索；apiKey 仅验证存在性、不落文档） | 激活服务 `nemotron-3-super-120b-a12`，kind=openai-compatible，baseUrl=`https://ai-gateway.kilo.ai/api/v1`；另有备用服务 `agnes-3.0-flash`，baseUrl=`https://api.agnes-ai.cn/v1` |
| 端点探测矩阵（curl） | 见下表 |

### 端点探测矩阵

| 端点 | 直连 | 经代理 127.0.0.1:10808 | CORS 预检（Origin=http://localhost:5173） | POST 响应 ACAO |
| --- | --- | --- | --- | --- |
| `ai-gateway.kilo.ai/api/v1`（激活） | ✅ 1.2s（400，因无鉴权，属预期） | ✅ | ❌ **204 但响应不含 `Access-Control-Allow-Origin`** | ❌ 无 |
| `api.agnes-ai.cn/v1`（备用） | ✅ 0.5s（401，因测试无 key，属预期） | — | ✅ `ACAO: *`，允许 Authorization/Content-Type | — |
| `openrouter.ai/api/v1` | ⚠️ 勉强（≈12s） | ✅ 1.3s | ✅ `ACAO: *` | — |

## 3. 根因

**激活的 Kilo 网关（`ai-gateway.kilo.ai`）不支持浏览器跨域（CORS）**：
其 OPTIONS 预检虽返回 204，但响应缺少 `Access-Control-Allow-Origin` 等 CORS 头，
浏览器按规范拦截实际 POST，`fetch` 在网络层抛出 `TypeError: Failed to fetch`，
请求根本未到达服务端，故 DevTools 显示「请求没有内容」。

该网关面向 CLI / 桌面等**原生 HTTP 客户端**设计（此类客户端不受 CORS 约束，因此 Kilo
自身可正常使用），但本项目架构为 **BYO-key、浏览器直连 Provider、严禁代理/后端转发**，
因此此端点在本应用中不可用。与网络环境、API key、ai-read 代码均无关。

## 4. 解决方案

| 优先级 | 方案 | 说明 |
| --- | --- | --- |
| 1 | 服务下拉框切换 `agnes-3.0-flash` | CORS 完备、国内直连快，预期立即可用 |
| 2 | 配置其他支持浏览器 CORS 的 OpenAI 兼容端点 | 如 OpenRouter（需浏览器代理规则覆盖其域名） |
| ✗ | 本地代理转发 | **违反项目红线（无代理原则），不采用** |

## 5. 经验沉淀

1. `Failed to fetch` 且 DevTools 无响应体 ⇒ 优先怀疑 CORS 拦截或网络不可达，而非代码；
   用 `curl -i -X OPTIONS` 带 `Origin` + `Access-Control-Request-*` 头即可离线验证端点是否欢迎浏览器调用。
2. 端点选型（浏览器直连架构）必须检查：**预检 ACAO + 实际响应 ACAO + Authorization 是否在 allow-headers**。
3. LevelDB localStorage 检索技巧：键记录为 ASCII、值记录为 UTF-16LE，需双编码检索；
   诊断读取 apiKey 仅验证存在性（长度），**严禁将 key 写入任何文档/记忆**（项目红线）。

## 6. 遗留（可选优化，待确认后实施）

- `Failed to fetch` 时显示中文诊断提示（CORS/网络/代理/地址检查方向），按
  `docs/bugfix/` 流程另行落地。
