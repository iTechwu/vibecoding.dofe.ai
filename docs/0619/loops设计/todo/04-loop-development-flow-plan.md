# 04 · Loop 开发闭环计划

## 目标

让一个数据库中的 Issue 进入现有 Loop 编排，并最终完成代码开发闭环。

## v1 主流程

```text
DB Issue OPEN
  -> .loops Issue/Intake/State
  -> Generate Spec
  -> Human approve
  -> Decompose
  -> Run Loop until shards DONE
  -> Global Regression
  -> Global Review
  -> Finalize
  -> DB Issue CLOSED
```

## Phase 0 · Issue 入库

输入来自 Web 表单。创建后同时存在：

- DB `LoopIssue`
- DB `LoopIssueIntake`
- DB `LoopState`
- `.loops/issues/<id>.json`
- `.loops/intakes/<id>.json`
- `.loops/intakes/<id>.raw.json`
- `.loops/state.json`

## Phase 1 · Spec 生成

复用现有 `LoopsService.generateSpec()`。

v1 要求：

- 生成后同步 DB LoopState `phase/specVersion/costCalls`。
- Spec 仍写 `.loops/specs`。
- 默认 deterministic adapter 可用于开发；CLI adapter 通过 env 开关启用。

## Phase 2 · 审核

第一版仍保留人工审核门禁，但不需要登录。

v1 行为：

- reviewer 默认 `human`。
- Approve 后进入 decompose。
- Request revision 可后置优化，但现有能力保留。

## Phase 3 · 拆解

复用现有 `decompose()`：

- 生成 shards。
- 生成 Test Matrix。
- 写 annotations。
- context_budget 硬拦截已在调度前存在。

v1 需要补强：

- 拆解后同步 DB LoopState `shardsTotal`。
- 如果 shard 超预算，优先在 decompose 阶段暴露 warning，避免 run 阶段才 BLOCKED。

## Phase 4-5 · 实施、测试、审查

复用现有 `runLoop()`：

- `max_parallel=1` 作为 v1 默认。
- 依赖满足才运行。
- Claude adapter 生成 Implementation Record。
- Runner 写 Test Record。
- Codex reviewTests + review 后决定 DONE / NEEDS-WORK / FAILED。

v1 重点：

- 每次 run 后同步 DB LoopState。
- 若 shard DONE，同步 shardsDone。
- 若成本熔断/预算超限/redo 超限，DB paused/phase 同步。

## Phase 7 · 全局回归和整体复查

现有计划已接入：

- `tests.regression_commands`
- `__global__` Test Record
- `GLOBAL_REGRESSION` log
- regression fail -> Global Review NEEDS-WORK

v1 默认命令：

```yaml
tests:
  regression_commands:
    - pnpm lint
```

后续再扩为 build / e2e。

## Phase 8 · 终态标注和关闭

复用现有 `finalize()`：

- Codex annotateFinalize。
- convergence-pr record。
- issue status CLOSED。

v1 必补：

- DB Issue.status = CLOSED。
- DB LoopState.phase = CLOSED。
- DB LoopState.finalized = true。

## 运行方式

v1 可以先支持手动逐步推进：

1. Generate Spec
2. Approve
3. Decompose
4. Run
5. Run until all DONE
6. Global Review
7. Finalize

后续增加 `Run to completion` 一键按钮。

## 验收

- 从 DB Issue 详情页能完整推进到 CLOSED。
- 每个阶段 `.loops` 产物齐全。
- DB LoopState 与 `.loops/state.json` 主要字段一致。
- 回归失败时不会 finalize。
- finalize 后 detail 中有终态 annotations。

