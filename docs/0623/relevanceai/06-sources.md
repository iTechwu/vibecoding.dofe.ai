# 06 · 资料来源与分析边界

检索日期：2026-06-23  
说明：Relevance AI 信息以公开官网、官方文档、官方 changelog 和官方 GitHub 为主；第三方资料只用于辅助理解市场表述，不作为核心事实依据。

## 官方资料

| 来源                           | 链接                                                                                            | 本文使用的信息                                                                                       |
| ------------------------------ | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Relevance AI 官网              | https://relevanceai.com/                                                                        | AI Workforce、Invent、agents/tools/evals、企业平台定位                                               |
| Agents 产品页                  | https://relevanceai.com/agents                                                                  | Invent 可由自然语言生成 agents、tools、evals；Workforce builder；no-code builder                     |
| Tools 产品页                   | https://relevanceai.com/tool                                                                    | No-code tool builder、bulk run、API & MCP                                                            |
| Multi Agents 产品页            | https://relevanceai.com/multi-agents                                                            | Multi-agent system、collaborative work、specialist agents、escalation                                |
| 官方文档 Introduction          | https://relevanceai.com/docs/get-started/introduction                                           | Relevance AI 是低/无代码 AI agents 与 multi-agent teams 平台                                         |
| Agents core concepts           | https://relevanceai.com/docs/get-started/core-concepts/agents                                   | Agent、Knowledge、Multi Agent System、AI Workforce 的解释                                            |
| Evals 文档                     | https://relevanceai.com/docs/build/agents/build-your-agent/evals                                | scenario-based evaluations、reusable Checks、Enterprise rollout                                      |
| Triggers 文档                  | https://relevanceai.com/docs/build/agents/build-your-agent/triggers                             | integration、scheduled、webhook、SDK、API、Tools trigger 类型                                        |
| Scheduled Triggers             | https://relevanceai.com/docs/build/agents/build-your-agent/agent-triggers/scheduled-triggers    | recurring schedule、future messages、自动报告/跟进/提醒                                              |
| API Triggers                   | https://relevanceai.com/docs/build/agents/build-your-agent/agent-triggers/api-trigger           | 通过 HTTP request 触发 agent                                                                         |
| Webhook Triggers               | https://relevanceai.com/docs/build/agents/build-your-agent/agent-triggers/custom-webhook        | 外部系统通过 webhook payload 触发 agent                                                              |
| Integration Triggers           | https://relevanceai.com/docs/build/agents/build-your-agent/agent-triggers/integrations          | 1,000+ integrations trigger                                                                          |
| Workforce Add Triggers         | https://relevanceai.com/docs/build/workforces/build-an-ai-workforce/add-triggers                | Workforce trigger 是 workflow 入口，支持 recurring schedule                                          |
| Trigger to Agent Configuration | https://relevanceai.com/docs/build/workforces/workforce-features/trigger-to-agent-configuration | manual、recurring schedule、integration triggers                                                     |
| Integrations Introduction      | https://relevanceai.com/docs/integrations/introduction                                          | Native integrations 与 Pipedream integrations，覆盖 2,000+ services                                  |
| RBAC 文档                      | https://relevanceai.com/docs/enterprise/rbac                                                    | Enterprise RBAC、组织/项目/资产权限、audit logs                                                      |
| Enterprise Quick Start         | https://relevanceai.com/docs/enterprise/quick-start-guide                                       | SSO、Directory Sync、RBAC、S3 event streaming 等企业设置                                             |
| OTEL Event Streaming           | https://relevanceai.com/docs/enterprise/streaming-events                                        | 用 OpenTelemetry 格式流式输出 audit logs 和 execution traces                                         |
| Pricing                        | https://relevanceai.com/pricing                                                                 | Enterprise Triggers、Agent Evaluations、A/B Testing & Analytics、SSO/RBAC/Audit、2,000+ integrations |
| Changelog                      | https://relevanceai.com/docs/changelog                                                          | Pause triggers、organization concurrency analytics 等近期能力方向                                    |
| GitHub SDK                     | https://github.com/RelevanceAI/relevanceai                                                      | Relevance AI SDK、agents/tools/knowledge                                                             |

## 本项目资料

| 来源                                                               | 本文使用的信息                                                                                                        |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE.md`                                                        | 项目定位、架构规则、Zod-first、DB Service、Client layer、Winston logger                                               |
| `apps/web/app/loops/page.tsx`                                      | Dashboard 已接入 metrics、capabilities、agent runtime、logs、notifications、workspace、resume                         |
| `apps/web/app/loops/loops-dashboard-model.ts`                      | Review Inbox、Loop Board、Exception Center、Permission Profile、Provider Profile、Trigger Portfolio、Repo Context Map |
| `apps/api/src/modules/loops/loops.service.ts`                      | Loops phase、agent definitions、createSimpleIssue、cost guard、metrics、agentRuntime、capabilities、resume            |
| `apps/api/src/modules/loops/adapters/*`                            | Codex/Claude/agent/git adapter 边界，说明底层执行通过 CLI adapter 承接                                                |
| `apps/api/src/modules/loops/agent-runtime-detection.service.ts`    | Codex/Claude CLI runtime detection                                                                                    |
| `apps/api/src/modules/loops/loops-runtime-command-builder.util.ts` | local/Docker runtime command construction                                                                             |
| `apps/api/src/modules/loops/loops.controller.ts`                   | ts-rest endpoints、RBAC、audit log                                                                                    |
| `packages/contracts/src/api/loops.contract.ts`                     | Loops API surface                                                                                                     |
| `packages/contracts/src/schemas/loops.schema.ts`                   | Loops schema and response contracts                                                                                   |
| `docs/0623/goose/README.md`                                        | Agent runtime、MCP/ACP、provider profile 借鉴                                                                         |
| `docs/0623/opencode/README.md`                                     | Agent mode、permission model 借鉴                                                                                     |
| `docs/0623/openhands/README.md`                                    | Agent control plane、backend abstraction、automation triggers 借鉴                                                    |
| `docs/0623/uiux/*`                                                 | 当前 Loops UIUX 状态与已实施能力                                                                                      |

## 分析边界

1. 未登录 Relevance AI 产品后台，因此对具体 UI、交互细节、内部数据结构不做确定性断言。
2. 定价、集成数量、rollout 状态可能随时间变化。本文以 2026-06-23 公开页面为准。
3. Relevance AI 的 Evals/RBAC 等部分能力在文档中标注为 Enterprise 或渐进 rollout，本文将其视为“官方公开产品方向”，不等同于所有账号可用。
4. DofeAI 的能力判断基于当前仓库代码和文档，不代表生产环境配置一定启用。本文修正版明确假设：本项目以 Codex CLI 和 Claude Code CLI 作为底层执行运行时，上层产品价值是编排、治理、审计和证据链。
5. 本文建议偏产品与架构路线，不包含具体数据库迁移和 UI 设计稿。

## 可信度分级

| 级别 | 含义                         | 示例                                                                                                                  |
| ---- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| A    | 官方页面或本项目代码直接确认 | Relevance AI supports triggers；DofeAI has Loops metrics endpoint；DofeAI has Codex/Claude runtime detection/adapters |
| B    | 官方资料合理推断             | Relevance AI 的购买锚点包括企业治理和集成生态                                                                         |
| C    | 产品策略建议                 | DofeAI 应定位 Software Delivery Workforce                                                                             |

## 后续验证建议

- 申请 Relevance AI trial 或 demo，实测 Invent 到 Workforce 的创建链路；
- 对比 Relevance AI Evals 的具体 check 配置能力；
- 观察 Relevance AI trigger pause/replay/failure handling 的真实体验；
- 访谈 3-5 个目标用户，验证 Software Delivery Workforce 定位是否比泛 agent 平台更有购买意愿；
- 用一个真实 repo 跑 DofeAI Bugfix Loop，验证 proposed eval suite 的口径是否足够。
