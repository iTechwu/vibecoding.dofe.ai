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

- 状态：not-started
- 实施分支：main
- 关键改动：
  - 文件侧生命周期已由 `LoopsService` 与 `LoopsFileStoreService` 更新 `.loops/state.json`。
  - 未发现任何 DB `LoopState` 或 `LoopIssue.status` 生命周期同步调用。
- 验证命令：
  - `rg -n "upsertState|writeSpec|writeShards|writeGlobalReview|writeFinalization|loopState|loopIssue" apps/api/src/modules/loops`
- 验证结果：未通过任务验收；只能确认 `.loops` 状态同步存在，DB 状态同步未实现。
- 剩余风险：队列和详情无法依赖 DB 稳定恢复 Loop 进展；finalize 后 DB 不会变为 CLOSED/finalized。
- 需要归档到 IMPLEMENTATION-ANNOTATIONS.md 的内容：
  - TASK-05 最终状态为 not-started：Loop 生命周期 DB 同步未落地，当前只有 `.loops` 文件状态更新。
