# 06 · 资料来源与分析边界

## 本地来源

| 来源                                                                          | 用途                                                |
| ----------------------------------------------------------------------------- | --------------------------------------------------- |
| `../crewAI/README.md`                                                         | CrewAI 定位、Crews/Flows、AMP Suite、社区与安装说明 |
| `../crewAI/AGENTS.md`                                                         | CrewAI 文档版本模型与贡献规则                       |
| `../crewAI/pyproject.toml`                                                    | workspace、工具链、质量门禁、依赖约束               |
| `../crewAI/lib/crewai/pyproject.toml`                                         | 主框架依赖、版本、Python 支持范围                   |
| `../crewAI/lib/crewai-tools/pyproject.toml`                                   | tool ecosystem 与 optional integrations             |
| `../crewAI/lib/cli/pyproject.toml`                                            | CLI 能力与依赖                                      |
| `../crewAI/lib/crewai/src/crewai/crew.py`                                     | Crew 对象字段和能力                                 |
| `../crewAI/lib/crewai/src/crewai/agent/core.py`                               | Agent 对象字段和能力                                |
| `../crewAI/lib/crewai/src/crewai/flow/flow.py`                                | Flow 对外导出与 DSL                                 |
| `../crewAI/docs/edge/en/introduction.mdx`                                     | CrewAI 官方介绍、Crews/Flows 架构                   |
| `../crewAI/docs/edge/en/concepts/production-architecture.mdx`                 | Flow-first 生产架构建议                             |
| `../crewAI/docs/edge/en/enterprise/introduction.mdx`                          | CrewAI AMP 能力                                     |
| `../crewAI/docs/edge/en/enterprise/features/agent-control-plane/overview.mdx` | Agent Control Plane                                 |
| `../crewAI/docs/edge/en/enterprise/features/rbac.mdx`                         | RBAC 与实体权限                                     |
| `../crewAI/docs/edge/en/enterprise/features/automations.mdx`                  | Automations、部署和管理                             |
| `../crewAI/docs/edge/en/enterprise/features/traces.mdx`                       | Traces、token、cost、timeline、debug                |
| `docs/0619/loops设计/**`                                                      | DofeAI Loops 产品设计                               |
| `docs/0623/relevanceai/**`                                                    | 既有 Relevance AI 对比分析                          |
| `apps/api/src/modules/loops/**`                                               | DofeAI Loops 后端实现                               |
| `packages/contracts/src/api/loops.contract.ts`                                | DofeAI Loops contract                               |
| `packages/contracts/src/schemas/loops.schema.ts`                              | DofeAI Loops schema                                 |

## 在线来源

| 来源                     | 链接                                                     | 用途                                       |
| ------------------------ | -------------------------------------------------------- | ------------------------------------------ |
| CrewAI 官网              | https://crewai.com/                                      | 产品定位                                   |
| CrewAI Docs              | https://docs.crewai.com/                                 | 官方文档入口                               |
| CrewAI GitHub            | https://github.com/crewAIInc/crewAI                      | star、fork、license、代码活动              |
| CrewAI PyPI              | https://pypi.org/project/crewai/                         | 稳定版本、Python 范围、包描述              |
| LangGraph Docs           | https://docs.langchain.com/oss/python/langgraph/overview | LangGraph 定位参照                         |
| LangGraph GitHub         | https://github.com/langchain-ai/langgraph                | 社区与活跃度参照                           |
| Microsoft AutoGen Docs   | https://microsoft.github.io/autogen/stable/              | AutoGen 定位参照                           |
| Microsoft AutoGen GitHub | https://github.com/microsoft/autogen                     | 社区与活跃度参照                           |
| OpenAI Agents SDK Docs   | https://openai.github.io/openai-agents-python/           | Agents、handoffs、guardrails、tracing 参照 |
| OpenAI Agents SDK GitHub | https://github.com/openai/openai-agents-python           | 社区与活跃度参照                           |
| LlamaIndex Docs          | https://docs.llamaindex.ai/                              | LlamaIndex Workflows/RAG 参照              |
| LlamaIndex GitHub        | https://github.com/run-llama/llama_index                 | 社区与活跃度参照                           |

## GitHub / PyPI 快照

检索日期：2026-06-23。

| 项目                          |  Stars | Forks | Open issues | License   | pushed_at            |
| ----------------------------- | -----: | ----: | ----------: | --------- | -------------------- |
| `crewAIInc/crewAI`            | 54,184 | 7,588 |         531 | MIT       | 2026-06-23T05:31:42Z |
| `langchain-ai/langgraph`      | 35,479 | 5,954 |         591 | MIT       | 2026-06-22T21:16:47Z |
| `microsoft/autogen`           | 59,170 | 8,921 |         914 | CC-BY-4.0 | 2026-04-15T11:59:09Z |
| `openai/openai-agents-python` | 27,354 | 4,218 |          74 | MIT       | 2026-06-23T05:59:53Z |
| `run-llama/llama_index`       | 50,303 | 7,607 |         520 | MIT       | 2026-06-20T00:09:30Z |

PyPI `crewai`：

| 字段            | 值                                                                          |
| --------------- | --------------------------------------------------------------------------- |
| Version         | `1.14.7`                                                                    |
| Requires Python | `>=3.10,<3.14`                                                              |
| Summary         | Cutting-edge framework for orchestrating role-playing, autonomous AI agents |

## 可信度说明

- 本地 `../crewAI/docs/edge` 是 rolling edge 文档，可能包含尚未正式发布的能力。
- PyPI `1.14.7` 是稳定发行视角，本地 `1.14.8a2` 是预发布/开发视角。
- GitHub stars/forks/issues 是 2026-06-23 的 API 快照，会随时间变化。
- 对竞品的判断以官方文档和公开仓库为主，未使用非公开商业信息。
- 对 DofeAI 的判断基于当前本地仓库实现和既有文档，不代表已发布产品状态。

## 分析假设

1. DofeAI 会继续以 Codex CLI / Claude Code CLI 作为重要底层执行 runtime。
2. DofeAI 的核心目标用户是软件团队，而不是泛业务运营团队。
3. 本项目会坚持现有 monorepo 架构：Next.js、NestJS、Prisma、ts-rest、Zod-first。
4. Loops 的 `.loops` evidence 和 DB 索引会继续共存。
5. 后续产品化需要兼顾本地开发、Docker runner 和远程执行池。
