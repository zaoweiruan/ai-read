# 2026-10-21 设计｜模式 tab 永不再消失（四层加固）v1.0

> 源：用户 2026-10-21 二次报告「tab 开关又消失了」+ 截图 `log/5e6e42cb-27c9-48d6-8a3d-397151c8b847.png`。
> 截图要点：处理面板内**模式 tab 行完全不见**（仅剩 服务/选项/提示/红色超时文案），右栏结果区为空；用户真实服务 `agnes-3.0-flash` 在 60s 内未响应。
> 范围：`src/App.tsx`、`src/stores/book-store.ts`、`src/components/processing/ProcessingPanel.tsx`、`src/components/content/BookContent.tsx`、`src/components/chapters/ChapterList.tsx`。

## 1. 判定

上一轮已修「文档变更触发整页 reload」与「请求无超时」。本轮截图显示 tab 行**在 DOM 位置缺失**（处理面板标题与「服务」之间无任何 tab 行，且面板非滚动状态），说明存在**与 reload 无关**的第二类成因：工作台/面板在**无书或状态丢失**时被整块卸载或被 flex 压缩塌陷。

## 2. 四层加固（任一层单独成立即可保证 tab 可见）

| 层 | 措施 | 解决 |
| --- | --- | --- |
| L1 常驻 | `App.tsx` 去掉 `chapters.length > 0` 条件，**工作台三栏恒定渲染**；无书时章节列/内容区/处理面板显示空态，模式 tab 始终存在可点 | 整页 reload / 换书 / 解析失败导致 tab 整体消失 |
| L2 持久化 | `book-store` 接入 zustand `persist`（`ai-read:book`），持久化 `book / chapters / selectedChapterIds / activeChapterId / groups / summary / mindMap / activeMode`；**`bookData`（ArrayBuffer）不入库**；localStorage 读写包 try/catch（配额不足静默跳过） | 刷新后章节与结果仍在 → 工作台与结果窗不空 |
| L3 防塌陷 | 处理面板所有直接子元素加 `shrink-0`（标题行 / tab 行 / 选项区 / 底部区），面板内容超出时改为**内部滚动**而非压缩；右栏处理面板高度 300/320 → 320/360 px | flex column 空间不足时 tab 行被压成 0 高度 |
| L4 空态引导 | `BookContent` idle 文案按「有书无文件 / 无书」分场景提示重新上传；`ChapterList` 空列表给出「尚未加载书籍章节」 | 刷新后正文为空导致的困惑 |

## 3. 附带结论

- 用户真实服务 `agnes-3.0-flash` 单章请求 60s 未响应（已由看门狗报错并恢复 tab）。超时保护已生效；该端点/模型是否支持 `chat/completions` + JSON 输出需另行核对（与 tab 问题无关）。
- 刷新后**正文与重新处理**仍需重新上传文件（`bookData` 不持久化，避免 localStorage 写入二进制），`run()` 已有明确报错「电子书数据未驻留，请重新上传文件。」。

## 4. 验收

- 无书加载时：三个模式 tab 存在且可点（点击给出「请先选择至少一个章节。」或上传提示），不随状态消失。
- 上传 → 刷新：章节列、选中态、结果（导读/导图）仍在，tab 仍可见；正文区显示「请重新上传」引导。
- 挂起 60s：tab 行保持可见（不塌陷），超时文案出现后可再次点选并正常跑完。
