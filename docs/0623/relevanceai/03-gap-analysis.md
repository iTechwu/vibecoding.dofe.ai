# 03 · 基于本项目实现的差距分析

## 分析边界

本分析基于以下本地文件和实现：

- `CLAUDE.md`
- `apps/web/app/loops/page.tsx`
- `apps/web/app/loops/loops-dashboard-model.ts`
- `apps/web/app/loops/new/*`
- `apps/api/src/modules/loops/loops.service.ts`
- `apps/api/src/modules/loops/adapters/*`
- `apps/api/src/modules/loops/agent-runtime-detection.service.ts`
- `apps/api/src/modules/loops/loops-runtime-command-builder.util.ts`
- `apps/api/src/modules/loops/loops.controller.ts`
- `apps/api/src/modules/loops/loops-capability-registry.ts`
- `packages/contracts/src/api/loops.contract.ts`
- `packages/contracts/src/schemas/loops.schema.ts`
- `docs/0623/{goose,opencode,openhands,uiux}`

## 当前实现画像

DofeAI Loops 当前已经不是简单 demo，而是一个具备控制面雏形的工程交付系统：

- 合同层：ts-rest + Zod 4 contracts；
- 后端层：NestJS + LoopsService + adapters + file/DB persistence；
- 前端层：Next.js dashboard、detail、new issue；
- 运行层：以 Codex CLI 与 Claude Code CLI 为底层执行 runtime，已有 agent runtime detection、workspace profile、Docker/local CLI 相关诊断；
- 治理层：RBAC decorator、AuditLogService、cost guard、doctor；
- 可观测层：metrics、logs、notifications、trace summary；
- 产品层：Review Inbox、Exception Center、Performance Snapshot、Permission Profile、Provider Profile、Trigger Portfolio、Repo Context Map。

## 能力成熟度评分

评分：1 = 缺失，2 = 概念存在，3 = v1 可用，4 = 产品化，5 = 企业级成熟。

| 能力                   | 当前评分 | 证据                                                               | 与 Relevance AI 差距                                              |
| ---------------------- | -------: | ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| 自然语言 intake        |        3 | `createSimpleIssue`、`normaliseSimpleIssue`、simple form preview   | 已有 workforce/runtime/eval/risk preview；缺持久化 blueprint/eval |
| 阶段化交付             |        4 | PHASE_1 到 PHASE_8、advance/run/reloop/finalize                    | Relevance 不一定有此深度，是 DofeAI 优势                          |
| Agent runtime          |        4 | Codex/Claude adapters、runtime detection、Runtime Backend Registry | 缺真实持久化 policy、fallback 执行和 remote runner                |
| Workforce 产品抽象     |        3 | Workforce Overview、Agent Handoff、Delivery Flow                   | 缺可配置 team/canvas 与 blueprint 绑定                            |
| Tool registry          |        2 | capability registry、permission profile                            | 缺 tool schema、配置、测试、授权                                  |
| Trigger system         |        3 | sourceKind/sourceChannel 展示、resume、signed webhook intake v1    | 缺 schedule/replay/dead-letter/integration worker                 |
| Eval system            |        3 | tests/reviews/coverage、derived EvalSuite/EvalRun API v1           | 缺持久化、版本化、趋势和 gating 绑定                              |
| Enterprise governance  |        3 | SSO/RBAC/audit/cost/doctor                                         | 缺资产级权限、OTEL、quota/concurrency                             |
| Integration ecosystem  |        2 | Git/PR/runtime adapters                                            | 缺 Slack/GitHub/Linear/Jira/CI 入口闭环                           |
| Template marketplace   |        2 | simple issue templates、blueprint catalog                          | 缺 marketplace/clone/configurable blueprint                       |
| Observability          |        3 | metrics/logs/trace/exception center                                | 缺 vendor-neutral event streaming                                 |
| Evidence chain         |        4 | implementation/test/review/global/evidence artifacts               | DofeAI 优势，应产品化                                             |
| CLI backend governance |        3 | runtime diagnostics、workspace profile、Runtime Backends UI        | 缺 fallback 执行、远程 runner、持久化策略                         |

## 关键差距 0：Codex/Claude CLI 运行时没有成为一等产品对象

### 当前状态

项目已经有 Loops agent adapters、Claude adapter、agent runtime detection、workspace profile、Docker/local CLI 相关诊断。也就是说，底层不是抽象 LLM，而是具体的 Codex CLI / Claude Code CLI 执行环境。

### 问题

当前 UI 和文档容易把这些运行时理解成普通 provider 信息，而不是 DofeAI 的底层能力边界。用户需要知道：

- 本次 Loop 由 Codex 还是 Claude Code 执行；
- 在 local、Docker 还是未来 remote runner 中执行；
- 有哪些 read/write/shell/network 权限；
- 失败后是否 fallback 到另一个 CLI；
- 哪些阶段必须由某个 CLI 或人工 gate 承接。

### 建议

新增 `Runtime Backend Registry`：

```text
RuntimeBackend
- id: codex-cli | claude-code-cli | deterministic | docker-codex | docker-claude | remote-runner
- status: available | degraded | unavailable
- executionMode: local | docker | remote
- supportedStages
- permissionProfile
- workspacePolicy
- costPolicy
- fallbackPolicy
- lastHealthCheck
- diagnostics
```

这个 registry 应成为 Workforce、Tool、Eval、Trigger 的底座，而不是 dashboard 里的附属诊断信息。

## 关键差距 1：Workforce 抽象已部分闭合

### 当前状态

后端有阶段和 agent：

- Spec Review Agent；
- Implementation Agent；
- Shard Review Agent；
- Global Review Agent。

前端 Dashboard 有 Loop Board、Provider Profile、Permission Profile、Workforce Overview、Agent Handoff Timeline 和 Delivery Flow Pipeline，但部分文案仍会暴露 issue、phase、shard 等内部模型。

### 问题

用户对“PHASE_5_REVIEW / shard / reloop”的理解成本已经被 Workforce/Delivery Flow 降低，但 blueprint 与 team 配置仍未形成一等产品对象。

### 建议

继续增强 `Delivery Workforce` 概念：

- 每个 Loop 由一个 `Delivery Workforce Blueprint` 生成；
- Blueprint 包含 agents、handoffs、required tools、eval suite、human gates、runtime backend policy；
- Dashboard 展示 “Spec Writer -> Builder -> Reviewer -> Release Annotator” 的团队视图；
- Detail 页展示当前 agent、上游输入、下游交接、阻塞 gate、实际使用的 Codex/Claude CLI backend。

## 关键差距 2：创建入口缺少 Invent 级输出

### 当前状态

`/loops/new` 通过一句话生成：

- title；
- priority；
- body；
- acceptanceCriteria；
- targetRepo；
- template preview；
- recommended agent path/test policy 的 UI 提示。

### 问题

这只是 Issue 标准化，不是工作流设计。Relevance AI 的 Invent 强调生成 agents/tools/evals。

### 建议

将创建结果升级为：

- `issue`：需求与验收标准；
- `blueprint`：使用哪个 delivery workforce；
- `agentPlan`：每个 agent 负责什么；
- `runtimePlan`：每个阶段默认使用 Codex、Claude Code、Docker 或 fallback backend；
- `toolPlan`：需要哪些工具和权限；
- `evalPlan`：如何判断结果可接受；
- `riskPlan`：何时需要人类审批。

## 关键差距 3：触发器生命周期已展示但未执行化

### 当前状态

DofeAI 能记录 issue source，并在 Trigger Portfolio / Trigger Lifecycle 展示来源、仓库和提交人。API 有 resume，也已有 `/loops/triggers/webhook` signed webhook intake v1：配置 signing secret 时强制 HMAC-SHA256 签名校验，未配置 secret 时保留本地/手动 unsigned 兼容；外部 payload 可创建低风险 Loop，保留 `sourceChannel/sourceKind`，并将常见 `title/body/acceptanceCriteria/targetRepo/priority`、GitHub issue/PR 等字段映射为 Delivery Loop issue。targetRepo 仍走现有 allow-list，外部 payload 不能越过仓库边界；写入 issue body 的 webhook payload 会对 token、secret、authorization、password、api key 等敏感字段做基础脱敏；payload size guard 默认限制 64KB，可通过 `LOOPS_WEBHOOK_MAX_PAYLOAD_BYTES` 调整；单实例 in-process rate guard 默认限制同一 `source:event` 每分钟 60 次，可通过 `LOOPS_WEBHOOK_RATE_LIMIT_PER_MINUTE` 调整。但它还不是完整 trigger object 与 worker，也不是分布式 rate limit。

### 问题

Relevance AI 支持 scheduled/API/webhook/integration/tools-as-triggers，并能暂停 trigger。DofeAI 如果只靠手动提交，就很难成为自动化平台。

### 建议

新增 Trigger Contract：

```text
Trigger
- id
- workspaceId
- blueprintId
- type: manual | webhook | schedule | github | slack | linear | ci
- status: active | paused | failed
- auth: signingSecret | oauthConnection | apiKeyRef
- inputSchema
- mapping
- retryPolicy
- lastRun
- failureCount
```

优先实现：

1. Manual trigger object，兼容现有 create issue；
2. Webhook trigger，把当前 signed intake + basic payload mapping + evidence redaction + payload size guard + in-process rate guard v1 扩展为 payload replay、retry/dead-letter；
3. Schedule trigger，支持 cron 和 timezone；
4. GitHub issue/PR/CI trigger；
5. Slack command trigger。

## 关键差距 4：Evals 有派生检查但没有持久化复用

### 当前状态

每个 Loop 有 test record、review record、global review、requirements coverage、derived eval plan 与 release gate checks。这些证据在单个交付里很强；代码中也已有 `EvalSuiteSchema`、`EvalRunSchema`、`listEvalSuites`、`listEvalRuns` 的只读派生 API v1。

### 问题

团队无法回答：

- 这个 blueprint 最近 30 天通过率是多少？
- 新 agent 版本是否退化？
- 哪些场景是回归基线？
- 哪些 checks 是硬门禁？

### 建议

新增 Eval Suite：

```text
EvalSuite
- id
- name
- scope: blueprint | workspace | tool | agent
- scenarios[]
- checks[]
- baselineVersion
- passThreshold
- lastRun
- trend
```

软件交付内置 checks：

- acceptance criteria coverage；
- test command pass；
- no unreviewed changed files；
- spec diff approved；
- PR evidence attached；
- cost within budget；
- forbidden file/path policy check；
- security-sensitive change requires human review。

## 关键差距 5：Tool Registry 停留在展示

### 当前状态

Capability Registry 已有：

- capability items；
- agent tool registry；
- owner；
- permission profile；
- planned compatibility。

### 问题

用户不能配置 tool，也不能看到 tool 的输入输出 schema、运行风险、授权连接、测试结果和审计。

### 建议

将 capability registry 演进为 Tool & Integration Registry：

- Tool definition：name、description、input/output schema；
- Runtime binding：local、docker、remote、MCP、HTTP；
- Permission profile：read/write/shell/network/secrets；
- Owner and approval policy；
- Test cases and eval checks；
- Audit event mapping；
- Version and rollback。

## 关键差距 6：企业治理尚未形成包装

### 当前状态

已有：

- `@Auth('api')`；
- `RequireLoopsPermission`；
- audit log create/update；
- doctor；
- metrics/logs/notifications；
- cost guard。

### 问题

这些能力目前散在技术实现里，产品上没有形成 Enterprise Admin Center。

### 建议

新增 Admin/Governance 信息架构：

- Organization / Workspace / Blueprint / Tool / Trigger 分层权限；
- Audit Explorer；
- Cost & quota dashboard；
- Runtime policy center；
- Secret and integration connection status；
- OTEL event streaming；
- Data retention policy。

## 关键差距 7：模板市场已有目录但缺 clone/config

### 当前状态

有 simple issue templates、dashboard blueprint catalog 和多份竞品分析文档，但产品中还没有持久化、可 clone/config 的蓝图市场。

### 建议

第一批 Software Delivery Blueprints：

| Blueprint         | 目标用户 | 默认 agents                                    | 默认 evals                                    |
| ----------------- | -------- | ---------------------------------------------- | --------------------------------------------- |
| Bugfix Loop       | 工程团队 | Triage、Implement、Test、Review                | regression test、root cause、diff scope       |
| API Endpoint Loop | 后端团队 | Contract、Service、Test、Review                | Zod contract、DB service boundary、type-check |
| UI Feature Loop   | 前端团队 | UX Spec、Implement、A11y Review、Visual QA     | responsive checks、a11y、Playwright           |
| Refactor Loop     | 架构团队 | Impact Analyst、Refactor、Review               | behavior unchanged、coverage、risk map        |
| Migration Loop    | 平台团队 | Planner、Migrator、Verifier、Rollback Reviewer | migration dry-run、rollback plan              |

## 与架构规则的关系

所有建议必须遵守本项目规则：

- DB 访问只通过 DB Service；
- API 请求/响应 Zod-first，经 ts-rest contracts；
- 外部 API 通过 Client layer；
- Winston logger only；
- list API 使用 PaginationQuerySchema / PaginatedResponseSchema；
- Loops 新 endpoint 应继续走 `packages/contracts/src/api/loops.contract.ts` 和 `packages/contracts/src/schemas/loops.schema.ts`。

## 差距优先级

| 优先级 | 差距                             | 当前状态                                                                                          | 原因                    |
| ------ | -------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------- |
| P0     | Software Delivery Workforce 抽象 | 已闭合 v1：Workforce Overview + Delivery Flow + handoff timeline                                  | 直接影响定位和用户理解  |
| P0     | Runtime Backend Registry         | 已闭合 v2：contract/API/dashboard + file/DB policy persistence + health                           | Codex/Claude CLI 是底座 |
| P0     | Eval Suite                       | 已闭合 v2：EvalSuite/EvalRun API + evidence aggregation + trend baseline worker                   | 直接影响生产可信度      |
| P1     | Trigger Contract                 | 已闭合 v2：signed webhook + schedule CRUD/manual fire + BullMQ scheduler + retry/replay/DLQ       | 直接影响自动化平台属性  |
| P1     | Blueprint Marketplace            | 已闭合 v1：backend CRUD + default seed + version rollback/history                                 | 直接影响复用和获客      |
| P1     | Tool Registry v2                 | 已闭合 v1：backend CRUD + lifecycle/auth/health/test 控制面                                       | 直接影响生态扩展        |
| P2     | Enterprise Governance Center     | 已部分闭合：release gate/governance controls、Rules Center enforcement、cross-tenant archive code | 影响大客户成交          |
| P2     | OTEL Event Streaming             | 未实施                                                                                            | 企业深水区能力，可后置  |

## 2026-06-24 实施审查标注

本轮再次审查代码后，确认文档中的若干建议已在本项目中有可运行实现，不能再标为“缺失”：

- `Runtime Backend Registry`：已存在 contract/API/service/dashboard v1，基于 Codex CLI / Claude Code CLI runtime detection 生成 backend 列表、状态、mode、权限、workspace、cost、fallback 和 health checks。
- `Software Delivery Workforce`：已存在 Workforce Overview、Agent Handoff Timeline 和本轮新增的 Delivery Flow Pipeline，将 Loops 状态机映射为用户可理解的交付流程。
- `Invent Delivery Preview`：`/loops/new` 已展示 Workforce / Runtime / Eval / Risk-Gate preview。
- `Release Governance`：已存在 delivery governance、review gate override、second opinion policy、release canary。本轮补齐 `rollbackNote` 持久化、表单提交和 release gate checklist，使首次 finalize 能在 PR 创建前通过显式回滚说明满足门禁。
- `Eval`：已有 derived Eval Plan、测试/审阅/coverage 证据、release gate checks、`EvalSuite`/`EvalRun` contract/API/service、historical baseline/trend worker 与 cache health；仍缺跨租户长期归档和队列化实时聚合。
- `Trigger`：已有 Trigger Portfolio/Lifecycle 视图、signed webhook intake v1、schedule trigger CRUD、manual fire、BullMQ scheduler、retry/replay/dead-letter；仍缺 Slack/Linear/Jira 专用 mapping、CI fail→Loop、外部告警和分布式限流。
- `Tool Registry`：已有 `list/get/register/update/health-check/test` backend contract/API/service 与 file-backed persistence；真实 provider invocation runtime 仍是后续。
- `Blueprint Marketplace`：已有 backend CRUD、8 个 default blueprint seed、version rollback/history；clone、跨租户共享和审批队列仍是后续。

仍需实施或优化的内容进入后续 Epic，不宜在本轮继续强行扩展：

1. Eval Platform：跨租户长期归档、队列化实时聚合、Eval result 与 finalized Loop 的可查询关联。
2. Trigger Platform：Slack/Linear/Jira/CI 专用 mapping、payload replay UX、分布式 rate limit/cost policy、外部告警。
3. Tool & Integration Runtime：真实 provider invocation、tool invocation audit replay、provider secret bootstrap。
4. Blueprint Marketplace 产品化：clone/config、跨租户共享、审批队列、评分和使用分析。
5. Enterprise Governance Center：Audit Explorer、quota/concurrency、OTEL event streaming、data retention。
