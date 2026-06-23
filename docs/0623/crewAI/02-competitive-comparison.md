# 02 · 深度竞品对比

## 竞品分层

| 类别              | 代表产品                                                                      | 与 DofeAI 的关系               |
| ----------------- | ----------------------------------------------------------------------------- | ------------------------------ |
| 通用多 agent 框架 | CrewAI、LangGraph、Microsoft AutoGen、OpenAI Agents SDK、LlamaIndex Workflows | 抽象和工程架构参照             |
| 企业 agent 平台   | CrewAI AMP、Relevance AI                                                      | 控制面、治理、部署、可观测参照 |
| 软件工程 agent    | Open SWE、OpenHands、SWE-agent、Aider、Cline、Roo Code、Goose、OpenCode       | 直接场景竞品或运行时参照       |
| DofeAI 当前形态   | Loops + Codex CLI + Claude Code CLI                                           | 软件交付垂直控制面             |

## 核心对比矩阵

评分：1 = 弱/缺失，3 = 可用，5 = 成熟强项。

| 维度           | CrewAI | LangGraph | AutoGen | OpenAI Agents SDK | LlamaIndex Workflows | Relevance AI | DofeAI Loops 当前 | DofeAI 机会                             |
| -------------- | -----: | --------: | ------: | ----------------: | -------------------: | -----------: | ----------------: | --------------------------------------- |
| 多 agent 建模  |      5 |         4 |       5 |                 3 |                    3 |            4 |                 3 | 用 Delivery Workforce 做垂直 agent team |
| 状态/流程控制  |      5 |         5 |       3 |                 3 |                    4 |            4 |                 4 | 将 Loops 状态机产品化                   |
| 生产部署       |      4 |         4 |       2 |                 2 |                    2 |            5 |                 2 | Runner/worker/trigger/PR pipeline       |
| 企业治理       |      4 |         3 |       2 |                 2 |                    2 |            5 |                 3 | RBAC + runtime policy + audit + rules   |
| 可观测/Trace   |      5 |         4 |       3 |                 4 |                    2 |            4 |                 3 | Delivery Trace + Evidence               |
| Tool ecosystem |      5 |         4 |       3 |                 3 |                    5 |            5 |                 2 | Tool & Integration Registry             |
| Eval/Guardrail |      4 |         3 |       3 |                 4 |                    3 |            4 |                 2 | Eval Suite v1                           |
| 软件交付深度   |      2 |         3 |       2 |                 2 |                    2 |            1 |                 4 | DofeAI 主战场                           |
| Issue-to-PR    |      1 |         2 |       1 |                 1 |                    1 |            1 |                 3 | GitHub/CI/PR evidence 补齐              |
| 文档即证据     |      2 |         2 |       1 |                 2 |                    2 |            2 |                 4 | 做成可导出的交付证据链                  |
| 开发者生态     |      5 |         5 |       5 |                 4 |                    5 |            3 |                 2 | Loops blueprints + skills               |
| 非技术用户入口 |      3 |         2 |       1 |                 1 |                    1 |            5 |                 2 | Invent Delivery Loop                    |

## CrewAI vs DofeAI

| 维度     | CrewAI                              | DofeAI 当前                                               | 判断                                        |
| -------- | ----------------------------------- | --------------------------------------------------------- | ------------------------------------------- |
| 默认心智 | 构建和部署多 agent 自动化           | 用 Codex/Claude 推进软件交付 Loop                         | 不同赛道，DofeAI 应垂直化                   |
| 核心抽象 | Agent、Task、Crew、Flow             | Issue、Spec、Shard、Phase、Review、Evidence               | DofeAI 抽象更贴近研发，但需产品化命名       |
| 生产建议 | Flow-first，Crews 作为工作单元      | Loop 状态机驱动阶段流转                                   | 方向一致，DofeAI 可借鉴 Flow-first 表达     |
| 企业平台 | AMP、ACP、Automations、RBAC、Traces | Dashboard、runtime diagnostics、cost guard、doctor、audit | CrewAI 包装成熟，DofeAI 底座有但分散        |
| 部署     | GitHub/ZIP/CLI 到 AMP               | 本地/Docker CLI runtime 为主                              | DofeAI 应优先 remote runner 和 queue worker |
| 可观测   | Agent/task/tool/token/cost traces   | Logs、metrics、evidence、doctor                           | DofeAI 应强调 delivery evidence             |
| 工具生态 | crewai-tools，MCP，平台 apps        | capability registry 雏形                                  | 需要工具注册、授权、测试、审计              |
| 商业壁垒 | 开源 adoption + AMP 治理            | 软件交付闭环 + 证据链 + coding runtime治理                | DofeAI 不宜横向追赶，应纵深                 |

## LangGraph vs DofeAI

LangGraph 的优势在 durable execution、state graph、人机协作、复杂 agent workflow。它适合开发者构建高度定制的 agent graph。

| 维度     | LangGraph                    | DofeAI 机会                                         |
| -------- | ---------------------------- | --------------------------------------------------- |
| 编排粒度 | Graph/node/edge/state        | Delivery stages/work packages/handoffs              |
| 目标用户 | 开发者、平台团队             | 研发团队、工程负责人、AI coding ops                 |
| 交付物   | Agent workflow app           | PR、test evidence、review evidence、delivery report |
| 风险     | 开发者需要自己设计产品和治理 | DofeAI 提供开箱即用软件交付流程                     |

判断：LangGraph 是强底层 framework，DofeAI 不应与其比“图能力”，应比软件交付的默认流程和证据闭环。

## AutoGen vs DofeAI

AutoGen 强在多 agent research 原型、agent chat、Magentic-One 等通用多 agent 协作叙事，社区认知强。

| 维度          | AutoGen                    | DofeAI 机会                                            |
| ------------- | -------------------------- | ------------------------------------------------------ |
| 多 agent 协作 | 强，学术/研究/开发者生态深 | 不做通用 chat，做 delivery roles                       |
| 生产治理      | 相对不是主叙事             | DofeAI 可用 SSO/RBAC/audit/runtime policy 形成企业优势 |
| 软件工程      | 可做，但不是默认产品       | DofeAI 聚焦 coding agents 与 repo workflow             |

判断：AutoGen 是多 agent 技术品牌，DofeAI 应避开“谁更会多 agent 聊天”，强调谁更能把软件需求交付到 PR。

## OpenAI Agents SDK vs DofeAI

OpenAI Agents SDK 提供 Agents、Handoffs、Guardrails、Tracing、Tools 等 primitives。它更像轻量、官方、可嵌入的 agent runtime SDK。

| 维度           | OpenAI Agents SDK              | DofeAI 机会                            |
| -------------- | ------------------------------ | -------------------------------------- |
| 底层模型与工具 | 官方模型/工具/trace primitives | DofeAI 可在上层编排 Codex/Claude CLI   |
| 抽象           | Agent、handoff、guardrail      | Workforce、work package、gate、eval    |
| 产品完整度     | SDK，不是完整业务平台          | DofeAI 提供 UI、状态机、审计、证据、PR |

判断：OpenAI Agents SDK 是可用底座之一，但不会替代 DofeAI 的软件交付控制面。

## LlamaIndex Workflows vs DofeAI

LlamaIndex 的主优势是数据/RAG/索引生态，Workflows 适合事件驱动 RAG agent 应用。

| 维度     | LlamaIndex    | DofeAI 机会                                 |
| -------- | ------------- | ------------------------------------------- |
| 数据连接 | 强            | DofeAI 只需 repo/document/code context 深度 |
| workflow | 适合 RAG app  | DofeAI 适合 issue-to-PR                     |
| 企业采购 | 数据/知识应用 | 工程交付治理                                |

判断：LlamaIndex 是知识与数据 app 框架，DofeAI 可借鉴事件与数据连接，但不应追求全数据生态。

## Relevance AI vs DofeAI

Relevance AI 是更直接的 AI Workforce SaaS 参照：团队、工具、知识、触发器、评测、治理、业务模板。

| 维度     | Relevance AI                  | DofeAI 机会                                     |
| -------- | ----------------------------- | ----------------------------------------------- |
| 用户心智 | AI Workforce for business ops | AI Workforce for software delivery              |
| 创建体验 | Invent agents/tools/evals     | Invent Delivery Loop                            |
| 模板     | 销售、运营、客服、研究        | Bugfix、API、UI、Refactor、Security、Dependency |
| 触发器   | 业务系统事件                  | GitHub/CI/Linear/Jira/Slack/webhook/schedule    |
| 证据     | 业务运行结果                  | Spec/test/review/diff/PR/evidence               |

判断：Relevance AI 的产品包装值得学习，但 DofeAI 的定位要更窄、更硬、更工程化。

## 直接软件工程竞品的影响

Open SWE、OpenHands、SWE-agent、Aider、Cline、Roo Code、Goose、OpenCode 等工具验证了市场对 coding agent 的需求，但大多落在以下某个点：

- IDE 内人机协作；
- CLI 代码修改；
- issue-to-PR；
- sandbox execution；
- benchmark / SWE-bench；
- local autonomous coding。

DofeAI 的差异化应是把这些 execution capability 组织成团队级交付系统：

- 统一 issue intake；
- spec gate；
- work package decomposition；
- runtime backend policy；
- queue worker；
- test/eval gate；
- cross-agent review；
- PR evidence；
- audit and governance。

## 结论

CrewAI 给 DofeAI 的最大启发是“不要只做一个 agent loop，要做一个可生产运营的 agent control plane”。但 DofeAI 的产品边界必须比 CrewAI 更聚焦：不做通用 Python agent framework，不做横向业务 automation，不做聊天式多 agent demo，而是做软件交付垂直场景的 AI Workforce。
