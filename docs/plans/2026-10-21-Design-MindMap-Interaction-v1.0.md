# 2026-10-21 设计｜思维导图交互（滚轮缩放 / 手型拖拽 / 双击折叠 / 小地图）v1.0

> 范围：仅 `ResultView.tsx` 的 `MindMapPanel`（mind-elixir 只在此实例化，红线不变）；零新 npm 依赖。
> 依据：mind-elixir 6.0.0-next.4 源码与 `dist/types` 类型盘点。用户已确认方案 A，附加要求：小地图支持**拖拽视口框平移**（不仅点击居中）。

## 1. 能力对照与动作

| 需求 | 库现状 | 实施动作 |
| --- | --- | --- |
| 滚轮缩放 | 内置 `handleWheel: true`（scaleMin 0.2 / scaleMax 1.4），`scale(scaleVal, offset?)`、`scaleFit()` API 完备 | 保留默认，工具条「+ / − / 适应」调用同一 API（offset 传容器中心） |
| 拖拽平移 + 手型光标 | panHelper 在 `editable:false` 下按下即可平移；手型光标 CSS（`.space-pressed` → grab/grabbing）默认仅按住空格出现；实例有 `spacePressed: boolean` 属性 | 工具条手型按钮切换：置 `spacePressed` + 给容器加/去 `space-pressed` 类（免按空格）；`index.css` 增加常驻 `cursor:grab`（按下 `grabbing`），`.me-tpc:hover` 显 `pointer` 提示双击 |
| 双击展开/折叠 | 仅单击节点旁 `.me-epd` 切换；无 dblclick 处理 | 容器 `dblclick` 委托：`closest('.me-tpc')` → 有子节点（`nodeObj.children.length > 0`）→ `expandNode(tpc)` 切换，无子节点忽略；原 `.me-epd` 单击保留 |
| 相关图标 | 内置 `toolBar` 为编辑向（撤销等） | `toolBar: false`；容器右上浮动工具条 6 个内联 SVG 按钮：手型(高亮态) / 放大 / 缩小 / 适应 / 展开全部(`expandNodeAll(root, true)`) / 折叠全部(`expandNodeAll(root, false)`) |
| 小地图框 + 拖拽平移 | 库无 minimap | 右下 160×110 SVG 自研，见 §2 |

## 2. 小地图设计

- **世界坐标反变换**：`screenRelContainer = off + T + O + s·(p − O)` → `p = O + (screen − off − T − O)/s`
  - `off = {map.offsetLeft, map.offsetTop}`（布局偏移，不受 transform 影响）
  - `T` 解析 `map.style.transform` 的 `translate3d(xpx, ypx, 0)`（兼容无 3d 形式）
  - `O` 解析 `getComputedStyle(map).transformOrigin`（`%` 按 offsetWidth/Height 折算；direction=1 时库设为 `${rootCenterX}px 50%`）
  - `s = instance.scaleVal`
- **渲染**：节点取全部 `.me-tpc` 的 `getBoundingClientRect` 反变换为世界矩形 → SVG `viewBox` 取（节点 ∪ 视口）并集 + 10% padding，`preserveAspectRatio="xMidYMid meet"`；节点画 `<rect>`（根节点换色），视口画高亮描边矩形。
- **刷新时机**：`bus` 监听 `scale` / `expandNode` / `linkDiv` + 容器 `pointermove` / `wheel` + `ResizeObserver`，统一 rAF 节流；销毁时全部解绑。
- **交互**（mouse 事件，兼容测试合成）：
  - 单击空白处：视口中心平移到该点（`move((p − center)·s)`，`move(dx, dy)` 为屏幕像素平移量）
  - 按住视口框（或任意处按下后）拖拽：`mousemove` 增量 `(Δp)·s` 持续平移 → 满足「拖拽视口框平移」

## 3. 组件结构与状态

```text
MindMapPanel
├─ 外层 relative 容器 (h-[28rem])
│  ├─ 内层 div ref=containerRef (mind-elixir el, absolute inset-0)
│  ├─ 工具条 (absolute right-2 top-2 z-10, 6 SVG 按钮, status=ready 才可点)
│  └─ 小地图 (absolute bottom-2 right-2 z-10, 160×110 svg + title)
└─ 状态: status/message/version（沿用）+ handMode + mini({dots, view, vb})
```

`MindElixirInstance` 本地类型扩展：`scale/scaleVal/expandNode/expandNodeAll/move/spacePressed/container/map/nodeData/findEle/bus`（动态 import 后 cast，既有模式不变）。

## 4. 文案与验收

- 底部提示改为：`滚轮缩放 · 拖拽平移（手型）· 双击节点展开/折叠 · 右下角小地图导航`
- 验收：`pnpm typecheck` / `pnpm build` 绿；mock E2E：滚轮后 transform scale 变化、手型按钮后容器含 `space-pressed` 且节点 cursor=grab、双击 `问题层` 子节点消失再点恢复、小地图出现且 mousedown+mousemove 拖动后 map transform 位移、截图；写后必查扫杂散 token；提交前密钥扫描。
