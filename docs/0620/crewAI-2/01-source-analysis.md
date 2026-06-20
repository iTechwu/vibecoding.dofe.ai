# `../crewAI` 二次源码分析

## 结构观察

`../crewAI` 是 Python monorepo，核心不再只是一个 agent framework，而是多层产品能力组合：

| 层        | 源码位置                            | 能力                                                                                  |
| --------- | ----------------------------------- | ------------------------------------------------------------------------------------- |
| Framework | `lib/crewai/src/crewai`             | Agent、Crew、Task、Flow、Memory、Knowledge、Event Bus、A2A、Checkpoint、Visualization |
| CLI       | `lib/cli/src/crewai_cli`            | create/run/train/test/chat/replay/deploy/traces/templates/auth/config                 |
| Core      | `lib/crewai-core/src/crewai_core`   | paths、settings、token、auth providers、telemetry、plus API、lock store               |
| Files     | `lib/crewai-files/src/crewai_files` | image/pdf/text/audio/video 解析、上传、缓存、provider 格式化                          |
| Tools     | `lib/crewai-tools/src/crewai_tools` | MCP、RAG、AWS、S3、Bedrock、Zapier 等工具适配                                         |
| Devtools  | `lib/devtools/src/crewai_devtools`  | 版本发布、文档 freeze、changelog、enterprise release                                  |

## 关键产品信号

1. **运行态治理是核心**：README 和 docs 明确强调 Control Plane、Tracing、Observability、RBAC、SSO、Secrets、Integrations。
2. **CLI 是产品入口**：`crewai-cli` 可独立安装，未安装 framework 时仍能执行 version/login/org/config/traces/create/template 等轻量命令。
3. **Flows 是生产架构**：源码中有 flow DSL、persistence、async feedback、conversation、visualization，说明 CrewAI 把可恢复/可解释/可视化作为生产能力。
4. **A2A 与 MCP 是生态接口**：`a2a/`、`mcp` 依赖和 tools adapters 说明 CrewAI 正在把 agent 互联和工具治理产品化。
5. **文件/多模态一等化**：`crewai-files` 独立成包，直接支持 task/crew input files。

## 对 Loops 的映射

| CrewAI 信号           | Loops 当前对应                              | 缺口                                    |
| --------------------- | ------------------------------------------- | --------------------------------------- |
| Control Plane metrics | `/loops` 页面前端聚合 doctor/cost/list/logs | 缺后端 `metrics` contract，规则不可复用 |
| Traces / Events       | `.loops/logs`、`logs` endpoint              | 缺统一 trace/event summary              |
| Checkpoint / Resume   | `.loops` 文件真源、resume、work lock        | 恢复能力未进入 dashboard API            |
| HITL                  | spec review、pause/resume/takeover/reloop   | 缺 action queue 聚合                    |
| A2A / tools           | Codex/Claude/Git adapters                   | 还没有第三方 agent/tool registry        |
| Files                 | raw payload、test records、PR body          | intake 附件和证据文件未产品化           |

## 本轮最小可实施点

新增 `GET /loops/metrics`：

- 使用现有 `list`、`doctor`、`cost` 数据聚合，不触碰 DB 读写边界。
- Contract 使用 Zod schema。
- Controller 使用 ts-rest + RBAC READ 权限。
- Web 后续切换到 metrics，减少重复前端拼装。
