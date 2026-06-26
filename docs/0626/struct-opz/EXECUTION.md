# Loops 结构优化执行文档

## 执行原则

本执行文档基于 [README.md](./README.md) 的结构方案，将 loops 拆分落地为可分批执行的重构任务。

核心原则：

- 每批只移动一个清晰边界，保持 API contract 不变。
- `apps/api/src/modules/loops` 逐步收敛为 controller/module/processor 层。
- 业务能力逐步下沉到 `apps/api/libs/domain/services/loops-*`。
- 每个目标目录保持 `1 个 service + 1 个 module + n 个附属文件`。
- 任一批次完成后都应保持可 type-check、可测试、可回退。

## Step 0 · 建立目标目录与兼容 Facade

### 目标

建立 loops domain services 的目标骨架，让后续迁移有稳定落点，同时保持 controller 当前调用方式不变。

### 范围

- 新建 `apps/api/libs/domain/services/loops`。
- 新建 `loops.module.ts`、`loops.service.ts`、`index.ts`。
- 在 `apps/api/libs/domain/services/index.ts` export loops 入口。
- 在 API `loops.module.ts` 中预留或接入 `LoopsDomainModule`。
- 兼容 facade 暂时保持与现有 `LoopsService` 同名或等价调用面。

### 不做

- 不迁移 `loops.service.ts` 的业务方法实现。
- 不改 `loops.controller.ts` 的 ts-rest handler 行为。
- 不改 `packages/contracts`。
- 不调整 DB schema、Prisma migration 或外部 API contract。

### 受益

- 后续迁移有明确 domain 入口。
- controller diff 最小，降低 API 行为回归风险。
- 可以先验证 Nest module graph，避免大规模搬迁时才发现 DI 问题。

## Step 1 · 下沉低耦合工具、Store 与 Lock

### 目标

优先迁移依赖少、行为稳定的基础能力，为 issue、engine、evidence 等上层服务提供共同底座。

### 范围

- 新建 `apps/api/libs/domain/services/loops-store`。
- 新建 `apps/api/libs/domain/services/loops-locks`。
- 迁移候选：
  - `loops-file-store.service.ts`
  - `loops-persistence.service.ts`
  - `loops-persistence.token.ts`
  - `loops-lock-backend.interface.ts`
  - `loops-work-lock.service.ts`
  - `in-memory-loops-lock.backend.ts`
  - `redis-loops-lock.backend.ts`
  - `loops-runtime-config.util.ts`
  - `loops-workspace-root.util.ts`
  - `loops-path-policy.util.ts`
- spec 跟随源文件迁移。
- API module 改为 import `LoopsStoreModule` / `LoopsLocksModule`，不再直接注册这些 provider。

### 不做

- 不改 `.loops` 文件格式。
- 不改 DB persistence 双写语义。
- 不引入新的 storage abstraction。
- 不把 raw Prisma 引入 domain service。
- 不迁移 engine 状态机。

### 受益

- 先切出最底层依赖，减少后续服务之间的横向 import。
- file store、persistence、lock 的职责更清晰。
- 为后续检测循环依赖提供稳定边界。

## Step 2 · 拆 Issue Intake 与查询能力

### 目标

将 issue 创建、查询、简单需求归一化从主 `LoopsService` 中抽出，形成独立 intake/query 边界。

### 范围

- 新建 `apps/api/libs/domain/services/loops-issues`。
- 迁移或抽取：
  - `list`
  - `getIssue`
  - `createIssue`
  - `createSimpleIssue`
  - `listFromFile`
  - submitter 归一化
  - simple issue targetRepo 解析
  - issue id 生成
  - rule snapshot 捕获
- 保持 facade 的同名方法，内部委托给 `LoopsIssuesService`。
- 保持 `normaliseSimpleIssue` 和 `@repo/contracts` 类型来源不变。

### 不做

- 不改变 `POST /loops/issues` 和 `POST /loops/issues/simple` 的请求/响应。
- 不调整 Auth 派生 submitter 的策略。
- 不迁移 webhook trigger 的调度、重试、dead-letter 逻辑。
- 不把 UI 默认表单或前端 client 纳入本批。

### 受益

- issue intake 可以独立测试。
- `LoopsService` facade 开始变薄。
- 创建/查询路径与 engine 推进路径解耦，降低后续拆状态机的风险。

## Step 3 · 拆 Loop Engine 状态机

### 目标

把核心状态推进、phase 转换、shard 调度和 finalize 逻辑从主 service 中独立出来，形成 `loops-engine`。

### 范围

- 新建 `apps/api/libs/domain/services/loops-engine`。
- 迁移或抽取：
  - `generateSpec`
  - `reviewSpec`
  - `decompose`
  - `runLoop`
  - `advance`
  - `reviewGlobal`
  - `reloop`
  - `finalize`
  - `recoverInterruptedShards`
  - `findRunnableShard`
  - `runRunnableShard`
  - `costGuardedState`
  - `nextResumePhase`
  - `nextSpecVersion`
- engine 依赖 store、locks、runners、quality、evidence 等下层服务。
- 保持 CLOSED 幂等、人工关卡、异常暂停等既有语义。

### 不做

- 不重写状态机规则。
- 不新增 phase。
- 不改变用户默认入口 `advance` 的产品语义。
- 不在 engine 中直接处理 HTTP request、audit log 或 controller permission。
- 不使用 `forwardRef` 作为循环依赖默认解法。

### 受益

- 核心执行逻辑从 API module 中解耦。
- 状态机可单独做 focused specs。
- 后续引入后台 scheduler 或远程 runner 时可以复用同一 engine。

## Step 4 · 拆 Runner、Runtime 与 Workspace

### 目标

将 agent/Claude/Git runner 编排、runtime detection、workspace profile、Docker fallback 独立成可治理的运行时边界。

### 范围

- 新建 `apps/api/libs/domain/services/loops-runners`。
- 新建 `apps/api/libs/domain/services/loops-runtime`。
- 迁移或抽取：
  - agent/claude/git adapter interface 与实现
  - `loops-runtime-command-builder.util.ts`
  - `loops-runner.service.ts`
  - `agent-runtime-detection.service.ts`
  - `loops-workspace-profile.service.ts`
  - `loops-docker.client.ts`
  - `loops-docker-sandbox.service.ts`
  - `loops-runtime-images.ts`
- 保持外部命令和 Docker 运行策略不变。
- 保持 secret 脱敏和 workspace allowlist 约束。

### 不做

- 不更换 CLI 或 Docker 镜像。
- 不托管用户 CLI 登录态。
- 不改变 Docker mount policy。
- 不把 runtime UI 操作放入后端 domain。
- 不让业务 service 直接绕过 adapter 执行外部命令。

### 受益

- runtime backend 能力独立，便于诊断、替换和治理。
- engine 不再知道具体 CLI/Docker 细节。
- workspace policy 与执行策略的安全边界更清楚。

## Step 5 · 拆 Evidence、Quality 与 Release Gates

### 目标

将交付证据、review/release gates、coverage、browser QA、second opinion、learning governance 从主 service 中拆出。

### 范围

- 新建 `apps/api/libs/domain/services/loops-evidence`。
- 新建 `apps/api/libs/domain/services/loops-quality`。
- 迁移或抽取：
  - `getDeliveryEvidence`
  - `buildDeliveryEvidence`
  - `buildDeliveryEvidenceMarkdown`
  - review gate / release gate builder
  - requirement coverage builder
  - evidence artifact builder
  - second opinion comparison util
  - browser QA worker
  - second opinion worker
  - learning governance / memory util
  - visual regression util

### 不做

- 不改变 delivery evidence markdown 的外部可见字段。
- 不改变 release gate 阻断策略。
- 不新增 QA provider。
- 不把 PR comment 发布逻辑混入 evidence builder。
- 不把 learning governance 与 issue intake 合并。

### 受益

- 交付证据成为独立能力，可被 detail API、PR 发布、archive 复用。
- engine 只消费 gate 结果，不维护证据构建细节。
- QA 与二审策略可独立演进。

## Step 6 · 拆 Eval 与 Bench 聚合

### 目标

将 Eval Suite、Eval Run、historical baseline、cross-tenant aggregation 和 bench trend 逻辑从主 service 中独立。

### 范围

- 新建 `apps/api/libs/domain/services/loops-eval`。
- 迁移或抽取：
  - `listEvalSuites`
  - `getEvalSuite`
  - `listEvalRuns`
  - `getEvalRun`
  - `runLoopBenchTrendWorker`
  - `runEvalTrendWorker`
  - `getCrossTenantEvalAggregation`
  - `runEvalAggregationWorker`
  - `getEvalAggregationCacheHealth`
  - Eval evidence collection/build/evaluate helpers
  - `loops-eval-aggregation-worker.service.ts`
- API processor 只保留 queue entry，调用 `LoopsEvalService` 或 jobs facade。

### 不做

- 不改 Eval suite/check 定义语义。
- 不调整 historical baseline 算法口径。
- 不改变 BullMQ queue name。
- 不把 dashboard 展示逻辑放入 domain。

### 受益

- Eval 运营面与核心 engine 解耦。
- queue worker 可以更清晰地复用 domain 服务。
- 后续跨租户聚合、长期归档、趋势分析可以独立迭代。

## Step 7 · 拆 Integrations、MCP、CI、PR 与通知

### 目标

将外部系统集成能力聚合到 client/adaptor 边界，避免业务 service 直接持有 HTTP/MCP/CI/PR 细节。

### 范围

- 新建 `apps/api/libs/domain/services/loops-integrations`。
- 迁移或抽取：
  - `loops-pr-provider.client.ts`
  - `loops-mcp-client.service.ts`
  - `loops-mcp-secret.service.ts`
  - `loops-notification-sender.service.ts`
  - MCP server list/connect/disconnect/test
  - CI checks list/connect/disconnect/test
  - CI publication history
  - PR comment / check-run 发布适配

### 不做

- 不新增第三方集成。
- 不更改 GitHub App/token exchange 策略。
- 不更改 MCP secret 存储策略。
- 不让 integration service 反向依赖 engine。
- 不把外部 HTTP 调用散落到其他 domain service。

### 受益

- 外部 API 调用集中在 client/adaptor 层。
- secret、脱敏、重试、错误映射更容易审计。
- engine/evidence 只依赖清晰端口，降低集成变更影响面。

## Step 8 · 拆 Trigger 与 Remote Runner Pool

### 目标

将 webhook/schedule trigger 和 remote runner lease/job 管理拆成独立运营域。

### 范围

- 新建 `apps/api/libs/domain/services/loops-triggers`。
- 新建 `apps/api/libs/domain/services/loops-remote-runners`。
- 迁移或抽取：
  - `webhookTrigger`
  - webhook payload size/rate limit/signature 校验
  - webhook source enrichment
  - schedule trigger CRUD/fire
  - trigger execution retry/replay
  - dead-letter list
  - remote runner list
  - lease acquire/release
  - remote job run/artifact upload
- API processors 继续只作为 queue entry。

### 不做

- 不新增 Linear/Jira/Slack/GitHub Issue 的深度集成。
- 不改变现有 webhook signature contract。
- 不改变 trigger retry/backoff 口径。
- 不改变 remote runner permission 门禁。
- 不把 trigger 创建行为与 issue intake 写死耦合。

### 受益

- trigger 生命周期独立，便于后续 replay、dead-letter、外部 intake 扩展。
- remote runner pool 与本地 runner/runtime 解耦。
- 队列任务、HTTP 手动触发、后台调度可复用同一 domain service。

## Step 9 · 拆 Admin、Archive、Tool 与 Blueprint

### 目标

将管理型能力从核心交付 loop 中拆出，减少主 service 的运营杂项。

### 范围

- 新建 `apps/api/libs/domain/services/loops-admin`。
- 迁移或抽取：
  - cross-tenant archive
  - archive list / refresh url
  - tool registry CRUD/test
  - blueprint CRUD/rollback
  - recipe admin action
  - capability registry
  - metrics/action queue/risk queue/resume summary 等 dashboard 派生能力

### 不做

- 不改变 archive 存储位置。
- 不改变 tool/blueprint contract。
- 不新增 marketplace 功能。
- 不把 admin 能力反向依赖 controller 权限 decorator。

### 受益

- 核心 loop engine 更聚焦交付状态机。
- 管理和 dashboard 派生能力可以独立优化。
- 后续权限、审计、租户治理更容易分层。

## Step 10 · 收敛 API Module 与删除旧聚合

### 目标

完成 API 层瘦身，清理旧 `apps/api/src/modules/loops` 中已经迁移的领域 provider 和业务实现。

### 范围

- `apps/api/src/modules/loops` 最终仅保留：
  - `loops.controller.ts`
  - `loops.module.ts`
  - `loops-rbac.decorator.ts`
  - `*.processor.ts`
  - API-only spec 或 e2e spec
- `loops.module.ts` import domain modules，不直接注册已迁移 provider。
- 删除或迁移旧 `loops.service.ts`、worker service、client、adapter、util 文件。
- 更新 import path 到 `@app/services/loops-*`。
- 补充结构检查脚本，禁止 domain 反向 import API modules。

### 不做

- 不改变用户可见 API path。
- 不改变 ts-rest contract。
- 不做 unrelated cleanup。
- 不同时推进 UI 重构。
- 不在未通过 focused tests 的情况下删除旧文件。

### 受益

- API module 回归薄装配层。
- domain services 边界稳定，循环依赖风险显著降低。
- 后续多人/多 agent 并行开发 loops 子域更容易。

## 每步通用验收

每一步完成后至少检查：

```bash
pnpm --filter @repo/api test -- loops
pnpm --filter @repo/api type-check
```

涉及架构收敛、engine、runner、DB persistence 或 release-facing 行为时，再跑：

```bash
pnpm quality:gate
```

结构检查：

```bash
rg "apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops" apps/api/libs/domain/services
```

期望无输出。
