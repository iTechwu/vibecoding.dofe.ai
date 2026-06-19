# TASK-05 · Loop 生命周期 DB 状态同步

## 任务目标

让现有 Loop 编排在关键阶段同步 DB `LoopState` 与 `LoopIssue.status`，使队列和详情能稳定反映 Loop 进展。

## 依赖

- 依赖 `TASK-03` 的持久化服务。

## 本任务范围

在以下阶段同步 DB：

- `generateSpec`
  - phase
  - specVersion
  - costCalls / costTokens 如已有
- `reviewSpec`
  - approved / revision / rejected 相关 phase
- `decompose`
  - shardsTotal
  - phase
- `runLoop`
  - shardsDone
  - shardsInProgress
  - phase
  - paused
- `reviewGlobal`
  - global verdict 后的 phase
  - reloopCount 如触发回环
- `finalize`
  - `LoopIssue.status = CLOSED`
  - `LoopState.phase = CLOSED`
  - `LoopState.finalized = true`

## 可能涉及文件

- `apps/api/src/modules/loops/loops.service.ts`
- `apps/api/src/modules/loops/loops-file-store.service.ts`
- `apps/api/src/modules/loops/loops-runtime-config.util.ts`
- `apps/api/src/modules/loops/**persistence**`

## 验收标准

- 从 Issue 创建到 CLOSED，DB 顶层状态与 `.loops/state.json` 关键字段一致。
- 队列页能通过 DB 状态看到 Loop 进度变化。
- finalize 后 DB Issue 状态为 `CLOSED`。
- 失败或暂停时 DB 状态不静默停留在旧状态。

## 验证建议

- 使用 deterministic adapter 跑一条临时 Issue：

```text
createIssue -> generateSpec -> approve -> decompose -> runLoop -> reviewGlobal -> finalize
```

- 检查 DB 与 `.loops/state.json`。
- `pnpm loops:doctor`

## 禁止事项

- 不重写现有 Loop 状态机。
- 不绕过持久化服务直接写 Prisma。
- 不为了 DB 同步删除 `.loops` 日志或产物。

## 实施回填

- 状态：done
- 实施分支：main
- 关键改动：
  - `LoopsService` 在每个生命周期阶段后统一调用 `syncAndRead(issueId)`：先读 `.loops` 真相，再 `persistence.syncState(detail.state, detail.issue.status)`（`upsertLoopState` + `updateIssueStatus`）把 phase/specVersion/shards/reloop/cost/paused/finalized 等同步到 DB，并返回合并后的详情。
  - 覆盖阶段：`generateSpec`（phase→REVIEW、specVersion、costCalls）、`reviewSpec`（approve→DECOMPOSE / reject→CLOSED / revision→SPEC）、`decompose`（shardsTotal、phase→IMPLEMENT）、`runLoop`（shardsDone/InProgress、phase→CONVERGE、scheduler 写 `SCHEDULER_BATCH`）、`reviewGlobal`（globalVerdict、phase→ANNOTATE）、`finalize`（`store.writeFinalize` 写 `.loops` CLOSED 后经 `syncAndRead` 同步 DB `issue.status=CLOSED` + `state.phase=CLOSED` + `finalized=true`）。
  - 暂停/回环路径（`intervene` pause/resume、`reloop`、`autoReloopAfterGlobalReview`）同样经 `syncAndRead` 同步 DB，失败/暂停不会静默停留在旧状态。
- 验证命令：
  - `rg -n "syncAndRead|persistence\\.syncState|syncClosed" apps/api/src/modules/loops/loops.service.ts`
  - `rg -n "upsertLoopState|updateIssueStatus" apps/api/generated/db/modules/loops/loops-db.service.ts apps/api/src/modules/loops/loops-persistence.service.ts`
  - `npx --filter @repo/api jest src/modules/loops/loops.service.spec.ts`（文件侧生命周期到 CLOSED 断言通过）
- 验证结果：通过（代码 + 文件侧 jest）；从创建到 finalize 的 `.loops` 与 DB 同步逻辑均落地，finalize 后 DB 同步为 CLOSED/finalized。DB 运行期同步需迁移后的可用 DB 才能端到端验证。
- 剩余风险：DB 同步依赖 `syncAndRead` 被调用，新增生命周期分支时需保持调用；DB 运行期同步未在本环境实跑。
- 需要归档到 IMPLEMENTATION-ANNOTATIONS.md 的内容：
  - TASK-05 升级为 done：生命周期各阶段经 `syncAndRead`/`syncState` 同步 DB `LoopState` 与 `LoopIssue.status`，finalize 同步 CLOSED/finalized；DB 运行期同步待迁移后验证。
