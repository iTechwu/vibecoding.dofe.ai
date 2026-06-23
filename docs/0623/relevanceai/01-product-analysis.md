# 01 · Relevance AI 产品深度分析

## 产品定位

Relevance AI 自称是 AI Workforce 的平台。官方文档将其定义为低代码/无代码平台，可构建 AI agents 和 multi-agent teams，让它们像员工一样自主完成任务。官网与产品页反复强调：

- 用自然语言描述需求，Invent 自动生成 agents、tools 和 evals；
- 用拖拽式 builder 细化 agent 和 workforce；
- 用 Tools、Knowledge、Integrations 连接业务数据和系统；
- 用 Triggers 让 agent 从手动执行走向自动化运行；
- 用 Evals、Analytics、RBAC、Audit Logs、Event Streaming 支撑企业可控上线。

对 DofeAI 的分析必须从另一个前提出发：本项目不是要自研一个 Relevance AI 式的通用 agent runtime，而是把 Codex CLI 与 Claude Code CLI 作为底层执行层。DofeAI 的产品价值在于把这些 CLI agent 的能力变成可编排、可审计、可复用的软件交付流程。

## 目标用户

| 用户          | 需求                         | Relevance AI 的产品承诺                             |
| ------------- | ---------------------------- | --------------------------------------------------- |
| 运营团队      | 不写代码搭建跨系统流程       | No-code builder、模板、集成、触发器                 |
| 销售/增长团队 | SDR、BDR、线索研究、外联跟进 | Marketplace agent、CRM/email/Slack 集成             |
| 客服/支持团队 | 处理重复问题、升级复杂问题   | Knowledge、human escalation、chat/voice/phone agent |
| 企业 IT/安全  | 权限、审计、身份、可观测     | SSO、RBAC、audit logs、OTEL event streaming         |
| 技术团队      | API/MCP/SDK 连接内部系统     | API triggers、webhooks、MCP/API、tool builder       |

## 信息架构

Relevance AI 的信息架构大致分为七层：

| 层级        | 产品对象                                        | 用户心智                              |
| ----------- | ----------------------------------------------- | ------------------------------------- |
| Create      | Invent / Agent Builder                          | 描述我要的员工或流程                  |
| Orchestrate | Workforce                                       | 把多个专家组织成团队                  |
| Execute     | Tasks / Chat / Agent Modes                      | 让 agent 工作、对话、打电话或处理任务 |
| Equip       | Tools / Knowledge / Integrations                | 给 agent 工具、数据和业务系统权限     |
| Trigger     | Manual / Schedule / API / Webhook / Integration | 什么时候自动开始                      |
| Evaluate    | Evals / Checks / Analytics / A/B                | 证明 agent 是否可靠                   |
| Govern      | RBAC / SSO / Audit / Event Streaming / Quotas   | 企业可控、可审计、可扩展              |

## 核心能力拆解

### 1. Invent：从自然语言到 agent/workforce 初稿

Invent 的价值是降低冷启动成本。用户不必先理解 prompt、tool step、knowledge 或 trigger 的配置方式，只要描述目标，系统生成 agents、tools 和 evals 的初始方案。

产品意义：

- 把“创建 agent”从配置表单变成招聘/委派心智；
- 自动补全工具、角色、流程和评测，减少空白画布焦虑；
- 为后续模板市场和最佳实践复用提供入口。

对 DofeAI 的启发：

- `/loops/new` 的 simple issue 已有自然语言入口，但输出仍是 issue，不是“推荐的交付团队/流程蓝图”；
- 可以把 normaliseSimpleIssue 升级为 `Invent Delivery Loop`：生成 spec 草稿、推荐由 Codex/Claude CLI 执行的 agent team、测试策略、风险清单和验收指标。

### 2. Workforce：多 agent 可视化编排

Workforce 是 Relevance AI 区别于普通 agent builder 的关键。它把多个 agent 放到同一画布上，支持协作、交接、升级和流程控制。

产品意义：

- 把复杂工作拆给不同专业 agent；
- 用可视化边和节点表达交接关系；
- 让企业用户能解释“谁负责哪一步”。

对 DofeAI 的启发：

- DofeAI 已有 spec review agent、implementation agent、shard review agent、global review agent 的运行时定义；
- 这些 agent 本质上是 Codex/Claude Code CLI 的角色化调用与阶段化编排；
- 前端仍以 Loop/phase/shard 为主，可增加 `Software Delivery Workforce` 视图，将阶段映射为团队成员、CLI backend、权限模式与交接线。

### 3. Tools：业务动作抽象

Relevance AI 的 Tool Builder 支持无代码流程、LLM prompt、控制流、批量运行，以及 API/MCP 连接。Tool 是 agent 能力边界和业务系统连接点。

产品意义：

- 将业务流程从 prompt 中抽离，形成可复用动作；
- 让运营用户能搭建自动化，而不是依赖工程排期；
- 支持批量处理数据集，适配销售、营销、数据清洗等场景。

对 DofeAI 的启发：

- 当前 capability registry 已能展示 agent/tool owner、权限和兼容性；
- 下一步应从 registry 展示升级为 Tool Registry：每个 tool 有 schema、权限、owner、运行环境、风险等级、审计事件和测试用例；
- Tool Registry 不应替代 Codex/Claude CLI 的内置能力，而应描述 DofeAI 允许这些 CLI 在什么 workspace、以什么权限、调用哪些外部工具。

### 4. Knowledge：业务上下文与 RAG

Relevance AI 将 Knowledge 定位为 agent 使用的业务信息和上下文，支持知识源、检索、enrich with tool、snippets 等。

产品意义：

- 提升 agent 对企业专有知识的准确性；
- 减少 prompt 中硬编码背景信息；
- 支撑客服、销售、内部知识管理等场景。

对 DofeAI 的启发：

- DofeAI 的核心上下文是 repo、spec、trace、evidence、rules snapshot；
- 可以将这些包装为 `Repo Knowledge`、`Delivery Memory`、`Decision Records`，并作为 Codex/Claude CLI 每次执行前的结构化上下文输入。

### 5. Triggers：从手动任务到自动化运营

Relevance AI 支持 integration triggers、scheduled triggers、webhooks、API triggers、tools as triggers。Workforce 也可通过 manual、schedule、integration 触发。

产品意义：

- 让 agent 从“点击运行”变成“事件驱动”；
- 适配日报、跟进、CRM 变更、Slack 消息、表格更新、webhook 等真实运营入口；
- 企业可暂停、恢复和治理触发器。

对 DofeAI 的启发：

- DofeAI 已有 Trigger Portfolio 展示 sourceChannel/sourceKind/targetRepo/submitter；
- 但需要 trigger contract、签名 webhook、schedule worker、integration source、payload replay 和失败重试。

### 6. Evals：生产可靠性

Relevance AI 的 Evals 用 scenario-based evaluations 和 reusable Checks 测试 agent。定价页也将 Agent Evaluations、A/B Testing & Analytics 放入企业能力。

产品意义：

- 把 agent 从“感觉可用”推进到“可上线验证”；
- 评测可复用，适合跨团队治理；
- 与 analytics/A-B 测试结合，形成持续优化闭环。

对 DofeAI 的启发：

- DofeAI 已有 test record、review record、global review、requirements coverage；
- 但需要抽象为 Eval Suite：场景、输入、期望、检查器、回归基线、通过率、变更对比；
- Eval Suite 应评估“某个 CLI backend + blueprint + repo context”的组合，而不是只评估抽象 agent。

### 7. Enterprise Governance：企业购买理由

Relevance AI 企业能力包括 SSO、RBAC、Audit Logs、event streaming、organization/project controls、API keys、data retention、quotas 等。

产品意义：

- 企业采购不只买 agent 能力，也买风险控制；
- 组织级、项目级、资产级权限使 agent 可以规模化部署；
- OTEL event streaming 把 agent 运行数据接入企业已有可观测体系。

对 DofeAI 的启发：

- 本项目已有 SSO/RBAC/audit log 基础，也有 logs/metrics/doctor；
- 建议将其包装为 `Enterprise Control Plane`，补齐 asset-level permission、event streaming、quota/concurrency、policy center。

## 商业化观察

Relevance AI 定价页突出企业套餐：

- Unlimited Agents & Tools；
- Unlimited Users & Projects；
- Unlimited Workforces；
- 2,000+ Integrations；
- Enterprise Triggers；
- Agent Evaluations；
- A/B Testing & Analytics；
- SSO、RBAC、Audit Logs；
- Dedicated Account Manager。

这说明 Relevance AI 的付费锚点不是“调用多少次模型”，而是：

1. 部门级和企业级规模化；
2. 集成生态；
3. 自动化触发器；
4. 可靠性评测；
5. 治理和安全。

## 产品弱点与可攻击点

| 可能弱点                             | 解释                                           | DofeAI 可利用方向                                                 |
| ------------------------------------ | ---------------------------------------------- | ----------------------------------------------------------------- |
| 泛业务场景导致深度不足               | 销售、客服、运营、营销都覆盖，垂直交付深度有限 | 聚焦软件交付全链路                                                |
| No-code 复杂度上升                   | 大型流程在画布中可能难以维护和版本化           | 用 spec/evidence/PR 作为工程化边界                                |
| 企业治理偏横向                       | RBAC/audit/OTEL 强，但未必懂研发流程           | 加强 Git、CI、review、release、回滚证据                           |
| Agent 结果质量依赖 eval 设计         | Evals 仍需用户构造场景和 checks                | 提供内置软件交付 eval suite                                       |
| 不强调 self-host engineering runtime | 更像 SaaS 控制面                               | DofeAI 可强化私有化、repo-local、Docker/remote backend            |
| 底层 coding agent 不透明             | SaaS 用户较难直接控制实际代码执行环境          | DofeAI 可明确暴露 Codex/Claude CLI backend、workspace、权限和证据 |
