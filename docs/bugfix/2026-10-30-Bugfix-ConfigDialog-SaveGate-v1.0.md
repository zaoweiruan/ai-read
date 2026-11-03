# 2026-10-30 修复 配置对话框保存门禁导致配置无法落盘 v1.0

## 现象

用户连续反馈「无法正确保存配置，刷新后配置还原」。表现为：在「配置 AI 服务」对话框里改完 API Key / 模型 / 地址，点「保存」后界面无任何反应（无报错、无成功提示），刷新页面后配置回到修改前的值；新增服务则因「验证服务」不通过而始终无法保存。

## 与上一版修复的关系

`2026-10-29-Bugfix-Settings-Persist-Revert-v1.0.md` 修正了 `src/stores/settings-store.ts` 的持久化管道（`safeStorage` + `createJSONStorage` + `partialize` + `merge` 归一化）。该修复本身正确且必要，但**未能消除现象**——因为它假设「配置已写入但还是丢了」，而真实链路上 `updateProvider` / `addProvider` **从未被调用**，`set()` 根本没发生，localStorage 里连旧值都没有更新。本文档为真正的根因修复。

## 根因

两个缺陷都在 `src/components/config/ConfigDialog.tsx`，共同后果是「配置永远存不进 store」。

### 缺陷一：`saveExisting` 校验对象错配（必然发生）

```tsx
const d = drafts[p.id]
if (!d || !verified(p.id, p)) return   // p 是 store 旧值，不是草稿
```

- 按钮门禁 `canSave = opts.dirty && verified(key, value)`，其中 `value = current(stored)` 是**草稿**，指纹取自草稿；
- 点击保存后调 `saveExisting(stored)`，内层 `verified(p.id, p)` 传入的是**store 旧值**；
- `isDirty()` 的定义正是 `fingerprint(草稿) !== fingerprint(旧值)`，故只要处于 dirty 状态，内层校验恒为 false，函数静默 `return`。

结果：按钮亮着可点，点击却什么都不发生。任何对已有服务的修改 100% 无法保存。

### 缺陷二：验证结果被当作保存的前置条件

- `saveNew` 要求 `verified('new', newDraft)`，即 `verifyProvider` 必须返回 `ok: true`；
- `src/services/ai/verify.ts` 在网络层失败（`TypeError: Failed to fetch`，典型成因即 CORS 预检被拒）时返回 `{ ok: false, status: 'cors' }`；
- 因此端点不支持浏览器直连时，保存按钮永久 `disabled`，新增服务无法进入 store。

本项目 BYO-key 浏览器直连，端点不支持 CORS 是已知且常见的现实情况（见 `docs/spec/cors优化.md`、`2026-10-19-Bugfix-AI-Provider-CORS-v1.0.md`）。原逻辑把「该端点暂时用不了」升级成「该配置连存都不许存」。

此外，草稿是组件内 `useState`，对话框关闭即丢失，与上述两点叠加，造成「改完刷新必然还原」。

## 修复

`src/components/config/ConfigDialog.tsx`：

1. `saveExisting` 去掉内层二次校验，只判断草稿是否存在；保存后 `updateProvider` + `clearDraft` + `clearVerify`。
2. `saveNew` 去掉 `verified` 前置校验，直接 `addProvider`，随后 `setNewDraft(null)` + `clearVerify`。
3. 按钮门禁改为 `canSave = opts.dirty`：**验证降级为建议**，不再是保存前置条件。
4. 未验证时给出中性提示「未验证也可直接保存；建议先『验证服务』确认连通与 CORS」，验证失败（如 `status: 'cors'`）时补充说明「配置仍可保存，但实际请求会被浏览器拦截」。
5. 顶部说明文案同步改为「验证用于确认连通性，未通过也可保存」。
6. 保存成功后清理对应验证结果，避免旧指纹结果跨草稿残留。

## 设计取舍

- 不引入任何代理 / 后端转发，保持 BYO-key 浏览器直连的既有红线；验证只做诊断，不做门禁。
- 不新增字段、不改数据结构，`ai-read:settings` 存储结构不变，旧数据无需迁移。

## 安全红线

`ai-read:settings` 含用户 apiKey，本文档不记录任何 apiKey 原文；修复仅调整保存与校验的交互逻辑，不改变密钥存储位置（仍为浏览器本地 localStorage）。

## 校验

- `pnpm typecheck`：通过（`tsc -b --noEmit` 无输出无错误）
- `pnpm lint`：0 error（既有 3 条 `react-hooks/exhaustive-deps` warning 全在 `BookContent.tsx` L595/L623/L746，与本次修复无关）
- `pnpm build`：成功（5.65s；既有 `index-*.js` 1,204 kB `>500 kB chunk` 提示，非错误）
