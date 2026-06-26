# Loops 结构优化实施标注

## 循环记录

本文件记录 `docs/0626/struct-opz` 方案的实施循环。每轮固定包含：

1. 实施
2. 标注文档
3. 审查待实施项
4. 再标注文档

## 总体状态

| Step                                           | 状态     | 标注                                                                                                   |
| ---------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| Step 0 · 建立目标目录与兼容 Facade             | 已完成   | `LoopsDomainModule` 已作为 domain 装配入口                                                             |
| Step 1 · 下沉低耦合工具、Store 与 Lock         | 已完成   | `loops-store` / `loops-locks` 已下沉                                                                   |
| Step 2 · 拆 Issue Intake 与查询能力            | 部分完成 | intake + query/read pipeline 已下沉，API 保留兼容 wrapper                                              |
| Step 3 · 拆 Loop Engine 状态机                 | 部分完成 | 纯状态推导原语已下沉，主流程推进仍待拆                                                                 |
| Step 4 · 拆 Runner、Runtime 与 Workspace       | 部分完成 | runner/runtime 主体已下沉，adapter provider wiring 留 API module                                       |
| Step 5 · 拆 Evidence、Quality 与 Release Gates | 部分完成 | evidence/quality 主要 builder/gate/enricher 已下沉，API 保留兼容 wrapper                               |
| Step 6 · 拆 Eval 与 Bench 聚合                 | 部分完成 | eval/bench 纯 builder + trend/aggregation worker IO 编排已下沉，evidence/DB/Redis 适配仍由 facade port |
| Step 7 · 拆 Integrations、MCP、CI、PR 与通知   | 部分完成 | Cycle 4 完成 PR provider / MCP client / MCP secret                                                     |
| Step 8 · 拆 Trigger 与 Remote Runner Pool      | 部分完成 | Cycle 13 完成 schedule trigger CRUD                                                                    |
| Step 9 · 拆 Admin、Archive、Tool 与 Blueprint  | 部分完成 | Cycle 53-57 完成 archive collection service                                                            |
| Step 10 · 收敛 API Module 与删除旧聚合         | 待实施   | -                                                                                                      |

## 当前剩余待实施项

截至 nextstep Cycle 60 后，已经完成多批“实施 → 标注文档 → 审查待实施项 → 再标注文档”的循环。当前剩余项如下：

- Step 2：`list` / `listFromFile` / `getIssue` query/read pipeline 已下沉到 `loops-issues`；API facade 保留兼容入口与 HTTP 日志/异常映射。
- Step 3：完整状态机方法仍在 API `LoopsService`，当前仅下沉了纯状态推导原语。
- Step 4：runner services/adapters 已下沉；adapter provider wiring 仍在 API module，作为 API 装配逻辑保留。
- Step 5：workflow baseline evidence、delivery evidence markdown、runtime security exceptions、second opinion policy、release gate blockers、requirements coverage builder、evidence artifact builder、review/release gate builder、delivery controls、list enricher、second opinion builder 等已下沉；API `LoopsService` 仅保留兼容 wrapper。
- Step 6：Eval suite builder、Eval run builder、Eval trend baseline builder、request-time aggregation builder 与 loop bench metric helper + eval/bench trend worker IO 编排（`runEvalTrendWorker` / `runLoopBenchTrendWorker`）+ eval aggregation worker 编排（`runEvalAggregationWorker`）已下沉到 `loops-eval`；evidence 收集与 DB/Redis 适配仍由 facade port 实现。
- Step 7：notification sender 仍暂置 `loops-store`；CI checks registry 与 publication history builder 仍在 API `LoopsService`。
- Step 8：schedule trigger CRUD + `fireScheduleTrigger` 编排已下沉到 `loops-triggers`（`LoopsTriggerSchedulerProcessor` 不再注入 legacy facade 类，issue creation port `LOOPS_ISSUE_CREATION_PORT` 当前由 facade 临时实现）；remote runner pool 基础 list/lease/job 已下沉；remote shard execution pipeline 仍待拆 domain service。
- Step 9：capability registry、tool registry、delivery blueprint marketplace、archive control wrapper、archive collection service 已下沉；eval aggregation 接入仍待 Step 6/Next N4 收口。
- Step 10：API module 仍需进一步瘦身；`LoopsService` 仍为 legacy 聚合 facade + 大量私有方法。

## Cycle 0 · 执行记录初始化

### 实施

- 新增本实施标注文档。
- 建立后续循环记录格式。

### 标注文档

- `IMPLEMENTATION-ANNOTATIONS.md` 已创建。
- 后续每轮会同步更新“总体状态”和对应 Cycle 小节。

### 审查待实施项

- Step 0-10 均待实施。
- 下一轮优先建立 domain `loops` facade/module 骨架。

### 再标注文档

- Cycle 0 完成，进入 Cycle 1。

### 验证

- 文档变更，无代码验证。

## Cycle 1 · Step 5a 下沉 Quality 可独立能力

### 实施

- 新建 `apps/api/libs/domain/services/loops-quality`。
- 迁移以下文件到 domain services：
  - `loops-browser-qa-worker.service.ts`
  - `loops-browser-qa-worker.service.spec.ts`
  - `loops-learning-governance.service.ts`
  - `loops-visual-regression.util.ts`
  - `loops-second-opinion-comparison.util.ts`
  - `loops-second-opinion-comparison.util.spec.ts`
- 新增 `LoopsQualityModule`，并由 `LoopsDomainModule` re-export。
- `LoopsService`、`loops.service.spec.ts`、`loops-second-opinion-worker.service.ts` 改为从 `@app/services/loops-quality` 引入已迁移能力。
- API `loops.module.ts` 移除 `LoopsBrowserQaWorkerService` 与 `LoopsLearningGovernanceService` 直接 provider 注册，由 domain module 提供。

### 标注文档

- 总体状态中 Step 5 标为“部分完成”。
- 标注 `loops-second-opinion-worker.service.ts` 未迁移，因为它仍依赖 API 层 `adapters/loops-process.util` 和 `loops-runtime-command-builder.util`。

### 审查待实施项

- 待实施：
  - `LoopsSecondOpinionWorkerService` 已在 Cycle 3 迁移。
  - `buildDeliveryEvidence`、review/release gate、coverage builder 仍在 API `LoopsService`。
- 未发现 domain `loops-quality` 反向 import `apps/api/src/modules/**`。

### 再标注文档

- Cycle 1 完成，下一轮优先处理 runtime/runner utilities，使 second-opinion worker 具备迁移条件。

### 验证

```bash
pnpm --filter @repo/api test -- loops-browser-qa-worker.service.spec.ts loops-second-opinion-comparison.util.spec.ts --runInBand
```

结果：2 个 test suite 通过，2 个测试通过。

## Cycle 2 · Step 4a 下沉 Runner 纯工具

### 实施

- 新建 `apps/api/libs/domain/services/loops-runners`。
- 迁移以下文件到 domain services：
  - `loops-process.util.ts`
  - `loops-process.util.spec.ts`
  - `loops-runtime-command-builder.util.ts`
  - `loops-runtime-command-builder.spec.ts`
- 新增 `LoopsRunnersModule`，并由 `LoopsDomainModule` re-export。
- 更新 runtime detection、CLI adapters、second-opinion worker 使用 `@app/services/loops-runners`。

### 标注文档

- 总体状态中 Step 4 标为“部分完成”。
- 标注：本轮只迁移 runner 纯工具，不迁移 adapter provider token 和 `LoopsRunnerService`。

### 审查待实施项

- 待实施：
  - `LoopsSecondOpinionWorkerService` 已无 API runner util 依赖，下一轮可迁移到 `loops-quality`。
  - CLI adapter interface/implementations 仍在 API `adapters/`。
  - `LoopsRunnerService` 仍在 API 层，后续需与 Docker sandbox 边界一起迁移。
- 审查发现并修复：批量路径替换曾产生 `/services/loops-runners` 与 `@app@app/services/loops-runners` 错误，已修正。

### 再标注文档

- Cycle 2 完成，下一轮迁移 second-opinion worker 到 `loops-quality`。

### 验证

```bash
pnpm --filter @repo/api test -- loops-process.util.spec.ts loops-runtime-command-builder.spec.ts agent-runtime-detection.service.spec.ts --runInBand
```

结果：3 个 test suite 通过，21 个测试通过。

## Cycle 3 · Step 5b 下沉 Second Opinion Worker

### 实施

- 将 `LoopsSecondOpinionWorkerService` 从 API `src/modules/loops` 迁移到 `apps/api/libs/domain/services/loops-quality`。
- `LoopsQualityModule` 注册并导出 `LoopsSecondOpinionWorkerService`。
- `LoopsService` 与 `loops.service.spec.ts` 从 `@app/services/loops-quality` 引入二审 worker。
- API `loops.module.ts` 移除二审 worker 直接 provider 注册。

### 标注文档

- Step 5 仍为“部分完成”：quality worker 边界已下沉，但 delivery evidence / gates / coverage builder 仍在 API `LoopsService`。

### 审查待实施项

- 待实施：
  - delivery evidence markdown builder 下沉。
  - review/release gates 下沉。
  - requirement coverage 下沉。
- 本轮确认 `LoopsSecondOpinionWorkerService` 不再依赖 API 层工具，依赖方向为 domain services / contracts。

### 再标注文档

- Cycle 3 完成，下一轮处理 integrations 可独立迁移能力。

### 验证

```bash
pnpm --filter @repo/api test -- loops-second-opinion-comparison.util.spec.ts loops.service.spec.ts --runInBand
```

结果：2 个 test suite 通过，69 个测试通过。

## Cycle 4 · Step 7a 下沉 Integrations 可独立能力

### 实施

- 新建 `apps/api/libs/domain/services/loops-integrations`。
- 迁移以下文件到 domain services：
  - `loops-pr-provider.client.ts`
  - `loops-pr-provider.client.spec.ts`
  - `loops-mcp-client.service.ts`
  - `loops-mcp-client.service.spec.ts`
  - `loops-mcp-secret.service.ts`
- 新增 `LoopsIntegrationsModule`，import `HttpModule` 并导出 PR provider、MCP client、MCP secret。
- `LoopsDomainModule` re-export `LoopsIntegrationsModule`。
- `LoopsService`、`loops.service.spec.ts`、`CliLoopsGitAdapter`、API `loops.module.ts` 改为从 `@app/services/loops-integrations` 引入。
- API `loops.module.ts` 移除 integrations provider 的直接注册。

### 标注文档

- 总体状态中 Step 7 标为“部分完成”。
- 标注：`LoopsNotificationSender` 仍暂置在 `loops-store`，因为 `LoopsFileStoreService` 当前直接依赖它；后续要迁移需先把 notification port 从 store 中抽出。

### 审查待实施项

- 待实施：
  - `LoopsNotificationSender` 从 store re-home 到 integrations。
  - CI checks registry 仍在 API `LoopsService` 私有方法中。
  - PR publication history 的业务 builder 仍在 API `LoopsService`。
- 已确认 PR/MCP spec 随文件迁移并通过。

### 再标注文档

- Cycle 4 完成，下一轮处理 Eval worker/service 边界。

### 验证

```bash
pnpm --filter @repo/api test -- loops-pr-provider.client.spec.ts loops-mcp-client.service.spec.ts --runInBand
```

结果：2 个 test suite 通过，22 个测试通过。

## Cycle 5 · Step 6a 下沉 Eval Aggregation Worker

### 实施

- 新建 `apps/api/libs/domain/services/loops-eval`。
- 迁移 `LoopsEvalAggregationWorkerService` 到 domain services。
- 新增 `LoopsEvalModule` 并由 `LoopsDomainModule` re-export。
- `LoopsEvalAggregationProcessor` 与 `LoopsService` 从 `@app/services/loops-eval` 引入 aggregation worker。
- API `loops.module.ts` 移除 aggregation worker 直接 provider 注册。

### 标注文档

- 总体状态中 Step 6 标为“部分完成”。
- 标注：本轮只迁移 Redis-backed aggregation worker；Eval suite/run builder 仍在 legacy API `LoopsService`。

### 审查待实施项

- 待实施：
  - `listEvalSuites` / `getEvalSuite` / `listEvalRuns` / `getEvalRun` 下沉。
  - Eval evidence collection/build/evaluate helpers 下沉。
  - Loop bench trend worker 下沉。
- 本轮未迁移 processor，processor 仍作为 API/BullMQ entry。

### 再标注文档

- Cycle 5 完成。已满足至少 5 次循环动作要求；后续进入结构审查与剩余项标注。

### 验证

```bash
pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand
```

结果：1 个 test suite 通过，68 个测试通过。

## Cycle 6 · 结构审查与待实施项标注

### 实施

- 执行 domain 反向 import 检查。
- 执行 API loops 剩余文件盘点。
- 执行 domain services 已迁移文件盘点。
- 执行 API type-check。

### 标注文档

- 新增“当前剩余待实施项”小节。
- 明确 Step 2-10 的剩余工作，不把 partial 下沉误标为完成。

### 审查待实施项

- domain services 未发现代码层反向 import `apps/api/src/modules/loops`；扫描命中仅为模块注释中的历史路径说明。
- API `apps/api/src/modules/loops` 仍保留：
  - adapter provider 与 adapter interfaces；
  - runtime detection / runner / docker sandbox；
  - processors；
  - legacy `LoopsService` 大聚合；
  - controller/module/rbac；
  - 相关 API 层 specs。
- 下一批优先级建议：
  1. 先迁 `AgentRuntimeDetectionService` 到 `loops-runtime`。
  2. 再迁 `LoopsRunnerService` + `LoopsDockerSandboxService` 到 `loops-runners` 或 `loops-runtime`。
  3. 再按 evidence builder 解锁 issue query 与 Eval builder 下沉。

### 再标注文档

- Cycle 6 完成，结构审查结果已写入本文档。

### 验证

```bash
rg "apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops" apps/api/libs/domain/services
pnpm --filter @repo/api type-check
```

结果：

- 反向 import 检查仅命中文档注释，无代码 import。
- `pnpm --filter @repo/api type-check` 通过。

## Cycle 7 · Step 4b 下沉 Runtime Detection

### 实施

- 将 `AgentRuntimeDetectionService` 和对应 spec 从 API `src/modules/loops` 迁移到 `apps/api/libs/domain/services/loops-runtime`。
- `LoopsRuntimeModule` 注册并导出 `AgentRuntimeDetectionService`。
- `loops-runtime/index.ts` 导出 runtime detection service。
- `LoopsService`、`loops.service.spec.ts` 改从 `@app/services/loops-runtime` 引入。
- API `loops.module.ts` 移除 runtime detection 的直接 provider 注册。

### 标注文档

- 当前剩余待实施项中 Step 4 更新为：runtime detection 已下沉，CLI adapter token / `LoopsRunnerService` / Docker sandbox 仍待迁移。

### 审查待实施项

- 待实施：
  - `LoopsRunnerService` 仍在 API 层，依赖 Docker sandbox。
  - `LoopsDockerSandboxService` 仍在 API 层。
  - CLI adapter interfaces/implementations 仍在 API `adapters/`，需要与 token provider 一起迁。
- 运行 `agent-runtime-detection.service.spec.ts` 单独通过。
- `loops.service.spec.ts` 单独通过。
- 两个 spec 合并同一 Jest invocation 时出现过一次 Browser QA canary 单用例 5s timeout，分开复跑均通过；标记为测试运行时组合耗时风险，非本轮代码路径失败。

### 再标注文档

- Cycle 7 完成，Step 4 继续保持“部分完成”。

### 验证

```bash
pnpm --filter @repo/api test -- agent-runtime-detection.service.spec.ts --runInBand
pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand
```

结果：

- `agent-runtime-detection.service.spec.ts`：1 个 test suite 通过，5 个测试通过。
- `loops.service.spec.ts`：1 个 test suite 通过，68 个测试通过。

## Cycle 8 · Step 4c 下沉 Docker Sandbox

### 实施

- 将 `LoopsDockerSandboxService` 从 API `src/modules/loops` 迁移到 `apps/api/libs/domain/services/loops-runtime`。
- `loops-runtime/index.ts` 导出 sandbox service 与相关类型。
- `LoopsRuntimeModule` 注册并导出 `LoopsDockerSandboxService`。
- `LoopsRunnerService` 与 `LoopsService` 改从 `@app/services/loops-runtime` 引入 sandbox。
- API `loops.module.ts` 移除 sandbox 直接 provider 注册。
- 同步修正文档状态表：Step 0、Step 1 标为已完成。

### 标注文档

- 当前剩余待实施项中 Step 4 更新为：runtime detection 与 Docker sandbox 已下沉，CLI adapter token 与 `LoopsRunnerService` 仍待迁移。

### 审查待实施项

- 待实施：
  - `LoopsRunnerService` 仍在 API 层。
  - CLI adapter interfaces/implementations 仍在 API `adapters/`。
  - `LOOPS_GIT_ADAPTER` factory 仍在 API module。
- 本轮扫描无 API 层旧 `loops-docker-sandbox.service` import。

### 再标注文档

- Cycle 8 完成，下一轮迁移 `LoopsRunnerService`。

### 验证

```bash
pnpm --filter @repo/api test -- loops-runner.service.spec.ts loops.service.spec.ts --runInBand
pnpm --filter @repo/api type-check
```

结果：

- 2 个 test suite 通过，74 个测试通过。
- API type-check 通过。

## Cycle 9 · Step 4d 下沉 LoopsRunnerService

### 实施

- 将 `LoopsRunnerService` 与对应 spec 从 API `src/modules/loops` 迁移到 `apps/api/libs/domain/services/loops-runners`。
- `LoopsRunnersModule` 注册并导出 `LoopsRunnerService`。
- `loops-runners/index.ts` 导出 runner service。
- `LoopsService`、`loops.service.spec.ts`、`loops-persistence.db.spec.ts`、remote runner skipped e2e 动态 import 改为 `@app/services/loops-runners`。
- API `loops.module.ts` 移除 runner service 直接 provider 注册。

### 标注文档

- 当前剩余待实施项中 Step 4 更新为：CLI adapter token 仍在 API 层；runtime detection、Docker sandbox、`LoopsRunnerService` 已下沉。

### 审查待实施项

- 待实施：
  - CLI adapter interfaces/implementations 仍在 API `adapters/`。
  - `LOOPS_AGENT_ADAPTER` / `LOOPS_CLAUDE_ADAPTER` / `LOOPS_GIT_ADAPTER` provider 仍在 API module。
- 扫描确认无 API 层相对 import `./loops-runner.service`。

### 再标注文档

- Cycle 9 完成，下一轮审查 Trigger / Remote Runner / Admin 可迁移边界。

### 验证

```bash
pnpm --filter @repo/api test -- loops-runner.service.spec.ts loops.service.spec.ts --runInBand
pnpm --filter @repo/api type-check
```

结果：

- 2 个 test suite 通过，74 个测试通过。
- API type-check 通过。

## Cycle 10 · Step 9a 下沉 Capability Registry

### 实施

- 新建 `apps/api/libs/domain/services/loops-admin`。
- 将 `LoopsCapabilityRegistry` 从 API `src/modules/loops` 迁移到 `loops-admin`。
- 新增 `LoopsAdminModule` 并由 `LoopsDomainModule` re-export。
- `LoopsService` 改从 `@app/services/loops-admin` 引入 capability registry。
- API `loops.module.ts` 移除 capability registry 直接 provider 注册。

### 标注文档

- 总体状态中 Step 9 标为“部分完成”。
- 当前剩余待实施项更新为：capability registry 已下沉；Archive、tool、blueprint 仍未完整下沉。

### 审查待实施项

- 审查 `LoopsCrossTenantArchiveService` 时发现其仍通过 `forwardRef(() => require('./loops.service').LoopsService)` 依赖 API `LoopsService`。
- 因该循环依赖会造成 domain 反向依赖 API，Archive service 暂不下沉；需要先抽出 archive 所需的 Loop detail/list port，或把 archive 调用的 `LoopsService` 方法改为更窄的 domain port。
- Tool / blueprint CRUD 仍为 `LoopsService` 私有 builder + public methods，待拆 admin service。

### 再标注文档

- Cycle 10 完成，下一轮优先处理 Trigger / Remote Runner 中可安全下沉的 processor 支撑边界。

### 验证

```bash
pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand
pnpm --filter @repo/api type-check
```

结果：

- 1 个 test suite 通过，68 个测试通过。
- API type-check 通过。

## Cycle 11 · Step 4e 下沉 Runner Adapters

### 实施

- 新建 `apps/api/libs/domain/services/loops-runners/adapters`。
- 迁移 CLI / deterministic adapter 实现、adapter interfaces、git adapter spec 到 `loops-runners/adapters`。
- `loops-runners/index.ts` re-export adapters。
- API `loops.module.ts` 的 provider wiring 继续保留，但改从 `@app/services/loops-runners` 引入 adapter classes/tokens。
- `LoopsService`、`loops.service.spec.ts`、`loops-persistence.db.spec.ts`、remote runner skipped e2e 动态 import 改为 `@app/services/loops-runners`。

### 标注文档

- 当前剩余待实施项中 Step 4 更新为：runner services/adapters 已下沉；adapter provider wiring 仍在 API module。

### 审查待实施项

- 待实施：
  - 把 adapter provider wiring 从 API module 下沉到 `LoopsRunnersModule`，但需处理 `LOOPS_GIT_ADAPTER` factory 对 `LoopsPrProviderClient` 的依赖。
  - API module 仍保留 provider selection 逻辑。
- Trigger / Remote Runner processor 本轮审查后确认仍应保留 API/worker entry；其业务下沉需先把 `fireScheduleTrigger` / `executeRemoteShardJob` 从 legacy `LoopsService` 拆成 domain service。

### 再标注文档

- Cycle 11 完成，下一轮做最终结构审查与剩余项精确标注。

### 验证

```bash
pnpm --filter @repo/api test -- cli-loops-git.adapter.spec.ts --runInBand
pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand
pnpm --filter @repo/api type-check
```

结果：

- `cli-loops-git.adapter.spec.ts`：1 个 test suite 通过，1 个测试通过。
- `loops.service.spec.ts`：1 个 test suite 通过，68 个测试通过。
- API type-check 通过。
- 合并同一 Jest invocation 跑 `cli-loops-git.adapter.spec.ts + loops.service.spec.ts` 时仍可能触发 Browser QA canary 单用例 5s timeout；分开复跑均通过，保留为测试运行时组合耗时风险。

## Cycle 12 · 最终结构审查与准确标注

### 实施

- 执行 API `apps/api/src/modules/loops` 剩余文件盘点。
- 执行 domain services 反向依赖扫描。
- 清理 deterministic adapter 中对旧 API 路径的文件 hint 文案，避免结构检查误报。
- 执行分组 focused tests 与 type-check。

### 标注文档

- 明确 Step 8：processor 作为 API/worker entry 保留是符合边界的；待拆的是 `LoopsService` 中的 trigger / remote runner 业务方法。
- 明确 Step 4：adapter provider wiring 仍在 API module，当前作为装配逻辑保留；若继续下沉，需要 `LoopsRunnersModule` import `LoopsIntegrationsModule` 并接管 `LOOPS_GIT_ADAPTER` factory。

### 审查待实施项

- API `apps/api/src/modules/loops` 当前剩余文件集中为：
  - API 层：`loops.controller.ts`、`loops.module.ts`、`loops-rbac.decorator.ts`
  - Worker entry：`loops-eval-aggregation.processor.ts`、`loops-remote-runner.processor.ts`、`loops-trigger-scheduler.processor.ts`
  - Legacy 聚合：`loops.service.ts`
  - 待解耦服务：`loops-cross-tenant-archive.service.ts`
  - API/legacy specs：`loops.service.spec.ts`、`loops-persistence.db.spec.ts`、`loops-cost-guard.spec.ts`、`loops-simple-issue.spec.ts`、`loops-remote-runner.cli-e2e.spec.ts`
- 仍阻塞的核心项：
  - `LoopsCrossTenantArchiveService` 依赖 `LoopsService`，必须先抽 archive port。
  - Trigger / Remote Runner processors 依赖 `LoopsService.fireScheduleTrigger` / `executeRemoteShardJob`，必须先抽 `loops-triggers` / `loops-remote-runners` domain service。
  - Step 2 / Step 3 / Step 5 / Step 6 的大块方法仍在 `LoopsService`，需要以 evidence/coverage enricher 为先导继续拆。

### 再标注文档

- Cycle 12 完成；本轮继续满足循环实施要求，并把可安全下沉的后续项推进到 domain services。

### 验证

```bash
rg "apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops|from './loops.service'|require\\('./loops.service'\\)" apps/api/libs/domain/services
pnpm --filter @repo/api test -- loops-runner.service.spec.ts cli-loops-git.adapter.spec.ts loops-pr-provider.client.spec.ts loops-mcp-client.service.spec.ts --runInBand
pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand
pnpm --filter @repo/api type-check
```

结果：

- 反向依赖扫描仅剩模块注释中的历史路径说明，无代码 import / require。
- 4 个 runner/integration test suite 通过，29 个测试通过。
- `loops.service.spec.ts` 通过，68 个测试通过。
- API type-check 通过。

## Cycle 13 · Step 8a 下沉 Schedule Trigger CRUD

### 实施

- 新建 `apps/api/libs/domain/services/loops-triggers`。
- 新增 `LoopsTriggersModule` / `LoopsTriggersService`。
- 下沉 schedule trigger CRUD：
  - `listScheduleTriggers`
  - `getScheduleTrigger`
  - `createScheduleTrigger`
  - `updateScheduleTrigger`
  - `deleteScheduleTrigger`
  - `computeNextCronTime`
- `LoopsService` 通过 `LoopsTriggersService` 委托上述方法；`fireScheduleTrigger` 仍留在 facade，因为它会调用 `createIssue`。

### 标注文档

- 总体状态中 Step 8 标为“部分完成”。
- 当前剩余待实施项更新为：schedule trigger CRUD 已下沉；fire/processor 与 remote runner pool 仍待拆 domain service。

### 审查待实施项

- 待实施：
  - `fireScheduleTrigger` 需要 `createIssue` port 后才能完整下沉。
  - `LoopsTriggerSchedulerProcessor` 仍作为 API/BullMQ entry 保留，当前依赖 legacy `LoopsService.fireScheduleTrigger`。
  - remote runner pool 尚未下沉。

### 再标注文档

- Cycle 13 完成，下一轮处理 remote runner pool 的 list/lease/job CRUD。

### 验证

```bash
pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand
pnpm --filter @repo/api type-check
```

结果：

- `loops.service.spec.ts` 通过，68 个测试通过。
- API type-check 通过。

## Cycle 14 · Step 8b 下沉 Remote Runner Pool 基础能力

### 实施

- 新建 `apps/api/libs/domain/services/loops-remote-runners`。
- 新增 `LoopsRemoteRunnersModule` / `LoopsRemoteRunnersService`。
- 下沉 remote runner 基础控制面：
  - `listRemoteRunners`
  - `acquireRemoteRunnerLease`
  - `releaseRemoteRunnerLease`
  - `runRemoteRunnerJob`
  - `buildRemoteRunnerItems`
  - `getRemoteRunnerItem`
- `LoopsService` 继续保留权限检查与外部 artifact upload / execution pipeline，基础对象构造委托给 domain service。

### 标注文档

- 当前剩余待实施项更新为：schedule trigger CRUD 与 remote runner pool 基础 list/lease/job 已下沉；fire/processor 与 remote execution pipeline 仍待拆 domain service。

### 审查待实施项

- 待实施：
  - `uploadRemoteRunnerArtifacts` 牵涉 external storage 和 file content，仍在 facade。
  - `executeRemoteShardJob` 是远程执行 pipeline，依赖 agent/runner/evidence/store 多方，需要单独切片。
  - `LoopsRemoteRunnerProcessor` 仍作为 API/BullMQ entry，当前调用 legacy `LoopsService.executeRemoteShardJob`。

### 再标注文档

- Cycle 14 完成，下一轮做结构审查与剩余项更新。

### 验证

```bash
pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand
pnpm --filter @repo/api type-check
```

结果：

- `loops.service.spec.ts` 通过，68 个测试通过。
- API type-check 通过。

## Cycle 15 · 结构审查与 Step 8 剩余项标注

### 实施

- 执行 domain services 反向依赖扫描。
- 执行 API `apps/api/src/modules/loops` 剩余文件盘点。
- 执行分组 focused tests 与 type-check。

### 标注文档

- 明确 Step 8 当前状态：schedule trigger CRUD 与 remote runner pool 基础 list/lease/job 已下沉；processor 作为 API/worker entry 保留，fire 与 remote execution pipeline 仍待拆 domain service。

### 审查待实施项

- API `apps/api/src/modules/loops` 当前剩余文件：
  - API 层：`loops.controller.ts`、`loops.module.ts`、`loops-rbac.decorator.ts`
  - Worker entry：`loops-eval-aggregation.processor.ts`、`loops-remote-runner.processor.ts`、`loops-trigger-scheduler.processor.ts`
  - Legacy 聚合：`loops.service.ts`
  - 待解耦服务：`loops-cross-tenant-archive.service.ts`
  - API/legacy specs：`loops.service.spec.ts`、`loops-persistence.db.spec.ts`、`loops-cost-guard.spec.ts`、`loops-simple-issue.spec.ts`、`loops-remote-runner.cli-e2e.spec.ts`
- 反向依赖扫描仅命中注释中的历史路径说明，无 domain 到 API 的代码 import/require。
- 下一批若继续推进，建议顺序：
  1. 抽 `loops-evidence` 的 delivery controls / coverage enricher，解锁 Step 2 list/getIssue 下沉。
  2. 抽 `loops-triggers.fireScheduleTrigger` 所需的 issue creation port。
  3. 抽 `loops-remote-runners.executeRemoteShardJob` pipeline。

### 再标注文档

- Cycle 15 完成；新增后续循环的审查结论已写入本文档。

### 验证

```bash
rg "apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops|from './loops.service'|require\\('./loops.service'\\)" apps/api/libs/domain/services
pnpm --filter @repo/api test -- loops-runner.service.spec.ts cli-loops-git.adapter.spec.ts loops-pr-provider.client.spec.ts loops-mcp-client.service.spec.ts loops.service.spec.ts --runInBand
pnpm --filter @repo/api type-check
```

结果：

- 反向依赖扫描仅剩模块注释中的历史路径说明，无代码 import / require。
- 5 个 focused test suite 通过，97 个测试通过。
- API type-check 通过。

## Cycle 16 · Step 5c 下沉 Workflow Baseline Evidence 原语

### 实施

- 在 `LoopsEvidenceService` 中新增 `buildWorkflowBaselineEvidence`。
- `LoopsService.buildWorkflowBaselineEvidence` 改为委托 `LoopsEvidenceService`。
- 保留 legacy private 方法作为兼容 facade，避免一次性扰动调用点。

### 标注文档

- 当前剩余待实施项中 Step 5 更新为：workflow baseline evidence 原语已下沉；delivery evidence markdown、review/release gates、requirements coverage builder 仍在 API `LoopsService`。

### 审查待实施项

- 待实施：
  - review/release gate builder 仍依赖多组 legacy helper，需要单独拆 `DeliveryControls` enricher。
  - requirements coverage builder 仍依赖 detail/read coverage summary。
  - delivery evidence markdown builder 仍依赖完整 detail shape。

### 再标注文档

- Cycle 16 完成，下一轮做最终结构审查和状态收敛。

### 验证

```bash
pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand
pnpm --filter @repo/api type-check
```

结果：

- `loops.service.spec.ts` 通过，68 个测试通过。
- API type-check 通过。

## Cycle 17 · 最终验证与状态收敛

### 实施

- 执行 domain services 反向依赖扫描。
- 执行本轮 focused tests。
- 执行 API type-check。
- 汇总当前 diff / status。

### 标注文档

- 确认本轮新增 Cycle 13-17 均已记录。
- 确认 Step 5 / Step 8 的剩余项描述已更新。

### 审查待实施项

- 仍需继续拆的高风险项：
  - `LoopsService` 状态机完整推进方法：`generateSpec` / `reviewSpec` / `decompose` / `runLoop` / `advance` / `finalize` 等。
  - delivery controls / release gates / requirements coverage / delivery evidence markdown。
  - `fireScheduleTrigger` 的 issue creation port。
  - `executeRemoteShardJob` remote execution pipeline。
  - `LoopsCrossTenantArchiveService` 对 `LoopsService` 的循环依赖。
- 当前 API `loops.module.ts` 保留 adapter provider wiring，属于装配逻辑；后续若要进一步下沉，需要让 `LoopsRunnersModule` 接管 `LOOPS_*_ADAPTER` token factory。

### 再标注文档

- Cycle 17 完成；本轮共完成 Cycle 13-17 五次循环动作。

### 验证

```bash
rg "apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops|from './loops.service'|require\\('./loops.service'\\)" apps/api/libs/domain/services
pnpm --filter @repo/api test -- loops-runner.service.spec.ts cli-loops-git.adapter.spec.ts loops-pr-provider.client.spec.ts loops-mcp-client.service.spec.ts loops.service.spec.ts --runInBand
pnpm --filter @repo/api type-check
```

结果：

- 反向依赖扫描仅剩模块注释中的历史路径说明，无代码 import / require。
- 5 个 focused test suite 通过，97 个测试通过。
- API type-check 通过。

## Cycle 18 · Step 5d 下沉 Evidence 纯判定与 Markdown 原语

### 实施

- 扩展 `apps/api/libs/domain/services/loops-evidence/LoopsEvidenceService`。
- 下沉以下纯/近纯 evidence 原语：
  - `buildDeliveryEvidenceMarkdown`
  - `buildRuntimeSecurityExceptions`
  - `deliveryBlockedReason`
  - `isSpecApproved`
  - `isImplementationDone`
  - `isReviewPassed`
  - `isBrowserQaPassed`
  - `isReleaseReady`
  - `testsPassed`
  - `reviewFindingsCount`
  - `phaseAtLeast`
  - `checkRulesCompliance`
  - `applySecondOpinionPolicy`
  - `isSecondOpinionReviewerPassed`
- `LoopsService` 保留同名私有 wrapper，但实现改为委托 `this.evidence.*`，保持 legacy facade 的调用面不变。

### 标注文档

- Step 5 状态继续为“部分完成”：delivery markdown、runtime security exception 与多组 gate predicate 已下沉。
- 标注：本轮只迁纯/近纯 helper，不迁 `buildWorkflowRecipe` / `buildReviewGates` / `buildReleaseGate` 组合 builder。

### 审查待实施项

- 待实施：
  - `buildReviewGates` / `buildReleaseGate` 仍在 API `LoopsService`，下一轮可在已有 predicate 下沉后继续处理。
  - `buildRequirementsCoverage` 仍需单独处理 coverage 文本匹配与 summary builder。
  - `withRequirementsCoverage` / `withDeliveryControlsList` 仍待 coverage 与 delivery controls builder 就位后迁移。

### 再标注文档

- Cycle 18 完成，进入 release gate 阻断逻辑下沉。

### 验证

```bash
pnpm --filter @repo/api type-check
```

结果：API type-check 通过。

## Cycle 19 · Step 5e 下沉 Release Gate Blockers

### 实施

- 在 `LoopsEvidenceService` 中新增 `buildReleaseGateBlockers`。
- 将 `enforceReleaseGate` 中的 checklist blocker、second-opinion conflict resolution、Rules Center violation 聚合逻辑下沉到 domain service。
- `LoopsService.enforceReleaseGate` 保留日志与 `BadRequestException` 抛错职责，避免 domain service 依赖 Nest HTTP 异常与 API logger。

### 标注文档

- Step 5 状态继续为“部分完成”：release gate 的阻断判定已下沉；异常呈现仍由 API facade 负责。
- 标注：本轮没有迁移 `enforceReleaseGate` 整方法，因为它包含 API 层日志与 HTTP exception 语义。

### 审查待实施项

- 待实施：
  - `buildReleaseGate` 本体仍在 API `LoopsService`，但依赖的 predicate / blocker 已经在 domain。
  - `buildReviewGates` 仍需要处理 governance override 与 evidence id lookup。
  - `buildDeliveryControls` 仍作为组合入口留在 facade。

### 再标注文档

- Cycle 19 完成，下一轮处理 coverage builder 的纯函数部分。

### 验证

```bash
pnpm --filter @repo/api type-check
```

结果：API type-check 通过。

## Cycle 20 · Step 5f 下沉 Requirements Coverage Builder

### 实施

- 在 `LoopsEvidenceService` 中新增 requirements coverage 构建与聚合方法：
  - `buildRequirementsCoverage`
  - `resolveRequirementStatus`
  - `summarizeRequirementsCoverage`
  - `aggregateCoverageSummaries`
  - `emptyCoverageSummary`
  - `coverageTextMatches`
  - `normalizeCoverageText`
- `LoopsService` 的同名私有方法全部改为委托 `this.evidence.*`。

### 标注文档

- Step 5 当前状态更新为：requirements coverage builder 已下沉。
- 标注：`readCoverageSummary` 仍留 API facade，因为它调用 `getIssue`；待 `getIssue` / issue query port 下沉后再迁。

### 审查待实施项

- 待实施：
  - `buildEvidenceArtifacts` 仍在 API `LoopsService`，它是 `withRequirementsCoverage` 的另一个前置。
  - `withRequirementsCoverage` 在 coverage + artifact builder 都下沉后可继续委托/迁移。
  - `withDeliveryControlsList` 仍依赖 list item detail 读取与 delivery controls builder。

### 再标注文档

- Cycle 20 完成，下一轮处理 evidence artifact builder。

### 验证

```bash
pnpm --filter @repo/api type-check
pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand
```

结果：

- API type-check 通过。
- `loops.service.spec.ts` 通过，68 个测试通过。

## Cycle 21 · Step 5g 下沉 Evidence Artifact Builder

### 实施

- 在 `LoopsEvidenceService` 中新增 `buildEvidenceArtifacts`。
- 使用结构类型 `EvidenceArtifactInput` 承接 detail 所需字段，避免 domain service import API `LoopsService` 本地派生类型。
- `LoopsService.buildEvidenceArtifacts` 改为委托 `this.evidence.buildEvidenceArtifacts(detail)`。
- 为结构类型下 `rawPayloadRef` 可能缺失的场景补充稳定 artifact fallback path。

### 标注文档

- Step 5 当前状态更新为：evidence artifact builder 已下沉。
- 标注：本轮仍保留 `LoopsService` 私有 wrapper，避免一次性修改所有 legacy 调用点。

### 审查待实施项

- 待实施：
  - `withRequirementsCoverage` 现在只剩组合职责，可在下一轮迁移为 `LoopsEvidenceService.withRequirementsCoverage`。
  - `buildReviewGates` / `buildReleaseGate` / `buildWorkflowRecipe` 仍在 facade。
  - `withDeliveryControlsList` 仍依赖 detail 读取和 delivery controls 组合。

### 再标注文档

- Cycle 21 完成，下一轮处理 `withRequirementsCoverage` 组合 enricher。

### 验证

```bash
pnpm --filter @repo/api type-check
pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand
```

结果：

- API type-check 通过。
- `loops.service.spec.ts` 通过，68 个测试通过。

## Cycle 22 · Step 5h 下沉 Requirements Coverage 组合 Enricher

### 实施

- 在 `LoopsEvidenceService` 中新增 `withRequirementsCoverage`。
- 该 enricher 组合 `buildEvidenceArtifacts` 与 `buildRequirementsCoverage`，并通过回调接入尚未下沉的 `buildDeliveryControls`。
- `LoopsService.withRequirementsCoverage` 改为委托 `this.evidence.withRequirementsCoverage(...)`，继续保留 legacy 私有入口。

### 标注文档

- Step 5 当前状态更新为：`withRequirementsCoverage` 组合 enricher 已下沉。
- 标注：`buildDeliveryControls` / `buildWorkflowRecipe` / `buildReviewGates` / `buildReleaseGate` 尚未全部下沉，因此本轮使用回调保持依赖方向正确。

### 审查待实施项

- 待实施：
  - `buildDeliveryControls` 仍在 API facade，后续需要把 workflow recipe / review gate / release gate 组合一起迁入 evidence。
  - `withDeliveryControlsList` 仍需要 `readDetail`，更适合在 issue query port 下沉时一起迁。
  - `list` / `getIssue` 下沉已少一个关键阻塞，但仍依赖 delivery controls list enricher。

### 再标注文档

- Cycle 22 完成，下一轮做最终结构审查与状态收敛。

### 验证

```bash
pnpm --filter @repo/api type-check
pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand
```

结果：

- API type-check 通过。
- `loops.service.spec.ts` 通过，68 个测试通过。

## Cycle 23 · 结构审查与状态收敛

### 实施

- 执行 domain services 反向依赖扫描。
- 执行 focused tests：
  - `loops-runner.service.spec.ts`
  - `cli-loops-git.adapter.spec.ts`
  - `loops-pr-provider.client.spec.ts`
  - `loops-mcp-client.service.spec.ts`
  - `loops.service.spec.ts`
- 执行 API type-check。
- 同步 `EXECUTION.md` 顶部进度表，使执行总览与 Cycle 18-22 的实际状态一致。

### 标注文档

- 标注本批 Cycle 18-23 已完成至少 5 次循环动作。
- Step 5 标注为“部分完成”：coverage/artifact/enricher 已明显前移，但 review/release gate builder 与 delivery controls list enricher 仍待迁。
- Step 4 / Step 6 / Step 7 / Step 8 / Step 9 的执行总览按前序循环成果修正为“部分完成”。

### 审查待实施项

- domain services 反向依赖扫描只命中模块注释中的历史路径说明，无代码 import / require。
- 当前最接近继续拆分的 Step 5 待办：
  - `buildWorkflowRecipe`
  - `buildReviewGates`
  - `buildReleaseGate`
  - `buildDeliveryControls`
  - `withDeliveryControlsList`
- Step 2 的 `list` / `getIssue` 仍待 `withDeliveryControlsList` 或 issue query port 完成后迁移。
- Step 3 engine 推进方法仍待 store/evidence/runner 依赖进一步稳定后单独高风险拆分。

### 再标注文档

- Cycle 23 完成；本批从 Cycle 18 到 Cycle 23 共 6 次循环，满足“至少 5 次循环动作”要求。

### 验证

```bash
rg "apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops|from './loops.service'|require\\('./loops.service'\\)" apps/api/libs/domain/services
pnpm --filter @repo/api test -- loops-runner.service.spec.ts cli-loops-git.adapter.spec.ts loops-pr-provider.client.spec.ts loops-mcp-client.service.spec.ts loops.service.spec.ts --runInBand
pnpm --filter @repo/api type-check
```

结果：

- 反向依赖扫描仅命中模块注释中的历史路径说明，无代码 import / require。
- 5 个 focused test suite 通过，97 个测试通过。
- API type-check 通过。

## Cycle 24 · Step 5i 下沉 Review Gates Builder

### 实施

- 在 `LoopsEvidenceService` 中新增 `evidenceIdsByKind` 与 `buildReviewGates`。
- 使用结构类型承接 `deliveryGovernance.requiredReviewGates` 与 `reviewGateOverrides`，保持 domain service 不依赖 API `LoopsService` 本地类型。
- `LoopsService.buildReviewGates` 改为委托 `this.evidence.buildReviewGates(item)`。

### 标注文档

- Step 5 当前状态更新为：review gates builder 已下沉。
- 标注：`LoopsService` 保留私有 wrapper，减少 legacy 调用点扰动。

### 审查待实施项

- 待实施：
  - `buildReleaseGate` 仍在 API facade，但其依赖的 review gates builder 已在 domain。
  - `buildWorkflowRecipe` 和 `buildDeliveryControls` 仍在 API facade。
  - `withDeliveryControlsList` 仍需 detail 读取能力配合。

### 再标注文档

- Cycle 24 完成，下一轮处理 release gate builder。

### 验证

```bash
pnpm --filter @repo/api type-check
pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand
```

结果：

- API type-check 通过。
- `loops.service.spec.ts` 通过，68 个测试通过。

## Cycle 25 · Step 5j 下沉 Release Gate Builder

### 实施

- 在 `LoopsEvidenceService` 中新增 `buildReleaseGate`。
- `buildReleaseGate` 接收 facade 计算出的可选 `secondOpinion`，避免本轮把 `buildSecondOpinion` 一并迁入。
- `LoopsService.buildReleaseGate` 改为只负责 detail 判定与 second opinion 计算，然后委托 `this.evidence.buildReleaseGate(item, secondOpinion)`。

### 标注文档

- Step 5 当前状态更新为：release gate builder 已下沉。
- 标注：二审报告生成仍在 API facade；domain release gate builder 只消费报告结果。

### 审查待实施项

- 待实施：
  - `buildWorkflowRecipe` 仍在 API facade。
  - `buildDeliveryControls` 仍是 workflow/review/release/secondOpinion 的组合入口。
  - `withDeliveryControlsList` 仍待 delivery controls 组合下沉后处理。

### 再标注文档

- Cycle 25 完成，下一轮处理 workflow recipe builder。

### 验证

```bash
pnpm --filter @repo/api type-check
pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand
```

结果：

- API type-check 通过。
- `loops.service.spec.ts` 通过，68 个测试通过。

## Cycle 26 · Step 5k 下沉 Workflow Recipe Builder

### 实施

- 在 `LoopsEvidenceService` 中新增 `buildWorkflowRecipe`。
- 补齐 `DeliveryControlInput` 对 `workflowRecipe`、`workflowDefaults`、`evidenceArtifacts` 的结构化描述。
- `LoopsService.buildWorkflowRecipe` 改为委托 `this.evidence.buildWorkflowRecipe(item)`。

### 标注文档

- Step 5 当前状态更新为：workflow recipe builder 已下沉。
- 标注：返回结构保持原 legacy 行为，不在本轮补充 contract schema 之外的字段，避免重构中夹带行为变更。

### 审查待实施项

- 待实施：
  - `buildDeliveryControls` 仍是 API facade 中的组合入口。
  - `withDeliveryControlsList` 仍依赖 detail 读取和 delivery controls 组合。
  - `buildSecondOpinion` 仍在 API facade，可后续单独下沉。

### 再标注文档

- Cycle 26 完成，下一轮处理 delivery controls 组合入口。

### 验证

```bash
pnpm --filter @repo/api type-check
pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand
```

结果：

- API type-check 通过。
- `loops.service.spec.ts` 通过，68 个测试通过。

## Cycle 27 · Step 5l 下沉 Delivery Controls 组合入口

### 实施

- 在 `LoopsEvidenceService` 中新增 `buildDeliveryControls`。
- `buildDeliveryControls` 组合 workflow recipe、review gates、release gate，并接收 facade 计算出的可选 `secondOpinion`。
- `LoopsService.buildDeliveryControls` 改为计算 detail/secondOpinion 后委托 `this.evidence.buildDeliveryControls(item, secondOpinion)`。

### 标注文档

- Step 5 当前状态更新为：delivery controls 组合入口已下沉。
- 标注：second opinion 生成仍保留在 API facade，后续可作为独立循环迁移。

### 审查待实施项

- 待实施：
  - `withDeliveryControlsList` 仍在 API facade。
  - `withRequirementsCoverage` 仍通过回调接入 delivery controls，可改为直接使用 domain 组合。
  - Step 2 `list` / `getIssue` 仍未迁移。

### 再标注文档

- Cycle 27 完成，下一轮处理 delivery controls list / requirements enricher 收敛。

### 验证

```bash
pnpm --filter @repo/api type-check
pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand
```

结果：

- API type-check 通过。
- `loops.service.spec.ts` 通过，68 个测试通过。

## Cycle 28 · Step 5m 收敛 Requirements Enricher 对 Facade 的回调依赖

### 实施

- 调整 `LoopsEvidenceService.withRequirementsCoverage`，不再接收 `buildDeliveryControls` 回调。
- `withRequirementsCoverage` 直接调用 domain 内的 `buildDeliveryControls`。
- `LoopsService.withRequirementsCoverage` 仅负责传入现有 `buildSecondOpinion(detail)` 结果。

### 标注文档

- Step 5 当前状态更新为：requirements enricher 已完全使用 domain delivery controls 组合。
- 标注：facade 仍负责 second opinion 生成，避免本轮扩大范围。

### 审查待实施项

- 待实施：
  - `withDeliveryControlsList` 仍在 API facade，可通过 read/log 回调下沉。
  - `buildSecondOpinion` 仍在 API facade。
  - Step 2 `list` / `getIssue` 可在 list enricher 下沉后继续评估。

### 再标注文档

- Cycle 28 完成，下一轮处理 `withDeliveryControlsList`。

### 验证

```bash
pnpm --filter @repo/api type-check
pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand
```

结果：

- API type-check 通过。
- `loops.service.spec.ts` 通过，68 个测试通过。

## Cycle 29 · Step 5n 下沉 Delivery Controls List Enricher

### 实施

- 在 `LoopsEvidenceService` 中新增 `withDeliveryControlsList`。
- domain service 负责 list item 的 delivery controls、runtime security exceptions、delivery governance 合并。
- `readDetail`、`buildSecondOpinion`、`onReadError` 通过回调传入，避免 domain service 反向依赖 API facade 或 logger。
- `LoopsService.withDeliveryControlsList` 改为委托 `this.evidence.withDeliveryControlsList(...)`。

### 标注文档

- Step 5 当前状态更新为：delivery controls list enricher 已下沉。
- 标注：IO 读取和日志仍由 API facade 提供，业务组合在 domain service 中完成。

### 审查待实施项

- 待实施：
  - `buildSecondOpinion` 仍在 API facade。
  - Step 2 `list` / `getIssue` 仍在 API facade，但 evidence/controls enricher 的主要阻塞已消除。
  - 可继续评估 `readCoverageSummary` 与 issue query port 的下沉。

### 再标注文档

- Cycle 29 完成，下一轮做结构审查与状态收敛。

### 验证

```bash
pnpm --filter @repo/api type-check
pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand
```

结果：

- API type-check 通过。
- `loops.service.spec.ts` 通过，68 个测试通过。

## Cycle 30 · 结构审查与 Step 5 状态收敛

### 实施

- 执行 domain services 反向依赖扫描。
- 执行 focused tests：
  - `loops-runner.service.spec.ts`
  - `cli-loops-git.adapter.spec.ts`
  - `loops-pr-provider.client.spec.ts`
  - `loops-mcp-client.service.spec.ts`
  - `loops.service.spec.ts`
- 执行 API type-check。
- 同步 `EXECUTION.md` 顶部 Step 5 状态。

### 标注文档

- 标注本批 Cycle 24-30 已完成 7 次循环动作，满足“至少 5 次循环动作”要求。
- Step 5 更新为：review/release gate builder、delivery controls、delivery controls list enricher 已下沉。
- 标注：`buildSecondOpinion` 仍在 API facade，Step 2 `list` / `getIssue` 仍待 issue query port 拆分。

### 审查待实施项

- domain services 反向依赖扫描只命中模块注释中的历史路径说明，无代码 import / require。
- API `LoopsService` 中 Step 5 剩余 evidence/quality 相关待办：
  - `buildSecondOpinion`
  - legacy wrapper：`buildWorkflowRecipe` / `buildReviewGates` / `buildReleaseGate` / `buildDeliveryControls`
- Step 2 当前更接近可迁移：`list` / `getIssue` 的主要 delivery enricher 阻塞已下沉，但仍需要抽 issue query/read port。
- Step 3 engine 推进方法仍需单独高风险循环。

### 再标注文档

- Cycle 30 完成；本批从 Cycle 24 到 Cycle 30 共 7 次循环，继续保持文档与实施状态一致。

### 验证

```bash
rg "apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops|from './loops.service'|require\\('./loops.service'\\)" apps/api/libs/domain/services
pnpm --filter @repo/api test -- loops-runner.service.spec.ts cli-loops-git.adapter.spec.ts loops-pr-provider.client.spec.ts loops-mcp-client.service.spec.ts loops.service.spec.ts --runInBand
pnpm --filter @repo/api type-check
```

结果：

- 反向依赖扫描仅命中模块注释中的历史路径说明，无代码 import / require。
- 5 个 focused test suite 通过，97 个测试通过。
- API type-check 通过。

## Cycle 31 · Step 5o 下沉 Second Opinion Builder

### 实施

- 在 `LoopsEvidenceService` 中新增 `buildSecondOpinion`。
- `buildSecondOpinion` 复用已下沉的 `buildPrimarySecondOpinionFindings` / `compareSecondOpinionFindings`。
- `LoopsService.buildSecondOpinion` 改为委托 `this.evidence.buildSecondOpinion(detail)`。
- API `LoopsService` 移除对 second-opinion comparison util 的直接 import。

### 标注文档

- Step 5 当前状态更新为：second opinion builder 已下沉。
- 标注：API `LoopsService` 仅保留兼容 wrapper，避免一次性修改所有调用点。

### 审查待实施项

- 待实施：
  - Step 2 `getIssue` / `list` 仍在 API facade，但 evidence / delivery controls / second opinion 主要阻塞已下沉。
  - legacy wrapper 后续可随 facade 收敛统一删除。
  - Step 3 engine 推进方法仍需独立高风险循环。

### 再标注文档

- Cycle 31 完成，下一轮评估并拆 `getIssue` issue read port。

### 验证

```bash
pnpm --filter @repo/api type-check
pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand
```

结果：

- API type-check 通过。
- `loops.service.spec.ts` 首次运行命中既有 Browser QA canary 5s timeout flake；单独重跑通过，68 个测试通过。

## Cycle 32 · Step 2a 下沉 getIssue Read Pipeline

### 实施

- 在 `LoopsIssuesService` 中新增 `getIssue`。
- `getIssue` 通过 DB persistence 或 file store 读取 detail，并接收 caller-provided detail enricher。
- `LoopsService.getIssue` 改为委托 `this.issues.getIssue(issueId, ...)`，保留原有 warn log 与 `NotFoundException` 映射。

### 标注文档

- Step 2 当前状态更新为：`getIssue` read pipeline 已下沉。
- 标注：HTTP exception / 日志仍归 API facade，domain service 不引入 controller 语义。

### 审查待实施项

- 待实施：
  - `list` / `listFromFile` 仍在 API facade。
  - `readCoverageSummary` 仍调用 `getIssue`，待 list/query 进一步下沉后评估归属。
  - legacy wrapper 仍需随 Step 10 统一收敛。

### 再标注文档

- Cycle 32 完成，下一轮处理 `list` / `listFromFile` query pipeline。

### 验证

```bash
pnpm --filter @repo/api type-check
pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand
```

结果：

- API type-check 通过。
- `loops.service.spec.ts` 通过，68 个测试通过。

## Cycle 33 · Step 2b 下沉 list / listFromFile Query Pipeline

### 实施

- 在 `LoopsIssuesService` 中新增 `list` 与私有 `listFromFile`。
- `list` 通过 DB persistence 或 file store 获取列表，并接收 caller-provided list enricher。
- `LoopsService.list` 改为委托 `this.issues.list(query, ...)`。
- 删除 API facade 中的 `listFromFile` 实现。

### 标注文档

- Step 2 当前状态更新为：`list` / `listFromFile` / `getIssue` query/read pipeline 已下沉。
- 标注：API facade 仍保留兼容入口；delivery controls list enricher 仍由 facade 注入。

### 审查待实施项

- 待实施：
  - Step 2 legacy wrapper 可在 Step 10 facade 收敛时统一处理。
  - `readCoverageSummary` 仍在 API facade，可后续根据 eval/list 依赖决定归属。
  - Step 3 engine 推进仍未拆。

### 再标注文档

- Cycle 33 完成，下一轮做结构审查并选择后续低风险切片。

### 验证

```bash
pnpm --filter @repo/api type-check
pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand
```

结果：

- API type-check 通过。
- `loops.service.spec.ts` 通过，68 个测试通过。

## Cycle 34 · 结构审查与下一切片选择

### 实施

- 执行 API facade 剩余方法扫描。
- 执行 domain services 反向依赖扫描。
- 审查 Step 6 Eval / Bench 的纯 builder 边界。

### 标注文档

- Step 2 标注为 query/read pipeline 已下沉，仍保留 API 兼容入口。
- Step 5 标注为主要 evidence/delivery controls builder 已下沉，仍有 legacy wrapper。
- Step 6 标注为下一批可低风险推进：先下沉 eval suite / bench metric 的纯 builder，不碰 evidence collection IO。

### 审查待实施项

- 待实施：
  - Step 6：`buildEvalSuites` / `evalSuiteBlueprints` / `materializeEvalSuite` / `evaluateEvalCheck` / `evalAggregateStatus`。
  - Step 6：`buildLoopBenchMetrics` / `diffLoopBenchMetrics` / `percent`。
  - Step 3：engine 主流程仍高风险，暂不在本批直接拆。

### 再标注文档

- Cycle 34 完成，下一轮下沉 Eval suite 纯 builder。

### 验证

```bash
rg "apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops|from './loops.service'|require\\('./loops.service'\\)" apps/api/libs/domain/services
```

结果：仅命中模块注释中的历史路径说明，无代码 import / require。

## Cycle 35 · Step 6b 下沉 Eval Suite 纯 Builder

### 实施

- 新增 `LoopsEvalService`。
- `LoopsEvalService` 承接：
  - `buildEvalSuites`
  - `evalSuiteBlueprints`
  - `materializeEvalSuite`
  - `evaluateEvalCheck`
  - `evalAggregateStatus`
- `LoopsEvalModule` 注册并导出 `LoopsEvalService`。
- `LoopsService` 注入 `LoopsEvalService`，原私有方法改为 wrapper 委托。

### 标注文档

- Step 6 当前状态更新为：Eval suite builder 已下沉。
- 标注：`collectEvalEvidence` 仍留 API facade，因为它调用 `list` / `cost` / `readDetail` 并处理 warn log。

### 审查待实施项

- 待实施：
  - Eval run builder 仍在 API facade。
  - Loop bench metrics / trend helper 仍在 API facade。
  - Eval evidence collection IO 仍在 API facade。

### 再标注文档

- Cycle 35 完成，下一轮处理 loop bench metric 纯 helper。

### 验证

```bash
pnpm --filter @repo/api type-check
pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand
```

结果：

- API type-check 通过。
- `loops.service.spec.ts` 通过，68 个测试通过。

## Cycle 36 · Step 6c 下沉 Loop Bench Metric 纯 Helper

### 实施

- `LoopsEvalService` 新增：
  - `buildLoopBenchMetrics`
  - `diffLoopBenchMetrics`
  - `percent`
- `LoopsService` 对应私有方法改为委托 `this.evalService.*`。

### 标注文档

- Step 6 当前状态更新为：loop bench metric helper 已下沉。
- 标注：trend worker 的 store IO / history append 仍留 API facade，避免本轮扩大到 worker 编排。

### 审查待实施项

- 待实施：
  - Eval run builder 仍在 API facade。
  - Eval trend worker / loop bench trend worker 的 IO 编排仍在 API facade。
  - cross-tenant eval aggregation request-time helper 仍待评估。

### 再标注文档

- Cycle 36 完成，下一轮做最终结构审查与状态收敛。

### 验证

```bash
pnpm --filter @repo/api type-check
pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand
```

结果：

- API type-check 通过。
- `loops.service.spec.ts` 通过，68 个测试通过。

## Cycle 37 · 结构审查与状态收敛

### 实施

- 执行 domain services 反向依赖扫描。
- 执行 focused tests：
  - `loops-runner.service.spec.ts`
  - `cli-loops-git.adapter.spec.ts`
  - `loops-pr-provider.client.spec.ts`
  - `loops-mcp-client.service.spec.ts`
  - `loops.service.spec.ts`
- 执行 API type-check。
- 同步 `EXECUTION.md` 顶部 Step 2 / Step 5 / Step 6 状态。

### 标注文档

- 标注本批 Cycle 31-37 已完成 7 次循环动作，满足“至少 5 次循环动作”要求。
- Step 2 更新为：`list` / `listFromFile` / `getIssue` query/read pipeline 已下沉。
- Step 5 更新为：second opinion builder 已下沉，API 仅留兼容 wrapper。
- Step 6 更新为：eval suite builder 与 loop bench metric helper 已下沉。

### 审查待实施项

- domain services 反向依赖扫描只命中模块注释中的历史路径说明，无代码 import / require。
- 当前剩余高价值待办：
  - Step 6：Eval run builder 与 trend worker IO。
  - Step 3：engine 主流程推进方法。
  - Step 8：`fireScheduleTrigger` 与 remote execution pipeline。
  - Step 9：Archive/tool/blueprint。
  - Step 10：清理 legacy wrappers / 收敛 API module。

### 再标注文档

- Cycle 37 完成；本批从 Cycle 31 到 Cycle 37 共 7 次循环，继续保持文档与实施状态一致。

### 验证

```bash
rg "apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops|from './loops.service'|require\\('./loops.service'\\)" apps/api/libs/domain/services
pnpm --filter @repo/api test -- loops-runner.service.spec.ts cli-loops-git.adapter.spec.ts loops-pr-provider.client.spec.ts loops-mcp-client.service.spec.ts loops.service.spec.ts --runInBand
pnpm --filter @repo/api type-check
```

结果：

- 反向依赖扫描仅命中模块注释中的历史路径说明，无代码 import / require。
- 5 个 focused test suite 通过，97 个测试通过。
- API type-check 通过。

## Cycle 38 · Step 6d 下沉 Eval Run 纯 Builder

### 实施

- `LoopsEvalService` 新增：
  - `buildEvalRuns`
  - `evalBlueprintId`
  - `latestEvalBaseline`
  - `evalBaselineVersion`
  - `roundAverage`
  - `safeId`
- `LoopsService` 对应私有方法改为 wrapper 委托。
- `buildEvalRuns` 通过 `inferWorkflowKind` 回调保持原 fallback 行为。

### 标注文档

- Step 6 当前状态更新为：Eval run builder 已下沉。
- 标注：`runEvalTrendWorker` 的 store history IO 仍留 API facade。

### 审查待实施项

- 待实施：
  - Eval trend baseline 生成逻辑仍在 API facade。
  - Trend worker 的 `store.appendEvalTrendSnapshots` IO 仍在 API facade。
  - Cross-tenant eval request-time helper 仍待评估。

### 再标注文档

- Cycle 38 完成，下一轮处理 Eval trend baseline 纯生成逻辑。

### 验证

```bash
pnpm --filter @repo/api type-check
pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand
```

结果：

- API type-check 通过。
- `loops.service.spec.ts` 通过，68 个测试通过。

## Cycle 39 · Step 6e 下沉 Eval Trend Baseline Builder

### 实施

- `LoopsEvalService` 新增 `buildEvalTrendBaselines`。
- 将 `runEvalTrendWorker` 中 runs 分组、baseline 聚合、trend delta 计算下沉到 domain service。
- `LoopsService.runEvalTrendWorker` 保留 evidence/history 读取与 `store.appendEvalTrendSnapshots` IO。

### 标注文档

- Step 6 当前状态更新为：Eval trend baseline builder 已下沉。
- 标注：trend worker IO 仍留 API facade，保持 domain builder 纯计算。

### 审查待实施项

- 待实施：
  - Cross-tenant eval request-time aggregation helper。
  - Eval / bench trend worker 的 store IO 编排。
  - Legacy eval helper wrappers 后续可在 Step 10 清理。

### 再标注文档

- Cycle 39 完成，下一轮审查 cross-tenant aggregation 可拆边界。

### 验证

```bash
pnpm --filter @repo/api type-check
pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand
```

结果：

- API type-check 通过。
- `loops.service.spec.ts` 通过，68 个测试通过。

## Cycle 40 · Step 6f 下沉 Request-Time Eval Aggregation Builder

### 实施

- `LoopsEvalService` 新增 `buildRequestTimeAggregation`。
- 将 request-time fallback 中 suites → aggregation response 的纯构造逻辑下沉到 domain service。
- `LoopsService.buildRequestTimeAggregation` 保留 evidence collection IO，并委托 `this.evalService.buildRequestTimeAggregation(...)`。
- 收窄 `buildRequestTimeAggregation` 的 `period` 参数类型，匹配上游 contract union。

### 标注文档

- Step 6 当前状态更新为：request-time aggregation builder 已下沉。
- 标注：Redis/DB/cache/store IO 仍留 API facade。

### 审查待实施项

- 待实施：
  - Eval / bench trend worker 的 store IO 编排。
  - Cross-tenant aggregation worker 的 DB/Redis persistence 编排。
  - legacy eval wrappers 后续在 Step 10 清理。

### 再标注文档

- Cycle 40 完成，下一轮做结构审查与状态收敛。

### 验证

```bash
pnpm --filter @repo/api type-check
pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand
```

结果：

- API type-check 通过。
- `loops.service.spec.ts` 通过，68 个测试通过。

## Cycle 41 · 结构审查与 Step 6 状态收敛

### 实施

- 执行 domain services 反向依赖扫描。
- 执行 focused tests：
  - `loops-runner.service.spec.ts`
  - `cli-loops-git.adapter.spec.ts`
  - `loops-pr-provider.client.spec.ts`
  - `loops-mcp-client.service.spec.ts`
  - `loops.service.spec.ts`
- 执行 API type-check。
- 同步 `EXECUTION.md` 顶部 Step 6 状态。

### 标注文档

- 标注本批 Cycle 38-42 计划完成 5 次循环动作，满足“至少 5 次循环动作”要求。
- Step 6 更新为：eval suite/run builder、eval trend baseline builder、request-time aggregation builder、loop bench metric helper 已下沉。
- 标注：trend worker IO / DB / Redis / store append 仍留 API facade。

### 审查待实施项

- domain services 反向依赖扫描只命中模块注释中的历史路径说明，无代码 import / require。
- 当前剩余高价值待办：
  - Step 6：Eval / bench trend worker IO 编排。
  - Step 3：engine 主流程推进方法。
  - Step 8：`fireScheduleTrigger` 与 remote execution pipeline。
  - Step 9：Archive/tool/blueprint。
  - Step 10：清理 legacy wrappers / 收敛 API module。

### 再标注文档

- Cycle 41 完成；Step 6 的纯 builder 大头已迁入 `loops-eval`。

### 验证

```bash
rg "apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops|from './loops.service'|require\\('./loops.service'\\)" apps/api/libs/domain/services
pnpm --filter @repo/api test -- loops-runner.service.spec.ts cli-loops-git.adapter.spec.ts loops-pr-provider.client.spec.ts loops-mcp-client.service.spec.ts loops.service.spec.ts --runInBand
pnpm --filter @repo/api type-check
```

结果：

- 反向依赖扫描仅命中模块注释中的历史路径说明，无代码 import / require。
- 5 个 focused test suite 通过，97 个测试通过。
- API type-check 通过。

## Cycle 42 · 最终盘点与文档一致性校准

### 实施

- 复查 Cycle 38-41 的文档顺序与 Step 6 总览。
- 复查当前工作树中 `loops-eval` 新增 service/module/barrel 状态。
- 汇总本批验证结果与剩余待办。

### 标注文档

- 确认本批 Cycle 38-42 共 5 次循环动作。
- 确认 Step 6 总览与 `EXECUTION.md` 一致：纯 builder 已下沉，worker IO 仍留 facade。

### 审查待实施项

- 待实施：
  - Step 6：Eval / bench trend worker IO 编排与 DB/Redis persistence 编排。
  - Step 3：engine 主流程推进方法。
  - Step 8：trigger fire / remote execution pipeline。
  - Step 9：archive/tool/blueprint。
  - Step 10：legacy wrappers 与 API module 收敛。

### 再标注文档

- Cycle 42 完成；本批严格满足至少 5 次循环动作，并准确标注了继续待办项。

### 验证

沿用 Cycle 41 的最终验证结果：

```bash
rg "apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops|from './loops.service'|require\\('./loops.service'\\)" apps/api/libs/domain/services
pnpm --filter @repo/api test -- loops-runner.service.spec.ts cli-loops-git.adapter.spec.ts loops-pr-provider.client.spec.ts loops-mcp-client.service.spec.ts loops.service.spec.ts --runInBand
pnpm --filter @repo/api type-check
```

结果：

- 反向依赖扫描仅命中模块注释中的历史路径说明，无代码 import / require。
- 5 个 focused test suite 通过，97 个测试通过。
- API type-check 通过。

## Cycle 43 · Step 9 下沉 Tool Registry 与 Delivery Blueprint Marketplace

### 实施

- 新增 `apps/api/libs/domain/services/loops-admin/loops-admin.service.ts`。
- `LoopsAdminService` 承接 tool registry 控制面：
  - `listTools`
  - `getTool`
  - `registerTool`
  - `updateTool`
  - `toolHealthCheck`
  - `testTool`
- `LoopsAdminService` 承接 delivery blueprint marketplace：
  - `listBlueprints`
  - `getBlueprint`
  - `createBlueprint`
  - `updateBlueprint`
  - `rollbackBlueprint`
  - `seedDefaultBlueprints`
- `LoopsAdminModule` imports `LoopsStoreModule`，注册并导出 `LoopsAdminService`。
- `LoopsService` 注入 `LoopsAdminService`，上述 public API 改为兼容 wrapper。
- 新增 `adminLogSink()`，将原 facade 日志行为作为窄接口传给 domain service。

### 标注文档

- Step 9 更新为：capability registry、tool registry、delivery blueprint marketplace 已下沉到 `loops-admin`。
- 标注：API controller、ts-rest contract、审计日志和权限入口不变。

### 审查待实施项

- Archive 仍待实施：
  - `archiveTenant`
  - `listTenantArchives`
  - `refreshArchiveDownloadUrl`
- Archive 暂不下沉原因：当前仍依赖 legacy facade 周边装配和 cross-tenant archive service，需要先抽更窄的 loop detail/list port。
- Step 10 暂不执行：本轮只做 domain 下沉，不改 controller 直连关系。

### 再标注文档

- Cycle 43 完成，下一轮补 focused tests。

### 验证

```bash
pnpm --filter @repo/api type-check
```

结果：API type-check 通过。

## Cycle 44 · Step 9 admin service focused tests

### 实施

- 新增 `apps/api/libs/domain/services/loops-admin/loops-admin.service.spec.ts`。
- 使用真实 `LoopsFileStoreService` 与临时 `LOOPS_WORKSPACE_ROOT` 验证 domain service 行为：
  - tool register/list/health-check/persisted health。
  - 空 blueprint store 自动 seed 默认蓝图并可读取。

### 标注文档

- 标注 Step 9 的 tool / blueprint 已具备 domain service 级别测试覆盖。
- 标注：测试不覆盖 controller 审计与 ts-rest response wrapper，因为本批未改变这些边界。

### 审查待实施项

- Archive 下沉时需补 archive service/port focused tests。
- Step 10 移除 wrapper 时需补 controller/service integration tests。

### 再标注文档

- Cycle 44 完成，下一轮做结构审查。

### 验证

```bash
pnpm --filter @repo/api test -- loops-admin.service.spec.ts --runInBand
pnpm --filter @repo/api type-check
```

结果：

- `loops-admin.service.spec.ts` 通过，2 个测试通过。
- API type-check 通过。

## Cycle 45 · Step 9 结构审查

### 实施

- 审查 `loops-admin` 目录形态，当前满足 `1 service + 1 module + n`：
  - `loops-admin.service.ts`
  - `loops-admin.module.ts`
  - `loops-capability-registry.ts`
  - `loops-admin.service.spec.ts`
  - `index.ts`
- 审查 `LoopsDomainModule` 已 re-export `LoopsAdminModule`。
- 审查 API `loops.module.ts` 仍只通过 `LoopsDomainModule` 获取 domain providers。

### 标注文档

- 标注 `loops-admin` 不反向依赖 `apps/api/src/modules/loops`。
- 标注 `LoopsService` 仍作为 legacy facade 保留 public method wrapper。

### 审查待实施项

- `loops-admin` 不应接入 `PermissionService`、controller decorator 或 request user；权限与审计保持 API/controller 层。
- Archive 不能通过注入 legacy `LoopsService` 下沉，必须先抽 port。

### 再标注文档

- Cycle 45 完成，下一轮同步执行文档总览。

### 验证

结构审查由 Cycle 47 的反向依赖扫描覆盖。

## Cycle 46 · 文档标注与总览校准

### 实施

- 更新 `docs/0626/struct-opz/EXECUTION.md` 顶部 Step 9 总览。
- 更新本文件顶部 Step 9 与当前剩余待实施项。
- 补充 Cycle 43-47 执行记录。

### 标注文档

- 删除旧状态“tool/blueprint 仍未完整下沉”的表述。
- 更新为“capability registry、tool registry、delivery blueprint marketplace 已下沉；Archive 仍未完整下沉”。

### 审查待实施项

- Step 9 当前唯一明确剩余为 Archive。
- Step 10 仍待：legacy wrappers / API module provider 收敛。
- Step 8 仍待：`fireScheduleTrigger` 与 remote execution pipeline。
- Step 3 仍待：engine 主流程推进。

### 再标注文档

- Cycle 46 完成，下一轮做最终验证。

### 验证

文档变更随 Cycle 47 的 focused tests / type-check 一起收口。

## Cycle 47 · 收敛验证与下一批待办标注

### 实施

- 执行 domain services 反向依赖扫描。
- 执行 Step 9 focused tests。
- 执行 API type-check。

### 标注文档

- 确认本批 Cycle 43-47 共 5 次循环动作，满足用户要求。
- 确认 Step 9 已完成 tool / blueprint 下沉，Archive 留作后续独立循环。

### 审查待实施项

- 待实施：
  - Step 9：Archive port + archive service 下沉。
  - Step 10：清理 legacy wrappers / API module 收敛。
  - Step 8：`fireScheduleTrigger` issue creation port 与 remote execution pipeline。
  - Step 3：engine 主流程推进方法。
  - Step 6：Eval / bench trend worker IO 编排。

### 再标注文档

- Cycle 47 完成；本批严格执行“实施 → 标注文档 → 审查待实施项 → 再标注文档”的循环，并准确标注剩余项。

### 验证

```bash
rg "from ['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)|require\\(['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)" apps/api/libs/domain/services
pnpm --filter @repo/api test -- loops-admin.service.spec.ts --runInBand
pnpm --filter @repo/api type-check
```

结果：

- 反向依赖扫描无命中。
- `loops-admin.service.spec.ts` 通过，2 个测试通过。
- API type-check 通过。

## Cycle 48 · Step N1 Archive Port 初始下沉

### 实施

- `LoopsAdminService` 新增 archive control port 与 collection port 类型。
- `LoopsAdminService` 承接 `archiveTenant`、`listArchives`、`refreshArchiveUrl` 控制面 wrapper。
- `LoopsService` archive public methods 改为委托 `this.adminService.*`。
- `LoopsCrossTenantArchiveService` 不再注入 legacy `LoopsService` 类，改注入 `LOOPS_ARCHIVE_COLLECTION_PORT`。
- API `loops.module.ts` 临时使用 `useExisting: LoopsService` 绑定 collection port，保持当前 artifact collection 行为。

### 标注文档

- Step 9 更新为：archive control wrapper 已下沉，collection port 已定义。
- 标注：collection port 当前仍由 facade 临时实现，后续继续下沉。

### 审查待实施项

- 待实施：
  - collection port 实现继续拆到 domain read/eval ports。
  - `LoopsCrossTenantArchiveService` focused tests。
  - Step 10 清理 legacy archive wrapper。

### 再标注文档

- Cycle 48 完成，下一轮补 archive focused tests。

### 验证

```bash
pnpm --filter @repo/api type-check
pnpm --filter @repo/api test -- loops-admin.service.spec.ts --runInBand
```

结果：均通过。

## Cycle 49 · Step N1 Archive Focused Tests

### 实施

- `loops-admin.service.spec.ts` 增加 archive control port 行为测试。
- 覆盖 archive tenant 委托、list 包装、refresh message、未配置 archive port 的兼容行为。

### 标注文档

- Step 9 archive wrapper 下沉已有 focused tests 覆盖。

### 审查待实施项

- 待实施：
  - collection port 具体实现继续下沉。
  - archive service collection 行为测试。

### 再标注文档

- Cycle 49 完成，进入文档状态校准。

### 验证

```bash
pnpm --filter @repo/api test -- loops-admin.service.spec.ts --runInBand
pnpm --filter @repo/api type-check
rg "from ['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)|require\\(['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)" apps/api/libs/domain/services
```

结果：

- `loops-admin.service.spec.ts` 通过，4 个测试通过。
- API type-check 通过。
- domain 反向依赖扫描无命中。

## Cycle 50 · 文档事实源校准

### 实施

- 更新 `EXECUTION.md` Step 9 总览。
- 更新本文件顶部总体状态与当前剩余待实施项。
- 更新 `struct-opz-nextstep/BACKLOG.md` N5 状态。

### 标注文档

- 明确 `IMPLEMENTATION-ANNOTATIONS.md` 顶部不再保留 Step 2/3 早期“待实施”残留。
- 明确 Step 9 当前剩余：archive collection port 实现仍临时绑定 facade。

### 审查待实施项

- 待实施：
  - collection port 继续拆到 domain read/eval ports。
  - `LoopsCrossTenantArchiveService` 是否 re-home 到 `loops-admin` 需在 collection port 稳定后评估。

### 再标注文档

- Cycle 50 完成，进入结构审查。

### 验证

- 文档变更随 Cycle 52 最终验证收口。

## Cycle 51 · 结构审查与注释校准

### 实施

- 确认 `LoopsCrossTenantArchiveService` 已移除 `forwardRef` / lazy `require('./loops.service')` / direct `LoopsService` 注入。
- 更新 `loops-admin.module.ts` 注释。
- 更新 `struct-opz-nextstep/README.md` 当前结论。

### 标注文档

- 标注：archive service 现在依赖 `LOOPS_ARCHIVE_COLLECTION_PORT`，不直接依赖 legacy facade 类。

### 审查待实施项

- 仍待：
  - API module 中 `LOOPS_ARCHIVE_COLLECTION_PORT` 的 `useExisting: LoopsService` 临时绑定。
  - collection port 实现继续下沉。

### 再标注文档

- Cycle 51 完成，进入最终验证。

### 验证

```bash
pnpm --filter @repo/api type-check
rg "from ['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)|require\\(['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)" apps/api/libs/domain/services
```

结果：

- API type-check 通过。
- domain 反向依赖扫描无命中。

## Cycle 52 · 本批收敛验证与下一轮待办

### 实施

- 执行 focused tests。
- 执行 API type-check。
- 执行 domain 反向依赖扫描。

### 标注文档

- 确认本批 Cycle 48-52 共 5 次循环动作。
- 确认 Step 9 archive wrapper/port 初拆完成，对外 contract 不变。

### 审查待实施项

- 待实施：
  - Step 9：archive collection port 实现继续下沉。
  - Step 8：trigger fire / remote execution pipeline。
  - Step 6：Eval / bench trend worker IO。
  - Step 7：notification sender re-home / CI publication builder。
  - Step 3：engine 主流程。
  - Step 10：facade/module 收敛。

### 再标注文档

- Cycle 52 完成；本批严格执行“实施 → 标注文档 → 审查待实施项 → 再标注文档”的循环，并准确标注剩余项。

### 验证

```bash
pnpm --filter @repo/api test -- loops-admin.service.spec.ts --runInBand
pnpm --filter @repo/api type-check
rg "from ['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)|require\\(['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)" apps/api/libs/domain/services
```

结果：

- `loops-admin.service.spec.ts` 通过，4 个测试通过。
- API type-check 通过。
- domain 反向依赖扫描无命中。

## Cycle 53 · Step N1 Archive Collection Service 下沉

### 实施

- 新增 `LoopsArchiveCollectionService`。
- `LOOPS_ARCHIVE_COLLECTION_PORT` 从 API module 的 `useExisting: LoopsService` 改为 `useExisting: LoopsArchiveCollectionService`。
- `LoopsArchiveCollectionService` 使用 `LoopsIssuesService` + `LoopsEvidenceService` 提供 archive artifact collection 所需 list/detail read pipeline。
- eval aggregation 保持可选窄 port，未配置时返回空 aggregation。

### 标注文档

- Step 9 更新为：archive collection port 已由 domain collection service 实现。
- 标注：eval aggregation 接入仍待 Step 6 / Next N4。

### 审查待实施项

- 待实施：
  - archive service re-home 评估。
  - eval aggregation domain port 接入。
  - Step 10 删除 archive facade wrapper。

### 再标注文档

- Cycle 53 完成，下一轮补 focused tests。

### 验证

```bash
pnpm --filter @repo/api type-check
```

结果：API type-check 通过。

## Cycle 54 · Archive Collection Focused Tests

### 实施

- 新增 `loops-archive-collection.service.spec.ts`。
- 覆盖 collection list/detail/eval aggregation 可选 port 行为。

### 标注文档

- Step 9 archive collection service 已有 focused tests。

### 审查待实施项

- 待实施：
  - archive service re-home 评估。
  - eval aggregation port 正式接入。

### 再标注文档

- Cycle 54 完成，进入结构扫描。

### 验证

```bash
pnpm --filter @repo/api test -- loops-admin.service.spec.ts loops-archive-collection.service.spec.ts --runInBand
pnpm --filter @repo/api type-check
```

结果：

- 2 个 test suite 通过，6 个测试通过。
- API type-check 通过。

## Cycle 55 · Archive Collection 结构扫描

### 实施

- 执行 domain 反向依赖扫描。
- 确认 archive collection token 不再绑定 `LoopsService`。
- 确认 archive service 无 `forwardRef` / lazy `require('./loops.service')` / direct `LoopsService` 注入。

### 标注文档

- 标注：N5 的 facade 临时 collection port 已清偿。

### 审查待实施项

- 待实施：
  - eval aggregation port 接入。
  - archive service re-home 是否值得做。
  - Step 10 wrapper 删除。

### 再标注文档

- Cycle 55 完成，进入文档总览同步。

### 验证

```bash
rg "from ['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)|require\\(['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)" apps/api/libs/domain/services
```

结果：无命中。

## Cycle 56 · 文档总览同步

### 实施

- 更新 `struct-opz-nextstep` 与 `struct-opz` 的 Step 9 状态。

### 标注文档

- Step 9 当前状态：archive control wrapper + archive collection service 已下沉。
- 剩余项：eval aggregation 接入待 Step N4，archive service re-home 待评估。

### 审查待实施项

- 下一批优先：
  - Step 8 / N3 trigger fire issue creation port。
  - Step 6 / N2 Eval worker IO。
  - Step 7 / N6 integrations 技术债。

### 再标注文档

- Cycle 56 完成，进入最终验证。

### 验证

- 文档变更随 Cycle 57 最终验证收口。

## Cycle 57 · 本批收敛验证与下一轮待办

### 实施

- 执行 archive/admin focused tests。
- 执行 API type-check。
- 执行 domain 反向依赖扫描。

### 标注文档

- 确认本批 Cycle 53-57 共 5 次循环动作。
- 确认 Step 9 的 facade 临时 collection port 已清偿。

### 审查待实施项

- 待实施：
  - Step 8：trigger fire / remote execution pipeline。
  - Step 6：Eval / bench trend worker IO 与 archive eval aggregation port 接入。
  - Step 7：notification sender re-home / CI publication builder。
  - Step 9：archive service re-home 评估。
  - Step 3：engine 主流程。
  - Step 10：facade/module 收敛。

### 再标注文档

- Cycle 57 完成；本批严格执行“实施 → 标注文档 → 审查待实施项 → 再标注文档”的循环，并准确标注剩余项。

### 验证

```bash
pnpm --filter @repo/api test -- loops-admin.service.spec.ts loops-archive-collection.service.spec.ts --runInBand
pnpm --filter @repo/api type-check
rg "from ['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)|require\\(['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)" apps/api/libs/domain/services
```

结果：

- `loops-admin.service.spec.ts` 与 `loops-archive-collection.service.spec.ts` 通过，2 个 test suite / 6 个测试通过。
- API type-check 通过。
- domain 反向依赖扫描无命中。

## nextstep Cycle 58 · Step N2 Trigger Fire Issue Creation Port 实施

### 实施

- `loops-triggers` 新增 issue creation port：`LOOPS_ISSUE_CREATION_PORT` token、`LoopsIssueCreationPort`（`createIssue(input): Promise<{ issue: { id: string } }>`）、可选 `LoopsTriggersLogSink`。
- `LoopsTriggersService` 新增 `fireScheduleTrigger(triggerId, input, issueCreationPort, logSink?)`，承接 trigger 读取、paused 早返回、issue creation 调用、execution 记录、成功/失败 stats 编排。
- `LoopsService` `implements LoopsIssueCreationPort`，`fireScheduleTrigger` 收敛为 thin wrapper 委托 domain service。
- `loops.module.ts` 绑定 `{ provide: LOOPS_ISSUE_CREATION_PORT, useExisting: LoopsService }`。
- `LoopsTriggerSchedulerProcessor` 移除 `LoopsService` 注入，改为 `LoopsTriggersService` + `LOOPS_ISSUE_CREATION_PORT` + `domainLogSink`。

### 标注文档

- Step 8 fire 编排已下沉到 `loops-triggers`；processor 不再注入 legacy facade 类。
- issue creation port 当前仍由 facade 临时实现（与 archive collection port 同构）。

### 审查待实施项

- 待实施：issue creation port 实现继续下沉到 `loops-issues` intake port；processor schedule tick → fire focused 子集；Step N7 删除 facade fire wrapper。

### 再标注文档

- nextstep Cycle 58 完成，下一轮补 trigger fire focused tests。

### 验证

- API type-check 通过；domain 反向依赖扫描无命中。

## nextstep Cycle 59 · Step N2 Trigger Fire Focused Tests

### 实施

- 新增 `loops-triggers.service.spec.ts`（standalone unit spec）。
- 覆盖 CRUD 读取/missing、paused 早返回、成功 fire（execution 记录 + stats 重置 + logSink info）、失败 fire（failureCount 自增、未达阈值 status 保持 active、不写 execution、logSink error）、达 maxFailures 翻转 error、missing 抛 `NotFoundException`、log sink 可选。

### 标注文档

- Step N2 fire 编排已有 domain service focused tests 覆盖主要成功/失败路径。

### 审查待实施项

- 仍待：issue creation port 实现下沉；processor 端 schedule tick → fire focused 子集。

### 再标注文档

- nextstep Cycle 59 完成，进入结构扫描。

### 验证

- `loops-triggers.service.spec.ts` 7 个测试通过；API type-check 通过。

## nextstep Cycle 60 · Step N2 结构审查与注释校准

### 实施

- domain 反向依赖扫描无命中。
- 确认 `LoopsTriggerSchedulerProcessor` 已移除 `LoopsService` 类注入与 `loops.service` import。
- 确认 triggers domain 无 `forwardRef` / lazy `require('./loops.service')`。
- 确认 controller `fireScheduleTrigger` 仍经 facade wrapper（对外 contract/path 不变）。
- 更新 `loops-triggers.module.ts` 与 processor 顶部 doc 注释。

### 标注文档

- 剩余结构债：API module 中 `LOOPS_ISSUE_CREATION_PORT -> useExisting: LoopsService` 临时绑定。
- fire 编排已脱离 legacy facade class 依赖。

### 审查待实施项

- 下一步：issue creation port 实现下沉到 `loops-issues` intake port；processor schedule tick → fire focused 子集；Step N7 删除 facade fire wrapper。

### 再标注文档

- nextstep Cycle 60 完成，进入文档总览同步。

### 验证

- API type-check 通过；`loops-triggers.service.spec.ts` 7 个测试通过；domain 反向依赖扫描无命中。

## nextstep Cycle 61 · 文档总览同步

### 实施

- 更新 `struct-opz-nextstep/README.md` Step 8 当前结论。
- 更新 `struct-opz-nextstep/BACKLOG.md` N3 状态与当前风险提醒。
- 更新 `struct-opz/EXECUTION.md` Step 8 总览行。
- 更新本文件顶部“当前剩余待实施项”。

### 标注文档

- 明确 Step 8 当前已完成 schedule trigger CRUD + `fireScheduleTrigger` 编排下沉。
- 明确剩余：issue creation port 实现仍由 facade 临时实现；remote shard execution pipeline 仍待拆。

### 审查待实施项

- 下一批优先级：N2 eval / bench worker IO、N6 integrations、N3 issue creation port 下沉、N4 remote execution、N1 engine、N7 facade 收敛。

### 再标注文档

- nextstep Cycle 61 完成，进入最终验证。

### 验证

- 文档变更随 nextstep Cycle 62 最终验证收口。

## nextstep Cycle 62 · 本批收敛验证与下一轮待办

### 实施

- 执行 triggers + admin + archive focused tests。
- 执行 API type-check。
- 执行 domain 反向依赖扫描。
- 汇总本批 Cycle 58-62。

### 标注文档

- 本批已完成至少 5 次循环动作（58 实施 / 59 tests / 60 结构审查 / 61 文档同步 / 62 最终验证）。
- 准确标注 N3 trigger fire 当前状态，未改变对外 API contract / controller path / queue name。

### 审查待实施项

- 待实施：N2 eval / bench worker IO、N6 integrations、N3 issue creation port 下沉、N4 remote execution、N5 archive re-home 评估、N1 engine、N7 facade 收敛。

### 再标注文档

- nextstep Cycle 62 完成；trigger fire port 已落地，issue creation port 仍由 facade 临时实现。

### 验证

```bash
pnpm --filter @repo/api test -- loops-triggers.service.spec.ts loops-admin.service.spec.ts loops-archive-collection.service.spec.ts --runInBand
pnpm --filter @repo/api type-check
rg "from ['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)|require\\(['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)" apps/api/libs/domain/services
```

结果：

- 3 个 test suite 通过，13 个测试通过。
- API type-check 通过。
- domain 反向依赖扫描无命中。

## nextstep Cycle 63 · Step N2 Eval / Bench Trend Worker IO 下沉实施

### 实施

- `loops-eval` 新增 trend worker port：`LoopsEvalEvidencePort`、`LoopsEvalTrendStorePort`、`LoopsEvalLogSink`。
- `LoopsEvalService` 新增 `runEvalTrendWorker` / `runLoopBenchTrendWorker`，承接 evidence→suites→runs→baseline→append 与 list/cost/learnings→metrics→diff→append 编排。
- `LoopsService` 收敛为 thin wrapper，经 `evalEvidencePort` / `evalTrendStorePort` / `evalLogSink` getter 适配。

### 标注文档

- Step N2 trend worker IO 编排已下沉到 domain；facade 仅做 port 适配。

### 审查待实施项

- 待实施：aggregation worker 编排下沉；evidence/DB/Redis 适配独立化；processor 解耦。

### 再标注文档

- nextstep Cycle 63 完成，进入 aggregation worker 下沉。

### 验证

- API type-check 通过；facade trend 测试通过（79 tests）。

## nextstep Cycle 64 · Step N2 Eval Aggregation Worker IO 下沉实施

### 实施

- `loops-eval` 新增 `LoopsAggregationFlatItem` / `LoopsAggregation` 类型。
- `LoopsEvalService.runEvalAggregationWorker` 承接 suites→flat→compute→persist→warm→counts 编排。
- `LoopsService.runEvalAggregationWorker` 收敛为 thin wrapper，把 db/redis 适配包成 port 回调。

### 标注文档

- Step N2 aggregation worker 编排已下沉到 domain；DB/Redis 适配仍由 facade port 提供。

### 审查待实施项

- 待实施：adapter service 独立化；processor 解耦；focused tests。

### 再标注文档

- nextstep Cycle 64 完成，进入 focused tests。

### 验证

- API type-check 通过；facade loops.service.spec.ts 68 个测试通过。

## nextstep Cycle 65 · Step N2 Eval Worker Focused Tests

### 实施

- 新增 `loops-eval.service.spec.ts`（standalone unit spec）。
- 覆盖 trend worker（有/无 history）、bench trend worker（有/无 history deltas）、aggregation worker（persist/warm 计数、port 缺失跳过、持久化抛错记 error）。

### 标注文档

- Step N2 trend + aggregation worker 编排已有 domain focused tests 覆盖。

### 审查待实施项

- 仍待：processor 解耦 facade；adapter service 独立化。

### 再标注文档

- nextstep Cycle 65 完成，进入结构扫描。

### 验证

- `loops-eval.service.spec.ts` 7 个测试通过；API type-check 通过。

## nextstep Cycle 66 · Step N2 结构审查与注释校准

### 实施

- domain 反向依赖扫描无命中。
- 确认 `loops-eval.service.ts` 仅 import `@repo/contracts` + `@nestjs/common`。
- 确认 BullMQ queue name 不变。
- 更新 `loops-eval.module.ts` 注释。

### 标注文档

- 剩余结构债：evidence/DB/Redis 适配仍由 facade port；processor 仍调用 facade wrapper。

### 审查待实施项

- 下一步：建 `loops-eval` 专属 adapter service；processor 解耦。

### 再标注文档

- nextstep Cycle 66 完成，进入文档总览同步。

### 验证

- domain 反向依赖扫描无命中。

## nextstep Cycle 67 · 文档总览同步

### 实施

- 更新 `struct-opz-nextstep/README.md` Step 6、`BACKLOG.md` N2 + 风险提醒。
- 更新 `struct-opz/EXECUTION.md` Step 6 总览行、本文件顶部 Step 6 剩余项。

### 标注文档

- 明确 Step 6 已完成 trend + aggregation worker 编排下沉；剩余 adapter 独立化与 processor 解耦。

### 审查待实施项

- 下一批：N6 integrations、N3 issue creation port 下沉、N2 收尾、N4 remote execution、N1 engine、N7 facade 收敛。

### 再标注文档

- nextstep Cycle 67 完成，进入最终验证。

### 验证

- 文档变更随 Cycle 68 最终验证收口。

## nextstep Cycle 68 · 本批收敛验证与下一轮待办

### 实施

- 执行 eval domain + facade focused tests、API type-check、domain 反向依赖扫描。
- 汇总本批 Cycle 63-68。

### 标注文档

- 本批已完成至少 5 次循环动作（63 trend worker 实施 / 64 aggregation worker 实施 / 65 focused tests / 66 结构审查 / 67 文档同步 / 68 最终验证）。
- 准确标注 N2 eval worker IO 当前状态，未改变对外 API contract / controller path / BullMQ queue name。

### 审查待实施项

- 待实施：N6 integrations、N3 issue creation port 下沉、N2 收尾（adapter service + processor 解耦）、N4 remote execution、N5 archive re-home、N1 engine、N7 facade 收敛。

### 再标注文档

- nextstep Cycle 68 完成；eval/bench trend worker IO + eval aggregation worker 编排已下沉到 `loops-eval`。

### 验证

```bash
pnpm --filter @repo/api test -- loops-eval.service.spec.ts loops.service.spec.ts --runInBand
pnpm --filter @repo/api type-check
rg "from ['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)|require\\(['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)" apps/api/libs/domain/services
```

结果：

- eval domain + facade focused tests 通过（7 + 68）。
- API type-check 通过。
- domain 反向依赖扫描无命中。
