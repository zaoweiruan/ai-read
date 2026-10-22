# 2026-10-22 设计｜结果窗口全屏按钮 v1.0

> 源：用户 2026-10-22 指令「为结果窗口添加全屏按钮，点击全屏展示」。
> 范围：`src/components/processing/ProcessingPanel.tsx`（结果窗容器 + 按钮）、`src/index.css`（全屏态样式）。

## 1. 设计

- **入口**：结果窗顶部常驻细条（`sticky`），右端一枚「全屏」按钮（图标 + 文案），滚动时始终可见。
- **实现**：优先使用浏览器原生 Fullscreen API（`requestFullscreen()` / `exitFullscreen()`），原生不可用或被拒时回退为 CSS 覆盖层（同一元素加 `fixed inset-0 z-50` 类，不重新挂载 DOM）。
  - 关键点：全屏作用于**同一个 DOM 节点**，不做条件渲染 → 思维导图实例不重建、无重复渲染成本、退出后状态保留。
  - 监听 `fullscreenchange` 同步按钮文案（全屏 ⇄ 退出全屏）。
- **Esc**：原生全屏由浏览器直接退出；CSS 回退态额外监听 `Escape` 键退出。
- **全屏态样式**（`index.css`）：
  - `.mm-result-dock:fullscreen`：铺满视口 + 主题背景 + 内边距；
  - `.mm-result-dock:fullscreen .mm-shell`：导图高度 `calc(100vh - 160px)`，避免导图在全屏里过小；
  - 回退态同样通过 `.mm-result-dock.is-expanded` 类应用同样的高度规则。

### 背景色修正（2026-10-22 追加）

初版写的是 `background: var(--background)`，而项目主题变量是 Tailwind v4 的 **`--color-background`**，`--background` 未定义 → 整条声明失效 → 全屏元素透明 → 透出 Chromium `:fullscreen` 默认**黑色 backdrop**（用户截图确认）。

修正：
```css
.mm-result-dock:fullscreen { background: var(--color-background); color: var(--color-foreground); }
.mm-result-dock:fullscreen::backdrop { background: var(--color-background); }
```
实测：全屏背景 `oklch(1 0 0)`（白），文字 `oklch(0.145 0 0)`（近黑），与正文主题一致。

## 2. 验收

- 结果窗右上出现「全屏」按钮；点击后该容器成为全屏元素（`document.fullscreenElement === 容器`）或进入回退态（`is-expanded`），结果内容铺满视口、思维导图高度随之变大；按钮文案变为「退出全屏」。
- 再次点击（或按 Esc）恢复原位，**已生成结果不丢失**（导图实例不重建）。
- typecheck / build 绿；写后必查。
