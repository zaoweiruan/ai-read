# 2026-10-22 设计｜思维导图：居中按钮 + 小地图视口拖拽修正 + 产物来源标识 v1.0

> 源：用户 2026-10-22 三点反馈 —— ①「全书思维导图在哪个窗口」②「小地图选择框为啥不能拖动」③「添加居中按钮，点击后导图居中显示」。
> 范围：`src/components/results/ResultView.tsx`（MindMapPanel + 小地图）、`src/stores/book-store.ts`、`src/components/processing/ProcessingPanel.tsx`。无新依赖。

## 1. 问题判定

### ① 全书思维导图的位置
整书模式产物写入 `book-store.mindMap`，由 `ResultView` 的「思维导图」子标签渲染 —— 即**右侧栏结果窗**（处理面板下方）。为消除歧义，新增**来源徽标**：导图面板左上角显示「整书」/「章节」，一眼可辨当前导图是整书合并结果还是逐章导图。

### ② 小地图视口框拖不动（真因）
原 `onMiniDown` 逻辑：**任何位置按下都先 `centerOn(point)`**（把视图中心瞬移到按下点）再进入拖拽。抓取视口框时视图先跳到光标处，表现为「选框不跟手 / 拖不动」。

修正（命中测试）：
- 按下点落在**视口矩形内**（世界坐标命中）→ **不居中**，直接进入跟手平移（`move(Δworld × scale)`），视口框随光标移动；
- 按下点落在**视口矩形外** → 视口中心平移到该点（点击定位），随后拖拽仍可跟手。

### ③ 居中按钮
mind-elixir 内置 `toCenter()`：以当前缩放把**根节点居中**到容器中心（内部 `it()` 顺带重算 `transformOrigin`），与「适应画布」`scaleFit()`（缩放到整图可见）语义不同，二者并存。

## 2. 实施

| # | 改动 | 位置 |
| --- | --- | --- |
| 1 | 工具条新增「居中」按钮 → `inst.toCenter()` + rAF 刷新小地图 | MindMapPanel 工具条（适应画布之后） |
| 2 | 实例类型补 `toCenter: () => void` | `MindElixirInstance` |
| 3 | 小地图按下命中测试：视口内不居中、视口外居中 | `onMiniDown` |
| 4 | 视口框描边加粗并保证最小可见尺寸 | 小地图 `rect.mm-view` |
| 5 | `book-store` 增 `mindMapScope: 'book' \| 'chapter' \| null` + setter；ProcessingPanel 写产物时同步标记 | store / ProcessingPanel |
| 6 | 导图面板左上角来源徽标（整书 / 章节） | MindMapPanel |

## 3. 验收

- 点「居中」：导图平移使根节点位于容器中心，缩放不变（transform 变化但 scale 不变）。
- 小地图：在视口框内按下并拖动 → 视图跟手平移（无先跳后跳的突兀），视口框随光标；在视口外点击 → 视图居中到该点。
- 跑整书导图后，导图面板显示「整书」徽标；跑章节导图显示「章节」。
- typecheck / build 绿；写后必查；`pnpm` 脚本仅 typecheck/build（eslint 未安装）。
