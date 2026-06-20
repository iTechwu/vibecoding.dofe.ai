# `../crewAI` 项目深度分析

## 项目形态

`../crewAI` 是 Python 多包 monorepo，顶层 `pyproject.toml` 管理统一 dev 依赖和质量规则，核心包包括：

| 包                 | 主要职责                                                      | 对 Loops 的启发                                               |
| ------------------ | ------------------------------------------------------------- | ------------------------------------------------------------- |
| `lib/crewai`       | Crews、Flows、Agents、Tasks、Memory、Knowledge、Visualization | Loops 可把 Issue/Spec/Shard 映射为 agent workflow 的可视状态  |
| `lib/cli`          | 创建项目、kickoff flow、认证、模板、task outputs              | Loops CLI 已有类似能力，可强化模板和可恢复执行                |
| `lib/crewai-tools` | MCP、RAG、Zapier、AWS、S3、Bedrock 等工具适配                 | Loops 后续应把外部工具接入放到 client/adapter 层              |
| `lib/crewai-files` | 多模态文件解析、上传、缓存、provider 格式化                   | Loops intake 可扩展附件、日志、测试证据文件                   |
| `lib/crewai-core`  | project、auth、plus API、token、telemetry、settings           | Loops 需要更明确的 control plane auth、telemetry、settings 层 |
| `lib/devtools`     | 文档版本化和发布工具                                          | Loops 文档标注机制可继续系统化为 release/doctor 工具          |

## 产品能力拆解

CrewAI 的核心抽象是 Crews 与 Flows：

- Crews：强调角色化 agent 协作、任务委派、自治。
- Flows：强调生产级事件驱动、状态、条件分支、Human-in-the-loop。
- AMP：补齐企业使用时需要的部署、监控、RBAC、SSO、Secrets、Tracing、Integrations。

当前 Loops 的对应能力：

| CrewAI 能力             | Loops 当前实现                                    | 差距                                       |
| ----------------------- | ------------------------------------------------- | ------------------------------------------ |
| Crew/Agent 协作         | Codex 规划/审查 + Claude Code 实施的双 agent 分工 | Web UI 尚未把 agent 分工和每步证据展示清楚 |
| Flow 状态机             | Phase 0-8、round、reloop、finalize                | 缺少阶段漏斗、SLA/阻塞/下一步动作聚合      |
| Checkpointing / Resume  | `.loops` 文件真源、DB index、resume endpoint      | 恢复结果在 UI 上弱，用户难判断哪些恢复成功 |
| Tracing / Observability | logs、notifications、cost、doctor endpoint        | 首页信息存在，但未形成 control plane 视图  |
| HITL                    | spec review、pause/resume/takeover、reloop        | 审核入口分散，待人工处理项不突出           |
| RBAC / SSO              | 已有 AuthGuard 与 Loops RBAC                      | 真实浏览器 SSO E2E 仍 blocked              |
| Integrations            | planned: Feishu、remote PR、worker                | 缺外部凭据与产品决策，当前 blocked         |

## 当前项目可直接承接的优化点

1. 用现有 `list/cost/doctor/logs/notifications` 数据重构 `/loops` 首页，使其成为控制平面。
2. 在详情页突出 Spec、Shard、Test、Review、Annotation 证据链，降低“黑盒 agent”感。
3. 把文档标注与回归命令纳入每次产品迭代，形成“产品建议 → 实施 → 标注 → 回归”的闭环。
4. 后续再抽后端 metrics API，避免前端重复聚合并支撑 dashboard 性能。
