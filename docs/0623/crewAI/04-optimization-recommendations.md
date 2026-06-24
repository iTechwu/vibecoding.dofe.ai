# 04 · 对 DofeAI 的优化建议

## 产品战略

### 建议 1：明确定位为 Software Delivery Workforce

推荐定位：

> DofeAI 是面向软件团队的 AI Workforce Control Plane，基于 Codex 与 Claude Code CLI，把需求自动转化为规格、任务、实现、测试、审阅、PR 和可审计交付证据。

这句话要刻意避开三个陷阱：

- 不说自己是通用 CrewAI；
- 不说自己是底层 agent framework；
- 不承诺无人全自动可信交付。

## 信息架构调整

| 当前语言            | 建议语言                    | 原因                   |
| ------------------- | --------------------------- | ---------------------- |
| Loop                | Delivery Loop               | 更贴近交付场景         |
| Phase               | Delivery Stage              | 降低内部状态机感       |
| Shard               | Work Package                | 工程团队更容易理解     |
| Agent Runtime       | Runtime Backend             | 可配置、可治理、可诊断 |
| Capability Registry | Tool & Integration Registry | 从展示升级为配置治理   |
| Doctor              | Workspace Health            | 更产品化               |
| Cost Guard          | Spend & Safety Guard        | 更贴近企业治理         |
| Annotation          | Delivery Evidence           | 更贴近 PR/release      |

## P0 建议

### P0-1 · Workforce Overview

目标：让用户一眼知道“谁在做什么，卡在哪里，下一步是谁”。

前端最小落点：

- Dashboard 增加 Workforce Overview；
- Loop detail 增加 Agent Handoff Timeline；
- Exception Center 的 owner 改为 agent/persona；
- 每个 stage 显示 actual runtime backend。

后端不必立刻大改 schema，可先从现有 phase/state/review records 推导。

首批 persona：

| Persona          | 输入                     | 输出                  |
| ---------------- | ------------------------ | --------------------- |
| Intake Analyst   | raw issue                | normalized issue      |
| Spec Writer      | issue + repo context     | spec draft            |
| Work Planner     | approved spec            | work packages         |
| Builder          | work package             | implementation record |
| Test Runner      | changed files + commands | test evidence         |
| Code Reviewer    | implementation + tests   | review verdict        |
| Release Reviewer | all evidence             | global verdict        |
| Evidence Curator | final state              | PR/release evidence   |

### P0-2 · Runtime Backend Registry

实施状态：✅ v2 闭合。Dashboard v1（前端）+ 后端 contract v1（listRuntimeBackends/getRuntimeBackend/healthCheck/updatePolicy）+ file-backed policy patch lifecycle（R11）+ DB 级 policy persistence（R16）。后续 Epic 为 fallback 自动执行和 remote runner 执行池。

目标：把 Codex CLI、Claude Code CLI、本地、Docker、远程 runner 做成可配置资产。

Contract-first 草案：

```text
GET /loops/runtime-backends
GET /loops/runtime-backends/:id
POST /loops/runtime-backends/:id/health-check
PATCH /loops/runtime-backends/:id/policy
POST /loops/runtime-backends/:id/override
```

最小字段：

```text
id
name
kind
mode
status
version
authStatus
supportedStages
permissionProfile
workspacePolicy
costPolicy
fallbackPolicy
lastHealthCheck
diagnostics[]
```

验收标准：

- Dashboard 能显示每个 backend ready/degraded/unavailable；已实施 v1；
- Loop detail 能显示每个 stage 实际使用 backend；
- backend unavailable 时进入 exception，而不是静默失败；
- runtime override 写入 audit。

### P0-3 · Eval Suite v1

实施状态：✅ v2 闭合。Eval Plan dashboard v1（前端）+ 后端 Eval Suite/Eval Run contract v1（listEvalSuites/getEvalSuite/listEvalRuns/getEvalRun，5 个内置 suite 16 个 check）+ R13 request-time evidence aggregation（从现有 Loop evidence 派生 suite 计数、run checkResults 与 score）+ R19 historical baseline/trend worker（按 blueprint/suite 物化 baseline snapshot，并回填 EvalRun trendDelta）+ finalize release gate 阻断。后续 Epic 为跨租户实时聚合、长期归档和队列化调度。

目标：把测试/审阅/架构规则从单次记录升级为可复用质量门禁。

首批 suite：

| Suite                   | Checks                                                             |
| ----------------------- | ------------------------------------------------------------------ |
| Architecture Compliance | DB Service、Zod contract、Client layer、Logger 规则                |
| Delivery Readiness      | spec approved、work packages done、global review pass、PR evidence |
| Runtime Safety          | path policy、network policy、secret canary、allowed command        |
| Test Evidence           | required commands pass、failure reason classified、coverage exists |
| Cost Policy             | token/call/time budget 未触发                                      |

前端落点：

- 新建页 preview 显示 Eval Plan；
- Detail 页显示 Eval Results；
- Dashboard 显示 pass rate / failure categories；已实施 Eval Plan v1，后端 suite/run 已能返回非占位 evidence aggregation；
- Exception Center 可按 failed/attention hard gate 聚合；R14 已在 Dashboard 将 Eval check 转成可处理 exception item。

### P0-4 · PR Evidence First

实施状态：✅ v4 闭合。Detail 页 Delivery Evidence 区块 + 后端 getDeliveryEvidence endpoint + R6 PR comment 自动发布（finalize 自动调用 prProvider.createPrComment）。R10 已新增 CI Checks Registry 控制面与 SSO `ci-check` operate 写门禁；R17/R23 已接入 GitHub Checks API check-run 发布与 publication artifact；R28 已补齐 publication history index；R29 已补齐 Work Package→commit 映射、evidence 反向链接与 GitHub App installation token exchange v1；R29.1 已补齐公开 publication history API/UI。后续 Epic 为导出、搜索过滤和跨租户长期归档。

目标：让 `.loops` 证据进入工程团队真实 review 流程。

最小实现（已全部实施）：

- ✅ finalize 生成 delivery evidence（R5，buildDeliveryEvidence + markdown）
- ✅ PR provider adapter 支持创建/更新 PR comment（R6，createPrComment/updatePrComment）
- ✅ comment 包含 spec、work packages、tests、reviews、risks、cost、global verdict
- ✅ Loop detail 显示 PR status（Delivery Evidence 区块）
- PR provider adapter 支持创建/更新 PR comment；
- comment 包含 spec、work packages、tests、reviews、risks、cost、global verdict；
- Loop detail 显示 PR status；CI Checks Registry 已可 list/connect/disconnect/test，传入 headSha 时会通过 GitHub Checks API 发布真实 check-run，并写入 `.loops` publication artifact；Dashboard 已通过 publication history API 展示 latest check-run、evidence backlink 与 Work Package commit map。

## P1 建议

### P1-1 · Invent Delivery Loop

将 `/loops/new` 从 issue form 升级为 delivery loop planner。

用户输入一句话后，生成六块可编辑 preview：

1. Issue Summary；
2. Workforce Plan；
3. Runtime Plan；
4. Tool Plan；
5. Eval Plan；
6. Risk/Gate Plan。

验收标准：

- 创建前用户知道谁会做；
- 创建前用户知道用哪些工具和权限；
- 创建前用户知道怎么判断通过；
- 创建前用户知道哪里会停下来等人审批；
- 创建后这些 plan 成为 baseline evidence；R15 已将 blueprint/runtime/eval/gate baseline evidence 写入 `workflowRecipe.baselineEvidence` 并在 Loop detail 展示。

### P1-2 · Blueprint Marketplace v1

首批 blueprint：

| Blueprint               | 适用场景      | 默认 Eval                                    |
| ----------------------- | ------------- | -------------------------------------------- |
| Bugfix Loop             | bug 修复      | regression test + global review              |
| API Endpoint Loop       | 新增/修改 API | contract + controller/service + e2e          |
| UI Feature Loop         | 前端功能      | visual QA + accessibility + contract         |
| Refactor Loop           | 行为不变重构  | existing tests + diff risk                   |
| Security Patch Loop     | 安全修复      | security gate + human approval               |
| Dependency Upgrade Loop | 依赖升级      | lockfile + test matrix                       |
| Documentation Loop      | 文档更新      | source links + no code changes unless needed |

每个 blueprint 包含：

- intake questions；
- persona sequence；
- runtime policy；
- tools；
- eval suite；
- human gates；
- cost policy；
- evidence template；
- rollback checklist。

### P1-3 · Trigger Contract v2

优先级：

| Trigger      | 优先级 | 用途                     |
| ------------ | ------ | ------------------------ |
| Manual       | P0     | 兼容当前创建入口         |
| Webhook      | P1     | 外部系统 POST            |
| Schedule     | P1     | 定时巡检、依赖升级、日报 |
| GitHub Issue | P1     | label/comment 创建 Loop  |
| GitHub PR/CI | P1     | CI fail 自动修复         |
| Linear/Jira  | P2     | 产品需求流转             |
| Slack        | P2     | 团队聊天入口             |

必须具备：

- active/paused；
- signature verification；
- schema mapping；
- replay；
- retry/dead-letter；
- rate limit；
- owner and permission；
- audit events。

### P1-4 · Tool & Integration Registry

最小模块：

- Tools list；
- Tool detail；
- Connection/auth；
- Permission profile；
- Health check；
- Test cases；
- Audit usage；
- Runtime compatibility。

建议首批工具：

- Git；
- PR provider；
- pnpm/turbo；
- Jest；
- Playwright；
- Docker；
- Codex CLI；
- Claude Code CLI；
- MCP server；
- secret scanner。

## P2 建议

### P2-1 · Engineering Agent Control Plane

对标 CrewAI ACP，但指标改成软件交付：

| 模块                  | 指标                                                         |
| --------------------- | ------------------------------------------------------------ |
| Fleet Health          | active loops、blocked loops、failed checks、runtime degraded |
| Delivery Intelligence | lead time、human wait time、reloop rate、merge readiness     |
| Runtime Spend         | cost by backend/model/stage/blueprint                        |
| Quality Trend         | eval pass rate、test failure rate、review rejection reason   |
| Rules                 | repo policy、PII/secret redaction、security-sensitive gate   |
| Audit                 | who approved, who overrode, which backend wrote files        |

### P2-2 · Rules Center

CrewAI ACP 先从 PII Redaction 组织规则切入。DofeAI 可从工程规则切入：

- 禁止改 `.env` / secrets；
- 改 Prisma schema 必须附 migration/e2e；
- 改 API 必须更新 contract；
- 改 auth/payment/security 文件必须 human approval；
- production code 禁止 `console.log`；
- controller/service 不允许直接 Prisma；
- 外部 API 只能 client layer；
- 失败测试不能 finalize。

### P2-3 · Remote Runner / Execution Pool

实施状态：权限底座与 artifact provider v1 已推进。SSO Asset Permissions v1 已覆盖 `remote-runner`、`mcp-server`、`ci-check` 三类高风险资产；现有 `runtime-backend` health-check / policy patch、R10 MCP Server Registry / CI Checks Registry、R12 Remote Runner pool/lease 控制面，以及 R21 Remote Runner job worker/artifact manifest 写操作均已复用 SSO asset permission 硬门禁。R21 已支持 `POST /loops/remote-runners/:id/jobs` 并真实写入 job 索引与 manifest artifact。后续需接分布式 queue worker、真实 sandbox worker、取消/续跑与 org quota。

从本地/Docker 走向团队产品必须补：

- queue worker（R12 已完成控制面 lease，R21 已完成 job/artifact manifest provider v1；分布式 worker 后续）；
- job lease（R12 已完成 acquire/release lease contract，R21 已完成 job request/response contract）；
- concurrency；
- cancellation；
- resumability；
- artifact manifest provider（R21 已完成；外部 object storage upload 后续）；
- sandbox logs；
- workspace mount policy；
- remote health；
- org quota。

## 工程实施原则

### Contract-first

所有新增能力从 `packages/contracts` 开始：

- Zod 4 schema；
- ts-rest contract；
- list endpoint 使用 `PaginationQuerySchema` / `PaginatedResponseSchema`；
- schema tests；
- API docs summary/description。

### Layering

保持本项目规则：

- DB 访问只走 DB Service；
- 外部平台只走 Client layer；
- service 不直接拼第三方 API；
- Winston Logger；
- 不在生产代码写 `console.log`。

### 渐进式前端

不要一次重写 Loops Dashboard。先加三个推导型组件：

- `WorkforceOverview`：从现有 state 推导；
- `RuntimeBackendPanel`：复用 runtime detection；
- `EvalPlanPreview`：前端已有静态 preview；后端 EvalSuite/EvalRun contract 已接入 request-time evidence aggregation，后续可替换为后端实时数据源。
- `SSOAssetPermissions`：从 SSO permission snapshot 派生 workspace/blueprint/runtime/tool/eval/trigger/remote-runner/MCP/CI 资产权限。

## 建议的北极星指标

| 指标                    | 含义                                              |
| ----------------------- | ------------------------------------------------- |
| Loop-to-PR success rate | 创建 Loop 后成功生成可审查 PR 的比例              |
| Human wait time         | 卡在人类门禁的平均时间                            |
| Evidence completeness   | finalize 时证据完整率                             |
| Eval pass rate          | blueprint 级质量通过率                            |
| Reloop rate             | 需要回环的比例                                    |
| Cost per merged PR      | 每个成功交付 PR 的成本                            |
| Runtime failure rate    | Codex/Claude/local/Docker/remote backend 的失败率 |
