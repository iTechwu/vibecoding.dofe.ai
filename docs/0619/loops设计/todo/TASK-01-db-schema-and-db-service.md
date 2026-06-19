# TASK-01 · 数据库模型与 DB Service

## 任务目标

为 Loops v1 增加最小数据库持久化能力，让 Issue / Intake / LoopState 可入库、可查询、可被后续 API 和 Loop 生命周期同步使用。

## 依赖

- 依赖 `TASK-00` 的 v1 边界。
- 不依赖 Web 改造。

## 本任务范围

- 新增或扩展 Prisma schema，至少覆盖：
  - `LoopIssue`
  - `LoopIssueIntake`
  - `LoopState`
- 通过项目既有方式生成或暴露 DB Service。
- 如果现有 DB 生成链路被既有问题阻断，允许先建立 Loops 专用 DB Service，但 Prisma 访问仍必须封装在 DB Service 层。

## 建议字段

`LoopIssue`：

- `id`
- `title`
- `body`
- `status`
- `priority`
- `sourceChannel`
- `submitterProvider`
- `submitterId`
- `submitterName`
- `targetRepo`
- `createdAt`
- `updatedAt`
- `closedAt`

`LoopIssueIntake`：

- `id`
- `issueId`
- `sourceChannel`
- `sourceKind`
- `submitterProvider`
- `submitterId`
- `submitterName`
- `message`
- `rawPayload`
- `status`
- `createdAt`

`LoopState`：

- `id`
- `issueId`
- `phase`
- `round`
- `specVersion`
- `shardsTotal`
- `shardsDone`
- `shardsInProgress`
- `reloopCount`
- `costTokens`
- `costCalls`
- `paused`
- `finalized`
- `updatedAt`

## 可能涉及文件

- `apps/api/prisma/**`
- `apps/api/generated/db/**`
- `apps/api/src/**/db/**`
- `apps/api/src/modules/loops/**`

## 验收标准

- 数据库 schema 中存在 v1 所需 Loops 模型。
- API/Service 层没有直接 `prisma.write` / `prisma.read`。
- DB Service 提供创建 Issue、创建 Intake、创建/更新 LoopState、按状态查询 Issue 列表、按 issueId 查询详情的能力。
- 迁移或 schema 生成步骤被记录清楚。

## 验证建议

- `pnpm db:generate`
- `pnpm --filter @repo/api type-check`
- 若全量 type-check 因既有非 Loops 问题失败，需在回填中列明阻断来源，并提供 Loops 相关文件的局部验证。

## 禁止事项

- 不在 `LoopsService` 或 controller 中直接访问 Prisma。
- 不引入登录依赖字段作为必填外键。
- 不删除 `.loops` 文件存储逻辑。

## 实施回填

- 状态：done
- 实施分支：main
- 关键改动：
  - `apps/api/prisma/schema.prisma` 已包含 `LoopIssue`、`LoopIssueIntake`、`LoopState` 三个 Prisma model（`schema.prisma:251`、`:280`、`:303`），字段覆盖任务建议清单，并含软删除、索引与级联关系。
  - 迁移 `apps/api/prisma/migrations/20260619120000_add_loops_persistence/migration.sql` 已生成，与 schema 对齐（含 `loop_state_issue_id_key` 唯一索引与两张外键 `ON DELETE CASCADE`）。
  - 生成物 `apps/api/generated/db/modules/loops/loops-db.service.ts` 提供 `LoopsDbService extends TransactionalServiceBase`：事务化 `createIssue`（Issue+Intake+LoopState 三表同事务写入）、`createIntake`、`createLoopState`、`updateLoopState`、`updateIssueStatus`、`upsertLoopState`、`listIssuesByStatus`、`listIssues`（含 phase 关联过滤）、`listAllIssueStates`、`getIssueDetailByIssueId(OrThrow)`。
  - 配套生成 `loop-issue/loop-issue.service.ts`、`loop-issue-intake/loop-issue-intake.service.ts`、`loop-state/loop-state.service.ts` 与各自 module/index，统一经 `LoopsDbModule` 暴露并 import 进 `LoopsModule`。
  - Loops API/Service 层（`loops.service.ts`、`loops.controller.ts`）无 `prisma.read`/`prisma.write`/`PrismaService` 直接访问，全部经 `LoopsDbService`。
- 验证命令：
  - `rg -n "model LoopIssue|model LoopIssueIntake|model LoopState" apps/api/prisma/schema.prisma`
  - `rg -n "class LoopsDbService|createIssue|upsertLoopState|listIssues|getIssueDetailByIssueId" apps/api/generated/db/modules/loops/loops-db.service.ts`
  - `rg -n "prisma\\.read|prisma\\.write|new Prisma|PrismaService" apps/api/src/modules/loops -g '!**/*.map'`（应为空）
  - `pnpm --filter @repo/api type-check`（Loops 相关文件无错误；仅余既有非 Loops 阻断）
- 验证结果：通过；schema、迁移、DB Service 与查询/写入方法均存在且 type-check 干净；DB 运行期写入需 `pnpm db:migrate:deploy` + 可用 `DATABASE_URL` 后才能真正落库（属部署/本地验证步骤，非代码缺口）。
- 剩余风险：DB Service 为生成产物，重新 `pnpm db:generate` 时若生成器逻辑变化需复核；DB 运行期写入未在本环境实跑。
- 需要归档到 IMPLEMENTATION-ANNOTATIONS.md 的内容：
  - TASK-01 升级为 done：DB model、迁移、`LoopsDbService`（含事务化三表写入与查询/详情）均已落地；DB 运行期写入待迁移后验证。
