# Loops v1 后续待办（2026-06-19）

> 本目录在 Loops v1 主链路**代码完成且经文件侧 + live-DB 冒烟验证**之后，整理出后续的待实施项、待优化项与未落实（后置）项。
> 权威实现状态见 [`docs/0619/loops设计/IMPLEMENTATION-ANNOTATIONS.md`](../loops设计/IMPLEMENTATION-ANNOTATIONS.md) 的「最终归档（TASK-08 · round 2）」。

## 当前已验证结论（round 12 / 2026-06-20）

- v1 主链路（无登录 Web 提交 → DB 三表入库 → `.loops` 真相源 → Loop 开发闭环 → 整体复查/终态标注 → CLOSED）代码全部落地。
- `pnpm loops:db-smoke`（连真实 DB）3/3 通过：三表写入、生命周期 CLOSED/finalized、doctor 一致性告警。
- `(cd apps/api && npx jest src/modules/loops)`：文件侧 1 passed、DB 侧默认 skip（`LOOPS_DB_SMOKE=1` 启用）。
- **round 4 后**：`pnpm --filter @repo/api type-check` 通过；`pnpm loops:doctor` / `pnpm loops:db-doctor` 均返回 `ok: true`；`pnpm --filter @repo/api exec jest src/modules/loops --runInBand` 文件侧通过、DB 侧默认 skip。
- **round 5 后**：`pnpm check:list-contracts` 通过；`TaskListResponseSchema` 已改为标准 `PaginatedResponseSchema(SystemTaskSchema)`。
- **round 6 后**：`taskContract.getTaskList` 已补 `TaskListQuerySchema`（基于 `PaginationQuerySchema`），Web `useTaskList()` 已传默认 `{ page: 1, limit: 20 }`；`pnpm --filter @repo/api type-check`、`pnpm --filter @repo/web type-check`、`pnpm check:list-contracts`、Loops Jest、`loops:doctor`、`loops:db-doctor` 均通过。
- **round 7 后**：contracts 测试已从历史 team/space/file/recycle-bin 导出快照改为校验当前公共导出面；`pnpm --filter @repo/contracts test` 与 `pnpm --filter @repo/contracts typecheck` 均通过。
- **round 8 后**：Loops CLI adapter 与 API bootstrap 中命中的 `as any` 已收敛为 `unknown`/Fastify 明确类型；`pnpm --filter @repo/api type-check`、Loops Jest、`loops:doctor`、`loops:db-doctor` 均通过。`pnpm check:architecture` 当前仅剩 auth/SSO 迁移范围命中（`resource-owner.guard.ts` 的 Nest Logger、`streaming-asr-session.guard.ts` 的 `as any`），不在本目录继续处理。
- **round 9 后**：`packages/utils` 历史 hygiene 基线已清零，生产代码无 `console.*` / `any` 新命中；`pnpm --filter @repo/utils typecheck`、`pnpm --filter @repo/utils test`、`pnpm check:utils-hygiene` 均通过。
- **round 10 后**：复核 `OPT-3` / `OPT-5` 后维持 accepted 决策：业务代码未引用 Loops per-model 生成 DB Service，实际访问集中在 `LoopsDbService`；API Jest config 的 `process.cwd()` 依赖已有注释约束且 `jest --showConfig` 确认从 `apps/api` 解析正确。上述两项不作为待实施阻断。
- **round 11 后**：再次深度复审本目录，无新的非 SSO/file 待实施项；`api/web/contracts/utils` type-check、contracts/utils tests、Loops Jest、`loops:doctor`、`loops:db-doctor`、list/sensitive/utils gates 均通过。
- **round 12 后**：回归复核发现 `docs/0619/sso` 迁移进程（已推进至第十二轮）已修复此前阻断 `check:architecture` 的 auth/SSO 命中——`resource-owner.guard.ts` 改注入 Winston `WINSTON_MODULE_PROVIDER` Logger（不再用 Nest 内置 Logger）、`streaming-asr-session.guard.ts` 已移除 `as any`。**`pnpm check:architecture` 与 `pnpm quality:gate` 现已全绿**，本目录此前记录的「quality:gate 被 auth/SSO 短路」结论已失效。
- **round 13 后**：SSO 迁移已提交、`generated/db` 落定，实施 **OPT-3**——`LoopIssue`/`LoopIssueIntake`/`LoopState` 加入 `generate-db-crud.js` 的 `EXCLUDE_MODELS`，删除 3 个孤儿生成目录并由 `ensureExportsInIndex` 收敛 `index.ts`。回归全绿（`quality:gate` 6/6、`loops:doctor`、Loops Jest、API type-check）。本目录待优化项仅剩 `OPT-5`（accepted，非阻断）。
- `pnpm quality:gate` ✅ 全绿：`check:architecture` / `check:list-contracts` / `check:sensitive-logs` / `check:utils-hygiene` / `type-check` 五步全部通过；本目录在 Loops v1 收尾范围内已无任何质量门禁阻断。
- SSO 与 file 唯一真源迁移当前由另一个进程在 `docs/0619/sso` 范围处理（当前进度见 [`docs/0619/sso/09-implementation-status.md`](../sso/09-implementation-status.md)）；本目录只标注 Loops v1 收尾与非 SSO/file 的质量事项。

## 分类口径

| 分类     | 含义                                             | 文件                                                   |
| -------- | ------------------------------------------------ | ------------------------------------------------------ |
| 待实施项 | 有明确代码改动、阻断质量门禁或功能闭环的具体任务 | [01-to-implement.md](01-to-implement.md)               |
| 待优化项 | 已可用但有健壮性/可维护性/可移植性改进空间       | [02-to-optimize.md](02-to-optimize.md)                 |
| 未落实项 | 明确不在 v1 范围、按路线图后置到 v1.1+ 的能力    | [03-not-yet-implemented.md](03-not-yet-implemented.md) |

## 优先级总览（建议执行顺序）

| #   | 项                                                     | 分类   | 优先级 | 理由                                                              |
| --- | ------------------------------------------------------ | ------ | ------ | ----------------------------------------------------------------- |
| 1   | ~~修复既有非 Loops type-check 阻断~~                   | 待实施 | P0     | ✅ round 6 API/Web type-check 通过；SSO/file 真源迁移不纳入本目录 |
| 2   | ~~`generated/db/index.ts` 去重导出 + 生成器去重~~      | 待实施 | P1     | ✅ round 3 已完成                                                 |
| 3   | ~~CLI 可选 DB 模式（doctor/status 能查 DB）~~          | 待优化 | P2     | ✅ `loops:db-status` / `loops:db-doctor` 已落地并验证             |
| 4   | ~~DB 写失败补偿/标记策略明确化~~                       | 待优化 | P2     | ✅ 已在 `08-数据存储设计.md` 记录 v1 runbook                      |
| 5   | ~~裁剪冗余 per-model 生成 DB Service~~                 | 待优化 | P3     | ✅ round 13 已完成（`EXCLUDE_MODELS` + 删除 3 个孤儿目录）        |
| 6   | ~~Web 表单 `targetRepo` 默认值可移植化~~               | 待优化 | P3     | ✅ round 3 已完成（服务端解析仓库根）                             |
| 7   | `jest.config.ts` `process.cwd()` 依赖收敛              | 待优化 | P3     | 🟡 accepted：round 10 复核 showConfig 正常，维持注释约束          |
| 8   | ~~Task list query/response 标准化闭环~~                | 待优化 | P3     | ✅ `TaskListQuerySchema` + Web 默认分页参数已补齐                 |
| 9   | ~~Contracts 测试历史导出快照收敛~~                     | 待优化 | P3     | ✅ 当前 contract/schema/error 公共面测试与 typecheck 已通过       |
| 10  | ~~Loops/API bootstrap architecture `any` 收敛~~        | 待优化 | P3     | ✅ Loops adapter 与 `main.ts` 已无 `as any` 命中                  |
| 11  | ~~`packages/utils` hygiene 历史基线清理~~              | 待优化 | P3     | ✅ 无 `console.*` / `any` 命中，utils typecheck/test 通过         |
| 12  | Dofe SSO / 角色权限                                    | 未落实 | v1.1   | TASK-09 后置                                                      |
| 13  | 飞书入口/审批/反向通知                                 | 未落实 | v1.2   | TASK-09 后置                                                      |
| 14  | 真实远端 PR / 多 Loop 并行 / 独立 worker 池 / 生产告警 | 未落实 | v1.3   | TASK-09 后置                                                      |

> 注：round 13 实施后，本目录无新的 Loops v1 P0/P1 待实施项；`pnpm quality:gate` 全绿；`OPT-3` 已 done（round 13），仅剩 `OPT-5` 维持 accepted/deferred，不作为阻断。
