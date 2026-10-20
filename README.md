# AI Read - 智能电子书解析

将 EPUB / PDF 电子书解析为结构化思维导图与文字总结。

## 技术栈

- React 19 + TypeScript（strict / verbatimModuleSyntax）
- Vite 6 + Tailwind CSS 4 + shadcn/ui 风格组件
- Zustand 状态管理（settings / prompt 持久化，book 非持久化）
- EPUB：`@smoores/epub` + `epubjs`
- PDF：`pdfjs-dist`
- 思维导图：`mind-elixir`
- AI 服务：自研 Provider（openai-compatible / google），浏览器直连、BYO-Key、无代理

## 快速开始

```powershell
# 安装依赖
pnpm install

# 开发服务器（HMR）
pnpm dev

# 类型检查
pnpm typecheck

# 生产构建
pnpm build

# 预览构建产物
pnpm preview
```

## 使用流程

1. 点击「配置」，填写 AI 服务端点、密钥与模型（浏览器直连，密钥仅存于本地 localStorage）。
2. 上传 `.epub` 或 `.pdf` 电子书，本地解析章节。
3. 勾选章节（Ctrl+G 可分组），选择处理模式与高级选项。
4. 开始处理，实时查看进度。
5. 查看文字总结或思维导图（可缩放 / 拖拽 / 展开折叠）。

## 处理模式

- **文字总结模式**：逐章摘要 + 章节关系 + 全书总结。
- **章节思维导图模式**：为每个选中章节生成思维导图。
- **整书思维导图模式**：汇总全书生成单一思维导图。

## 文档

- 需求文档：`docs/spec/ai-read 需求.md`
- 文档主索引：`docs/INDEX.md`
- 进度跟踪：`docs/plans/project-plans-tracker.md`
- 长期记忆与 AI 上下文注入点：`AGENTS.md`