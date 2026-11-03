你开发的是一个 Node.js AI 辅助阅读程序，调用大模型时却总提示“端点不支持浏览器 CORS 跨域调用”，核心原因通常是：你的前端正在直接请求大模型 API，但模型服务端不允许来自浏览器的跨域请求。

这一般不是模型不支持 AI 阅读，也不一定是 API Key 错了，而是请求架构或服务端跨域配置的问题。

## 一、为什么会出现这个问题？

假设你的程序采用下面的结构：

AI 阅读前端

网页、React、Vue 或本地 HTML

浏览器 fetch() 直接请求大模型 API

大模型服务端

不允许当前浏览器来源进行跨域访问

浏览器执行跨域请求时，会根据请求类型和服务端响应检查 CORS 策略。如果服务端没有返回匹配的 `Access-Control-Allow-Origin` 等响应头，浏览器就会拦截请求。

尤其是携带 `Authorization` 请求头的 API 调用，浏览器通常还会先发送 `OPTIONS` 预检请求。如果服务端没有正确处理预检，也会失败。

常见原因有：

- API 端点不开放浏览器调用：服务端要求通过后端转发请求。
- 前端直接调用模型服务：Node.js 项目虽然使用了 Node.js 技术栈，但如果请求代码运行在浏览器中，仍然受浏览器 CORS 限制。
- 端点或代理配置不正确：例如自定义 `baseURL`、反向代理、网关没有正确处理跨域请求。
- 把浏览器的 CORS 报错误认为模型故障：实际上，服务端可能根本没有收到正式的模型请求。

## 二、推荐的解决方案：增加 Node.js 后端代理

对于 AI 辅助阅读程序，我建议采用这种架构：

前端阅读器

解析文章、选中文字、生成摘要、提问

Node.js 后端

保存 API Key、校验请求、调用模型、处理流式响应

大模型 API

生成解释、摘要、翻译、阅读问答

前端只请求你自己的 Node.js 服务。后端通过服务端 HTTP 请求调用模型 API，这样浏览器就不需要直接跨域访问模型端点了。

[image](https://www.google.com/s2/favicons?domain=https://developer.mozilla.org\&sz=32)

MDN+1



### 1. 创建 Node.js 后端

例如使用 Express：

安装依赖：

```
npm install express cors dotenv
```

创建 `.env` 文件：

```
LLM_API_KEY=你的模型API密钥
LLM_BASE_URL=https://你的模型服务地址/v1
LLM_MODEL=你的模型名称
PORT=3000
```

创建 `server.js`：

```
require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors({
  origin: "http://localhost:5173"
}));

app.use(express.json({ limit: "1mb" }));

app.post("/api/reading/ask", async (req, res) => {
  try {
    const { text, question } = req.body;

    if (
      typeof text !== "string" ||
      typeof question !== "string" ||
      !text.trim() ||
      !question.trim()
    ) {
      return res.status(400).json({
        error: "请提供文章内容和问题"
      });
    }

    const response = await fetch(
      `${process.env.LLM_BASE_URL}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Authorization":
            `Bearer ${process.env.LLM_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: process.env.LLM_MODEL,
          messages: [
            {
              role: "system",
              content: "你是一个严谨的 AI 阅读助手。"
            },
            {
              role: "user",
              content:
                `文章内容：\n${text}\n\n阅读问题：\n${question}`
            }
          ],
          stream: false
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "模型调用失败"
      });
    }

    res.json({
      answer: data.choices?.[0]?.message?.content ?? ""
    });
  } catch (error) {
    console.error("模型调用失败：", error.message);

    res.status(502).json({
      error: "模型服务暂时不可用"
    });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("AI 阅读后端已启动");
});
```

> 注意：上面的后端调用方式假设你的模型服务兼容 OpenAI Chat Completions API。不同厂商的端点、鉴权方式和返回格式可能不同，需要按实际服务修改。

### 2. 前端改为请求自己的后端

```
async function askAI(articleText, question) {
  const response = await fetch(
    "http://localhost:3000/api/reading/ask",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: articleText,
        question
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "AI 请求失败");
  }

  return data.answer;
}
```

启动后端：

```
node server.js
```

前端调用 `askAI(文章内容, 用户问题)` 即可获取模型回答。

这里的 `cors` 只用于配置你自己的后端允许哪些前端来源访问，并不能替代大模型厂商的 CORS 配置。上线时应将允许来源限制为实际前端域名，并添加鉴权、限流等措施。

另外，不要把模型 API Key 放在前端代码、浏览器存储或打包后的 JavaScript 中，否则用户可以提取密钥并盗用额度。

## 三、如果仍然报错，按这个顺序排查

| 检查项                | 重点                                      |
| ------------------ | --------------------------------------- |
| 浏览器开发者工具 → Network | 查看失败的是模型端点还是自己的 Node.js 接口              |
| `OPTIONS` 请求       | 是否返回 2xx，以及是否允许实际请求的方法和请求头              |
| API 地址             | 是否使用正确的模型端点和 API 路径                     |
| 后端日志               | 是否出现模型服务的 401、403、404 或 429 等错误         |
| 本地页面协议             | 如果通过 `file://` 打开 HTML，建议先用本地 HTTP 服务运行 |

不要尝试用 `mode: "no-cors"` 绕过问题：这样通常无法读取模型返回的 JSON 内容，也就无法正常显示 AI 阅读结果。

[image](https://www.google.com/s2/favicons?domain=https://developer.mozilla.org\&sz=32)

MDN+1



## 四、我建议先确认你的项目结构

不同结构的解决方法略有区别，尤其是 Electron、纯网页和 Node.js 全栈项目的请求位置不一样。

1\. 你的 AI 阅读程序属于哪一种？

普通网页 / React / Vue

Electron 桌面程序

Node.js 后端已存在，但调用仍失败

2\. 你调用的是哪个大模型？

OpenAI API

DeepSeek

通义千问 / 阿里云百炼

其他兼容 OpenAI 的模型接口

还没确定 / 使用第三方聚合 API

3\. 当前使用的请求方式

浏览器 `fetch()`

OpenAI SDK 或其他模型 SDK

不确定

生成针对我的项目的解决方案