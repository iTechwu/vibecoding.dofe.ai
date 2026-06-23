# gstack 产品深析

## 产品定位

gstack 的定位可以概括为：

> 面向 AI coding power users 的本地 workflow operating layer，把 Claude Code 等宿主变成一支可指挥、可复盘、可扩展的虚拟工程团队。

它不是 IDE 插件，不直接做模型推理，也不试图替代 GitHub/Jira/Linear。它做的是流程和能力包装：用 skills 把最佳实践写成可执行提示，用 CLI/daemon 弥补 agent 缺少真实浏览器、记忆、安全边界和发布纪律的问题。

## 目标用户

| 用户              | 痛点                                          | gstack 解决方式                                         |
| ----------------- | --------------------------------------------- | ------------------------------------------------------- |
| 技术 Founder/CEO  | 想保持产品判断和出活速度，但没有完整团队      | `/office-hours`、`/plan-ceo-review`、`/autoplan`        |
| Staff/Tech Lead   | AI 改代码快，但质量、架构、审查、发布容易失控 | `/plan-eng-review`、`/review`、`/ship`、`/cso`          |
| 独立开发者/小团队 | 缺 QA、设计、文档、发布工程角色               | `/qa`、`/design-review`、`/document-release`、`/canary` |
| 多 agent 用户     | Claude/Codex/OpenClaw/Cursor 等工具割裂       | host adapters、`/pair-agent`、`/codex`                  |

## 产品结构

### 1. Workflow Skills

gstack 将工程流程拆成一组角色化技能：

- 产品/战略：`/office-hours`、`/plan-ceo-review`；
- 计划/架构：`/plan-eng-review`、`/plan-design-review`、`/plan-devex-review`、`/autoplan`；
- 实施/审查：`/review`、`/codex`、`/investigate`；
- 体验/质量：`/qa`、`/qa-only`、`/design-review`、`/devex-review`；
- 安全/发布：`/cso`、`/ship`、`/land-and-deploy`、`/canary`；
- 文档/知识：`/document-release`、`/document-generate`、`/learn`；
- 浏览器/协作：`/browse`、`/open-gstack-browser`、`/pair-agent`。

这些技能的价值不只是“提示词多”，而是把工程团队中的职责边界编码成默认流程，降低用户从空白 prompt 开始的成本。

### 2. Persistent Browser

gstack 的浏览器能力是其最硬的基础设施能力。架构上采用本地 long-lived Chromium daemon：

- 第一次调用启动浏览器，后续命令通过 localhost HTTP 调用，降低每次操作的冷启动成本；
- 保留 tabs、cookies、localStorage，支持真实登录态；
- 通过 accessibility snapshot 给元素分配 refs，避免 agent 手写 CSS selector；
- 支持 headless 和 headed handoff，遇到 CAPTCHA/MFA 可交给人处理；
- 支持 cookie import、console/network/dialog 日志、截图、原始 CDP allowlist。

这让 gstack 的 `/qa` 不只是“根据代码猜测”，而是能打开页面、点击、观察、修复、再验证。

### 3. Safety & Security

gstack 的安全设计覆盖两个层面：

第一层是本地执行安全：

- `/careful`、`/freeze`、`/guard` 防止破坏性命令和越界编辑；
- scoped tokens、tunnel listener allowlist、rate limiting 保护远程 pair-agent；
- redaction/prepush 类工具减少秘密泄露。

第二层是网页 prompt injection 安全：

- 对页面内容、工具输出做 trust-boundary envelope；
- 本地 ML classifier 检测 prompt injection；
- transcript classifier 做全会话判断；
- canary token 检测系统提示泄露；
- dashboard/attack logs 提供可见性。

对 DofeAI 的启发：安全不应只做“规则展示”，而要成为 runtime 前、中、后的策略系统。

### 4. Memory & Learning

gstack 记忆体系包括：

- `~/.gstack/projects/<slug>/learnings.jsonl` 项目学习；
- timeline、decision、review、question、taste、analytics 等 JSONL；
- GBrain 作为更长期、跨机器、可 MCP 化的知识库；
- context-save/context-restore 与 continuous checkpoint。

它的关键产品洞察是：AI agent 的生产力会被“每次都重新解释项目背景”拖垮。记忆不是锦上添花，而是让多次 sprint 复利增长的基础。

### 5. Team Distribution

gstack 的 team mode 通过 `CLAUDE.md` skill routing 和 `.claude/` 引导团队安装同一套 workflow。它没有做重型 SaaS 管控，而是把流程嵌进 repo，靠开源、脚本和约定扩散。

DofeAI 可以更进一步：将 workflow pack 结构化到 contract 和 UI 中，让团队可以审查、版本化、启用/禁用。

## 产品优势

| 优势                 | 说明                                                                         |
| -------------------- | ---------------------------------------------------------------------------- |
| 清晰的 workflow 心智 | Think -> Plan -> Build -> Review -> Test -> Ship -> Reflect，很容易传播      |
| 角色化强             | CEO、Eng Manager、Designer、QA、CSO、Release Engineer 让用户知道何时调用什么 |
| 本地优先             | 不要求 SaaS 后端，安装快，信任门槛低                                         |
| 浏览器能力扎实       | persistent daemon + refs + cookies + handoff 解决真实 QA 问题                |
| 安全意识强           | 对 prompt injection、tunnel、cookie、destructive command 都有具体设计        |
| 多 host 扩散         | 同一套 workflow 可装到多个 agent 宿主，避免绑定单一产品                      |
| 叙事有感染力         | “一个人像二十人团队一样交付”非常适合 founder 市场                            |

## 产品风险

| 风险                       | 说明                                                     | DofeAI 可规避方式                                      |
| -------------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| Prompt/skill 规模膨胀      | 54 个 SKILL.md，部分技能巨大，长期维护成本高             | 用 contract + server-side workflow recipe 把流程结构化 |
| 宿主依赖                   | Claude Code 是主战场，其他 host 适配深度可能不一致       | DofeAI 应抽象 AgentAdapter，不把体验绑定单一 host      |
| 本地状态分散               | JSONL、全局目录、repo 配置多，团队审计难                 | DofeAI 可将 evidence、policy、memory 入库并可视化      |
| “个人超级工具”多于团队治理 | 强 founder/power user，团队权限、审批、报表不是核心      | DofeAI 应坚持 team control plane                       |
| 安装/升级复杂度            | 多 host、多 symlink、generated docs、Bun/Playwright 依赖 | DofeAI 可通过 Web/API 管理工作流版本                   |
| 质量依赖提示纪律           | skills 是强约束，但仍受 agent 执行一致性影响             | 用状态机和后端 contract 强化不可跳过的 gate            |

## 对 DofeAI 的定位启发

DofeAI 不应复制 gstack 的 slash command 集合。更好的位置是：

> gstack 是个人 agent workflow pack；DofeAI 应成为团队级 agent delivery control plane。

因此，DofeAI 的优化方向应是：

- 把 gstack 的角色化流程转成可配置、可审计的 Loop workflow；
- 把 gstack 的浏览器 QA 转成 worker capability 和 evidence artifact；
- 把 gstack 的 learnings 转成团队级知识资产；
- 把 gstack 的 safety guardrails 转成 runtime policy；
- 把 gstack 的 ship/canary 转成 Release Gate。
