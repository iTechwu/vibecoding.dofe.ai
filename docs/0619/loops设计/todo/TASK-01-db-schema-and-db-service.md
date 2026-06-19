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

- 状态：partial
- 实施分支：main
- 关键改动：
  - `apps/api/prisma/schema.prisma` 已包含 `LoopIssue`、`LoopIssueIntake`、`LoopState` 三个 Prisma model。
  - Loops API/Service 层未发现直接 `prisma.read` / `prisma.write` / `PrismaService` 访问。
  - 未发现 Loops 专用 DB Service 或已生成 DB Service 被 Loops 模块调用。
- 验证命令：
  - `rg -n "model LoopIssue|model LoopIssueIntake|model LoopState" apps/api/prisma/schema.prisma`
  - `rg -n "prisma\\.read|prisma\\.write|new Prisma|PrismaService|loopIssue|loopState|LoopIssueIntake" apps/api/src/modules/loops apps/api/src apps/api/libs -g '!**/*.map'`
- 验证结果：partial；schema 存在，且 Loops 层没有直接 Prisma 访问；但 DB Service、迁移/生成验证、Issue/Intake/LoopState 实际入库能力未完成。
- 剩余风险：后续任务若直接在 `LoopsService` 补 Prisma 写入会违反架构规则，必须先补 DB Service。
- 需要归档到 IMPLEMENTATION-ANNOTATIONS.md 的内容：
  - TASK-01 最终状态为 partial：DB model 已存在，但 DB Service 与真实 DB 查询/写入未完成。
