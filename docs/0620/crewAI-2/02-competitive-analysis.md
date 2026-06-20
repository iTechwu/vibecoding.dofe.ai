# 二次竞品分析

## 竞品矩阵

| 产品                  | 当前定位                                                        | 强项                                                                | Loops 应学什么                                               |
| --------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------ |
| CrewAI + AMP          | Python agent framework + enterprise control plane               | Crews/Flows、CLI、A2A、tools/files、traces、RBAC、SSO、integrations | 从“能执行”升级到“能治理、能恢复、能审计”                     |
| LangGraph + LangSmith | Stateful long-running agent runtime + observability/eval/deploy | durable execution、persistence、HITL、streaming、trace/eval         | Loops 的 phase/round/reloop 应有稳定 metrics 和 action queue |
| Microsoft AutoGen     | AgentChat/Core/Studio，多 agent SDK + prototyping UI            | event-driven core、Studio、extensions、distributed runtime          | Loops 可提供模板化、低代码化 issue intake                    |
| n8n AI                | 可视化 workflow automation + AI cluster nodes                   | templates、integrations、chat trigger、自托管                       | Loops 的 Feishu/Git/provider 入口要做到模板和触发器化        |
| Devin 类 coding agent | 端到端软件工程执行                                              | 自动任务、PR、浏览器/终端一体                                       | Loops 应坚持透明证据链和可接管，而不是黑盒交付               |

## 二次洞察

- 控制平面不只是 UI：成熟竞品都有后端聚合、trace/event、deployment/runtime 状态，而不是前端临时拼 dashboard。
- HITL 的价值在 action queue：用户不应自己翻日志判断下一步，而应看到“需要批准/需要恢复/需要 re-loop/可以 finalize”。
- Agent 生态接口会变成竞争门槛：A2A、MCP、tool registry、file inputs 都会影响可扩展性。
- 对 coding 产品而言，PR/diff/test evidence 是独特护城河：Loops 要比通用 agent workflow 更懂代码交付证据。

## 信息来源

- 本地源码：`../crewAI/lib/crewai`、`../crewAI/lib/cli`、`../crewAI/lib/crewai-core`、`../crewAI/lib/crewai-files`、`../crewAI/lib/crewai-tools`
- CrewAI docs index: `https://docs.crewai.com/llms.txt`
- LangGraph docs: `https://docs.langchain.com/oss/python/langgraph/overview`
- AutoGen docs: `https://microsoft.github.io/autogen/stable/`
- n8n AI docs: `https://docs.n8n.io/advanced-ai/`
