# 03 · 基于本项目实现的差距分析

## 当前实现画像

基于本项目已有文档和代码，DofeAI Loops 当前已经具备以下底座：

- 产品文档：`docs/0619/loops设计/**` 描述了 Issue → Spec → Review → Decompose → Implement → Review → Reloop → Finalize 的完整循环；
- 后端模块：`apps/api/src/modules/loops/**` 已有 service、controller、runtime detection、workspace profile、runner、cost guard、doctor、locks、notifications、PR provider、adapters；
- 合同层：`packages/contracts/src/api/loops.contract.ts` 与 `packages/contracts/src/schemas/loops.schema.ts` 承载 Loops API；
- 持久化：`.loops` 文件源 + DB service 双源一致性检测；
- 治理：RBAC decorator、AuditLogService、runtime security policy、path policy、cost policy；
- 可观测：logs、metrics、notifications、trace timeline、doctor；
- 前端：Dashboard、Loop detail、new issue、review/exception/provider/permission/trigger 等控制面雏形。

这说明 DofeAI 的问题不是“没有技术底座”，而是“技术底座尚未被包装成用户一眼能理解、能复用、能治理、能采购的产品对象”。

## 能力成熟度评分

评分：1 = 缺失，2 = 概念存在，3 = v1 可用，4 = 产品化，5 = 企业级成熟。

| 能力                  | 当前评分 | 证据                                                                                    | 对标 CrewAI 差距                          |
| --------------------- | -------: | --------------------------------------------------------------------------------------- | ----------------------------------------- |
| Issue intake          |        3 | simple issue、web entry、source tracking                                                | 缺 Invent Delivery Loop 级 plan 生成      |
| 状态机/流程           |        4 | phase、advance、review、reloop、finalize                                                | 缺 Flow/Workforce 产品语言                |
| 多 agent 分工         |        3 | Codex/Claude adapters、review/build 分工                                                | 缺 agent persona 和 handoff UI            |
| Runtime detection     |        4 | agent-runtime detection、workspace profile、Docker/local、Runtime Backends dashboard v1 | 生命周期治理仍需后端 contract             |
| 企业治理              |        3 | RBAC、audit、cost、doctor、runtime policy                                               | 缺资产级权限、组织级 rules、quota         |
| 可观测                |        3 | metrics、logs、notifications、event log                                                 | 缺 ACP 级健康/成本/趋势聚合               |
| Trace/evidence        |        4 | spec/test/review/global/evidence artifacts                                              | 缺统一 Delivery Trace 与导出              |
| Tool registry         |        2 | capability registry                                                                     | 缺 tool schema、auth、health、test、audit |
| Trigger system        |        2 | source/trigger portfolio 展示                                                           | 缺 trigger object、replay、retry、DLQ     |
| Eval system           |        3 | test/review/coverage、Eval Plan dashboard v1                                            | 缺 reusable eval suite/trend/baseline     |
| Blueprint marketplace |        1 | templates 雏形                                                                          | 缺版本化 workflow 模板                    |
| Remote/queue worker   |        2 | runner/local/Docker 方向                                                                | 缺生产异步 worker 和执行池                |
| PR integration        |        2 | PR provider adapter                                                                     | 缺默认 issue-to-PR 交付体验               |

## 差距 1：缺少用户可理解的 Workforce 抽象

### 当前状态

Loops 内部有明确阶段：spec、review、decompose、implementation、review、global review、finalize。但用户看到的是 phase、shard、round、reloop 等工程术语。

### 问题

CrewAI 用 Crews / Agents / Automations 让用户理解“谁在做什么”。DofeAI 当前的术语更像内部状态机，不像产品对象。

### 建议

新增 `Software Delivery Workforce`：

| Agent            | 职责                     | 当前对应                         |
| ---------------- | ------------------------ | -------------------------------- |
| Intake Analyst   | 标准化需求、补充验收标准 | simple issue normalisation       |
| Spec Writer      | 生成规格                 | generate spec                    |
| Human Gatekeeper | 审批/打回/拒绝           | review spec                      |
| Work Planner     | 拆解 work packages       | decompose shards                 |
| Builder          | 修改代码                 | Claude Code/Codex implementation |
| Test Runner      | 执行测试并留证           | LoopsRunnerService               |
| Code Reviewer    | 分片审阅                 | shard review                     |
| Release Reviewer | 全局收敛审阅             | global review                    |
| Evidence Curator | 汇总证据、PR 注释        | finalize/annotations             |

## 差距 2：Runtime Backend 没有成为一等资产

### 2026-06-23 实施标注

已闭合 v1：`apps/web/app/loops/loops-dashboard-model.ts` 新增 `buildRuntimeBackends`，将现有 `LoopAgentRuntimeResponse.runtimes` 包装为 Codex CLI / Claude Code CLI 两个可治理 Runtime Backend，并展示 status、mode、permissions、workspace policy、cost policy、fallback policy、supported stages 和 health checks。`apps/web/app/loops/page.tsx` 已新增 Runtime Backends 区块，`apps/web/app/loops/loops-dashboard-model.test.ts` 与 `apps/web/app/loops/page.test.tsx` 已覆盖。

仍未闭合：后端一等 `RuntimeBackend` contract、policy patch、health-check endpoint、fallback 执行策略、远程 runner 生命周期。

### 当前状态

项目已有：

- Codex / Claude adapter；
- local / Docker runtime detection；
- workspace profile；
- runtime command builder；
- runtime security policy；
- cost guard。

### 问题

这些能力分散在诊断和执行逻辑里，用户无法配置：

- 哪个阶段用 Codex CLI；
- 哪个阶段用 Claude Code CLI；
- local/Docker/remote 的优先级；
- 失败如何 fallback；
- 哪些 backend 能访问 network/shell/secrets；
- 哪些 repo 允许被 mount/write。

### 建议

新增 `RuntimeBackend` 模型：

```text
RuntimeBackend
- id
- name
- kind: codex-cli | claude-code-cli | deterministic | docker | remote-runner
- status: ready | degraded | unavailable
- mode: local | docker | remote
- version
- authStatus
- supportedStages
- permissionProfile
- workspacePolicy
- costPolicy
- fallbackPolicy
- healthChecks[]
- lastDetectedAt
```

## 差距 3：创建入口还只是 Issue 标准化

### 当前状态

`/loops/new` 可以把自然语言整理成 title、priority、body、acceptance criteria、target repo、template preview。

### 问题

CrewAI 的 Studio / deployment / automation 心智会让用户知道“我创建的是一个可运行自动化”。DofeAI 当前创建的是“一个 issue”，后续会发生什么不够显性。

### 建议

升级为 `Invent Delivery Loop`，创建前生成：

- Issue summary；
- Workforce plan；
- Work package strategy；
- Runtime plan；
- Tool plan；
- Eval plan；
- Risk and human gate plan；
- Estimated cost and duration；
- PR/evidence delivery plan。

## 差距 4：Eval 不是可复用资产

### 2026-06-23 实施标注

已闭合 v1：`apps/web/app/loops/loops-dashboard-model.ts` 新增 `buildEvalPlan`，把 architecture compliance、delivery readiness、runtime safety、test evidence、cost policy 汇总为硬关卡视图。Dashboard 已新增 Eval Plan 区块，显示 passed / attention / blocked 和每项 evidence。相关测试已补齐。

仍未闭合：后端 `EvalSuite` / `EvalRun` contract、跨 blueprint 趋势、baseline version、历史通过率、硬关卡对 finalize 的后端统一阻断。

### 当前状态

每个 Loop 有测试记录、审阅记录、requirements coverage、global review。

### 问题

团队无法横向比较：

- 某个 blueprint 最近 30 天通过率；
- 某个 runtime backend 的失败率；
- 某类 API endpoint loop 的平均 reloop 次数；
- 某个架构规则是否经常被违反；
- 新版本 agent prompt 是否退化。

### 建议

新增 `EvalSuite` 与 `EvalRun`：

```text
EvalSuite
- scope: workspace | blueprint | agent | runtime | tool
- scenarios[]
- checks[]
- thresholds
- hardGates[]
- baselineVersion

EvalRun
- suiteId
- targetRef
- status
- score
- checkResults[]
- evidenceRefs[]
- trendDelta
```

首批 checks 应直接利用本项目规则：

- 不允许 controller/service 直接使用 Prisma；
- API 变更必须更新 Zod/ts-rest contract；
- 外部 API 必须经 client layer；
- production code 不允许 console.log/Nest Logger；
- test command pass；
- changed files 在 allowed repo/path；
- cost 未触发熔断；
- global review pass；
- PR evidence present。

## 差距 5：Tool Registry 停留在展示层

### 当前状态

Capability Registry 已有工具/能力展示，permission profile 也有雏形。

### 问题

CrewAI 的工具生态包括 `crewai-tools`、Tool Repository、MCP、enterprise integrations。DofeAI 现在缺少工具的完整生命周期：

- 定义；
- 授权；
- 输入输出 schema；
- 权限；
- 健康检查；
- smoke test；
- 使用审计；
- 版本回滚。

### 建议

建立 `Tool & Integration Registry`：

| 类别           | 首批对象                                       |
| -------------- | ---------------------------------------------- |
| Repo tools     | git、worktree、PR provider、diff、branch       |
| Build tools    | pnpm、npm、pytest、jest、turbo、docker         |
| QA tools       | Playwright/browser、lint、type-check、coverage |
| Collaboration  | GitHub、GitLab、Linear、Jira、Slack            |
| Runtime tools  | Codex CLI、Claude Code CLI、MCP servers        |
| Security tools | path policy、secret scanner、dependency audit  |

## 差距 6：Trigger 没有生命周期

### 当前状态

DofeAI 能记录来源，也有 Trigger Portfolio 展示，但没有一等 trigger object。

### 问题

没有 trigger 生命周期，就无法承接：

- GitHub issue label 自动创建 Loop；
- CI failed 自动创建修复 Loop；
- schedule 定期做依赖升级；
- webhook 从外部系统触发；
- Slack/Linear/Jira 触发；
- replay 和 dead-letter。

### 建议

新增 `Trigger`：

```text
Trigger
- id
- workspaceId
- blueprintId
- type: manual | webhook | schedule | github | slack | linear | jira | ci
- status: active | paused | failed
- inputSchema
- mapping
- authRef
- signingSecretRef
- retryPolicy
- deadLetterPolicy
- lastRunAt
- failureCount
- owner
```

## 差距 7：企业控制面还没有统一叙事

### 当前状态

已有 dashboard、cost guard、doctor、audit、RBAC、runtime detection，但分散在页面和服务里。

### 问题

CrewAI 的 Agent Control Plane 直接回答企业问题：

- fleet 是否健康；
- 哪些 automation 在失败；
- LLM 花了多少钱；
- 哪些规则在组织范围生效；
- 谁有权限。

DofeAI 需要回答工程管理问题：

- 哪些 repo 的 AI 交付最稳定；
- 哪些 blueprint 最容易失败；
- 哪些 runtime backend 成本最高；
- 哪些 human gate 等待最久；
- 哪些架构规则经常被 agent 违反；
- 哪些 Loop 可以安全 merge。

### 建议

建立 `Engineering Agent Control Plane`，包括：

- Delivery fleet health；
- Runtime backend health；
- Cost and quota；
- Eval trend；
- Rule center；
- Audit explorer；
- Human gate inbox；
- Trigger health；
- Tool health。

## 差距 8：PR 是软件团队默认交付语言，但当前不够突出

### 实施标注（2026-06-23 R5/R6）

✅ 已闭合 v2。Detail 页新增 Delivery Evidence 区块（spec/works/tests/reviews/risks/cost/prStatus）。R6 新增 PR comment 自动发布：`LoopsPrProviderClient.createPrComment()` 在 `finalize()` 中自动调用，将 delivery evidence markdown 发布为 PR 评论。

仍未闭合：GitHub CI check 集成、Work Package→commit 映射、PR→DofeAI evidence 反向链接。

### 当前状态

项目已有 PR provider adapter 和 evidence 设计，但产品主路径仍围绕 Loop 状态。

### 问题

工程团队最终需要在 PR 里做 code review、CI、merge、release。`.loops` evidence 是优势，但必须进入 PR 工作流。

### 建议（实施状态）

- ✅ Loop detail 增加 Delivery Evidence 区块（R5）；
- ✅ finalize 自动生成 PR evidence comment（R6）；
- ❌ global review 结果与 PR checks 绑定（需 GitHub Checks API 集成）；
- ❌ Work Package 映射 commit；
- ❌ PR 页面能跳回 DofeAI evidence。
