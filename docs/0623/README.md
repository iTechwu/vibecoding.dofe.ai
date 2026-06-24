# 0623 · AI Coding Agent 竞品情报总览

日期：2026-06-23

## 本轮检索范围

围绕 DofeAI / Loops / Loop Engineering 的产品方向，本轮重点检索 GitHub 上具备借鉴价值的开源 AI coding agent、异步工程 agent、IDE/CLI agent 与 agent runtime 项目。

## 竞品分层

| 层级                           | 项目         | 目录                                   | 对 DofeAI 的主要启发                                           |
| ------------------------------ | ------------ | -------------------------------------- | -------------------------------------------------------------- |
| 团队级异步工程 agent           | Open SWE     | [open-swe](open-swe/README.md)         | GitHub issue 到 PR、异步 worker、plan approval                 |
| 自托管 agent 控制面            | OpenHands    | [openhands](openhands/README.md)       | 多 backend、agent server、automation server、self-host         |
| Benchmark / issue repair agent | SWE-agent    | [swe-agent](swe-agent/README.md)       | 工具接口、SWE-bench、配置化 agent loop                         |
| 终端 pair programming          | Aider        | [aider](aider/README.md)               | repo map、git 自动提交、lint/test feedback                     |
| 多端 IDE/CLI/SDK agent         | Cline        | [cline](cline/README.md)               | Plan/Act、Kanban、多 agent、定时任务、外部连接                 |
| 多 agent 任务板                | Cline Kanban | [cline-kanban](cline-kanban/README.md) | 独立 worktree、卡片依赖、实时 diff、PR                         |
| IDE modes agent                | Roo Code     | [roo-code](roo-code/README.md)         | Code/Architect/Ask/Debug modes，本地化与模式分工               |
| 开源 coding agent 先驱         | Continue     | [continue](continue/README.md)         | VS Code/CLI/JetBrains 多端经验，以及仓库只读后的产品风险       |
| 轻量终端/桌面 agent            | OpenCode     | [opencode](opencode/README.md)         | build/plan 双 agent、只读规划、跨平台安装                      |
| 通用本机 agent runtime         | Goose        | [goose](goose/README.md)               | Desktop/CLI/API、MCP、ACP、多 provider、定制发行版             |
| 通用多 agent 框架 + 企业控制面 | CrewAI       | [crewAI](crewAI/README.md)             | Crews/Flows、AMP、ACP、RBAC、Traces、Triggers、Tool Repository |

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

| 优先级 | 建议                                                                                    | 当前状态                                                                                                   |
| ------ | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| P0     | Loop Board v1：按交付阶段展示 issue、mode、human gate、branch、PR、evidence             | 已实施于 `/loops` dashboard                                                                                |
| P0     | 异步化 Loop Engine：从同步 `advance` 迁移到队列 worker                                  | 后续 Epic                                                                                                  |
| P0     | 计划审阅升级为 Spec Diff Review                                                         | 已实施 v1：轻量 diff 摘要；结构化审批后续 Epic                                                             |
| P1     | 异常决策中心：runtime、成本、暂停、全局审阅、doctor problem 统一成 action cards         | 已实施 v1；权限/测试失败/re-loop limit 结构化后续 Epic                                                     |
| P1     | Agent backend abstraction：local CLI、Docker、remote worker、cloud worker               | 后续 Epic                                                                                                  |
| P1     | Evidence-first delivery：implementation/test/review/global review/convergence artifacts | 已有基础，持续增强                                                                                         |
| P1     | 入口集成扩展：GitHub Issues/PR、Linear、Slack                                           | 已实施 v2：webhook trigger (R7) + schedule trigger CRUD (R30c) + trigger lifecycle retry/replay/DLQ (R30c) |
| P1     | 模式分工：Planner、Implementer、Reviewer、Recovery Agent                                | 已实施 v1：看板 mode + 创建页推荐 agent path                                                               |
| P1     | Repo map / context map                                                                  | 已实施 v1：按现有 Loops 聚合仓库上下文；真实 repo graph 后续                                               |
| P1     | Workspace rules panel                                                                   | 已实施 v1：规则扫描、diagnostics、per-loop snapshot 与 agent-readable enforcement 可见                     |
| P1     | 沙箱与权限产品化                                                                        | 已实施 v1：权限画像可见；运行时强制策略后续 Epic                                                           |
| P1     | Provider profile                                                                        | 已实施 v1：provider/runtime mode/active agents 可见                                                        |
| P1     | Agent performance metrics                                                               | 已实施 v1：pass/redo/cost/trace 快照；benchmark 后续                                                       |

## 实施闭环状态

### 循环 1 · Loop Board v1

状态：已实施。

落点：

- `apps/web/app/loops/loops-dashboard-model.ts`：新增 `buildLoopBoard`，将现有 issue/state/cost 派生为 Backlog / Spec Review / Running / Blocked / Delivered。
- `apps/web/app/loops/page.tsx`：新增 Loop Board 区块，展示 mode、human gate、evidence、branch、PR 状态和 blocker。
- `apps/web/locales/{en,zh-CN}/loops.json`：新增看板文案。
- `apps/web/app/loops/loops-dashboard-model.test.ts` 与 `apps/web/app/loops/page.test.tsx`：覆盖派生模型与页面渲染。

再审查结论：Loop Board v1 已覆盖 Cline Kanban / Cline 文档中的 P0 “任务板信息架构”诉求；Spec Diff Review 已由 detail 页轻量 diff 摘要闭合为 v1。worktree 真实路径、卡片级实时 diff、自动 PR、队列 worker 等仍需后续 contract / worker / git integration 设计，已标注为后续 Epic。

### 循环 2 · Exception Center v1

状态：已实施。

落点：

- `apps/web/app/loops/loops-dashboard-model.ts`：新增 `buildExceptionCenter`，将现有 issue/state/cost/runtime/doctor 数据统一派生为异常决策项。
- `apps/web/app/loops/page.tsx`：新增 Exception Center 区块，展示 owner、recommended action、evidence、source 和容量摘要。
- `apps/web/locales/{en,zh-CN}/loops.json`：新增异常决策中心文案。
- `apps/web/app/loops/loops-dashboard-model.test.ts` 与 `apps/web/app/loops/page.test.tsx`：覆盖异常派生模型和 dashboard 渲染。

再审查结论：Exception Center v1 已覆盖 OpenHands 的 backend capacity dashboard 第一层诉求，也覆盖 UIUX 文档中 Dashboard exception card 的前端控制面诉求。权限模式、测试失败明细、re-loop limit、impact、retry action 和 evidence links 仍需后端 contract 结构化支持，已标注为后续 Epic。

### 循环 3 · Template Agent Path / Test Policy Preview

状态：已实施。

落点：

- `apps/web/app/loops/new/loop-issue-templates.ts`：为每个 Loop template 增加推荐 agent path 与 test policy 文案 key。
- `apps/web/app/loops/new/simple-loop-issue-form.tsx`：在 live preview 中展示自动推断模板对应的 agent path 与测试策略。
- `apps/web/locales/{en,zh-CN}/loops.json`：新增模板路径和测试策略文案。
- `apps/web/app/loops/new/simple-loop-issue-form.test.tsx`：覆盖 feature 与 bugfix 模板的推荐路径和测试策略。

再审查结论：Roo Code 文档中“Loop template 与 agent mode 绑定”的前端解释层已闭合；Aider 文档中“Test command policy”的第一层产品提示已闭合。repo 级可配置 unit/type/lint/e2e 命令、真实 agent route contract、权限模式仍需 workspace profile / runtime contract 支持，标注为后续 Epic。

### 循环 4 · Dashboard Delivery Guide v1

状态：已实施。

落点：

- `apps/web/app/loops/loops-dashboard-model.ts`：新增 `buildDashboardGuide`，根据 issue、review inbox、exception center、delivered 状态派生创建 / 审阅 / 异常 / 证据四步引导。
- `apps/web/app/loops/page.tsx`：在 dashboard 指标区前新增 Delivery Guide，降低首次进入的信息密度。
- `apps/web/locales/{en,zh-CN}/loops.json`：新增引导文案。
- `apps/web/app/loops/loops-dashboard-model.test.ts` 与 `apps/web/app/loops/page.test.tsx`：覆盖引导状态规则与页面渲染。

再审查结论：UIUX 文档中“Dashboard 新手引导弱”的后续优化已闭合为 v1。后续若需要个性化引导排序或基于用户行为的 dismiss 状态，需要新增用户偏好/行为数据，不纳入本轮。

### 循环 5 · Permission Profile v1

状态：已实施。

落点：

- `apps/web/app/loops/loops-dashboard-model.ts`：新增 `buildPermissionProfile`，从现有 agent/tool registry 汇总 read、write、shell/test、network、approval 状态和证据。
- `apps/web/app/loops/page.tsx`：在 Capability Registry 中新增 Permission Profile 区块。
- `apps/web/locales/{en,zh-CN}/loops.json`：新增权限画像文案。
- `apps/web/app/loops/loops-dashboard-model.test.ts` 与 `apps/web/app/loops/page.test.tsx`：覆盖权限画像派生和页面渲染。

再审查结论：OpenCode 文档中的“Agent permission mode”已闭合到可视化 v1；Goose 文档中的 MCP/extension/provider profile 也已闭合第一层可见性。真正的运行时权限强制、MCP/ACP extension 管理面、provider/model/cost profile contract 仍需后端 contract 和管理员 UI，标注为后续 Epic。

### 循环 6 · Performance Snapshot v1

状态：已实施。

落点：

- `apps/web/app/loops/loops-dashboard-model.ts`：新增 `buildPerformanceSnapshot`，基于现有 loop state、cost 和 trace summary 派生 pass rate、redo rate、平均 calls/tokens 与 trace events。
- `apps/web/app/loops/page.tsx`：在 dashboard metrics 后新增 Performance Snapshot 区块。
- `apps/web/locales/{en,zh-CN}/loops.json`：新增性能快照文案。
- `apps/web/app/loops/loops-dashboard-model.test.ts` 与 `apps/web/app/loops/page.test.tsx`：覆盖性能指标派生和页面渲染。

再审查结论：SWE-agent 文档中的“Agent performance metrics”已闭合为 dashboard v1。Loop Bench、隔离执行环境、真实 duration、标准任务集和 workspace strategy profile 仍需要后端/评测环境设计，标注为后续 Epic。

### 循环 7 · Detail Trace Timeline / Worker Progress v1

状态：已复核并完成文档校准。

落点：

- `apps/web/app/loops/[issueId]/page.tsx`：detail 页已有 Trace Timeline、Scope Summary 与 Event Log，基于现有 `detail.logs` 展示事件进度。
- `apps/web/locales/{en,zh-CN}/loops.json`：已有 trace/event log 文案。
- `apps/web/app/loops/[issueId]/page.test.tsx`：已覆盖事件流渲染、scope summary、事件数量展示与重复事件 key 防护。

再审查结论：Open SWE 文档中的 “Worker progress stream” 已闭合为文件态事件流 v1；Cline Kanban 文档中的 “Live progress stream” 已部分闭合到 detail 进度可视化。卡片级 latest diff/test、SSE live stream、真实异步 worker 仍需后端队列、状态机、contract、git/runtime integration，标注为后续 Epic。

### 循环 8 · Trigger Portfolio v1

状态：已实施。

落点：

- `apps/web/app/loops/loops-dashboard-model.ts`：新增 `buildTriggerPortfolio`，基于现有 issue source、target repo、submitter 与 created 时间派生入口来源组合。
- `apps/web/app/loops/page.tsx`：dashboard 新增 Trigger Portfolio 区块，展示来源分布、仓库覆盖和近期触发记录。
- `apps/web/locales/{en,zh-CN}/loops.json`：新增触发来源文案。
- `apps/web/app/loops/loops-dashboard-model.test.ts` 与 `apps/web/app/loops/page.test.tsx`：覆盖派生模型与页面渲染。

再审查结论：OpenHands 文档中的 “Automation trigger contract” 已闭合第一层可见性：用户可以看到当前 Loops 从哪些 source/repo/submitter 进入。GitHub/Slack/Linear webhook、schedule trigger、payload replay、signed validation 和外部唤醒仍需后端 contract、队列与集成设计，标注为后续 Epic。

### 循环 9 · Workspace Rules Panel v1

状态：已实施。

落点：

- `packages/contracts/src/schemas/loops.schema.ts`：为 workspace summary/profile 增加 `rules` 扫描摘要与 rule diagnostics schema。
- `apps/api/src/modules/loops/loops-workspace-profile.service.ts`：扫描 `AGENTS.md`、`CLAUDE.md`、`.cursor/rules`、`.clinerules`，返回存在状态、首行摘要、更新时间和重叠/缺失诊断。
- `apps/web/app/loops/page.tsx`：dashboard workspace switcher 展示 Workspace Rules Panel 与规则诊断。
- `packages/contracts/src/__tests__/schemas.test.ts`、`apps/api/src/modules/loops/loops-workspace-profile.service.spec.ts`、`apps/web/app/loops/page.test.tsx`：覆盖 schema、扫描逻辑和页面渲染。

再审查结论：Cline 文档中的 “Workspace rules panel” 已闭合为 v1，团队规则文件不再只是隐式仓库文档，而是在 Loops 控制台中可见。本轮进一步补齐 Rule Diagnostics v1：可提示缺失规则、规则来源过少、多个 agent-readable 规则可能存在优先级冲突。per-loop rule snapshot 与 agent-readable rules enforcement 已在循环 12 闭合为 v1；更细的规则解析、优先级配置和运行时硬阻断仍归入后续 Epic。

### 循环 10 · Provider Profile v1

状态：已实施。

落点：

- `apps/web/app/loops/loops-dashboard-model.ts`：新增 `buildProviderProfile`，基于 agent registry 与 runtime detection 汇总 provider、active agents、runtime mode 和 planned tool routes。
- `apps/web/app/loops/page.tsx`：Capability Registry 下新增 Provider Profile 区块。
- `apps/web/locales/{en,zh-CN}/loops.json`：新增 provider profile 文案。
- `apps/web/app/loops/loops-dashboard-model.test.ts` 与 `apps/web/app/loops/page.test.tsx`：覆盖派生模型与页面渲染。

再审查结论：Goose 文档中的 “Provider profile” 已闭合为 v1：控制台可见 provider 分布、runtime mode、active agents 和 planned tool routes。model/cost profile contract、provider 凭证健康、企业预设分发仍需要后端 contract 与管理员 UI，标注为后续 Epic。

### 循环 11 · Repo Context Map v1

状态：已实施。

落点：

- `apps/web/app/loops/loops-dashboard-model.ts`：新增 `buildRepoContextMap`，基于现有 issue `targetRepo`、状态、phase、更新时间和 cost guard 派生仓库级上下文。
- `apps/web/app/loops/page.tsx`：dashboard 新增 Repo Context Map 区块，展示仓库覆盖、阻塞数、阶段分布和每仓最近 Loop。
- `apps/web/locales/{en,zh-CN}/loops.json`：新增 repo context 文案。
- `apps/web/app/loops/loops-dashboard-model.test.ts` 与 `apps/web/app/loops/page.test.tsx`：覆盖派生模型与页面渲染。

再审查结论：Aider 文档中的 “Workspace repo map” 与总清单中的 “Repo map / context map” 已闭合第一层可见性：用户能看到 Loops 当前覆盖哪些仓库、各仓库处于哪些阶段、哪些仓库有阻塞。真实代码地图、commit range、dirty state、worktree path、diff summary 和依赖图仍需要 git/workspace profile contract，标注为后续 Epic。

### 循环 12 · Per-loop Rule Snapshot / Agent-readable Enforcement v1

状态：已实施。

落点：

- `packages/contracts/src/schemas/loops.schema.ts`：新增 `LoopRuleSnapshotSchema`，挂载到 `LoopIntake.ruleSnapshot`。
- `apps/api/src/modules/loops/loops.service.ts`：创建 Loop 时从当前 workspace profile 捕获规则快照，固化 present/missing rules、diagnostics 与 `snapshot-required` enforcement 状态。
- `apps/api/src/modules/loops/loops-persistence.service.ts`：DB detail 读取时保留 `.loops` intake 中的 rule snapshot，避免 DB intake 映射丢失创建时上下文。
- `apps/web/app/loops/[issueId]/page.tsx`：Issue detail 的 Intake 卡片展示 Rule Snapshot、agent-readable 状态、规则清单和诊断。
- `packages/contracts/src/__tests__/schemas.test.ts`、`apps/api/src/modules/loops/loops.service.spec.ts`、`apps/web/app/loops/[issueId]/page.test.tsx`：覆盖 schema、创建时快照、详情展示。

再审查结论：Cline 文档中点名的 `per-loop rule snapshot` 与 `agent-readable rules enforcement` 已闭合为 v1：每个新 Loop 都会固化创建时规则上下文；若存在 `AGENTS.md` / `CLAUDE.md` / `.clinerules` 等 agent-readable 来源，则 enforcement 标记为 `enforced` 并提供证据路径；否则标记为 `attention`。当前 enforcement 是可审计的执行上下文约束，不是运行时硬阻断。规则优先级配置、规则内容结构化解析和 agent adapter 执行前硬阻断仍归入后续 Epic。

### 循环 13 · Schedule Trigger + Trigger Lifecycle v1（R30c，2026-06-24）

状态：已实施。

落点：

- `packages/contracts/src/schemas/loops.schema.ts`：新增 schedule trigger schemas（CRUD + cron）+ trigger execution/retry/replay/dead-letter schemas。
- `packages/contracts/src/api/loops.contract.ts`：新增 9 个 endpoint（schedule trigger CRUD 5 个 + trigger lifecycle 4 个）。
- `apps/api/src/modules/loops/loops.service.ts`：新增 schedule trigger CRUD + cron 解析 + 指数退避 + trigger execution 管理方法。
- `apps/api/src/modules/loops/loops.controller.ts`：新增 9 个 handler（含 audit log）。
- `apps/api/src/modules/loops/loops-file-store.service.ts`：新增 file-backed trigger persistence（`.loops/triggers/`）。

再审查结论：CrewAI 文档中的 "Trigger Contract v2" 与 Relevance AI 的 "Trigger system" 已闭合 v1。Schedule trigger 支持 cron-based 定时创建 Loop；Trigger lifecycle 支持 retry（指数退避）、replay、dead-letter queue。真实 cron 执行引擎（外部 scheduler 轮询）、复杂 cron 表达式、分布式锁、cross-system trigger mapping 仍需后续 Epic。

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
