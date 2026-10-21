# 2026-10-21 缺陷修复｜点击「当前章节总结」后 tab 开关消失、无法再入 v1.0

> 现象（用户 2026-10-21 报告，附截图 `log/fa22eb82-b2d7-4995-a627-4c0a87d125d4.png`）：点「当前章节总结」后所有 tab 开关消失，无法再次进入处理流程。
> 范围：`src/components/processing/ProcessingPanel.tsx`、`vite.config.ts`。

## 1. 定位过程

- 在干净环境（mock provider、1280×720）点击「当前章节总结」**未能复现**：三个 tab 仍可见可用、`errs=[]`。
- 关键证据来自 dev 服务器日志（`vite` 客户端输出）：

  ```
  16:01:29 page reload docs/INDEX.md
  16:09:14 page reload docs/plans/project-plans-tracker.md
  16:10:26 page reload docs/plans/project-plans-tracker.md
  ```

  用户报告时间（08:13 UTC）正好落在上述 `page reload` 之后数分钟。

## 2. 根因（三条，均已修复）

1. **文档编辑触发整页 reload（主因）**：Vite 监听到 `docs/**` 变更即执行 `page reload`；开发过程中频繁提交/更新 `docs/INDEX.md`、`docs/plans/project-plans-tracker.md`，浏览器被整页刷新。书籍、章节、结果均在**内存 store**（zustand 非持久化），reload 后 `chapters.length===0` → 工作台整体卸载 → 三个模式 tab 与结果窗一起消失，只能重新上传才能再入。
2. **AI 请求无超时**：`provider.chat` 无超时机制；真实服务慢或挂起时 `running` 永久为 true → tab 持续 `disabled`，用户无法再点选任何模式（「无法再入」）。
3. **完成后自动 `scrollIntoView('#app-result')`**：结果窗已位于右栏停靠区，页面级滚动既无必要，也可能把处理面板（tab 所在）推离视口，造成「tab 消失」的观感。

截图呈多帧叠影（章节列表 / 阅读工具栏 / 处理面板文字互相重叠），与「reload 过程中撕裂合成」的形态一致。

## 3. 修复

| # | 修复 | 实现 |
| --- | --- | --- |
| 1 | watcher 忽略文档与日志目录 | `vite.config.ts`：`server.watch.ignored = ['**/docs/**', '**/log/**', '**/.git/**']`；文档变更不再触发整页 reload，内存态不再被清空 |
| 2 | 每次 AI 请求 60 秒看门狗 | `ProcessingPanel.withTimeout(ai)`：自建 `AbortController` 组合「外部暂停信号 + 60s 定时器」，超时以 `TimeoutError` 中止并转成中文提示「AI 请求超时（60 秒）：服务响应过慢，请稍后重试。」；`finally` 中 `running=false`，tab 必然恢复可用 |
| 3 | 移除结果窗自动滚动 | 删除 `run()` 末尾的 `scrollIntoView('#app-result')`（右栏停靠已可见） |

## 4. 验证（2026-10-21，mock provider，typecheck/build 绿）

- watcher 忽略生效：新增/删除 `docs/_watchprobe.tmp` 后日志**无** `page reload`（修复前同类改动必现）。
- 正常链路：点「当前章节总结」→ 导读生成；`scrollY` 0 → 0（无自动滚动）；三个 tab `disabled=false` 且在视口内；`errs=[]`。
- 挂起链路（mock `hang-model` 永不响应）：运行中 tab 禁用 + 「暂停」可见；60 秒后错误文案「AI 请求超时（60 秒）…」，三个 tab 全部恢复 `disabled=false`，「暂停」消失。
- 再入链路：超时后切回正常模型 → 重新点选「当前章节总结」→ 导读正常生成，tab 全部可用。

## 5. 遗留说明

- 文档 / 日志 / 截图类文件不再触发 reload；源码变更仍走正常 HMR（`ResultView` 因导出 `publishResult` 属于非组件导出，Fast Refresh 退化为整页 reload，属已知行为，不影响本缺陷修复范围）。
- 若浏览器仍缓存旧模块，需硬刷新（Ctrl+Shift+R）一次。
