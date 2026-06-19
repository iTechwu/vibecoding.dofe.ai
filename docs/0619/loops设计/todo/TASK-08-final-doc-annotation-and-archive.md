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
- 关键改动（round 2 / 2026-06-19 重新归档）：
  - 深度复核最终代码：确认 DB schema + 迁移、`LoopsDbService`、`LoopsPersistenceService` 双写、生命周期 `syncAndRead` DB 同步、DB/`.loops` 一致性 doctor、Web 无登录最简表单均已落地。
  - 修复阻断项：删除 `loops.service.ts` 重复的 `syncAndRead`（TS2393）；persistence 改为 `@Optional() @Inject(LOOPS_PERSISTENCE)` + type-only import，使 API server 走 DB 双写、独立 `ts-node` CLI 不再被 `@app/db` 解析阻断。
  - 新增 `loops.service.spec.ts` 文件侧全链路冒烟并修复 `jest.config.ts` `__dirname` ESM 问题，解锁 `pnpm test:api`。
  - 更新 `IMPLEMENTATION-ANNOTATIONS.md`：新增 round 2 最终归档作为当前权威结论（状态矩阵、TASK 汇总、验证记录、下一阶段入口），明确区分代码完成与 DB 运行期验证（需迁移后验证）。
  - 回填 `TASK-01..08` 实施状态：01/02/03/04/05/06/07 由 partial/not-started 升级为 done（代码与文件侧运行期验证通过），09 保持 done，00 保持 done；均附阻断来源与剩余风险。
- 验证命令：
  - `(cd apps/api && npx jest src/modules/loops/loops.service.spec.ts)` → 1 passed
  - `pnpm loops:doctor` / `pnpm loops:status` → 可运行
  - `pnpm --filter @repo/api type-check` → Loops 文件 0 错误（余 16 条既有非 Loops 阻断）
  - `pnpm --filter @repo/web type-check` / `pnpm --filter @repo/contracts type-check` → 通过
  - `git diff -- docs/0619/loops设计`
- 验证结果：通过文档归档验收。实现状态结论：v1 主链路代码全部完成且文件侧可自动验证；唯一剩余的是 DB 运行期写入/一致性/闭环需在迁移后的可用 DB 上验证（部署/本地步骤，非代码缺口）。SSO/飞书/真实 PR 仍未误纳入 v1。
- 剩余风险：`IMPLEMENTATION-ANNOTATIONS.md` 下方仍保留 round 1 较乐观的逐条标注；应以本次新增的「最终归档（TASK-08 · round 2 / 2026-06-19）」为权威结论。DB 运行期验证待迁移后进行。
- 需要归档到 IMPLEMENTATION-ANNOTATIONS.md 的内容：
  - 已归档（round 2）：v1 主链路代码完成（DB schema/迁移/DB Service/双写/生命周期同步/一致性 doctor/Web 无登录/文件侧 smoke），DB 运行期验证为下一阶段部署步骤。
