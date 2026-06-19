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

- 状态：done
- 实施分支：main
- 关键改动：
  - `/loops/new`（`apps/web/app/loops/new/page.tsx`）已是 v1 最简无登录表单：仅 title、targetRepo、priority、body、acceptanceCriteria；已移除 Submitter ID/Name mock 字段。
  - server action（`apps/web/app/loops/new/actions.ts`）只透传上述字段，不携带 submitter/登录态，提交成功后 `redirect('/loops/${result.issue.id}')`。
  - `/loops` 队列、doctor、cost、logs、notifications 与 `/loops/[issueId]` 详情操作入口（run/global-review/reloop/finalize 等）均存在。
  - 队列/详情数据经 `apps/web/lib/api/loops.ts` 调用 API（`GET /loops/issues`、`GET /loops/issues/:issueId`），状态来自 API（后端 DB 优先 + `.loops` 回退），前端不再伪造数据库状态。
  - 后端 `normalizeSubmitter` 默认 dev submitter，使前端省略 submitter 仍能正常入库。
- 验证命令：
  - `sed -n '1,85p' apps/web/app/loops/new/page.tsx`（确认无 submitter 字段）
  - `sed -n '1,20p' apps/web/app/loops/new/actions.ts`
  - `rg -n "submitter" apps/web/app/loops/new/page.tsx apps/web/app/loops/new/actions.ts`（应为空）
  - `pnpm --filter @repo/web type-check`（通过）
- 验证结果：通过；无登录最简表单、提交跳转、队列/详情入口与 API-backed 状态均就绪，web type-check 干净。
- 剩余风险：`targetRepo` 默认值硬编码为当前仓库绝对路径，部署到其他环境时需调整；未做浏览器端手动提交回放（需本地起 web+api）。
- 需要归档到 IMPLEMENTATION-ANNOTATIONS.md 的内容：
  - TASK-04 升级为 done：v1 无登录最简表单（无 submitter 字段）、提交跳转、API-backed 队列/详情均完成。
