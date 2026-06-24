# gstack 产品深析

## 1. 产品定位

gstack 的定位可以概括为：

> 面向 AI coding power users 的本地工程工作流层，把 Claude Code 等 agent host 变成一支可指挥、可复盘、可扩展的虚拟工程团队。

它不直接竞争模型能力，也不是单纯 IDE 插件。它做的是流程包装、工具补位和长期记忆：用 skills 编码工程最佳实践，用 CLI/daemon 提供浏览器、记忆、安全和发布能力，用 team mode 把个人 workflow 带进 repo。

## 2. 目标用户

| 用户              | 痛点                                     | gstack 的解决方式                              | DofeAI 对应机会                                      |
| ----------------- | ---------------------------------------- | ---------------------------------------------- | ---------------------------------------------------- |
| 技术 Founder/CEO  | 想保持产品判断和出活速度，但没有完整团队 | `/office-hours`、CEO review、autoplan          | Loop intake + product gate + release readiness       |
| Staff/Tech Lead   | AI 改代码快，但架构、审查和发布容易失控  | Eng/design/DX review、ship/canary              | Review Gate + Release Gate + PR evidence             |
| 独立开发者/小团队 | 缺 QA、安全、文档、发布工程角色          | QA、CSO、document、release tools               | Browser QA Worker + Runtime Security + docs evidence |
| 多 agent 用户     | Claude、Codex、Cursor 等工具割裂         | host configs、pair-agent、Codex second opinion | Codex/Claude Code 双运行时编排                       |
| 团队负责人        | 希望把个人 agent 经验变成团队流程        | team mode、repo skill routing                  | Workspace Recipe Admin + policy as data              |

## 3. 产品结构

### Workflow Skills

gstack 将工程流程拆成角色化技能：

- 产品/战略：`/office-hours`、`/plan-ceo-review`；
- 计划/架构：`/plan-eng-review`、`/plan-design-review`、`/plan-devex-review`、`/autoplan`；
- 实施/审查：`/review`、`/codex`、`/investigate`；
- 体验/质量：`/qa`、`/qa-only`、`/design-review`、`/devex-review`；
- 安全/发布：`/cso`、`/ship`、`/land-and-deploy`、`/canary`；
- 文档/知识：`/document-release`、`/document-generate`、`/learn`；
- 浏览器/协作：`/browse`、`/open-gstack-browser`、`/pair-agent`。

这些技能的价值不是“提示词多”，而是把工程团队职责边界编码成默认流程，降低用户从空白 prompt 开始的成本。

### Persistent Browser

gstack 的浏览器能力是其最硬的基础设施能力之一：

- long-lived Chromium daemon 降低冷启动；
- 保留 tabs、cookies、localStorage；
- 通过 accessibility snapshot 给元素分配 refs，降低 selector 脆弱性；
- 支持 headless/headed handoff，遇到 CAPTCHA/MFA 可交给人；
- 支持 console/network/dialog 日志、截图、CDP allowlist。

这让 `/qa` 不只是“根据代码猜测页面是否可用”，而是能真实打开、观察、点击和复盘页面。

### Safety & Security

gstack 的安全设计分两层：

| 层级                       | 能力                                                                         | 产品意义                     |
| -------------------------- | ---------------------------------------------------------------------------- | ---------------------------- |
| 本地执行安全               | careful、freeze、guard、scoped token、redaction                              | 降低破坏性命令和秘密泄露风险 |
| 网页 prompt injection 安全 | trust boundary、classifier、transcript classifier、canary token、attack logs | 避免网页内容污染 agent 指令  |

对 DofeAI 的启发是：安全不应只停留在“权限展示”，而应成为执行前、中、后的 runtime policy 和 evidence。

### Memory & Learning

gstack 的记忆体系包括项目 learnings、timeline、decision logs、review logs、question/taste/analytics JSONL，以及 GBrain 这类更长期知识库。

关键洞察是：AI agent 的生产力会被“每次都重新解释项目背景”拖垮。记忆不是锦上添花，而是多次 sprint 产生复利的基础。

### Team Distribution

gstack 通过 team mode、`CLAUDE.md` skill routing 和 repo 内配置扩散 workflow。它没有做重型 SaaS 管控，但非常擅长把个人高效实践带入共享仓库。

DofeAI 可以更进一步：把 workflow pack 结构化为 contract、DB/API 和 dashboard，使团队可以审查、版本化、启用、禁用和量化。

## 4. 产品优势

| 优势              | 说明                                                                        |
| ----------------- | --------------------------------------------------------------------------- |
| Workflow 心智清晰 | Think -> Plan -> Build -> Review -> Test -> Ship -> Reflect 容易传播        |
| 角色化强          | CEO、Designer、Eng Manager、QA、CSO、Release Manager 让用户知道何时调用什么 |
| 浏览器能力扎实    | persistent daemon + refs + handoff 能解决真实 QA 问题                       |
| 安全叙事完整      | 从 destructive command 到 prompt injection 都有具体设计                     |
| 多 host 扩散      | 同一套 workflow 可装到多个 agent 宿主                                       |
| 本地优先          | 安装快、信任门槛低，适合 power user                                         |
| 叙事有感染力      | “一个人像一支工程团队一样交付”非常适合 founder 市场                         |

## 5. 产品风险

| 风险                       | 说明                                     | DofeAI 可规避方式                                |
| -------------------------- | ---------------------------------------- | ------------------------------------------------ |
| Skill 规模膨胀             | 54 个 skill 长期维护成本高               | 用 Zod contract + workflow recipe 表达流程       |
| Host sprawl                | 多 host 适配深度难保持一致               | 坚持 Codex CLI + Claude Code CLI 双运行时        |
| 本地状态分散               | JSONL、全局目录、repo 配置难做组织级审计 | evidence、policy、memory 进入 DB/API/worker 治理 |
| Prompt-only 不够强约束     | skill 仍依赖 agent 遵循指令              | 用状态机、gate、worker enforce                   |
| Browser session 信任成本高 | cookie、登录态、截图都可能触及隐私       | 测试账号、session ref、脱敏和审批                |
| 团队治理弱于 SaaS 控制面   | gstack 更偏本地个人/小团队               | DofeAI 强化 RBAC、audit、queue、dashboard        |

## 6. DofeAI 的正确学习姿势

DofeAI 不应复制 gstack 的 slash command 集合。更好的位置是：

> gstack 是个人 agent workflow pack；DofeAI 应成为团队级 AI delivery control plane。

对应产品转化：

- 把角色命令转成 Workflow Recipe。
- 把 plan/review/ship 转成 Review Gate 和 Release Gate。
- 把浏览器操作转成 Browser QA Worker 与 evidence artifact。
- 把 learnings 转成团队级 Learning Memory 和治理队列。
- 把 guard/careful 转成 Runtime Security Gate 与 sandbox profile。
- 把 canary/ship 转成 release worker、rollback note 和 hard gate。

## 7. 产品经理视角的关键判断

gstack 已经证明了“流程密度”是 AI coding 的强需求。DofeAI 的机会不是做更长提示词，而是把流程密度产品化为组织可治理资产。用户真正愿意为 DofeAI 付费的点会是：

- agent 交付能不能被团队信任；
- 风险能不能在发布前被发现；
- 经验能不能复用而不污染项目；
- 多个 Loop 能不能并行但不失控；
- Codex 和 Claude Code 的职责边界能不能被看见、审计和改进。
