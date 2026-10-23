# 2026-10-23 Bugfix 阅读区注释图标 v1.0

## 1. 现象

截图（log/cc6fd623-….png）：正文中「注」标识图仍明显大于正文字号，以居中圆角块形态打断文流，观感突兀（「注」标识还是太大，显示也不友好）。

## 2. 根因

- 书内注释标记是 EPUB 小图（`extractRawBlocks` 拆成独立 `image` block），由 `ReaderImage` 渲染。
- 2026-10-22 已按 `min(自然宽, 1.5em)` 收敛（见 `plans/2026-10-22-Design-Reader-PageModes-v1.0.md`），但：
  1. **1.5em 仍大于一个正文字**（约 1.5 倍字高），徽章感强；
  2. 外层 `figure` 为 `my-3 flex flex-col items-center` + 图 `rounded-md`，小图标被**居中成块**、带圆角边框，与段落 `text-indent: 2em` 不对齐；
  3. 短 `alt`（如「注」）仍输出 `figcaption`，多占一行。

## 3. 修复方案

仅改 `src/components/content/BookContent.tsx` 图片渲染：

| 项 | 旧 | 新 |
| --- | --- | --- |
| 图标宽度上限 | `min(nat, 1.5em)` | `min(nat, 1em)`，并加 `max-height: 1.3em` + `object-fit: contain` |
| 图标形态 | `rounded-md`、继承默认类 | 无圆角、`inline-block`、`vertical-align: -0.15em` |
| figure | `my-3 flex flex-col items-center` | 图标：`my-0.5 pl-[2em]`（贴齐段首缩进，不居中）；插图布局不变 |
| figcaption | 有 alt 即显示 | 图标且 `alt.trim().length <= 4` 时不显示 |
| 阈值 | 自然宽 ≤ 200 | 不变 |

组件收口：`ReaderImage` + 调用处 `figure` 合并为 `ReaderFigure`，图标判定（onLoad naturalWidth ≤ 200）在同一组件内驱动形态。

插图（自然宽 > 200）行为与现状一致。

## 4. 验收

1. 含「注」小图的 EPUB：标记高度约等于一个正文字，左对齐段首，无圆角边框、无居中块、无多余图注行。
2. 普通插图：仍居中、最大 70vh、圆角不变。
3. `pnpm typecheck` / `pnpm lint` / `pnpm build` 通过；改后文件过杂散 token 复查。
