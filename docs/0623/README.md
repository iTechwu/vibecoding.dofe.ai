# 0623 · AI Coding Agent 竞品情报总览

日期：2026-06-23

## 本轮检索范围

围绕 DofeAI / Loops / Loop Engineering 的产品方向，本轮重点检索 GitHub 上具备借鉴价值的开源 AI coding agent、异步工程 agent、IDE/CLI agent 与 agent runtime 项目。

## 竞品分层

| 层级                           | 项目         | 目录                                   | 对 DofeAI 的主要启发                                     |
| ------------------------------ | ------------ | -------------------------------------- | -------------------------------------------------------- |
| 团队级异步工程 agent           | Open SWE     | [open-swe](open-swe/README.md)         | GitHub issue 到 PR、异步 worker、plan approval           |
| 自托管 agent 控制面            | OpenHands    | [openhands](openhands/README.md)       | 多 backend、agent server、automation server、self-host   |
| Benchmark / issue repair agent | SWE-agent    | [swe-agent](swe-agent/README.md)       | 工具接口、SWE-bench、配置化 agent loop                   |
| 终端 pair programming          | Aider        | [aider](aider/README.md)               | repo map、git 自动提交、lint/test feedback               |
| 多端 IDE/CLI/SDK agent         | Cline        | [cline](cline/README.md)               | Plan/Act、Kanban、多 agent、定时任务、外部连接           |
| 多 agent 任务板                | Cline Kanban | [cline-kanban](cline-kanban/README.md) | 独立 worktree、卡片依赖、实时 diff、PR                   |
| IDE modes agent                | Roo Code     | [roo-code](roo-code/README.md)         | Code/Architect/Ask/Debug modes，本地化与模式分工         |
| 开源 coding agent 先驱         | Continue     | [continue](continue/README.md)         | VS Code/CLI/JetBrains 多端经验，以及仓库只读后的产品风险 |
| 轻量终端/桌面 agent            | OpenCode     | [opencode](opencode/README.md)         | build/plan 双 agent、只读规划、跨平台安装                |
| 通用本机 agent runtime         | Goose        | [goose](goose/README.md)               | Desktop/CLI/API、MCP、ACP、多 provider、定制发行版       |

## 总体判断

DofeAI 不应与 IDE 插件做同质化竞争，也不应只做单任务命令行 agent。更好的产品定位是：

> 面向团队的 AI 工程交付控制面：以用户意图和 Spec 审阅为入口，以异步 agent worker 自动推进，以 `.loops` 证据和 PR/回归结果证明交付。

## 非开源但必须关注的行业标杆

GitHub Copilot coding agent / cloud agent 不是本轮开源文档输出对象，但它定义了行业默认用户心智：把 issue 分配给 agent，agent 在云端隔离环境中工作，推送分支，打开 PR，并通过 GitHub 通知让用户审阅。

DofeAI 的借鉴重点：

- GitHub issue assignment / label 触发 Loop；
- 每个 Loop 默认绑定 branch / PR；
- 后台环境状态可见但不打扰普通用户；
- PR comment 自动包含计划、测试、风险和证据摘要。

## 对本项目的优先优化建议

| 优先级 | 建议                                                                                    | 当前状态                                                 |
| ------ | --------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| P0     | Loop Board v1：按交付阶段展示 issue、mode、human gate、branch、PR、evidence             | 已实施于 `/loops` dashboard                              |
| P0     | 异步化 Loop Engine：从同步 `advance` 迁移到队列 worker                                  | 后续 Epic                                                |
| P0     | 计划审阅升级为 Spec Diff Review                                                         | 后续 Epic                                                |
| P1     | 异常决策中心：runtime、成本、暂停、全局审阅、doctor problem 统一成 action cards         | 已实施 v1；权限/测试失败/re-loop limit 结构化后续 Epic   |
| P1     | Agent backend abstraction：local CLI、Docker、remote worker、cloud worker               | 后续 Epic                                                |
| P1     | Evidence-first delivery：implementation/test/review/global review/convergence artifacts | 已有基础，持续增强                                       |
| P1     | 入口集成扩展：GitHub Issues/PR、Linear、Slack                                           | 后续 Epic                                                |
| P1     | 模式分工：Planner、Implementer、Reviewer、Recovery Agent                                | Loop Board v1 已展示 user-facing mode，后续接入 contract |
| P1     | Repo map / context map                                                                  | 后续 Epic                                                |
| P1     | 沙箱与权限产品化                                                                        | 后续 Epic                                                |

## 实施闭环状态

### 循环 1 · Loop Board v1

状态：已实施。

落点：

- `apps/web/app/loops/loops-dashboard-model.ts`：新增 `buildLoopBoard`，将现有 issue/state/cost 派生为 Backlog / Spec Review / Running / Blocked / Delivered。
- `apps/web/app/loops/page.tsx`：新增 Loop Board 区块，展示 mode、human gate、evidence、branch、PR 状态和 blocker。
- `apps/web/locales/{en,zh-CN}/loops.json`：新增看板文案。
- `apps/web/app/loops/loops-dashboard-model.test.ts` 与 `apps/web/app/loops/page.test.tsx`：覆盖派生模型与页面渲染。

再审查结论：Loop Board v1 已覆盖 Cline Kanban / Cline 文档中的 P0 “任务板信息架构”诉求；worktree 真实路径、实时 diff、自动 PR、队列 worker、Spec diff 等仍需后续 contract / worker / git integration 设计，已标注为后续 Epic。

### 循环 2 · Exception Center v1

状态：已实施。

落点：

- `apps/web/app/loops/loops-dashboard-model.ts`：新增 `buildExceptionCenter`，将现有 issue/state/cost/runtime/doctor 数据统一派生为异常决策项。
- `apps/web/app/loops/page.tsx`：新增 Exception Center 区块，展示 owner、recommended action、evidence、source 和容量摘要。
- `apps/web/locales/{en,zh-CN}/loops.json`：新增异常决策中心文案。
- `apps/web/app/loops/loops-dashboard-model.test.ts` 与 `apps/web/app/loops/page.test.tsx`：覆盖异常派生模型和 dashboard 渲染。

再审查结论：Exception Center v1 已覆盖 OpenHands 的 backend capacity dashboard 第一层诉求，也覆盖 UIUX 文档中 Dashboard exception card 的前端控制面诉求。权限模式、测试失败明细、re-loop limit、impact、retry action 和 evidence links 仍需后端 contract 结构化支持，已标注为后续 Epic。

## 来源

- Open SWE: https://github.com/langchain-ai/open-swe
- OpenHands: https://github.com/All-Hands-AI/OpenHands
- SWE-agent: https://github.com/SWE-agent/SWE-agent
- Aider: https://github.com/Aider-AI/aider
- Cline: https://github.com/cline/cline
- Cline Kanban: https://github.com/cline/kanban
- Roo Code: https://github.com/RooCodeInc/Roo-Code
- Continue: https://github.com/continuedev/continue
- OpenCode: https://github.com/sst/opencode
- Goose: https://github.com/block/goose
