# 01 · CrewAI 产品分析

## 分析边界

本分析基于：

- 本地仓库：`../crewAI`
- 本地 CrewAI 文档：`../crewAI/docs/edge/en/**`
- 本地源码：`../crewAI/lib/**`
- GitHub API 与 PyPI API 当前结果
- 官方文档链接，见 [06-sources.md](./06-sources.md)

截至 2026-06-23：

| 指标                   | 当前值                  |
| ---------------------- | ----------------------- |
| GitHub repository      | `crewAIInc/crewAI`      |
| GitHub stars           | 54,184                  |
| GitHub forks           | 7,588                   |
| GitHub open issues     | 531                     |
| GitHub pushed_at       | 2026-06-23T05:31:42Z    |
| PyPI stable version    | `1.14.7`                |
| 本地 workspace package | `1.14.8a2` 相关预发布包 |
| License                | MIT                     |
| 主语言                 | Python                  |
| Python range           | `>=3.10,<3.14`          |

## 产品定位

CrewAI 的定位可以拆成两层：

| 层       | 产品             | 核心对象                                                                   | 目标用户                           | 商业作用                       |
| -------- | ---------------- | -------------------------------------------------------------------------- | ---------------------------------- | ------------------------------ |
| 开源框架 | CrewAI framework | Agent、Task、Crew、Flow、Tool、Memory、Knowledge、Guardrail                | Python 开发者、AI 应用工程师       | 获客、生态、默认技术选型       |
| 企业平台 | CrewAI AMP       | Automation、Deployment、Trace、Trigger、RBAC、ACP、Tool Repository、Studio | 企业团队、平台工程、业务自动化团队 | 生产部署、治理、协作、付费转化 |

一句话：CrewAI 先用开源框架解决“怎么构建 agent app”，再用 AMP 解决“怎么部署、监控、治理、规模化运行 agent app”。

## 核心抽象

### 1. Agent

Agent 是具备 role、goal、backstory、tools、knowledge、memory、LLM、max_iter、max_rpm、guardrail、MCP 等配置的执行单元。本地源码 `lib/crewai/src/crewai/agent/core.py` 显示 Agent 已经不是简单 prompt wrapper，而是包含知识检索、工具准备、训练数据、checkpoint、MCP、A2A、skills、token 统计和事件总线的复杂对象。

对 DofeAI 的启发：

- DofeAI 的 Codex/Claude 角色不能只叫 provider，应上升为 Delivery Agent Persona；
- 每个 persona 需要绑定目标、阶段、工具、权限、评测、fallback、预算；
- 当前 `capability registry` 可演进为 persona/tool/runtime 的组合配置。

### 2. Task

Task 是 Crew 内的工作单元，支持描述、期望输出、上下文、agent assignment、guardrail、结构化输出、条件任务等。CrewAI 的优势在于让开发者用清晰的任务模型描述 agent 协作。

对 DofeAI 的启发：

- Loops 的 Shard 可以改名为 Work Package；
- Work Package 应包含 acceptance mapping、required checks、allowed files、runtime policy、handoff input/output；
- 分片审阅不只是状态字段，而应成为 Work Package 的 guardrail。

### 3. Crew

Crew 是 agent team。它承载 agents、tasks、process、memory、cache、planning、manager_llm、usage_metrics、security_config、callbacks、training、tracing 等。CrewAI 在 README 和 docs 中持续强调 Crews 是负责“自治协作”的团队。

对 DofeAI 的启发：

- DofeAI 应把默认 Loops 流程包装为 Software Delivery Crew / Workforce；
- 用户不应先看到 PHASE_4 / PHASE_5，而应看到 Spec Writer、Planner、Builder、Reviewer、Evidence Curator；
- 每个 agent 的实际执行 backend 才显示为 Codex CLI、Claude Code CLI、Docker 或 Remote Runner。

### 4. Flow

Flow 是 CrewAI 的生产架构核心。官方文档明确建议生产应用从 Flow 开始：Flow 管理状态、事件、分支、持久化、恢复、HITL，并在某些步骤调用 Crew。

本地 `lib/crewai/src/crewai/flow/flow.py` 显示 Flow 已拆分为 DSL、definition、runtime、state，公开 `@start`、`@listen`、`@router`、`or_`、`and_` 等控制原语。

对 DofeAI 的启发：

- Loops 的状态机已经更接近 Flow，而不是 Crew；
- DofeAI 可以用 Delivery Flow 表达整体交付路径，用 Workforce 表达每个阶段的 agent team；
- Human gate、reloop、resume、fork、finalize 应成为一等 Flow primitive。

## 开源仓库结构

本地 `../crewAI` 是 uv workspace：

| Package            | 作用                                                                           |
| ------------------ | ------------------------------------------------------------------------------ |
| `lib/crewai`       | 主框架：Agent、Task、Crew、Flow、Memory、Knowledge、MCP、Tracing、A2A          |
| `lib/crewai-tools` | 工具集合：文件、搜索、RAG、web scraping、数据库、automation、browser、cloud 等 |
| `lib/cli`          | CLI：create、run、flow、deploy、triggers、auth、enterprise、TUI                |
| `lib/devtools`     | release、docs versioning、开发工具                                             |
| `lib/crewai-files` | 文件处理能力                                                                   |
| `lib/crewai-core`  | 核心共用底层                                                                   |

这说明 CrewAI 的增长策略不是只维护一个 runtime，而是把“项目脚手架、工具生态、CLI、文档版本、企业部署”都纳入主仓库协同迭代。

## 企业能力拆解

### AMP

AMP 是 Agent Management Platform，官方企业文档将其描述为部署、监控、扩展 agent workflow 的平台。能力包括：

- Crew Deployments；
- REST API access；
- Observability；
- Tool Repository；
- Webhook Streaming；
- Crew Studio；
- GitHub / ZIP / CLI deployment。

对 DofeAI 的启发：

- DofeAI 的交付物不应只有 `.loops` 文件和页面状态，还应有可调用、可复跑、可部署、可审计的 Delivery Automation；
- GitHub deployment 不是 DofeAI 的重点，但 PR / issue / CI integration 是软件交付场景必须补齐的入口。

### Agent Control Plane

CrewAI ACP 是企业运营枢纽，关注：

- automation fleet health；
- LLM tokens / cost；
- provider / model breakdown；
- organization-wide rules，如 PII redaction；
- read/manage 权限。

对 DofeAI 的启发：

- DofeAI 应建立 Engineering Agent Control Plane；
- 不是泛化展示 tokens，而是展示 delivery health、runtime health、cost per PR、human wait time、test failure rate、reloop rate；
- rules 不只做 PII redaction，还应做 repository path policy、security-sensitive file gate、DB/API boundary rules、test required rules。

### Automations

CrewAI Automations 管理 live crews，支持 GitHub / ZIP 部署、环境变量、状态、endpoint、token、redeploy、delete、auto deploy。

对 DofeAI 的启发：

- DofeAI 的 Loop Blueprint 应能被“启用”为自动化；
- Manual / webhook / schedule / GitHub issue / CI failure 都应是同一个 Trigger model；
- 每个 automation 应有 owner、visibility、runtime policy、eval suite、cost quota。

### Traces

CrewAI Traces 捕获 agent reasoning、task execution、tool usage、token、execution time、cost、timeline 和 failure point。

对 DofeAI 的启发：

- DofeAI 已有 logs、trace timeline、evidence，但应统一为 Delivery Trace；
- Trace 不只是调试 UI，还应可导出为 PR comment、release evidence、audit evidence；
- 每个 Work Package 的 prompt/input/output/command/test/review 需要结构化可索引。

### RBAC

CrewAI AMP 的 RBAC 分两层：

- feature permissions：usage dashboards、crews dashboards、tools、agents、env vars、LLM connections、settings 等；
- entity permissions：automation、env var、LLM connection、Git repository 等。

对 DofeAI 的启发：

- 当前 `RequireLoopsPermission` 需要升级为资产级权限；
- 权限对象应覆盖 workspace、repo、blueprint、runtime backend、tool、trigger、eval suite、loop；
- HITL 审批权限应独立建模，不等同于 read/manage。

## CrewAI 的产品飞轮

CrewAI 的增长飞轮大致是：

1. 文档和课程降低认知门槛；
2. CLI scaffold 降低首次运行门槛；
3. YAML/JSON/代码配置降低工程维护成本；
4. tools package 增强可用场景；
5. Flows 解决生产可控性；
6. AMP 解决部署、治理、监控；
7. Studio 和 marketplace 降低非纯代码用户门槛；
8. Skills 让 coding agents 更会写 CrewAI 项目；
9. 企业功能把开源 adoption 转化为平台使用。

## CrewAI 的短板和可攻击点

| 短板                        | 原因                                                          | DofeAI 机会                                                                  |
| --------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 泛业务自动化定位较宽        | CrewAI 需要覆盖研究、销售、运营、文档、数据等多场景           | DofeAI 聚焦软件交付，可做更深的 repo、PR、test、review、evidence             |
| Coding agent 不是核心垂直   | CrewAI 有 coding agent 文档，但不是默认心智                   | DofeAI 直接基于 Codex/Claude Code CLI，天然贴近代码库修改                    |
| 生产控制依赖 AMP            | 开源框架与企业平台之间存在部署和治理分层                      | DofeAI 可以从第一天把控制面和交付证据做进产品                                |
| Python-first                | 对 JS/TS 全栈工程团队不是天然工作流                           | DofeAI 本仓库就是 Next/Nest/Prisma/ts-rest，可用 TypeScript 工程规则做差异化 |
| 通用 trace 未必等于交付证据 | Trace 关注运行过程，软件团队还要 spec、test、review、diff、PR | DofeAI 应把 Delivery Evidence 作为核心资产                                   |

## 对 DofeAI 的核心启示

1. 借鉴 CrewAI 的 Flow-first，但不要复刻 Python Flow DSL。DofeAI 应把现有 Loops 状态机产品化为 Delivery Flow。
2. 借鉴 CrewAI 的 Crew/Agent 心智，但将 agent 定位为软件交付角色，而不是泛业务 persona。
3. 借鉴 AMP 的企业包装，把 runtime、cost、rules、traces、RBAC 统一进 Engineering Agent Control Plane。
4. 借鉴 tools repository，但 DofeAI 的工具应围绕 Git、PR、CI、test runner、browser QA、package manager、MCP、repo policy。
5. 借鉴 skills 生态。DofeAI 可以为 Codex/Claude 提供官方 Loops skills，让 agent 更懂本项目的架构规则和交付协议。
