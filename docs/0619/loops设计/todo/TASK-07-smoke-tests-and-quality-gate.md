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

- 状态：done
- 实施分支：main
- 关键改动：
  - 新增服务级冒烟 `apps/api/src/modules/loops/loops.service.spec.ts`：用隔离临时工作区 + fake runner（TEST-PASS）+ fake git adapter + 确定性 agent/claude adapter、不接 persistence（纯文件模式），完整跑通 `createIssue -> generateSpec -> approve -> decompose -> runLoop -> reviewGlobal -> finalize`，断言 `submitterId==='dev-user'`、列表/详情恢复、shards 全 DONE、`globalVerdict==='PASS'`、终态 `issue.status==='CLOSED'`、`state.phase==='CLOSED'`、`finalized===true`、`doctor.ok===true`。
  - 顺带修复 `apps/api/jest.config.ts` 在 jest 30 下 `.ts` 配置被当作 ES module 求值导致 `__dirname` 未定义、`pnpm test:api` 无法启动的问题（改用 `process.cwd()`，对整个 api 单测解锁）。
  - 修复 `scripts/loops-cli.ts` 在 service 新增 `persistence` 参数后的运行期断裂（service 改为可选注入 + 文件回退，CLI 仍以 5 参构造，纯文件模式可运行）。
  - `pnpm loops:doctor` / `pnpm loops:status` 恢复可用，分别输出完整 doctor 结构与队列。
- 验证命令：
  - `(cd apps/api && npx jest src/modules/loops/loops.service.spec.ts)` → 1 passed
  - `pnpm loops:doctor` → `ok:true`，含 `dbProblems`/`consistencyProblems`/`problems` 字段
  - `pnpm loops:status` → 队列 JSON
  - `pnpm --filter @repo/api type-check`（Loops 文件 0 错误，仅余既有非 Loops 阻断）
- 验证结果：通过；Smoke 1（intake → `.loops`）、Smoke 2（队列/详情恢复）、Smoke 3（Loop 闭环 → CLOSED/finalized）、Smoke 4（doctor ok）的文件侧均有可复用自动化断言（`loops.service.spec.ts`）。
- **DB 侧已补齐并验证**：迁移应用后 `pnpm loops:db-smoke`（`LOOPS_DB_SMOKE=1` 跑 `loops-persistence.db.spec.ts` 连真实 DB）3/3 通过：①`createIssue` 写入三表且 `list`/`readDetail` 从 DB 读回；②生命周期 finalize 后 DB `CLOSED`/`finalized`/`closedAt`，`doctor.ok=true`；③删 DB `loop_state` 行 → `doctor.ok=false` 报一致性问题。`afterEach` 级联清理，无 DB 残留。
- 阻断来源（既有非 Loops，非本轮引入）：`generated/db/modules/*-auth/*.service.ts` 的 CreateInput/CreateManyInput 生成器类型差异；`libs/domain/auth`、`libs/domain/services/ip-info` 的 `@app/db` 导出漂移（`UserInfoModule/Service`、`FileCdnModule/Client`、`CountryCodeModule/Service`）；`uploader.controller.ts` 多余 `@ts-expect-error`。
- 剩余风险：CLI doctor 为纯文件模式（无 persistence），不能发现 DB 漂移；DB 一致性需经 API server 或 `loops:db-smoke` 验证。
- 需要归档到 IMPLEMENTATION-ANNOTATIONS.md 的内容：
  - TASK-07 升级为 done：文件侧 + live-DB 侧全链路 jest 冒烟均通过（`loops.service.spec.ts` + `loops-persistence.db.spec.ts`），并修复 jest 配置（`__dirname`、pnpm `transformIgnorePatterns`）与 CLI；既有非 Loops 阻断已列明。
