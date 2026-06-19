# TASK-07 · 冒烟测试与质量门禁

## 任务目标

为 v1 主链路补齐可重复执行的冒烟验证，证明「无登录提交 Issue -> 入库 -> Loop 开发闭环 -> CLOSED」可用。

## 依赖

- 依赖 `TASK-03`
- 依赖 `TASK-04`
- 依赖 `TASK-05`
- 依赖 `TASK-06`

## 本任务范围

- 新增或整理服务级/脚本级冒烟测试。
- 明确全量质量门禁与已知阻断。
- 记录最小人工验证流程。

## 必须覆盖的 Smoke

### Smoke 1 · 无登录 Issue 入库

- 未登录提交 Issue。
- DB 存在 `LoopIssue`。
- DB 存在 `LoopIssueIntake`。
- DB 存在初始 `LoopState`。
- `.loops` 中存在 issue/intake/state/log。

### Smoke 2 · 队列与详情恢复

- 刷新 `/loops` 后 Issue 仍存在。
- 进入详情可读取 `.loops` detail。
- 顶层状态来自 DB 不丢失。

### Smoke 3 · Loop 闭环

- `generateSpec`
- `approve`
- `decompose`
- `runLoop`
- `reviewGlobal`
- `finalize`
- 最终 DB Issue 为 `CLOSED`。

### Smoke 4 · Doctor 一致性

- 正常状态 doctor ok。
- 临时制造不一致时 doctor not ok。

## 可能涉及文件

- `apps/api/src/modules/loops/**/*.spec.ts`
- `scripts/loops-cli.ts`
- `docs/0619/loops设计/IMPLEMENTATION-ANNOTATIONS.md`
- `docs/0619/loops设计/todo/TASK-*.md`

## 验收标准

- 至少有一条可复用的命令或测试说明能跑通 v1 主链路。
- 验证结果能区分 Loops 新增问题与既有非 Loops type-check 阻断。
- 测试数据创建与清理方式明确。

## 验证建议

- `pnpm --filter @repo/web type-check`
- `pnpm --filter @repo/api type-check`
- `pnpm loops:doctor`
- 如 API type-check 被既有生成物/infra 问题阻断，需记录具体错误摘要。

## 禁止事项

- 不把手工验证伪装成自动化测试。
- 不留下临时 Issue、DB 脏数据或 `.loops` 测试产物。
- 不因既有非 Loops 问题回退本轮 Loops 改动。

## 实施回填

- 状态：partial
- 实施分支：main
- 关键改动：
  - 修复 `scripts/loops-cli.ts` 的 `status` 命令，使其适配当前分页 `LoopListResponse`，避免 ts-node 编译阻断 `loops:doctor/status`。
  - 记录当前可运行的 CLI doctor/status 验证结果。
  - 未新增覆盖 DB 入库闭环的自动化 smoke。
- 验证命令：
  - `pnpm loops:doctor`
  - `pnpm loops:status`
- 验证结果：partial；两个命令均可运行，当前 `.loops` 空状态 doctor OK；但未覆盖“无登录提交 -> DB 入库 -> Loop CLOSED”的 v1 主链路。
- 剩余风险：DB Service/双写缺失导致 Smoke 1/2/3/4 的 DB 部分均无法验证。
- 需要归档到 IMPLEMENTATION-ANNOTATIONS.md 的内容：
  - TASK-07 最终状态为 partial：CLI doctor/status 恢复可用，但 DB 入库与 DB/.loops 一致性 smoke 未完成。
