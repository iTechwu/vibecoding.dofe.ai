# TASK-04 · Web 无登录 Issue 流程

## 任务目标

优化 Web Loops 页面，让用户无需登录即可提交 Issue，并能从队列进入详情、推进 Loop。

## 依赖

- 依赖 `TASK-02` 的 contract/API 口径。
- 可与 `TASK-03` 并行，但最终需要接入双写后的 API。

## 本任务范围

- `/loops/new` 无登录提交表单。
- `/loops` 队列展示 DB/API 返回的 Issue 状态。
- `/loops/[issueId]` 详情保留现有 Loop 操作入口。
- 移除或隐藏 v1 中会误导用户的 SSO/飞书入口文案。

## v1 表单字段

- title
- targetRepo
- body
- priority
- acceptanceCriteria

submitter 默认由后端填充，前端不要求登录态。

## 可能涉及文件

- `apps/web/app/loops/page.tsx`
- `apps/web/app/loops/new/page.tsx`
- `apps/web/app/loops/[issueId]/page.tsx`
- `apps/web/lib/api/loops.ts`
- `apps/web/components/**`

## 验收标准

- 未登录状态可以打开 `/loops/new`。
- 提交成功后跳转到 Issue 详情或队列。
- 队列刷新后仍能看到刚提交的 Issue。
- 详情页可继续生成 Spec、审核、拆解、run、global-review、finalize。
- 页面不展示 v1 尚未实现的 SSO/飞书承诺。

## 验证建议

- `pnpm --filter @repo/web type-check`
- 本地启动 Web/API 后手动提交一条 Issue。
- 截图或记录关键页面状态。

## 禁止事项

- 不新增登录守卫。
- 不要求 cookie/session/token。
- 不在前端伪造数据库状态；状态应来自 API。

## 实施回填

- 状态：partial
- 实施分支：main
- 关键改动：
  - `/loops/new` 提供 Web Issue 表单，并通过 server action 调用 `createLoopIssue()`。
  - 提交成功后跳转 `/loops/:issueId`。
  - `/loops` 队列、doctor、cost、logs、notifications 与详情操作入口已存在。
  - 未发现页面级登录守卫或 cookie/session/token 强依赖。
- 验证命令：
  - `sed -n '1,180p' apps/web/app/loops/new/page.tsx`
  - `sed -n '1,80p' apps/web/app/loops/new/actions.ts`
  - `sed -n '1,220p' apps/web/app/loops/page.tsx`
- 验证结果：partial；无登录/mock Web 提交骨架存在，但页面仍展示 Submitter ID/Name mock 字段，队列数据来自文件 backed API，不是 DB/API 返回的 DB 状态。
- 剩余风险：后端未默认填充 submitter 时，前端 mock 字段仍承担兜底；真正无登录最简表单需移除或隐藏 submitter 字段。
- 需要归档到 IMPLEMENTATION-ANNOTATIONS.md 的内容：
  - TASK-04 最终状态为 partial：Web 无登录骨架可用，但 submitter UI 与 DB-backed 队列仍未达到 v1 验收。
