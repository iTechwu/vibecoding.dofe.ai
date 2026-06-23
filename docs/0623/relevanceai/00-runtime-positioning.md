# 00 · DofeAI 运行时定位修正

## 核心判断

本项目不是要从零构建一个 Relevance AI 式的通用 agent runtime。DofeAI 的底层执行能力来自 Codex CLI 与 Claude Code CLI，产品价值在其上方：

- 将自然语言需求转成可执行的软件交付流程；
- 为 Codex/Claude Code CLI 分配阶段、上下文、权限和验收标准；
- 将 CLI 的执行结果沉淀为 spec、test、review、global review、evidence、PR trace；
- 对执行过程做 RBAC、audit、cost guard、runtime diagnostics、human gates 和 reloop；
- 把一次次 CLI 执行组织成团队可理解、可复用、可治理的 Delivery Loop。

换句话说：

> Codex/Claude Code CLI 是执行器，DofeAI 是工程交付编排控制面。

## 与 Relevance AI 的根本差异

| 维度         | Relevance AI                                     | DofeAI                                                       |
| ------------ | ------------------------------------------------ | ------------------------------------------------------------ |
| 底层运行时   | SaaS 托管 agent runtime                          | Codex CLI / Claude Code CLI / local-Docker workspace         |
| 用户主要感知 | Agent、Workforce、Tool、Knowledge、Trigger、Eval | Delivery Loop、Runtime Backend、Spec、Work Package、Evidence |
| 主要场景     | 销售、客服、运营、营销、企业自动化               | 软件需求交付、代码修改、测试、审阅、PR 证据                  |
| 差异化重点   | 横向业务模板和集成生态                           | 深度研发上下文、CLI 执行治理、可审计交付链                   |
| 风险边界     | 平台托管执行与企业权限                           | 本地/容器/远程 workspace 中的代码执行权限                    |

## 分层架构

| 层级                 | DofeAI 负责                                                                   | Codex/Claude Code CLI 负责           |
| -------------------- | ----------------------------------------------------------------------------- | ------------------------------------ |
| Product Layer        | Dashboard、New Loop、Detail、Review Inbox、Exception Center                   | 不直接面向业务用户                   |
| Orchestration Layer  | phase、handoff、human gate、reloop、finalize、trigger、eval                   | 接收明确任务并执行                   |
| Runtime Policy Layer | backend selection、permission profile、workspace policy、fallback、cost guard | 遵循执行环境约束                     |
| Execution Layer      | 调度 CLI、记录状态、保存证据引用                                              | 读代码、改代码、跑测试、生成审阅输出 |
| Evidence Layer       | spec/test/review/global/evidence/trace/PR                                     | 产生变更、命令输出、分析结果         |

## Runtime Backend Registry

为了避免把 Codex/Claude CLI 只当成“provider 文案”，DofeAI 应将它们产品化为 Runtime Backend。

建议模型：

```text
RuntimeBackend
- id: codex-cli | claude-code-cli | docker-codex | docker-claude | deterministic | remote-runner
- label
- executionMode: local | docker | remote
- status: available | degraded | unavailable
- supportedStages
- permissionProfile
- workspacePolicy
- costPolicy
- fallbackPolicy
- diagnostics
- lastHealthCheck
```

## 对产品建议的影响

### 1. Workforce 不是泛 agent 团队

DofeAI 的 Software Delivery Workforce 不应被理解成 Relevance AI 那种跨业务系统的 no-code workforce。它是 Codex/Claude CLI 的角色化协作：

- Spec Writer：生成规格；
- Builder：实现变更；
- Test Runner：执行测试；
- Code Reviewer：审阅分片；
- Release Reviewer：全局评审；
- Evidence Curator：整理证据与 PR 注释。

### 2. Tool Registry 是权限与边界，不是任意 no-code 工具市场

DofeAI 的 Tool Registry 应先回答：

- Codex/Claude CLI 可以读写哪些路径；
- 是否允许 shell/network/browser；
- 哪些外部系统可调用；
- 哪些操作需要人类批准；
- 每次调用如何审计。

### 3. Eval Suite 应评估 backend + blueprint + repo context

评测对象不是抽象 agent，而是组合：

```text
Eval Target = Runtime Backend + Delivery Blueprint + Repo Context + Tool Policy
```

例如：

- Codex CLI + Bugfix Blueprint + repo A；
- Claude Code CLI + UI Feature Blueprint + repo B；
- Docker Codex + Migration Blueprint + staging DB policy。

### 4. Trigger 放大前必须先治理 runtime

Webhook、schedule、GitHub、Slack 等 trigger 一旦上线，会放大 CLI 执行权限。因此触发器上线顺序必须依赖：

- runtime backend health；
- workspace policy；
- permission profile；
- cost guard；
- eval gate；
- audit trail。

## 推荐产品叙事

对外叙事：

> DofeAI turns Codex and Claude Code CLI into a governed software delivery workforce.

中文叙事：

> DofeAI 将 Codex 与 Claude Code CLI 变成可治理的软件交付团队。

这比“通用 AI agent 平台”更准确，也更能解释为什么 DofeAI 要重点建设 Loops、runtime diagnostics、human gates、evidence、eval suite 和 enterprise governance。
