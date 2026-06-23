# 02 · Relevance AI vs DofeAI 深度对比

## 对比摘要

| 维度          | Relevance AI                                                   | DofeAI 当前                                               | 判断                                                  |
| ------------- | -------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------- |
| 核心定位      | 企业 AI Workforce SaaS 平台                                    | Codex/Claude Code CLI 之上的工程交付 Loops 控制面         | DofeAI 更垂直，Relevance 更横向                       |
| 底层运行时    | Relevance 托管 agent runtime 与工具执行                        | Codex CLI、Claude Code CLI、本地/Docker workspace runtime | DofeAI 的核心不是重造 runtime，而是编排与治理 runtime |
| 创建入口      | Invent 自然语言生成 agents/tools/evals                         | Simple Issue 自然语言生成结构化 issue                     | DofeAI 需从 issue 入口升级为 workforce/blueprint 入口 |
| 多 agent 协作 | Workforce 可视化画布                                           | 固定 phase + Codex/Claude CLI 角色化调用                  | DofeAI 有内核，缺产品化表达                           |
| 工具系统      | No-code Tool Builder、API/MCP、批量运行                        | Capability Registry、agent/tool owner、CLI 权限画像       | DofeAI 缺可配置 Tool/Runtime Policy                   |
| 知识系统      | Knowledge/RAG/knowledge sources/snippets                       | Repo/rules/spec/evidence 上下文                           | DofeAI 更适合研发知识，但未抽象成 Knowledge 产品      |
| 触发器        | Manual、schedule、webhook、API、integration、tools as triggers | Web/simple issue intake + source 展示 + resume            | DofeAI 触发器生态明显不足                             |
| 运行控制      | Agent tasks、workforce runs、trigger pause                     | Loop dashboard、advance/run/reloop/intervene/resume       | DofeAI 工程闭环更强                                   |
| 评测          | Evals、checks、analytics、A/B                                  | Test record、review record、global review、coverage       | DofeAI 有证据但缺 eval suite 产品                     |
| 企业治理      | SSO、RBAC、audit、event streaming、org/project controls        | SSO/RBAC、audit log、doctor、metrics、cost guard          | DofeAI 底座不错，包装不足                             |
| 集成生态      | 1,000+/2,000+ integrations、native + Pipedream                 | Git/PR/runtime/workspace 为主                             | DofeAI 应优先接软件研发工具链                         |
| 商业模板      | Marketplace agent templates                                    | issue templates/simple templates                          | DofeAI 缺可复制的交付蓝图市场                         |
| 目标购买者    | Ops、Sales、Support、Marketing、Enterprise IT                  | 工程/产品/研发管理者                                      | DofeAI 应明确买方和 ROI 叙事                          |

## 底层运行时差异

Relevance AI 把运行时隐藏在 SaaS 平台内部，用户主要感知 agent、tools、knowledge、trigger 和 workforce。DofeAI 则应反过来把 Codex/Claude Code CLI 的执行能力纳入可治理边界：

| 运行时问题        | DofeAI 应回答                                                  |
| ----------------- | -------------------------------------------------------------- |
| 用哪个 CLI 执行？ | Codex / Claude Code / deterministic fallback / future backend  |
| 在哪里执行？      | local workspace / Docker workspace / remote runner             |
| 有哪些权限？      | read/write/shell/network/secrets/approval                      |
| 输入是什么？      | issue、spec、repo knowledge、rule snapshot、eval plan          |
| 输出是什么？      | changed files、test output、review verdict、evidence artifacts |
| 如何失败恢复？    | pause、resume、takeover、reloop、retry、cost guard             |
| 如何审计？        | audit log、trace event、runtime diagnostics、artifact refs     |

## 产品心智对比

### Relevance AI：招募一个 AI 员工团队

典型用户问题：

- 我想自动化 SDR 外联，帮我搭一个团队；
- 我想让 agent 定时生成报告；
- 我想把 Slack、CRM、Google Sheets 和内部知识库连接起来；
- 我如何知道这个 agent 上线后可靠？
- 企业如何审计、限权和接入观测系统？

产品语言：

- Agent；
- Workforce；
- Tool；
- Knowledge；
- Trigger；
- Eval；
- Integration；
- RBAC/Audit。

### DofeAI：把一个需求交付成可审计的软件结果

典型用户问题：

- 我有一个需求，能不能自动拆规格、拆任务、实现、测试和审阅？
- 当前 Loop 卡在哪里，谁需要决策？
- 这次实现有没有证据、测试记录、review 记录和 PR？
- 成本/上下文/运行时是否健康？
- 多个仓库、多轮 re-loop 如何追踪？

产品语言：

- Loop；
- Runtime Backend；
- Issue；
- Spec；
- Shard；
- Test Record；
- Review Record；
- Global Review；
- Evidence Artifact；
- Runtime Diagnostics；
- Cost Guard。

## 核心能力矩阵

| 能力                 | Relevance AI 成熟度                    | DofeAI 成熟度                                                     | DofeAI 机会                                     |
| -------------------- | -------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------- |
| 自然语言创建         | 高：Invent 自动生成 agents/tools/evals | 中：simple issue 自动补全标题/优先级/验收标准                     | 增加 delivery blueprint + runtime plan 生成     |
| 多 agent 可视化      | 高：Workforce canvas                   | 中：phase/agent model 存在，Codex/Claude backend 未产品化         | 增加 team graph / handoff graph / backend badge |
| 执行生命周期         | 中高：tasks、runs、triggers            | 高：phase gate、advance、runLoop、reloop、finalize                | 保持工程交付闭环优势                            |
| 人类门禁             | 中：escalation/control                 | 高：spec review、global review、intervention                      | 把门禁转为“批准/驳回/接管”产品语言              |
| 证据链               | 中：audit/execution traces             | 高：test/review/global/evidence/trace                             | 强化为差异化卖点                                |
| 工具生态             | 高：tool builder + integrations        | 中低：registry 展示，缺 builder                                   | 先做研发工具集成与 tool schema                  |
| 知识库               | 高：business knowledge/RAG             | 中：repo/rules/spec/evidence 上下文                               | 抽象为 repo knowledge + decision memory         |
| 触发器               | 高：schedule/API/webhook/integration   | 低中：入口记录，缺 trigger lifecycle                              | P1 必补                                         |
| 评测与质量           | 中高：Evals rolling out/Enterprise     | 中：测试审阅记录强，但不可复用                                    | 建立 eval suite                                 |
| 企业治理             | 高：SSO/RBAC/audit/OTEL/quotas         | 中：已有 SSO/RBAC/audit/doctor/cost                               | 补 OTEL、asset permissions、quota               |
| 模板市场             | 高：Marketplace/templates              | 低：simple templates                                              | 建立 software delivery blueprints               |
| 成本控制             | 中：pricing/credits/spend controls     | 中高：per-loop cost guard                                         | 做成 enterprise cost governance                 |
| Runtime backend 管理 | 低：SaaS 抽象隐藏                      | 中：runtime detection、provider profile、Docker/local diagnostics | 做成 DofeAI 核心差异化                          |

## DofeAI 已有能力对照 Relevance AI

| Relevance AI 概念    | DofeAI 当前对应                                                   | 状态                                         |
| -------------------- | ----------------------------------------------------------------- | -------------------------------------------- |
| Agent                | spec-review / implementation / shard-review / global-review agent | 已有运行时定义，底层由 Codex/Claude CLI 承接 |
| Workforce            | Loop phase pipeline                                               | 有内核，缺可视化团队抽象                     |
| Invent               | `/loops/new` simple issue + normaliseSimpleIssue                  | 有轻量版                                     |
| Tool Registry        | LoopsCapabilityRegistry / Permission Profile                      | 展示型 v1                                    |
| Trigger Portfolio    | sourceChannel/sourceKind/targetRepo/submitter                     | 展示型 v1                                    |
| Task View            | Loop detail / dashboard action queue                              | 有工程任务视图                               |
| Evals                | test records + review records + requirements coverage             | 有证据，缺复用评测                           |
| Analytics            | metrics / performance snapshot / trace summary                    | 已有控制面指标                               |
| Audit Logs           | AuditLogService in loops controller                               | 已有操作审计                                 |
| RBAC                 | RequireLoopsPermission                                            | 已有 Loops 权限                              |
| Event Streaming      | logs/metrics endpoints                                            | 未达到 OTEL event streaming                  |
| Integration Triggers | Git/PR provider adapters 部分相关                                 | 未产品化                                     |
| Runtime Backend      | Codex/Claude CLI detection、workspace profile、Docker fallback    | 是 DofeAI 与 Relevance AI 的关键差异         |

## DofeAI 的差异化资产

### 1. Evidence-first 工程交付

Relevance AI 强调 agent 完成业务任务；DofeAI 可以强调每一步都可追溯：

- 原始 intake payload；
- rule snapshot；
- spec version；
- shard implementation；
- test commands；
- review verdict；
- global review；
- evidence artifacts；
- convergence PR。

这是软件团队采购时比“自动化”更硬的信任基础。

### 2. Human gate 与 re-loop

DofeAI 的 spec review、global review、reloop 能支持“人类批准关键判断，agent 继续执行”。这比很多 no-code agent 平台的线性流程更适合高风险工程任务。

### 3. Codex/Claude CLI runtime diagnostics 与 workspace profile

DofeAI 已关注 Codex/Claude runtime、Docker fallback、workspace root、path policy、cost guard。Relevance AI 更偏 SaaS 和集成生态，DofeAI 可在 self-host/private engineering runtime 上形成差异。这里的重点不是多接几个模型 provider，而是让用户知道每次交付由哪个 CLI backend 执行、在什么 workspace 中执行、具备什么权限、留下什么证据。

## DofeAI 的明显短板

### 1. 产品抽象偏工程内部

Loop、phase、shard 对研发 agent 实现者清楚，但对 PM、工程经理、非代码用户不直观。Relevance AI 的 Agent/Workforce/Tool/Trigger/Eval 更接近用户语言。

### 2. 创建体验还不是“从目标到团队”

DofeAI simple issue 能结构化用户输入，但没有像 Invent 那样显式生成：

- agent team；
- tool plan；
- eval plan；
- trigger suggestion；
- risk policy；
- expected ROI。

同时还缺少 runtime plan：

- 使用 Codex 还是 Claude Code；
- 是否需要 Docker sandbox；
- 是否允许 shell/network；
- 是否需要人类批准权限升级；
- 失败时切换到哪个 backend 或进入人工接管。

### 3. 缺少复用市场

Relevance AI 可以用 marketplace 和 use-case templates 降低行业冷启动。DofeAI 当前文档中有多个竞品分析与 UIUX 优化，但还没有产品内蓝图市场。

### 4. 触发器没有生产级闭环

当前更像手动创建/推进/恢复。缺少：

- signed webhook；
- schedule；
- GitHub issue/PR/CI events；
- Slack command；
- Linear/Jira issue event；
- trigger pause/resume；
- trigger replay；
- dead-letter queue。

### 5. 评测没有产品化

测试和审阅记录是单次 Loop 证据，不是跨版本、跨 agent、跨模板可复用的 eval suite。

## 竞品策略判断

DofeAI 不应该横向复制 Relevance AI 的全行业 AI Workforce，因为那会进入更重的集成、模板和 GTM 战场。更好的策略是：

1. 采用 Relevance AI 的产品抽象：Invent、Workforce、Tool、Trigger、Eval、Governance；
2. 保持 DofeAI 的垂直焦点：software delivery；
3. 明确 Codex/Claude Code CLI 是底层执行 runtime，DofeAI 是其上的 orchestration/control plane；
4. 将现有 Loops 内核包装为 `Software Delivery Workforce`；
5. 用 Git/CI/PR/evidence/review/runtime governance 的深度能力建立差异。

## 可直接借鉴的产品机制

| Relevance AI 机制                 | DofeAI 对应改造                                                             |
| --------------------------------- | --------------------------------------------------------------------------- |
| Invent creates agents/tools/evals | Create Loop 时生成 delivery blueprint + eval plan                           |
| Workforce canvas                  | Dashboard/Detail 增加 agent team handoff graph，并标注 Codex/Claude backend |
| Triggers tab                      | Workspace/Loop 增加 trigger management                                      |
| Evals tab                         | Workspace/Blueprint 增加 eval suite                                         |
| Marketplace clone agent           | Blueprint marketplace：Bugfix、Refactor、API endpoint、UI page、Migration   |
| RBAC at org/project/asset         | Loops org/workspace/blueprint/tool/trigger 分层权限                         |
| OTEL event streaming              | agent invocation、tool call、phase transition、review verdict 输出 OTEL     |
| Agent runtime abstraction         | Runtime Backend Registry：Codex CLI、Claude Code CLI、Docker、remote runner |
