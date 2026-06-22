# 01 · 开源项目对标分析

## 选型标准

本项目的相关开源参照不是“代码补全工具”，而是能覆盖至少一个 Loops 关键维度的项目：

- 异步工程任务；
- agent runtime / sandbox；
- plan / implement / test / review；
- human-in-the-loop；
- Git / PR / issue 集成；
- 运行证据与可追溯状态。

## 对标项目

| 项目                       | 定位                                           | 与本项目相关点                                                                    | 对 DofeAI 的启发                                                                              |
| -------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| OpenHands Agent Canvas     | 自托管 coding agents 与 automations 控制中心   | 多 backend、local / Docker / VM / cloud runtime、自动化集成、agent control center | DofeAI 当前 runtime 诊断方向正确，但还需要把“backend 能力”和“用户下一步”分层表达              |
| Open SWE                   | 开源异步 coding agent / 内部 coding agent 框架 | GitHub issue / UI 触发、计划审批、云沙箱、写码测试审阅、自动 PR                   | DofeAI 的 `advance` 和 Spec gate 与其模式一致，下一步应强化异步 worker、计划 diff、运行中反馈 |
| SWE-agent / mini-SWE-agent | 面向真实仓库 issue 修复与 SWE-bench 的 agent   | 单任务 autonomous repair、工具接口、benchmark、命令行可配置                       | DofeAI 应保留 CLI/debug 入口，但默认产品面不能要求用户理解底层工具循环                        |
| Aider                      | 终端 AI pair programming                       | repo map、git integration、自动 lint/test、自动 commit                            | DofeAI 可以借鉴“代码地图 + 自动测试 + Git 证据”，但应避免退回到手动聊天式协作                 |

## 关键模式

### 1. Plan approval 是最稳定的人类关卡

Open SWE 强调 Planner 先研究代码库并形成计划，默认允许人工审阅计划。DofeAI 的 Spec Review 本质上就是这个关卡，方向正确。

产品要求：

- Draft Spec 必须清晰展示目标、范围、验收；
- 批准后不应让用户继续点每个内部 phase；
- 修改意见必须进入下一版 Draft，而不是散落在聊天里。

### 2. Agent execution 应该异步化

OpenHands 和 Open SWE 都把长任务与 runtime/backend/sandbox 作为一等能力。DofeAI 当前已具备同步 `advance`，但长任务仍可能占用 HTTP 请求。

产品要求：

- 用户点击 `Continue loop` 是唤醒和重试，不是驱动每个步骤；
- 后台 worker 持续推进到人工关卡、异常或终态；
- 页面通过 polling/SSE 展示进度，而不是暴露细粒度按钮。

### 3. Sandboxing 是“给 agent 权限”的前提

Open SWE 的核心逻辑是隔离环境内给 agent 足够权限，OpenHands 支持 local、Docker、VM、cloud backend。DofeAI 已实现本机 CLI 优先、Docker 兜底和 workspace profile，这是正确基础。

产品要求：

- 普通用户只看“运行环境可用 / 不可用 / 需要配置”；
- 管理员才看 Docker image、CLI path、pull diagnostics；
- 权限失败要转成异常决策卡，而不是原始日志。

### 4. Evidence 比 transcript 更适合团队交付

Aider 强调 Git、lint/test、自动提交；Open SWE 强调 PR 和 issue 状态更新。DofeAI 的 `.loops` evidence truth source 是差异化优势。

产品要求：

- Evidence Coverage 应成为交付可信度核心；
- final delivery 必须绑定 implementation/test/review/global review/convergence artifacts；
- re-loop 后默认聚焦 current round，避免旧轮证据污染判断。

## 竞品差异化判断

DofeAI 不应直接复制 Open SWE 的“GitHub-first”或 Aider 的“terminal-first”。本项目更适合定位为：

> 面向团队和平台的 AI 工程交付控制面：多 agent、多 runtime、可审计证据、人工只批准关键决策。

因此产品优化优先级应是：

1. 降低用户默认路径中的内部术语；
2. 强化自动推进与暂停原因解释；
3. 把异常从日志升级为可处理决策；
4. 用 evidence 而不是聊天记录证明交付；
5. 再扩展 GitHub/Linear/Slack 入口。

## 来源

- OpenHands README: https://github.com/All-Hands-AI/OpenHands
- Open SWE GitHub: https://github.com/langchain-ai/open-swe
- Open SWE announcement: https://www.langchain.com/blog/introducing-open-swe-an-open-source-asynchronous-coding-agent
- SWE-agent README: https://github.com/SWE-agent/SWE-agent
- Aider README: https://github.com/Aider-AI/aider
