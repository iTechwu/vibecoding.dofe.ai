# 竞品分析

## 竞品选型

| 产品                             | 定位                                    | 关键能力                                                                                   | 对 Loops 的启发                                                            |
| -------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| CrewAI                           | Python 多 agent 框架 + AMP 企业控制平面 | Crews、Flows、CLI、Tools、Files、Tracing、RBAC、SSO、HITL、Integrations                    | Loops 应从“编码队列”升级为“agent coding control plane”                     |
| LangGraph / LangSmith            | 长运行、有状态 agent 编排与观测平台     | durable execution、persistence、streaming、human-in-the-loop、LangSmith tracing/eval       | Loops 的 Phase/round/reloop 要更可视化，并把状态恢复和人工介入做成一等入口 |
| Microsoft AutoGen                | 研究与应用兼顾的多 agent SDK + Studio   | AgentChat、Core event runtime、Studio no-code prototyping、extensions、distributed runtime | Loops 需要低代码/模板化 Issue intake，降低从需求到 Shard 的设计成本        |
| n8n AI                           | 可视化工作流自动化 + AI 节点            | root/sub node、workflow templates、chat trigger、integrations、自托管                      | Loops 后续可引入可视化触发器/模板和 Feishu/Git provider 集成               |
| Devin/Cognition 类自主编码 agent | 端到端软件工程 agent                    | 任务执行、浏览器/终端、PR、持续推进                                                        | Loops 的差异点应是透明、可审查、文档即真相，而非黑盒“一键完成”             |

## CrewAI 细分优势

- 框架抽象清晰：Agent / Task / Crew / Flow 分层明确。
- 企业控制面完整：Automations、Traces、RBAC、SSO、Secrets、Integrations。
- 文档与学习生态强：docs、examples、cookbooks、skills、CLI 模板。
- Python 开发生态友好：适合数据、自动化、企业脚本和 AI workflow。

## Loops 的差异化机会

1. **专注软件工程闭环**：CrewAI 是通用 agent workflow，Loops 可以把代码改动、测试证据、PR、文档标注做得更深。
2. **双 agent 交叉审查**：规划/审查与实施分离是质量卖点，应在 UI 上显性表达。
3. **文档即真相**：`.loops` 可读文档、不可变日志、DB index 三层结合，比纯 UI trace 更适合审计。
4. **面向团队的可接管性**：pause/resume/takeover/reloop 应成为控制台核心，而不只是隐藏操作。

## 当前短板

- 首页像 issue list，不像控制平面。
- 风险、阻塞、成本、人工待办没有聚合优先级。
- 流程阶段缺少一眼可扫的漏斗。
- 证据链散落在详情页，缺少“为什么可以信任本次 agent 产出”的设计。
- 集成能力仍 blocked，短期应诚实标注，不把未完成能力包装成已支持。

## 信息来源

- `../crewAI/README.md`
- `../crewAI/pyproject.toml`
- `../crewAI/lib/*`
- CrewAI docs `https://docs.crewai.com/llms.txt`
- LangGraph docs `https://docs.langchain.com/oss/python/langgraph/overview`
- AutoGen docs `https://microsoft.github.io/autogen/stable/`
- n8n AI docs `https://docs.n8n.io/advanced-ai/`
