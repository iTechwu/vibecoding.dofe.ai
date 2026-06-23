# 04 · 对 DofeAI 的优化建议

## 产品战略建议

### 建议 1：明确定位为 Codex/Claude CLI 之上的 Software Delivery Workforce

不要把 DofeAI 做成泛业务 AI agent 平台，也不要把它描述成自研底层 agent runtime。Relevance AI 已经在销售、运营、客服、营销等横向场景建立较完整叙事。DofeAI 应该把 Codex CLI 与 Claude Code CLI 作为底层执行能力，把现有 Loops 深化为软件交付垂直控制面。

推荐定位：

> DofeAI 是面向软件团队的 AI Workforce Control Plane，基于 Codex 与 Claude Code CLI，把需求自动转化为规格、任务、实现、测试、审阅、PR 和可审计证据。

产品语言调整：

| 当前语言            | 建议语言                    |
| ------------------- | --------------------------- |
| Loop                | Delivery Loop               |
| Phase               | Delivery stage              |
| Shard               | Work package                |
| Agent Runtime       | Runtime Backend             |
| Codex/Claude CLI    | Delivery Executor           |
| Capability Registry | Tool & Integration Registry |
| Metrics             | Delivery intelligence       |
| Doctor              | Workspace health            |
| Cost Guard          | Spend and safety guard      |

### 建议 2：把 Loops 的 agent pipeline 包装为 Workforce

新增 `Software Delivery Workforce` 默认团队：

| Agent            | 职责                           | 当前对应                            |
| ---------------- | ------------------------------ | ----------------------------------- |
| Intake Analyst   | 标准化需求、补齐验收标准       | simple issue / normalise            |
| Spec Writer      | 生成规格草案                   | generateSpec                        |
| Spec Reviewer    | 等待/辅助人类审阅              | reviewSpec gate                     |
| Work Planner     | 拆解 work packages             | decompose                           |
| Builder          | 实现并记录变更                 | runLoop / recordShardImplementation |
| Test Runner      | 执行测试并留证                 | runShardTests                       |
| Code Reviewer    | 分片审阅                       | reviewShard                         |
| Release Reviewer | 全局审阅、决定 reloop/finalize | reviewGlobal                        |
| Evidence Curator | 汇总证据和 PR 注释             | finalize / annotate                 |

前端建议：

- Dashboard 增加 Workforce Overview；
- Detail 页增加 Agent Handoff Timeline；
- 每个 agent card 标注执行 backend：Codex CLI / Claude Code CLI / Docker / fallback；
- 新建页 preview 展示 agent team、human gates、eval plan；
- Exception Center 的 owner 从 phase 改为 agent/persona。

### 建议 3：新增 Runtime Backend Registry

这是本轮修正后最重要的底座建议。DofeAI 的商业价值不是替代 Codex/Claude Code，而是让企业安全、可控、可审计地使用这些 CLI。

Runtime Backend Registry 应覆盖：

| 能力             | 说明                                                                   |
| ---------------- | ---------------------------------------------------------------------- |
| Backend identity | codex-cli、claude-code-cli、docker-codex、docker-claude、remote-runner |
| Health           | 是否安装、版本、认证状态、最近一次探测                                 |
| Capability       | 支持哪些 delivery stages、是否支持 shell/network/browser               |
| Permission       | read/write/shell/network/secrets/approval 策略                         |
| Workspace        | root、mount、path policy、allowed repos                                |
| Cost             | per-loop call/token policy、预算预警                                   |
| Fallback         | Codex 失败是否切 Claude，或进入人工接管                                |
| Evidence         | command transcript、changed files、test output、artifact refs          |

前端落点：

- Dashboard Provider Profile 升级为 Runtime Backends；
- Workspace settings 增加 backend health 和 policy；
- Loop detail 每个阶段展示 actual backend；
- Exception Center 增加 backend unavailable/degraded/fallback。

### 建议 4：创建体验升级为 Invent for Delivery

当前 simple issue 应升级为 `Invent Delivery Loop`：

用户输入一句话后，系统生成五块 preview：

1. Issue Summary：标题、目标仓库、优先级、验收标准；
2. Workforce Plan：将使用哪些 agents；
3. Runtime Plan：每个阶段使用 Codex CLI、Claude Code CLI、Docker 或 fallback；
4. Tool Plan：需要 Git、test runner、PR provider、package manager、browser 等哪些工具；
5. Eval Plan：怎么验证结果；
6. Risk/Gate Plan：哪些步骤需要人类批准。

验收标准：

- 创建前用户能知道“谁会做、用什么做、怎么验收、哪里会停下来问我”；
- 创建前用户能知道底层由哪个 CLI backend 执行，以及权限边界；
- preview 可编辑；
- 创建后这些 plan 写入 Loop detail，成为后续证据链的 baseline。

## 核心功能建议

### P0 · Eval Suite

目标：将单次测试/审阅记录升级为可复用质量体系。

建议 contract：

```text
GET /loops/eval-suites
POST /loops/eval-suites
GET /loops/eval-suites/:id
POST /loops/eval-suites/:id/runs
GET /loops/eval-runs
```

核心字段：

- suite scope：workspace / blueprint / agent / tool；
- scenarios：输入、目标、上下文；
- checks：规则、阈值、自动/人工；
- baseline：版本与期望；
- run result：pass/fail、score、evidence links；
- trend：按时间、blueprint、agent version 展示。

首批内置 checks：

- acceptance criteria coverage >= 100%；
- test records all pass；
- global review = PASS；
- changed files within allowed target repo；
- no production console.log / Nest Logger；
- no direct prisma.write/read in service/controller；
- no external API call outside client layer；
- Zod contract updated for API change；
- cost calls/tokens under policy。

### P1 · Trigger Contract v2

目标：从手动 Loop 变成事件驱动自动化。

首批 trigger：

| Trigger       | 说明                                     | 优先级 |
| ------------- | ---------------------------------------- | ------ |
| Manual        | 兼容现有 `/loops/new`                    | P0     |
| Webhook       | 外部系统 POST 创建/推进 Loop             | P1     |
| Schedule      | 定时巡检、日报、依赖升级检查             | P1     |
| GitHub Issue  | label/comment/new issue 触发             | P1     |
| GitHub PR/CI  | PR check failed 或 review requested 触发 | P1     |
| Slack Command | 团队聊天里创建或查询 Loop                | P2     |
| Linear/Jira   | 产品需求状态变化触发                     | P2     |

必须具备：

- active/paused；
- signature verification；
- payload schema and mapping；
- replay；
- retry/dead-letter；
- audit event；
- rate limit；
- owner and permissions。

### P1 · Blueprint Marketplace

目标：把 DofeAI 的最佳实践沉淀为可复制产品。

首批蓝图：

- Bugfix Loop；
- API Endpoint Loop；
- UI Feature Loop；
- Refactor Loop；
- Dependency Upgrade Loop；
- Security Patch Loop；
- Documentation Update Loop；
- Database Migration Loop。

每个 blueprint 包含：

- recommended intake questions；
- agents；
- tools；
- eval suite；
- human gates；
- cost policy；
- trigger suggestions；
- evidence template；
- rollback checklist。

### P1 · Tool & Integration Registry

目标：把 capability registry 从展示升级为配置与治理中心。

建议信息架构：

- Tools：Git、package manager、test runner、browser、PR provider、filesystem、MCP tools；
- Integrations：GitHub、GitLab、Slack、Linear、Jira、Notion、Sentry、CI；
- Permissions：read/write/shell/network/secrets；
- Health：last check、runtime compatibility、failure rate；
- Tests：tool smoke tests、eval checks；
- Audit：who used what, when, with what input/output reference。

### P1 · Delivery Intelligence

目标：将 dashboard 从状态看板升级为管理者决策面。

新增指标：

- lead time：从 intake 到 finalized；
- human wait time：卡在人类门禁的时间；
- reloop rate；
- test failure rate；
- review rejection reasons；
- cost per delivered Loop；
- agent success rate by blueprint；
- top blocked repos/tools；
- trigger failure rate。

### P2 · Enterprise Governance Center

目标：为企业部署和采购补齐叙事。

模块：

- Organization / Workspace / Blueprint / Tool / Trigger 权限；
- Audit Explorer；
- Cost & quota；
- Runtime Policy；
- Secret & Integration Connections；
- Event Streaming；
- Data Retention；
- Compliance Evidence Export。

## 工程落地建议

### Contract-first

新增能力先从 `packages/contracts` 开始：

- Zod 4 schema；
- ts-rest contract；
- list endpoint 使用 PaginationQuerySchema / PaginatedResponseSchema；
- contract tests。

### 后端 layering

新增外部集成必须走 Client layer：

- GitHubClient；
- SlackClient；
- LinearClient；
- WebhookSignatureService；
- TriggerExecutionService；
- EvalRunnerService；
- ToolRegistryService。

DB 访问必须通过 DB Service，不在 controller/service 直接访问 Prisma。

### 前端渐进实施

优先不重构大页面，新增三个局部产品化组件：

1. `WorkforceOverview`：由现有 phase/agent runtime 数据推导；
2. `EvalPlanPreview`：创建页静态规则 + 后续 contract；
3. `TriggerManagementPanel`：先展示 manual/source，后接 trigger API。

## 关键验收指标

| 指标             | 目标                                                  |
| ---------------- | ----------------------------------------------------- |
| 新用户创建成功率 | 创建页用户能在 2 分钟内创建第一个 Delivery Loop       |
| Preview 理解度   | 用户能在创建前说明 agent team、eval plan、human gates |
| 自动化入口       | 至少支持 webhook + schedule + GitHub issue trigger    |
| 质量证明         | 每个 finalized Loop 关联 eval run                     |
| 复用能力         | 至少 5 个 blueprint 可 clone                          |
| 企业治理         | Audit Explorer 可查询 trigger/tool/agent/phase 事件   |

## 不建议做的事

- 不建议短期复制 Relevance AI 的全行业模板市场；
- 不建议先做大型可视化画布，当前阶段可用 handoff graph 代替；
- 不建议将 Tool Builder 做成任意代码执行平台，先做受控工具 schema；
- 不建议跳过 eval suite 直接扩 integrations，否则自动化越多风险越大；
- 不建议把内部 phase 完全暴露给终端用户，应保留在高级/调试层。
