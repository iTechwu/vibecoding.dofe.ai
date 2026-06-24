# gstack 竞品矩阵

## 1. 分层定位

| 项目             | 核心定位                                               | 与 DofeAI 的关系                                    |
| ---------------- | ------------------------------------------------------ | --------------------------------------------------- |
| gstack           | AI engineering workflow layer + browser QA + memory    | 流程密度和虚拟工程团队心智的最强参照                |
| DofeAI Loops     | 团队级 AI delivery control plane                       | 应吸收 workflow + governance，而非复制 command pack |
| Cline / Roo Code | IDE 内 coding agent，强调 Plan/Act、人机审批和文件编辑 | 单用户 IDE 体验参照                                 |
| OpenHands        | 软件工程 agent platform/runtime                        | sandbox、任务环境、agent runtime 参照               |
| Aider            | Git-native CLI pair programmer                         | repo map、diff、commit discipline 参照              |
| Goose            | 本地通用 AI agent，强调扩展、MCP、provider             | runtime/plugin 生态参照                             |
| SWE-agent        | benchmark/issue repair agent                           | 可评测性和任务成功率参照                            |

## 2. 功能矩阵

| 能力             | gstack                        | DofeAI Loops 当前                                   | Cline/Roo         | OpenHands             | Aider        | Goose  | SWE-agent          |
| ---------------- | ----------------------------- | --------------------------------------------------- | ----------------- | --------------------- | ------------ | ------ | ------------------ |
| 团队控制面       | 中：team mode/repo routing    | 强：dashboard/API/gate/audit                        | 弱-中：IDE 内     | 中-强：平台化 runtime | 弱           | 中     | 弱                 |
| Workflow 编排    | 强：skills pipeline           | 强：Recipe/Gate/Release contract                    | 中：Plan/Act      | 中                    | 弱           | 中     | 中：配置化 loop    |
| 浏览器 QA        | 强：persistent browser        | 中：Playwright worker + trace + visual/handoff 基础 | 中                | 中                    | 弱           | 中     | 弱                 |
| Memory           | 强：learnings/GBrain/timeline | 中-强：LoopLearning + governance + recall           | 中：rules/context | 中                    | 中：repo map | 中     | 弱                 |
| Second Opinion   | 强心智：Codex/多模型审查      | 中-强：Claude Code secondary + conflict resolve     | 手动可做          | 可编排                | 手动         | 可扩展 | 不主打             |
| Release/canary   | 强：ship/canary/land          | 中-强：Release Gate + canary API + hard gate        | 弱                | 可接 CI/CD            | 中：git      | 弱-中  | 弱                 |
| Runtime Security | 中-强：guard/prompt injection | 中：command policy/canary/override，隔离待补        | 中：审批          | 强：sandbox 方向      | 弱           | 中     | 环境依赖           |
| Evidence         | 中：local artifacts/JSONL     | 强：detail/dashboard/PR evidence                    | 中：chat/history  | 中-强：logs/artifacts | 强：git diff | 中     | 强：benchmark logs |
| 可评测性         | 中：evals/bench               | 中：Loop Bench dashboard 首版，趋势化待补           | 弱                | 中                    | 弱           | 弱     | 强                 |
| 多 host          | 强：10 host configs           | 聚焦 Codex/Claude Code                              | 弱-中             | 强                    | 弱           | 强     | 弱                 |

## 3. gstack vs DofeAI

gstack 侧重个人/小团队的“流程即工具”。它把专家角色封装成技能，并让用户通过命令串联 sprint。

DofeAI 侧重团队级“任务与证据控制面”。它更适合沉淀状态、权限、队列、审计和可视化。当前 DofeAI 已经不只是 dashboard：Browser QA、Second Opinion、Release Canary、Runtime Security、Learning Governance 都有 API/worker/contract 基础。

建议：DofeAI 不要把 `/office-hours`、`/review` 等做成纯 prompt 复刻，而要做成 `WorkflowRecipe`、`ReviewGate`、`EvidenceArtifact`、`RuntimePolicy`、`ReleaseGate` 等结构化对象。

## 4. gstack vs Cline/Roo Code

Cline/Roo Code 在 IDE 内交互更直接，适合“我正在编辑这个项目，请帮我完成这一处变更”。它们的人机审批、文件修改和终端执行体验更贴近日常开发。

gstack 更像跨出 IDE 的工程流程套件，有浏览器 QA、发布、安全、记忆和 team install。

DofeAI 的机会是把这些能力从“用户手动调用命令”变成“Loop 生命周期中的默认步骤”，并让团队负责人从 dashboard 管理风险。

## 5. gstack vs OpenHands

OpenHands 更偏 agent platform/runtime：任务环境、sandbox、agent server、automation trigger 是其价值重心。

gstack 更偏 workflow pack：不拥有完整 SaaS control plane，但极强地占据“agent 应像工程团队一样工作”的流程心智。

DofeAI 应合并吸收：

- 从 OpenHands 学 sandbox、runtime isolation、任务环境复现；
- 从 gstack 学 workflow recipe、browser QA、role gates、memory 和 release discipline。

## 6. gstack vs Aider

Aider 的核心是 Git-native pair programming：repo map、精准编辑、diff、commit 体验清晰。它的用户信任来自“所有变更都在 git 里可见”。

gstack 范围更宽，但单次代码编辑体验未必比 Aider 极致。

DofeAI 应借鉴 Aider 的 git discipline，把每个 Loop 的 plan、patch、review、test、browser QA、release evidence 绑定到 PR summary 和 release gate。

## 7. gstack vs Goose

Goose 的启发是本地 runtime、provider 和插件生态，尤其是 MCP/extension 方向。

gstack 的启发是工程工作流产品化。

DofeAI 当前不应优先追求 Goose 式广泛插件生态，而应先把 Codex/Claude Code 双运行时的交付闭环打穿：worker 执行、证据沉淀、审批、release gate、runtime security。

## 8. gstack vs SWE-agent

SWE-agent 回答的是“agent 是否能在 benchmark 上解决软件工程问题”。gstack 回答的是“真实开发者如何把 agent 纳入日常交付流程”。

DofeAI 的机会是结合两者：在 Loops 里把已落地的 Loop Bench dashboard 继续趋势化，把 gstack 式流程产生的 evidence 转换为可度量、可回归检测的质量指标，例如首轮通过率、review conflict rate、browser QA regression rate、release rollback rate、runtime violation rate。

## 9. DofeAI 可形成的差异化

| 差异化方向          | 为什么 gstack 难覆盖                    | DofeAI 应怎么做                                          |
| ------------------- | --------------------------------------- | -------------------------------------------------------- |
| 团队治理            | gstack 本地/个人优先，缺 central policy | 组织级 workflow pack、审批、审计、权限                   |
| 结构化状态机        | gstack skills 仍是 prompt 执行          | 后端 Loop state machine 强约束 phase/gate                |
| Evidence 数据资产   | gstack 多 JSONL/local file              | 入库、可查询、可 dashboard 聚合、可 PR 输出              |
| Runtime enforce     | gstack 安全意识强，但环境隔离需部署约束 | OS/container sandbox、policy snapshot、override approval |
| Release governance  | gstack 有命令心智                       | Release hard gate、canary worker、rollback audit         |
| Learning governance | gstack 有 learning 复利                 | 去重、审批、生命周期、cross-workspace recall             |
| 集成入口            | gstack 偏手动 slash command             | GitHub/Slack/Linear/webhook/schedule trigger             |

## 10. 结论

gstack 是 DofeAI 在“流程产品化”上的最强对照。OpenHands 告诉我们 runtime/sandbox 怎么做，Aider 告诉我们 git discipline 怎么建立，SWE-agent 告诉我们如何评测，gstack 告诉我们 AI 工程团队应有哪些角色、门禁、记忆和浏览器眼睛。

DofeAI 的竞争优势应建立在团队化、结构化、可审计和可执行门禁上，而不是更长的提示词或更多 slash commands。
