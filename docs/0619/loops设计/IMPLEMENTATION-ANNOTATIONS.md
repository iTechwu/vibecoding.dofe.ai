# Loops 实施标注（2026-06-19）

> 标注口径：本文件记录本轮代码实施后的真实状态。`done` 表示已落到代码且可调用；`partial` 表示 MVP 骨架已落地但仍有明确缺口；`not-started` 表示文档要求尚未实施。

## 最终归档（TASK-08 / 2026-06-19）

```yaml
archive_round: TASK-08
impl_status: partial
test_status: partial
verdict: needs-work
source_of_truth: ".loops 文件与 log.jsonl 仍为文档真相源；DB 目前只完成 schema 草案，尚未成为可用索引"
verified_at: 2026-06-19
```

### 最终状态矩阵

| 范围 | 状态 | 代码/文档位置 | 最终判断 |
| --- | --- | --- | --- |
| v1 边界固化 | done | `03-工作流设计.md`, `08-数据存储设计.md`, `09-实施路线图.md`, `todo/TASK-00...` | 已明确 v1 不做真实登录/SSO、飞书、真实远端 PR、多 worker 生产并发，`.loops` 仍为真相源。 |
| DB schema | partial | `apps/api/prisma/schema.prisma` | 已存在 `LoopIssue`、`LoopIssueIntake`、`LoopState` Prisma model；未看到迁移/生成物验证与 Loops DB Service。 |
| DB Service / DB 读写 | not-started | `apps/api/src/modules/loops/**` | Loops 模块未注入 DB Service，也没有 `LoopIssue`/`LoopState` 表读写；API/Service 层没有直接 Prisma 访问，符合“不直连 Prisma”，但核心入库能力未完成。 |
| Contract / API 表面 | partial | `packages/contracts/src/schemas/loops.schema.ts`, `packages/contracts/src/api/loops.contract.ts`, `apps/api/src/modules/loops/loops.controller.ts` | Zod-first contract、`POST /loops/issues`、分页 `GET /loops/issues` 已存在；submitter 虽为可选 schema，但服务端仍依赖 `submitterId/submitterName` 或前端 mock 值，且列表仍来自 `.loops` 而非 DB。 |
| `.loops` 文档真相源 | done | `apps/api/src/modules/loops/loops-file-store.service.ts`, `.loops/config.yaml` | Issue/Intake/State/Spec/Shard/Test/Review/Annotation/log/Notification 等文件存储与 doctor 文件检查可用。 |
| DB + `.loops` 双写 | not-started | `apps/api/src/modules/loops/loops.service.ts` | `createIssue` 只写 `.loops`，未写 DB Issue/Intake/LoopState；未实现 `LoopsPersistenceService` 或等价双写编排。 |
| Web 无登录提交 | partial | `apps/web/app/loops/new`, `apps/web/app/loops`, `apps/web/lib/api/loops.ts` | Web 页面无显式登录守卫，提交后跳详情；但表单仍展示 Submitter ID/Name mock 字段，队列数据来自文件 backed API，不是 DB 索引。 |
| Loop 生命周期文件状态 | partial | `apps/api/src/modules/loops/loops.service.ts`, `loops-file-store.service.ts` | Spec、decompose、runLoop、global-review、reloop、finalize 能同步 `.loops/state.json`；没有同步 DB `LoopState` / `LoopIssue.status`。 |
| Loop 完成 CLOSED/finalized | partial | `LoopsService.finalize`, `LoopsFileStoreService.writeFinalization` | 文件侧可 CLOSED/finalized 并写终态标注/收敛 PR record；DB 侧 CLOSED/finalized 未实现。 |
| Doctor 一致性 | partial | `LoopsFileStoreService.doctor`, `pnpm loops:doctor` | 文件完整性、shard/annotation/finalized 终态检查可用；DB 与 `.loops` 一致性检查未实现。 |
| Smoke / 质量门禁 | partial | `pnpm loops:doctor`, `pnpm loops:status`, 文档回填 | 当前验证了 CLI doctor/status 可运行；未完成“无登录提交 -> DB 入库 -> Loop CLOSED”的可重复 DB 冒烟。 |
| SSO / 飞书 / 真实 PR | not-started | `TASK-09`, 设计文档 v1 裁剪说明 | 未误纳入 v1；后续阶段继续推进。 |

### TASK 汇总

| Task | 状态 | 归档结论 |
| --- | --- | --- |
| TASK-00 | done | v1 范围、DB 与 `.loops` 边界、后置项口径已写入设计文档。 |
| TASK-01 | partial | Prisma model 已有；DB Service、迁移/生成验证、Loops DB 查询写入未完成。 |
| TASK-02 | partial | Contract/API surface 基本存在；服务端默认 submitter 与 DB-backed list/detail 边界未完成。 |
| TASK-03 | not-started | 未实现 DB + `.loops` 双写持久化服务。 |
| TASK-04 | partial | Web 无登录/mock 提交流程可用骨架存在；仍有 mock submitter 字段与 DB 缺口。 |
| TASK-05 | not-started | Loop 生命周期未同步 DB 状态。 |
| TASK-06 | partial | `.loops` doctor 可用；DB 一致性 doctor 未完成。 |
| TASK-07 | partial | CLI doctor/status 已验证；DB 入库闭环 smoke 未完成。 |
| TASK-08 | done | 已完成最终审查、文档归档与任务回填。 |
| TASK-09 | done | 后置项清单清楚，未把 SSO/飞书/真实 PR 纳入 v1。 |

### 本轮验证记录

- `rg -n "prisma\\.read|prisma\\.write|new Prisma|PrismaService|loopIssue|loopState|LoopIssueIntake" apps/api/src/modules/loops apps/api/src apps/api/libs -g '!**/*.map'`：未发现 Loops 模块直接 Prisma 访问，也未发现 Loops DB Service 读写入口。
- `pnpm loops:doctor`：通过；输出 `ok=true`，当前 `.loops` root 存在，`loops=0`、`issues=0`、`problems=[]`。
- `pnpm loops:status`：通过；输出 `issues=0`、`loops=[]`。
- 修复验证前阻断：`scripts/loops-cli.ts` 的 `status` 命令已适配当前分页 `LoopListResponse`，避免 ts-node 编译时阻断 doctor/status。

### 下一阶段入口

1. 先补 `LoopsDbService` 或接入项目生成的 DB Service，封装 `LoopIssue`、`LoopIssueIntake`、`LoopState` 的 create/update/list/detail。
2. 增加 `LoopsPersistenceService`，统一执行 DB + `.loops` 双写，并定义 DB 成功但文件失败时的补偿策略。
3. 将 `createIssue`、`list`、关键生命周期状态更新切到持久化服务；doctor 增加 DB 与 `.loops` 双向一致性检查。
4. 再补可重复 smoke：无登录提交、DB 三表存在、刷新队列、闭环 finalize 后 DB 与 `.loops` 都 CLOSED/finalized。

## 总体状态

```yaml
target: loops-mvp
annotator: codex
round: 1
impl_status: in-progress
test_status: partial
verdict: needs-work
coverage: partial
location:
  - packages/contracts/src/schemas/loops.schema.ts
  - packages/contracts/src/api/loops.contract.ts
  - apps/api/src/modules/loops
  - apps/web/app/loops
  - scripts/loops-cli.ts
  - .loops/config.yaml
risk: medium
notes: 已完成 M0/M1 的 Web Issue、Spec 审核门禁、基础拆解、.loops 文件真相源、状态诊断/恢复、Test Matrix 派生、Implementation Record 登记、Runner 测试证据写入、Review Record 门禁、日志查询、成本熔断骨架、通知记录 MVP、人工介入 pause/resume/take 和标注看板骨架；当前代码还具备 runLoop 调度、Codex reviewTests/review/reviewGlobal/annotateFinalize 抽象、回环 reloop、终态 finalize、GitAdapter commit-per-shard/收敛 PR 记录与 CLI/Web 操作入口。本轮继续修正：真实 Codex CLI plan/decompose/review/reviewGlobal 输出走 Zod schema 校验后 fallback，Claude Code CLI implementation 输出也走 Zod schema 校验后 fallback；Codex/Claude CLI 非零退出与 schema 不合规会按 `.loops/config.yaml` 的 `max_retry` 受控重试，`LOOPS_MAX_RETRY` 可显式覆盖；reloop 最大次数读取 `.loops/config.yaml` 的 `max_reloop`；global review 增加当前 round 全 shard 证据门禁、runLoop 实施记录后接入成本熔断、终态标注补齐 Test Matrix / Global Review / Convergence PR 文档节点；doctor 增强为可检查 shard 计数/状态、annotation 目标覆盖和 finalized loop 的终态标注完整性；Runner 默认测试命令改为结构化读取 `.loops/config.yaml` 的 `tests.default_commands`，创建 Issue 时将 `targetRepo` 规范化为绝对路径并校验位于工作区根或 `LOOPS_ALLOWED_REPO_ROOTS` 白名单内，Runner 执行、Claude CLI 的 `cwd/--add-dir`、GitAdapter 的 checkout/add/commit/push 均复用同一策略；Runner `tests.allowed_commands` 命令白名单、`coverage_floor` 配置读取、常见 coverage 摘要解析、覆盖率低于阈值或缺失时阻断 TEST-PASS，并在 Test Record Markdown 与 Web 详情展示覆盖率；`max_shard_redo` 配置读取、Review Record 历史保留、反复 NEEDS-WORK 超限自动升级 FAILED，并写 `SHARD_REDO_LIMIT` 日志与通知；整体复查非 PASS 后自动生成下一版 DRAFT Spec、round/reloopCount 递增并回 Phase 2，达到 `max_reloop` 时暂停并写 `RELOOP_LIMIT` 通知；Shard 审查 PASS 转 DONE 后即时调用 GitAdapter commit-per-shard，并写 `SHARD_COMMIT` 日志，默认关闭时安全跳过；已读取 `.loops/config.yaml` 的 `max_parallel`，`runLoop` 会按依赖 DAG 最多推进 `max_parallel` 个 ready shard，并写 `SCHEDULER_BATCH` 日志；已读取 `context_budget` 并在调度启动前硬拦截 `estContext >= context_budget` 的 Shard，标记为 `BLOCKED`，更新 annotation 风险并写 `CONTEXT_BUDGET_EXCEEDED` 日志/通知，为 M2 上下文隔离和重拆闭环打下基础；本轮新增 `tests.regression_commands` 配置读取，`reviewGlobal` 在 Codex 整体复查前先运行全局回归并写 `__global__` Test Record / `GLOBAL_REGRESSION` 日志，回归失败时直接写 NEEDS-WORK 全局复查并阻断终态 PASS。真实 SSO、真实 Codex/Claude Code CLI 的生产可用性校验、真实并发 worker 隔离、飞书真实发送、真实 PR 打开仍未完成。
```

## 已完成

| 文档要求                   | 状态    | 位置                                                                                                                                                                           | 说明                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 共享 Zod Contract          | done    | `packages/contracts/src/schemas/loops.schema.ts`, `packages/contracts/src/api/loops.contract.ts`                                                                               | 定义 Issue/Intake/Spec/Shard/Annotation/State schema 与 `/loops` ts-rest contract。                                                                                                                                                                                                                                                                                                              |
| Web Issue Intake           | done    | `apps/web/app/loops/new`, `apps/api/src/modules/loops`                                                                                                                         | 支持页面提交标题、目标仓库、正文、优先级、验收标准、mock submitter。                                                                                                                                                                                                                                                                                                                             |
| `.loops/` 文件真相源       | done    | `.loops/config.yaml`, `apps/api/src/modules/loops/loops-file-store.service.ts`                                                                                                 | 写入 issues/intakes/specs/shards/annotations/state.json/log.jsonl。                                                                                                                                                                                                                                                                                                                              |
| Runtime 配置读取           | done    | `.loops/config.yaml`, `apps/api/src/modules/loops/loops-runtime-config.util.ts`                                                                                                | 统一读取 `context_budget`、`max_parallel`、`max_retry`、`max_reloop`、`max_shard_redo`、`shard_timeout_sec`、成本阈值、默认测试命令、全局回归命令、Runner 命令白名单与 coverage floor；FileStore、LoopService、Runner 与 CLI Adapter 复用同一解析入口，环境变量可显式覆盖 CLI retry/timeout。                                                                                                                                        |
| Issue 队列                 | done    | `apps/web/app/loops/page.tsx`                                                                                                                                                  | 展示 Issue、状态、Phase、优先级。                                                                                                                                                                                                                                                                                                                                                                |
| Issue 详情与 Loop 进度     | done    | `apps/web/app/loops/[issueId]/page.tsx`                                                                                                                                        | 展示 intake、spec、state、shards、annotations、global review、convergence PR，并提供 run/global-review/reloop/finalize 操作入口；reloop 新轮会隐藏旧轮 shards/annotations/global review/convergence PR 与 implementation/review/test records，避免旧证据污染当前轮。                                                                                                                             |
| Spec 生成骨架              | partial | `apps/api/src/modules/loops/loops.service.ts`, `apps/api/src/modules/loops/adapters`                                                                                           | 默认使用确定性 MVP 模板生成 Spec；支持 `REVISION_REQUESTED` 后生成递增版本；`LOOPS_AGENT_MODE=cli` 时 Codex plan 输出会先走 Zod schema 校验；真实 CLI 版本/权限/重试策略仍需生产验证。                                                                                                                                                                                                           |
| 人工审核门禁               | done    | `apps/web/app/loops/[issueId]/page.tsx`, `LoopsService.reviewSpec`                                                                                                             | 支持 approve/request-revision，未 APPROVED 时禁止 decompose。                                                                                                                                                                                                                                                                                                                                    |
| 基础拆解                   | partial | `LoopsService.decompose`, `LoopsAgentAdapter.decompose/designTests`                                                                                                            | 生成 MVP Shard、DAG、annotations，并通过 Adapter 生成 Test Matrix；真实 Codex CLI decompose 输出会先走 Zod shard schema 校验；拆解质量和重试仍需生产验证。                                                                                                                                                                                                                                       |
| 标注体系骨架               | partial | `.loops/annotations`, `apps/web/app/loops/[issueId]/page.tsx`, `LoopsAgentAdapter.annotateFinalize`                                                                            | 已生成结构化 annotation 并展示，finalize 时可刷新 issue/spec/shards/test matrix/global review/convergence PR 终态标注；更细粒度覆盖率、风险自动判定仍待做。                                                                                                                                                                                                                                      |
| Agent Adapter 抽象         | partial | `apps/api/src/modules/loops/adapters`, `LoopsModule`                                                                                                                           | 已抽象 Codex/Claude/Git Adapter，默认 deterministic，`LOOPS_AGENT_MODE=cli` 可切到 CLI Adapter；Codex plan/decompose/review/reviewGlobal 与 Claude implementation CLI 输出已做 Zod schema 校验，非零退出和 schema 不合规会按 `.loops/config.yaml` 的 `max_retry` 重试，环境变量可覆盖；Claude CLI 的工作目录与 `--add-dir` 已强制走 targetRepo 白名单；真实 CLI 版本、权限与生产稳定性仍需校验。 |
| 状态诊断 API               | done    | `GET /loops/doctor`, `LoopsFileStoreService.doctor`                                                                                                                            | 能检查 `.loops` 根目录、state、issue/intake/spec/shards 文件一致性，并校验 shard 计数/状态、annotation 覆盖 issue/spec/shards、finalized loop 的 Test Matrix / Global Review / Convergence PR 终态标注完整性。                                                                                                                                                                                   |
| 状态恢复 API               | done    | `POST /loops/resume`, `LoopsFileStoreService.resumeInterruptedLoops`                                                                                                           | 能将中断的 `IN_PROGRESS` / `TIMEOUT` shard 重置为 `TODO` 并写日志。                                                                                                                                                                                                                                                                                                                              |
| 运维 CLI                   | done    | `scripts/loops-cli.ts`, `pnpm loops:status/doctor/resume/run/global-review/reloop/finalize`                                                                                    | 能从命令行查询状态、运行 doctor、恢复中断 shard，并推进自动实施一步、整体复查、回环与终态标注。                                                                                                                                                                                                                                                                                                  |
| Web 可观测增强             | partial | `apps/web/app/loops/page.tsx`, `apps/web/app/loops/[issueId]/page.tsx`, `GET /loops/logs`, `GET /loops/cost`, `GET /loops/notifications`, `pnpm loops:logs/cost/notifications` | 队列页展示 doctor 状态、Resume Interrupted、最近日志、最近通知、成本熔断概览；详情页展示 issue 事件流、通知记录与成本字段；实时推送仍待做。                                                                                                                                                                                                                                                      |
| Test Matrix 派生与展示     | partial | `.loops/tests/**/matrix.json`, `.loops/tests/**/matrix.md`, `apps/web/app/loops/[issueId]/page.tsx`, `LoopsAgentAdapter.designTests/reviewTests`                               | decompose 后生成 ACTIVE Test Matrix，写入 JSON/Markdown 并展示；测试证据复核接口已接入，真实 Codex 测试设计质量仍待验证。                                                                                                                                                                                                                                                                        |
| Implementation Record      | partial | `.loops/runs/**/implementation.json`, `.loops/runs/**/implementation.md`, `POST /loops/issues/:issueId/shards/:shardId/implementation`, `POST /loops/issues/:issueId/run`      | 支持人工登记，也支持 runLoop 通过 Claude Adapter 自动产出 Implementation Record；Claude Code CLI 输出会校验 summary/changedFiles/testsChanged/tokens，不合法或进程失败会按 `.loops/config.yaml` 的 `max_retry` 重试，环境变量可覆盖后 fallback；真实 diff 自动回收仍需生产验证。                                                                                                                 |
| Runner 测试执行骨架        | partial | `apps/api/src/modules/loops/loops-runner.service.ts`, `apps/api/src/modules/loops/loops-file-store.service.ts`, `POST /loops/issues/:issueId/shards/:shardId/tests`            | 能执行用户传入或 `.loops/config.yaml` 中 `tests.default_commands` 默认测试命令，创建 Issue 时规范化并校验 `targetRepo` 位于允许根内，Runner 执行前复用同一白名单策略；已按 `tests.allowed_commands` 拦截未授权命令，捕获 stdout/stderr/exitCode/duration，解析 lines/branches coverage，并按 `coverage_floor` 把低覆盖率或缺失覆盖率转为 TEST-FAIL；独立 worker 隔离仍待做。                     |
| Test Record 存储与展示     | partial | `.loops/tests/**/records`, `apps/web/app/loops/[issueId]/page.tsx`                                                                                                             | 能写入 JSON/Markdown 测试证据并在 Issue 详情展示；Markdown 已包含覆盖率摘要，Web 详情展示 lines/branches；本轮新增 `__global__` 全局回归 Test Record；Codex 真实测试审查质量待生产验证。                                                                                                                                                                                                                                                     |
| Review Record 门禁         | partial | `.loops/runs/**/review.json`, `.loops/runs/**/reviews/*.json`, `POST /loops/issues/:issueId/shards/:shardId/review`, `LoopsAgentAdapter.review`                                | 支持登记 PASS/NEEDS-WORK/FAIL 审查结论；PASS 前强制要求本轮 Implementation Record 与 TEST-PASS；同一 round 多次审查会保留历史 Review Record，并维护 latest `review.json`；runLoop 可调用 Codex Adapter 自动审查；Codex review/global-review CLI 输出已校验 verdict/issues/fixInstructions/summary；真实 Codex 审查质量仍需验证。                                                                 |
| 通知记录 MVP               | partial | `.loops/notifications/**`, `GET /loops/notifications`, `apps/web/app/loops/page.tsx`, `apps/web/app/loops/[issueId]/page.tsx`, `scripts/loops-cli.ts`                          | 已在 Issue 接收、Spec 待审、Loop 开始、成本熔断、人工介入、收敛就绪、Shard 重做超限、回环超限、上下文预算超限等节点记录 Web 通知 JSON/Markdown，并写 `NOTIFY_SENT` 日志；真实 Web 站内已读/推送和飞书发送待接入。                                                                                                                                                                                                                          |
| 人工介入 pause/resume/take | partial | `POST /loops/issues/:issueId/interventions`, `apps/web/app/loops/[issueId]/page.tsx`, `scripts/loops-cli.ts`, `pnpm loops:pause/resume-loop/take`                              | 支持暂停整个 Loop、恢复 Loop phase、接管单个 Shard，并写入 `HUMAN_INTERVENE` 日志与 annotation；真实 agent 进程接管/释放、通知与 Git 工作流联动待接入。                                                                                                                                                                                                                                          |
| Shard 自动调度             | partial | `POST /loops/issues/:issueId/run`, `LoopsService.runLoop`, `pnpm loops:run`, `apps/web/app/loops/[issueId]/page.tsx`, `apps/web/lib/api/loops.ts`                              | 可选择依赖已满足的 TODO/NEEDS-WORK shard，调用 Claude Adapter 生成实施记录、Runner 测试、Codex Adapter 审查并推进状态；反复 NEEDS-WORK 超过 `.loops/config.yaml` 的 `max_shard_redo` 后自动升级 FAILED，并写日志/通知；已读取 `max_parallel` 并让一次 runLoop 最多推进对应数量的 ready shard，同时写 `SCHEDULER_BATCH`；本轮新增 `context_budget` 启动前硬拦截，超预算 Shard 标记 `BLOCKED` 并要求重拆；真实并发 worker、worker 级超时重试和 diff 自动回收待完善。       |
| 整体复查与回环             | partial | `POST /loops/issues/:issueId/global-review`, `POST /loops/issues/:issueId/reloop`, `.loops/runs/**/global-review.*`, `pnpm loops:global-review/reloop`, Web 详情页操作入口     | 已可记录全局复查；global review 强制每个 shard 当前 round 都有 IMPLEMENTATION、TEST-PASS、Review PASS；本轮新增全局回归门禁，证据完整后先运行 `tests.regression_commands` 并写 `__global__` Test Record，回归失败会写 NEEDS-WORK 全局复查并返回实施阶段；证据完整且整体复查非 PASS 时会自动生成下一版 DRAFT Spec，递增 round/reloopCount 并回 Phase 2 等待人审；达到 `max_reloop` 后暂停并通知；reloop 新轮详情会隐藏旧轮终态产物和证据记录；关键 E2E/构建矩阵与增量补拆仍待完善。                                                                                    |
| 终态标注与收敛 PR 记录     | partial | `POST /loops/issues/:issueId/finalize`, `.loops/runs/**/convergence-pr.*`, `LoopsGitAdapter`, `pnpm loops:finalize`, Web 详情页操作入口                                        | Global PASS 后可刷新终态 annotation、关闭 issue、生成收敛 PR 描述，并覆盖 Test Matrix / Global Review / Convergence PR 文档节点；doctor 已能发现 finalized loop 缺失终态标注；GitAdapter 在 checkout/add/commit/push 前校验 targetRepo 白名单；Shard 审查 PASS 转 DONE 后已即时调用 commit-per-shard；真实 PR 打开、远端推送治理仍待完善。                                                       |

## 未完成

| 文档要求                                       | 状态        | 原因 / 下一步                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dofe SSO 真实登录校验                          | not-started | 当前使用 mock submitter；需接 `sso.dofe.ai` / `api.sso.dofe.ai`。                                                                                                                                                                                                                                                                                                      |
| CodexAdapter / ClaudeCodeAdapter 真实 CLI 调用 | partial     | CLI Adapter 已接入 DI 开关并支持 deterministic fallback，Codex plan/decompose/review/reviewGlobal 与 Claude implementation 已做 Zod schema 校验，非零退出和 schema 不合规按 `.loops/config.yaml` 的 `max_retry` 重试，环境变量可覆盖；Claude CLI 执行目录和 `--add-dir` 已复用 targetRepo 白名单；仍需按真实 `codex` / `claude` CLI 版本固化参数、权限与生产告警策略。 |
| Codex 测试设计复核                             | partial     | `designTests()` / `reviewTests()` 接口和默认实现已接入；真实 Codex 生成、复核、矩阵状态维护策略仍需完善。                                                                                                                                                                                                                                                              |
| 成本统计与熔断                                 | partial     | 已读取 `.loops/config.yaml` 的 token/call cap，提供 `GET /loops/cost` / `pnpm loops:cost`，plan/decompose/runLoop 实施记录后会执行熔断；真实 token 统计、外部告警发送待接入。                                                                                                                                                                                          |
| Runner / Scheduler 执行层                      | partial     | 已实现 Implementation Record 登记、配置化默认测试命令运行、Runner 命令白名单、coverage floor 门禁、targetRepo 允许根白名单校验、Test Record 与 Review Record 写入，runLoop 可串起调度；已接入 `max_parallel` 并按 DAG 最多推进 N 个 ready shard；本轮新增 `context_budget` 硬拦截，超预算 Shard 不启动 Claude 且标为 `BLOCKED`；真实并发队列、worker 级超时治理、diff 自动回收待加强。                                                              |
| Shard 串行实施与审查闭环                       | partial     | 已支持人工/外部实施结果登记、自动单步实施、测试执行与审查门禁，并可在 `TEST-PASS + Review PASS` 后推进 `IMPLEMENTED -> DONE`；反复 NEEDS-WORK 已按 `max_shard_redo` 升级 FAILED，历史 Review Record 可追溯；真实 CLI 质量和重试策略待验证。                                                                                                                            |
| 人工介入命令体系                               | partial     | 已实现 Web/API/CLI 的 pause、resume-loop、take，并写 `HUMAN_INTERVENE`；真实 agent 子进程暂停/接管、通知与审计策略待接入。                                                                                                                                                                                                                                             |
| commit-per-shard                               | partial     | GitAdapter 已存在，finalize 可生成提交/PR 描述，并在真实 git 操作前校验 targetRepo 白名单；Shard 审查 PASS 转 DONE 后已调用 `gitAdapter.commitShard()` 并记录 `SHARD_COMMIT` 日志；默认 `LOOPS_GIT_COMMIT_PER_SHARD=false` 安全跳过真实提交，远端 PR 打开仍待完善。                                                                                                    |
| 回环、整体复查、终态标注                       | partial     | 已有 global-review/reloop/finalize API、CLI、Web 操作入口和文件记录；global review 有当前 round 证据门禁和全局回归门禁，非 PASS 自动回环、reloop 最大次数暂停保护、新轮详情隐藏旧轮终态产物和证据记录、finalize 补齐核心文档节点终态标注已落地；关键 E2E/构建矩阵与增量补拆仍待完善。                                                                                                                   |
| Feishu 入口与通知                              | partial     | 通知记录 MVP 已落地到 `.loops/notifications` 和 Web/CLI 查询；飞书入口、消息卡片审批、飞书反向发送仍按文档后置。                                                                                                                                                                                                                                                       |

## v1 后置项 Registry

> 本节与 `todo/TASK-09-deferred-items-registry.md` 保持一致，用于最终归档时防止把长期目标误标为 v1 必需项。

| 能力 | v1 归档口径 | 建议阶段 |
| --- | --- | --- |
| Dofe SSO 登录 | `not-started`；v1 使用无登录 Web 表单或 mock submitter | v1.1 |
| 用户角色/权限 | `not-started`；v1 使用 targetRepo 白名单和本地开发身份 | v1.1 |
| 飞书 Issue 入口 | `not-started`；Web 表单覆盖 v1 主链路 | v1.2 |
| 飞书审批卡片 | `not-started`；Web 审核台覆盖 v1 人工门禁 | v1.2 |
| 飞书反向通知 | `not-started`；Web/CLI 通知记录作为 MVP | v1.2 |
| 真实远端 PR 打开 | `not-started`；convergence PR record / GitAdapter 骨架可保留 | v1.3 |
| 多 Loop 并行队列 | `not-started`；v1 先单 Loop 或手动推进 | v1.3 |
| 独立 worker 池 | `not-started`；当前 API 内置 Runner 足够验证闭环 | v1.3 |
| 完整 E2E/build 矩阵 | `not-started`；v1 只要求最小冒烟与 regression commands | v1.2 |
| 生产级 agent 告警 | `not-started`；v1 只要求失败落日志、状态和通知记录 | v1.3 |

允许保留但不计入 v1 必需验收的骨架：CLI Adapter、commit-per-shard、convergence PR record、notifications record、`max_parallel` / `context_budget` / `max_reloop` 等运行时配置。

## 对路线图的准确标注

- M0：`partial`。产品骨架、`.loops`、Web/API 可用骨架、Codex/Claude/Git Adapter 抽象、CLI 运维命令已完成；真实 agent 生产调通仍未完成。
- M1：`partial`。Web Issue、审核台、基础拆解、状态恢复、Test Matrix 派生、Implementation Record 登记、Runner 测试证据、Review Record 门禁、自动单步调度、成本熔断接入、配置化默认测试命令、配置化 CLI retry/timeout、targetRepo 白名单与标注骨架已完成；Claude CLI、Runner、GitAdapter 的执行目录已统一受控；Runner 命令 allowlist、coverage 解析与 coverage floor 门禁、Review Record 历史保留、`max_shard_redo` 保护、审查 PASS 后 commit-per-shard 调用已落地；本轮已通过端到端冒烟验证；真实双 agent 生产实施、并发队列和 worker 级稳定治理待完善。
- M2：`partial`。`max_parallel` 已进入 runtime config，`runLoop` 会按依赖 DAG 最多推进 N 个 ready shard，并记录 `SCHEDULER_BATCH`；`context_budget` 已进入 runtime config，超预算 Shard 启动前会被标记 `BLOCKED` 并写 `CONTEXT_BUDGET_EXCEEDED` 通知；但当前仍为同进程顺序推进，真正多 Claude Code worker 并发、重拆自动化、完整测试矩阵与标注看板筛选仍未完成。
- M3：`partial`。整体复查、回环、终态标注刷新与收敛 PR 记录已具备 API/CLI/Web/文件记录；当前 round 证据门禁、全局回归门禁、整体复查非 PASS 自动回环、`max_reloop` / `max_shard_redo` 配置化、reloop 旧轮终态产物和证据记录隐藏、核心文档节点终态标注与 doctor 终态完整性检查已落地；关键 E2E/构建矩阵、增量补拆与更严格全量终态校验待完善。
- M4：`partial`。日志查询、doctor 深度状态检查、恢复入口、成本统计与 call/token 熔断骨架、通知记录 MVP、人工介入 pause/resume/take、GitAdapter commit-per-shard / 收敛 PR 记录和 Git 操作 targetRepo 白名单已落地；真实 agent 进程暂停/接管、Web/飞书推送、真实远端 PR 打开与 Git 治理未完成。

## 本轮验证记录

- `pnpm loops:doctor`：通过，`.loops` 根目录已初始化，当前 loops/issues 为 0，doctor 无问题。
- Doctor 深度检查冒烟：通过。临时 finalized loop 删除 convergence PR 终态 annotation 后，`doctor.ok=false` 且报告 `missing final annotation target ...`；测试数据已清理。
- `.loops/config.yaml` 默认测试命令读取：通过。`LoopsFileStoreService.readDefaultTestCommands()` 返回 `["pnpm test", "pnpm lint"]`，runLoop 已使用该配置替代硬编码 `pnpm --version`。
- `.loops/config.yaml` runtime 配置读取：通过。`readLoopsRuntimeConfig()` 返回 `contextBudget=24000`、`maxParallel=1`、`maxRetry=2`、`maxReloop=3`、`maxShardRedo=3`、`shardTimeoutSec=900`、成本阈值、默认测试命令与全局回归命令；FileStore、LoopService 与 CLI Adapter 复用同一解析入口。
- LoopsService 调度入口导入检查：通过。`ts-node import('./src/modules/loops/loops.service')` 成功，`runLoop` 已复用 `max_parallel` 并抽出 `runRunnableShard()`。
- 全局回归配置读取：通过。`readLoopsRuntimeConfig()` 返回 `tests.regressionCommands=["pnpm lint"]`，并仍受 `tests.allowed_commands` 白名单约束。
- 全局回归门禁导入检查：通过。`LoopsService` 可导入，`reviewGlobal()` 已在 Codex 整体复查前调用 `runGlobalRegression()`，失败时写 NEEDS-WORK 全局复查。
- 上下文预算通知 contract 冒烟：通过。`LoopNotificationSchema.kind` 可解析 `CONTEXT_BUDGET_EXCEEDED`，与 Scheduler 预算硬拦截通知一致。
- 上下文预算门禁导入检查：通过。`TS_NODE_TRANSPILE_ONLY=1 ts-node --compiler-options '{"rootDir":".","module":"commonjs"}'` 可导入 `LoopsService`，`blockShardForContextBudget()` 路径已落入代码；完整临时 issue 行为冒烟受 ts-node/stdin 的 TS6 `rootDir` 迁移检查干扰，未作为通过项记录。
- `.loops/config.yaml` Runner 安全配置读取：通过。`tests.allowed_commands=["pnpm test","pnpm lint","pnpm exec","node -e","printf"]`，`coverageFloor={lines:70,branches:60}`。
- targetRepo 白名单策略：通过。`resolveAllowedTargetRepo('../..')` 解析到当前工作区绝对路径，`/tmp` 被拒绝；创建 Issue、Runner 执行、Claude CLI `cwd/--add-dir` 与 GitAdapter checkout/add/commit/push 前复用同一允许根校验。
- GitAdapter targetRepo 负向冒烟：通过。`commitPerShard=true` 且 `targetRepo=/tmp` 时抛出 `outside allowed roots`，不会执行 git。
- Runner cwd 规范化冒烟：通过。以 `cwd='../..'` 运行 `node -e "console.log(process.cwd())"`，stdout 为当前仓库绝对路径，证明执行前已解析到允许根。
- Runner 命令白名单冒烟：通过。`rm -rf /tmp/loops-nope` 被拦截为 exit=126，stderr 为 `Command is not allowed by .loops/config.yaml tests.allowed_commands.`。
- Runner coverage 冒烟：通过。`Lines: 82.1% Branches: 76.4%` 解析为 `coverage={lines:82.1,branches:76.4}` 且 TEST-PASS；`Lines: 42% Branches: 20%` 因低于 floor 转 TEST-FAIL；无 coverage 输出时因缺失 lines/branches coverage 转 TEST-FAIL；Istanbul `All files | 90 | 76.5 | 88 | 82.3` 表格可解析为 `lines=82.3,branches=76.5`。
- Review Record 历史保留冒烟：通过。同一 shard / round 连续 4 次 review 后，`detail.reviewRecords.length=4`，同时 latest `review.json` 仍保留最新结论。
- `max_shard_redo` 冒烟：通过。默认 `max_shard_redo=3` 时，连续第 4 次 `NEEDS-WORK` review 自动写成 `FAIL`，shard 状态升级 `FAILED`，annotation 为 `implStatus=failed/verdict=fail`，并写入 1 条 `SHARD_REDO_LIMIT` 通知；临时测试数据已清理，`pnpm loops:doctor` 仍为 `ok=true`。
- commit-per-shard 冒烟：通过。使用捕获型 GitAdapter 验证 Shard 审查 `PASS` 后立即调用 `commitShard()` 1 次，参数中的 `changedFiles` 来自当前 round Implementation Record；临时测试数据与日志已清理。
- 通知 contract 冒烟：通过。`LoopNotificationSchema.kind` 已补充 `SHARD_REDO_LIMIT` 与 `RELOOP_LIMIT`，与服务端写入的重做超限 / 回环超限通知一致。
- `pnpm --filter @repo/api exec ts-node ... LoopsService.doctor()`：通过，可实例化 LoopsService + deterministic Codex/Claude + GitAdapter。
- Loops 端到端冒烟：通过。临时 Issue 完成 `createIssue -> generateSpec -> approve -> decompose -> runLoop x2 -> reviewGlobal -> finalize`，最终 `issue.status=CLOSED`、`phase=CLOSED`、`finalized=true`、`globalVerdict=PASS`、shards 全部 `DONE`，测试数据已清理。
- Loops 终态标注冒烟：通过。finalize 后 annotation targets 覆盖 issue、spec、全部 shard、test matrix、global review、convergence PR。
- Loops 自动回环冒烟：通过。使用测试 Adapter 让证据完整的 `reviewGlobal` 返回 `NEEDS-WORK` 后，系统自动生成 `v2` DRAFT Spec，状态为 `phase=PHASE_2_REVIEW`、`round=2`、`reloopCount=1`，新轮详情 `visibleShards=0`，Spec 正文包含 global review 摘要；临时测试数据与日志已清理。
- Reloop 旧轮产物隐藏冒烟：通过。finalize 后进入 reloop，新 round 详情返回 `shards=0`、`annotations=0`、`implementationRecords=0`、`reviewRecords=0`、`testRecords=0`、`globalReview=false`、`convergencePr=false`，旧轮终态产物不再污染当前轮展示。
- Loops 负向整体复查冒烟：通过。未完成 shard / 缺少当前 round 证据时，`reviewGlobal` 写入 `NEEDS-WORK` 并回到 `PHASE_4_IMPLEMENT`。
- `CliLoopsAgentAdapter` / `CliLoopsClaudeAdapter` import / schema 校验路径：通过 `ts-node` 导入检查；Codex plan/decompose/review/reviewGlobal 与 Claude implementation 输出已接 Zod safeParse。
- CLI Adapter 重试路径：通过代码审查与 `ts-node` 导入检查；Codex/Claude CLI 非零退出和 schema 不合规均按 `.loops/config.yaml` 的 `max_retry` 控制最多尝试次数，超限后 fallback deterministic。
- `pnpm --filter @repo/web type-check`：通过。本轮顺带修复 `apps/web/lib/api/auth-server.ts` 中 `response.body` 的 `unknown` 类型收窄问题，使 Web Loops 新入口被全量检查覆盖。
- `pnpm --filter @repo/api type-check`：未通过，阻断来自既有 `@app/db`、`@dofe/infra-common/*` 子路径解析、infra clients 导出差异与 uploader `@ts-expect-error` 等非 Loops 新增问题。
