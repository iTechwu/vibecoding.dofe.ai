# gstack 竞品矩阵

## 分层定位

| 项目             | 核心定位                                            | 与 DofeAI 关系                                   |
| ---------------- | --------------------------------------------------- | ------------------------------------------------ |
| gstack           | AI engineering workflow layer + browser QA + memory | 流程和操作系统式体验的强参照                     |
| OpenHands        | Self-hosted agent control center / Agent Canvas     | backend abstraction、automation server 的强参照  |
| Cline / Roo Code | IDE 内 Plan/Act、多模式 coding agent                | 单用户 IDE 体验参照                              |
| Cline Kanban     | 多 agent worktree 任务板                            | Loops Board / worktree 并行参照                  |
| Aider            | 终端 pair programming + repo map + git discipline   | CLI feedback loop 参照                           |
| Goose            | 本机通用 agent runtime + MCP/ACP/provider           | extension/provider/runtime 参照                  |
| SWE-agent        | Benchmark / issue repair agent                      | 可评测性、配置化 loop 参照                       |
| DofeAI           | 团队级 Loops Control Plane                          | 应吸收 workflow + governance，而非复制单点 agent |

## 功能矩阵

| 能力            | gstack                           | DofeAI 当前                 | OpenHands        | Cline/Kanban   | Aider          | Goose | SWE-agent |
| --------------- | -------------------------------- | --------------------------- | ---------------- | -------------- | -------------- | ----- | --------- |
| 团队控制面      | 中：靠 Conductor/team mode       | 强：Loops dashboard         | 强：Agent Canvas | 中：Kanban/IDE | 弱             | 中    | 弱        |
| 结构化 workflow | 强：skills pipeline              | 中：phase/evidence          | 中               | 中             | 弱             | 中    | 中：YAML  |
| 计划审阅        | 强：CEO/design/eng/DX            | 中：Spec review v1          | 中               | 中             | 弱             | 弱    | 弱        |
| 多 Agent 并行   | 中：依赖外部 workspace           | 中：Loop Board，worker 后续 | 强               | 强             | 弱             | 中    | 弱        |
| 浏览器 QA       | 强：persistent daemon            | 弱                          | 中               | 中             | 弱             | 中    | 弱        |
| 安全门禁        | 强：CSO、guard、prompt injection | 中：permission/rules 可见   | 中               | 中             | 弱             | 中    | 弱        |
| 记忆/学习       | 强：learn/GBrain/timeline        | 中：trace/evidence          | 中               | 弱             | 弱             | 中    | 弱        |
| 发布链路        | 强：ship/deploy/canary           | 中：evidence 基础           | 中               | 中             | 中：git commit | 弱    | 弱        |
| benchmark       | 中：model/evals                  | 弱：待 Loop Bench           | 中               | 弱             | 弱             | 弱    | 强        |
| 多 host         | 强：10 host configs              | 中：provider profile v1     | 强：ACP/agents   | 弱-中          | 弱             | 强    | 弱        |

## 关键差异分析

### gstack vs DofeAI

gstack 侧重个人/小团队的“流程即工具”。它把专家角色封装成技能，并让用户通过命令串联 sprint。

DofeAI 侧重团队级“任务与证据控制面”。它更适合沉淀状态、权限、队列、审计和可视化，但目前 workflow 本身还不如 gstack 明确。

建议：DofeAI 不要把 `/office-hours`、`/review` 等做成纯 prompt 复刻，而要做成 `WorkflowRecipe`、`ReviewGate`、`EvidenceArtifact`、`RuntimePolicy` 等结构化对象。

### gstack vs OpenHands

OpenHands 更像 agent platform：backend、agent server、automation server、integrations。

gstack 更像 workflow pack：它不拥有完整 backend control plane，但极强地占据了“如何让 agent 像团队一样工作”的流程心智。

对 DofeAI 来说，两者要合并吸收：

- 从 OpenHands 学 backend abstraction 和 automation trigger；
- 从 gstack 学 workflow recipe、browser QA、role gates 和 memory。

### gstack vs Cline / Roo Code

Cline/Roo Code 在 IDE 内交互体验更直接，Plan/Act/mode 更贴近日常开发。

gstack 的优势是跨出 IDE：它有 browser daemon、release/canary、security、docs、memory、team install，更像工程流程套件。

DofeAI 的机会是把这些能力从“用户手动调用命令”变成“Loop 生命周期中的默认步骤”。

### gstack vs Aider

Aider 的核心是代码编辑反馈 loop、repo map、git discipline。gstack 的 `/ship`、checkpoint、review 也强调 git，但它的范围更广。

DofeAI 可借鉴 Aider 的 repo map 和 gstack 的 release gate，形成仓库上下文 + 发布证据闭环。

### gstack vs Goose

Goose 是 runtime/provider/MCP 方向更强；gstack 是流程、浏览器、安全、记忆更强。

DofeAI 当前已有 Provider Profile v1，后续需要把 provider/runtime 能力与 workflow recipe 结合：不同 workflow step 可选择不同 agent/provider/runtime。

### gstack vs SWE-agent

SWE-agent 是研究/benchmark 型 agent，强调任务可评测；gstack 更偏实际交付流程。

DofeAI 应把两者结合：gstack 式流程体验 + SWE-agent 式 Loop Bench。否则 dashboard 指标只能描述执行数量，不能证明质量提升。

## DofeAI 可形成的差异化

| 差异化方向        | 为什么 gstack 难覆盖                      | DofeAI 应怎么做                                     |
| ----------------- | ----------------------------------------- | --------------------------------------------------- |
| 团队治理          | gstack 本地/个人优先，缺 central policy   | 组织级 workflow pack、审批、审计、权限              |
| 结构化状态机      | gstack skills 仍是 prompt 执行            | 后端 Loop state machine 强约束 phase/gate           |
| Evidence 数据资产 | gstack 多 JSONL/local file                | 入库、可查询、可 dashboard 聚合                     |
| 多 workspace 队列 | gstack 依赖 Conductor                     | 原生 worker queue、capacity、retry、cost cap        |
| 集成入口          | gstack 更偏手动 slash command             | GitHub/Slack/Linear/webhook/schedule trigger        |
| 企业安全          | gstack 有强本地安全设计，但非企业策略中心 | RBAC、policy as data、audit export、secret boundary |

## 结论

gstack 是 DofeAI 在“流程产品化”上的最强对照。OpenHands 告诉我们控制面怎么做，SWE-agent 告诉我们如何评测，gstack 告诉我们 AI 工程团队应有哪些角色、门禁、记忆和浏览器眼睛。DofeAI 的竞争优势应建立在团队化和结构化上，而不是更长的提示词或更多 slash commands。
