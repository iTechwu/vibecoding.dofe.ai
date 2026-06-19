# TASK-08 · 最终文档标注与归档

## 任务目标

在各 worktree 任务合并后，统一审查实现状态，准确更新 `docs/0619/loops设计` 下的实施标注与归档说明。

## 依赖

- 依赖 `TASK-01` 至 `TASK-07` 的实施回填。
- 可参考 `TASK-09` 的后置项清单。

## 本任务范围

- 深度审查最终代码。
- 核对 DB、API、Web、Loop 生命周期、doctor、测试是否真实完成。
- 更新 `IMPLEMENTATION-ANNOTATIONS.md`。
- 必要时在原始设计文档增加 v1 状态标注。
- 汇总每个 `TASK-xx` 的实施回填。

## 应检查的核心问题

- 是否仍然无登录可提交 Issue。
- Issue / Intake / LoopState 是否真实入库。
- DB 访问是否只发生在 DB Service 层。
- `.loops` 是否仍保留文档真相源。
- Loop 完成后 DB 与 `.loops` 是否都进入 CLOSED/finalized。
- doctor 是否能发现 DB 与 `.loops` 不一致。
- SSO/飞书/真实 PR 是否未误纳入 v1。

## 可能涉及文件

- `docs/0619/loops设计/IMPLEMENTATION-ANNOTATIONS.md`
- `docs/0619/loops设计/03-工作流设计.md`
- `docs/0619/loops设计/08-数据存储设计.md`
- `docs/0619/loops设计/09-实施路线图.md`
- `docs/0619/loops设计/10-决策与开放问题.md`
- `docs/0619/loops设计/todo/TASK-*.md`

## 验收标准

- 文档准确区分 `done` / `partial` / `not-started`。
- 每个完成的任务都有实施回填。
- 未完成或延期项不会被标成 done。
- 最终归档能指导下一阶段继续做 SSO、飞书、真实 PR、并发 worker。

## 验证建议

- `git diff -- docs/0619/loops设计`
- `rg -n "pending|blocked|not-started|SSO|飞书|PR|数据库|CLOSED" docs/0619/loops设计`
- 对照最终代码做人工审查。

## 禁止事项

- 不为了显得完成而提高状态。
- 不删除历史实施记录。
- 不把 todo 文档当作已实现证据，必须以代码和验证结果为准。

## 实施回填

- 状态：done
- 实施分支：main
- 关键改动：
  - 审查 Loops Prisma schema、contracts、API service/controller、Web 页面、doctor、CLI 与任务文档。
  - 更新 `IMPLEMENTATION-ANNOTATIONS.md`，新增 TASK-08 最终归档、状态矩阵、TASK 汇总、验证记录和下一阶段入口。
  - 回填 `TASK-01` 至 `TASK-09` 的实施状态，区分 `done` / `partial` / `not-started`。
  - 修复 `scripts/loops-cli.ts` 的分页列表适配问题，使 `pnpm loops:doctor` 不再被 `status` 分支的类型错误阻断。
- 验证命令：
  - `pnpm loops:doctor`
  - `pnpm loops:status`
  - `git diff -- docs/0619/loops设计`
  - `rg -n "pending|blocked|not-started|SSO|飞书|PR|数据库|CLOSED" docs/0619/loops设计`
- 验证结果：通过文档归档验收；doctor/status 可运行。实现状态结论为 partial：DB schema 已有，但 DB Service、双写、生命周期 DB 同步、DB doctor 和 DB smoke 未完成。
- 剩余风险：`IMPLEMENTATION-ANNOTATIONS.md` 下方仍保留历史较乐观的 round 1 标注；本次新增的“最终归档（TASK-08 / 2026-06-19）”应作为当前权威结论。
- 需要归档到 IMPLEMENTATION-ANNOTATIONS.md 的内容：
  - 已归档：v1 当前真实状态为 partial，下一阶段优先补 DB Service、Persistence 双写、生命周期 DB 同步、DB/.loops doctor 和 DB smoke。
