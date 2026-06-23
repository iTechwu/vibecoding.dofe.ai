# gstack 竞品分析

项目：gstack  
GitHub：https://github.com/garrytan/gstack  
定位：Claude Code / 多 Agent Host 的 AI 工程工作流层、浏览器 QA 工具链与个人/团队记忆系统  
检索日期：2026-06-23  
检索版本：`9fd03fae9e74f5daa7a138366aca8f86c7367c5c`，`v1.58.4.0`

## 一句话判断

gstack 不是传统 IDE agent，也不是单一 coding agent；它是把 Claude Code 等宿主包装成“可安装、可更新、可记忆、可安全审计、可并行运转的虚拟工程团队”的 workflow layer。对 DofeAI 的最大启发是：Loops 不能只做任务看板和执行状态，而要沉淀成一套可编排、可复用、可持续学习的交付操作系统。

## 核心事实

| 维度        | gstack                                                                                                                        |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 开源协议    | MIT                                                                                                                           |
| GitHub 热度 | 2026-06-23 GitHub API 显示约 113k stars、16.8k forks                                                                          |
| 主要宿主    | Claude Code，同时支持 Codex CLI、OpenCode、Cursor、Factory、Slate、Kiro、Hermes、GBrain、OpenClaw                             |
| 形态        | Markdown skills + CLI binaries + persistent Chromium daemon + Chrome extension + local state                                  |
| 工作流主线  | Think -> Plan -> Build -> Review -> Test -> Ship -> Reflect                                                                   |
| 关键能力    | `/office-hours`、`/autoplan`、`/review`、`/qa`、`/ship`、`/cso`、`/browse`、`/spec`、`/learn`、`/pair-agent`、`/setup-gbrain` |
| 技术底座    | Bun、Playwright/Chromium、local HTTP daemon、generated SKILL.md、JSONL local state、optional telemetry                        |

## 产品画像

gstack 的产品心智是“一个人用 AI 像一个团队一样交付”。它把工程团队中的 CEO/Founder、Eng Manager、Designer、QA Lead、Security Officer、Release Engineer、Technical Writer 等角色变成 slash command，并用共享上下文、项目记忆、浏览器能力、安全守卫和发布流程把这些角色串成 sprint。

它的竞争点不在模型本身，而在流程密度：

- 用 `/office-hours` 和 `/plan-ceo-review` 把需求前置重构；
- 用 `/plan-eng-review`、`/plan-design-review`、`/plan-devex-review` 强化计划质量；
- 用 `/review`、`/codex` 做多模型交叉审查；
- 用 `/qa`、`/browse`、`/open-gstack-browser` 让 agent 真正操作页面；
- 用 `/ship`、`/land-and-deploy`、`/canary` 打通发布后验证；
- 用 `/learn`、GBrain、decision/logging/timeline 类工具沉淀跨会话记忆。

## 与 DofeAI 的深度对比

| 维度      | gstack                                                                         | DofeAI 当前                                            | 差距/机会                                          |
| --------- | ------------------------------------------------------------------------------ | ------------------------------------------------------ | -------------------------------------------------- |
| 产品中心  | Agent workflow layer，靠 slash command 驱动                                    | Loops Control Plane，靠 dashboard/detail 驱动          | DofeAI 控制面更适合团队；但需要 workflow recipe 层 |
| 执行对象  | 技能/角色：CEO、Eng、Design、QA、CSO、Release                                  | Loop issue + phase + evidence                          | DofeAI 应把 phase 映射成可配置 Agent Path          |
| 计划质量  | office hours + CEO/design/eng/DX review pipeline                               | Spec review、human gate、rule snapshot 已有 v1         | 可补 multi-review pipeline 和质量评分              |
| 浏览器 QA | persistent Chromium daemon、refs、cookie import、handoff、sidebar              | 现阶段以工程/控制面为主                                | 浏览器 QA 是 DofeAI 的明显可借鉴增量               |
| 安全      | prompt injection classifier、canary token、scoped tunnel、redaction、CSO skill | workspace rules、permission profile、quality gate 基础 | 可把权限/安全从可见性升级为执行前门禁              |
| 多 Agent  | pair-agent、跨 host skill install、Codex second opinion                        | Provider profile、agent registry 可见                  | 可补 agent handoff / second opinion contract       |
| 记忆      | learnings、timeline、decision logs、GBrain sync                                | rule snapshot、trace、evidence、repo context map       | 可将 evidence 升级为可检索知识库                   |
| 并行      | 依赖 Conductor 多 workspace，可跑 10-15 parallel sprints                       | Loop Board/queue worker 仍在后续 Epic                  | DofeAI 应产品化并行 worker 和容量治理              |
| 发布      | ship/land/deploy/canary 一条链                                                 | evidence-first delivery，PR/git integration 待增强     | 可补 Release Gate 和 PR 证据摘要                   |
| 团队分发  | team mode、CLAUDE.md skill routing、auto-update                                | AGENTS/CLAUDE 规则扫描                                 | 可补 repo 级 workflow pack 管理                    |

## 对本项目的优先优化建议

| 优先级 | 建议                                                                     | 验收                                                                                                                                                                                                                                                                                                                                                                       |
| ------ | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0     | Loop Workflow Recipe：把当前 phase/mode/rule snapshot 映射为可配置工作流 | 已实施 v5：dashboard v1 + 后端 `LoopWorkflowRecipe` contract/list/detail 派生 + detail 页 Delivery Controls 工作流时间线 + 创建时 per-loop recipe snapshot + file-backed delivery governance 的 workflow default 记录；后续仍需 workspace 级管理 UI 和新建 Loop 默认应用                                                                                                   |
| P0     | Multi-review Gate：引入 CEO/Design/Eng/DX/Security review 槽位           | 已实施 v6：dashboard v1 + Review Inbox gate 聚合 + 后端 `LoopReviewGate` contract/list/detail 派生 + detail 页 gates 展示 + file-backed review gate override/waiver 审计；后续仍需 per-loop required gates 配置 UI 与更细 gate 规则                                                                                                                                        |
| P1     | Browser QA Worker：为 Loops 增加真实浏览器检查能力                       | 已实施 v5：`runBrowserQa` API + Playwright CLI report-only worker，写入 Browser QA report、截图、Playwright trace、console/network summary、visual regression baseline/diff artifact、browser handoff artifact，并新增 auth session ref 与 Browser QA session policy 治理；后续仍需真实 authenticated session profile、高级像素阈值/多 viewport 视觉回归和 QA bug 自动回归 |
| P1     | Learning & Decision Memory：把 evidence/trace/review 变成可检索资产      | 已实施 v9：LoopLearning 生成/召回/展示/治理/相似建议 + delivery governance learning policy + auto-merge worker，将 similarity suggestions 固化为 pending approval candidates；后续仍需真实跨 workspace 索引执行、审批 UI 和更强相似度模型                                                                                                                                  |
| P1     | Second Opinion Agent：结构化接入 Codex/Claude 双模型审查                 | 已实施 v5：contract/detail + `runSecondOpinion` + Claude Code secondary worker + finding fingerprint 精确比对 + file-backed second-opinion policy，可配置 requiredForRelease/conflictHumanGate；后续仍需冲突 human gate 工作队列和 release hard gate UI                                                                                                                    |
| P1     | Release Gate：从“任务完成”升级为“可发布”                                 | 已实施 v7：dashboard Release Readiness + Ready to Ship lane、后端 `LoopReleaseGate` 派生、detail checklist、PR summary evidence + file-backed release canary 记录并影响 `canaryPassed`；后续仍需真实发布阻断和 rollback/canary worker 执行                                                                                                                                 |
| P1     | Runtime Security Gate：把权限画像从展示升级为执行约束                    | 已实施 v6：runner shell policy、runtime policy snapshot、env-token canary、Dashboard Exception Center、file-backed runtime override 审计记录，并在命令进入 shell 前阻断常见 network tools/package install 与明显跨 workspace 写入模式；后续仍需 OS/container 级 network/write sandbox 和 override 执行层审批拦截                                                           |
| P2     | Team Workflow Pack：将团队推荐流程写入 repo 可版本化配置                 | 可导入/导出 workflow pack；和 AGENTS.md/CLAUDE.md 规则形成双向校验                                                                                                                                                                                                                                                                                                         |

## 推荐落地顺序

1. **先做 Workflow Recipe。** 这是 DofeAI 相比 gstack 的平台化入口：gstack 靠 slash command，DofeAI 可以靠结构化 contract 和 UI 让团队治理更清楚。
2. **再做 Multi-review Gate。** 当前已有 human gate、rule snapshot、evidence 基础，补 review 槽位成本低，产品价值高。
3. **第三步做 Browser QA Worker。** 这是 gstack 的强差异能力，也是 DofeAI 从“代码工作流”扩展到“产品可用性验证”的关键。
4. **第四步做 Memory。** 先从本项目 Loops evidence 内部检索做起，再考虑外部向量库/GBrain 类能力。

## 实施标注

2026-06-23 再审查确认：Workflow Recipe 已完成 dashboard v1。落点为 `apps/web/app/loops/loops-dashboard-model.ts` 的 `buildWorkflowRecipe`，以及 `apps/web/app/loops/page.tsx` 的 Workflow Recipe 区块；测试覆盖在 `apps/web/app/loops/loops-dashboard-model.test.ts` 与 `apps/web/app/loops/page.test.tsx`。该 v1 是前端派生能力，不改变 API/DB：它把现有 Loop phase、cost guard、pause/global verdict 映射为 Intake / Plan / Build / Review / Browser QA / Ship / Reflect，并显示 gate、blocked、release-ready 和 evidence。

2026-06-23 第二轮再审查确认：Multi-review Gate 已完成 dashboard v1。落点为 `apps/web/app/loops/loops-dashboard-model.ts` 的 `buildReviewGatePortfolio`，以及 `apps/web/app/loops/page.tsx` 的 Review Gates 区块；测试覆盖在同一组 Loops dashboard 模型与页面测试中。该 v1 将现有 Loop phase、global verdict、pause/cost guard 映射为 Product / Architecture / Code / Security gate，用于展示 passed、pending、needs changes、blocked。

2026-06-23 第三轮再审查确认：Release Gate 已完成 dashboard v1。落点为 `apps/web/app/loops/loops-dashboard-model.ts` 的 `buildReleaseReadiness`，以及 `apps/web/app/loops/page.tsx` 的 Release Readiness 区块；测试覆盖在同一组 Loops dashboard 模型与页面测试中。该 v1 基于现有 phase、specVersion、shardsDone/shardsTotal、globalVerdict、paused/cost guard 派生 ready、attention、blocked，并展示 Spec / Implementation / Review / QA checklist。

2026-06-23 第四轮再审查确认：Workflow Recipe / Multi-review Gate / Release Gate 已完成后端结构化 contract + list/detail 派生 v2。落点为 `packages/contracts/src/schemas/loops.schema.ts` 的 `LoopWorkflowRecipeSchema`、`LoopReviewGateSchema`、`LoopReleaseGateSchema` 类型导出，以及 `apps/api/src/modules/loops/loops.service.ts` 的 `withDeliveryControlsList` / `buildDeliveryControls`。当前 v2 对每个 Loop 派生 workflow steps、review gates、release checklist，并明确 runtime owner 只允许 `codex`、`claude-code`、`human`、`system`：Codex 负责规划/审查/发布门禁，Claude Code 负责 implementation。测试覆盖在 `apps/api/src/modules/loops/loops.service.spec.ts`，验证初始 pending 与最终 shipped 两种状态。后续仍需要创建时固化 per-loop snapshot、workspace 默认 recipe 配置、waiver 审计持久化、PR 摘要/canary 和真实发布阻断。

2026-06-23 第五轮再审查确认：Loop Detail 已完成 Delivery Controls v3 展示。落点为 `apps/web/app/loops/[issueId]/page.tsx` 的 Delivery Controls 区块，以及 `apps/web/app/loops/[issueId]/page.test.tsx` 的 contract 展示断言；英中翻译落点为 `apps/web/locales/en/loops.json` 和 `apps/web/locales/zh-CN/loops.json`。当前 v3 在 detail 页展示 workflow timeline、review gates、release checklist、runtime owner、humanGate、findings、blocked reason 和 evidence link count，让后端 contract 不再只停留在 payload。后续仍需要创建时固化历史 snapshot、waiver 审计持久化、PR 摘要/canary 和真实发布阻断。

2026-06-23 第六轮再审查确认：Release Gate 已完成 Dashboard Ready to Ship lane v4。落点为 `apps/web/app/loops/loops-dashboard-model.ts` 的 `readyToShip` board column、`apps/web/app/loops/page.tsx` 的 6 列 Loop Board，以及 `apps/web/app/loops/loops-dashboard-model.test.ts` 的 release candidate 断言；英中翻译落点为 `apps/web/locales/en/loops.json` 和 `apps/web/locales/zh-CN/loops.json`。当前 v4 将 `PHASE_6_CONVERGE` / `PHASE_7_GLOBAL_REVIEW` / `PHASE_8_ANNOTATE` 或 `globalVerdict=PASS` 且未关闭的 Loop 放入 Ready to Ship，关闭/ finalized 后才进入 Delivered。后续仍需要 PR 摘要、canary 和真实发布阻断。

2026-06-23 第七轮再审查确认：Multi-review Gate 已完成 Dashboard Review Inbox gate 聚合 v5。落点为 `apps/web/app/loops/loops-dashboard-model.ts` 的 `gateKind` / `buildReviewInboxGroups`，`apps/web/app/loops/page.tsx` 的 Review Inbox 分组渲染，以及 `apps/web/app/loops/loops-dashboard-model.test.ts` 的 gate 聚合断言；英中翻译落点为 `apps/web/locales/en/loops.json` 和 `apps/web/locales/zh-CN/loops.json`。当前 v5 将人工决策与通知按 product / architecture / code / security / release / exception gate 聚合，帮助 reviewer 先处理异常和关键门禁。后续仍需要持久化 waiver 审计、per-loop required gates，以及 Release Gate 引用持久化 review gate 状态。

2026-06-23 第八轮再审查确认：Release Gate 已完成 PR summary 自动引用 evidence v6。落点为 `apps/api/src/modules/loops/adapters/loops-git-adapter.interface.ts` 的 `evidenceArtifacts` 输入、`apps/api/src/modules/loops/loops.service.ts` 的 finalize 证据传递、`apps/api/src/modules/loops/adapters/cli-loops-git.adapter.ts` 的 `Evidence 摘要` PR body 渲染，以及 `apps/api/src/modules/loops/adapters/cli-loops-git.adapter.spec.ts` 的 present/pending evidence 断言。当前 v6 在收敛 PR 描述中引用已记录的 present evidence artifacts，避免把 pending convergence-pr 自引用写入 PR。后续仍需要 canary、真实发布阻断和持久化 review gate 状态。

2026-06-23 第九轮再审查确认：Runtime Security Gate 已完成 runner shell control operator 阻断 v1。落点为 `apps/api/src/modules/loops/loops-runner.service.ts` 的 `evaluateCommandPolicy`，以及 `apps/api/src/modules/loops/loops-runner.service.spec.ts` 的 allowlisted prefix + shell operator 阻断断言。当前 v1 在测试命令进入 `/bin/sh -lc` 前阻断 `&&`、`||`、`;`、pipe、redirect、backtick、`$(` 和换行等 shell control operators，并把阻断原因写入 `LoopTestRecord.commands[].stderr` 与 failedTests，作为可审计 evidence。后续仍需要 network/write 权限策略、审批流、policy snapshot 持久化和 canary 检测。

2026-06-23 第十轮再审查确认：Workflow Recipe 已完成创建时 per-loop recipe snapshot v4。落点为 `apps/api/src/modules/loops/loops.service.ts` 的 createIssue snapshot 生成、`apps/api/src/modules/loops/loops-file-store.service.ts` 的 `.loops/runs/<issueId>/workflow-recipe.snapshot.json` 写入/读取，以及 `apps/api/src/modules/loops/loops.service.spec.ts` 的 detail 初始态与终态 snapshot 断言。当前 v4 在 Loop 创建时固化 recipe 身份、来源和 capturedAt，Detail 继续用当前状态动态计算步骤状态，但保留 `source=loop-snapshot` 作为审计来源。后续仍需要 workspace 级 feature/bugfix/docs 默认 recipe 配置。

2026-06-23 第十一轮再审查确认：Learning & Decision Memory 已完成 finalize 后 LoopLearning v1。落点为 `packages/contracts/src/schemas/loops.schema.ts` 的 `LoopLearningSchema`、`apps/api/src/modules/loops/loops.service.ts` 的 `buildLoopLearnings`、`apps/api/src/modules/loops/loops-file-store.service.ts` 的 `.loops/learnings/<issueId>.json` / `.md` 写入读取，以及 `apps/api/src/modules/loops/loops.service.spec.ts` 的 detail learning 断言。当前 v1 在 Loop finalize 后从 evidence、review、test command、changed files 和 convergence PR 中沉淀 decision / test_policy / ownership / pitfall learning。后续仍需要新建 Loop 按 repo/source/template 召回相关 learning、Dashboard top/stale learning 展示和跨 Loop 去重。

2026-06-23 第十二轮再审查确认：Learning & Decision Memory 已完成 Loop Detail 可见化 v2。落点为 `apps/web/app/loops/[issueId]/page.tsx` 的 Learning Memory 区块、`apps/web/app/loops/[issueId]/page.test.tsx` 的展示断言，以及 `apps/web/locales/en/loops.json` / `apps/web/locales/zh-CN/loops.json` 的英中翻译。当前 v2 在 detail 页展示 learning 类型、摘要、置信度、证据链接数和 repo 来源，让后端沉淀不再只停留在 payload。后续仍需要新建 Loop 按 repo/source/template 召回相关 learning、Dashboard top/stale learning 展示、跨 Loop 去重和人工 dismiss/merge。

2026-06-23 第十三轮再审查确认：Second Opinion Agent 已完成 report-only v1。落点为 `packages/contracts/src/schemas/loops.schema.ts` 的 `LoopSecondOpinionSchema`、`apps/api/src/modules/loops/loops.service.ts` 的 `buildSecondOpinion` 派生、`apps/web/app/loops/[issueId]/page.tsx` 的 Delivery Controls 二次审查区块，以及 API/contract/detail 页面测试。当前 v1 严格限定 reviewer 归因为 Codex primary 与 Claude Code secondary，展示 agreement/conflict/primary-only/secondary-only 指标，并在 Release Gate checklist 预留 `secondOpinionPassed`；由于 `requiredForRelease=false`，它不会冒充真实二次审查或阻断发布。后续仍需要真实 Claude Code secondary reviewer worker、finding fingerprint 比对、冲突 human gate 和可配置 release hard gate。

2026-06-23 第十四轮再审查确认：Runtime Security Gate 已完成 test command policy snapshot 持久化 v2。落点为 `packages/contracts/src/schemas/loops.schema.ts` 的 `LoopRuntimeSecurityPolicySnapshotSchema`、`apps/api/src/modules/loops/loops-runner.service.ts` 的 `runtimeSecurityPolicy` 写入、`apps/api/src/modules/loops/loops-file-store.service.ts` 的 test record Markdown 渲染，以及 contract/runner 测试。当前 v2 在每次 runner test-command run 中记录 shell allowlist、blocked operators、network deny-by-default、write workspace-scoped 和 override not-supported 状态，和 blocked command evidence 一起持久化。Exception Center 聚合已由第二十五轮补齐，canary 检测已由第十八轮补齐；仍需要真实 network/write 隔离和 human override 审批记录。

2026-06-23 第十五轮再审查确认：Learning & Decision Memory 已完成新建 Loop preview 召回 v3。落点为 `packages/contracts/src/schemas/loops.schema.ts` 的 `LoopWorkspacesResponse.recentLearnings`、`apps/api/src/modules/loops/loops-file-store.service.ts` 的 `readRecentLearnings`、`apps/api/src/modules/loops/loops.service.ts` 的 `listWorkspaces` recent learning 附加，以及 `apps/web/app/loops/new/simple-loop-issue-form.tsx` 的 preview 展示。当前 v3 从 `.loops/learnings/*.json` 读取当前 workspace 的近期 learning，并在新建 Loop preview 中按目标 repo 展示最多 3 条相关 learning，不改变创建 payload。后续仍需要 Dashboard top/stale learning、跨 Loop 去重和人工 dismiss/merge。

2026-06-23 第十六轮再审查确认：Learning & Decision Memory 已完成 Dashboard top/stale learning 展示 v4。落点为 `apps/web/app/loops/page.tsx` 的 Learning Memory 区块、`apps/web/app/loops/page.test.tsx` 的 dashboard 展示断言，以及 `apps/web/locales/en/loops.json` / `apps/web/locales/zh-CN/loops.json` 的英中翻译。当前 v4 复用 `listWorkspaces.recentLearnings`，按 confidence 展示 top learnings，并将未设置 `lastUsedAt` 的条目标为 stale learnings。第十七轮已补人工 dismiss + merge API/file-backed governance 基础；后续仍需要 merge UI、跨 Loop 去重和同类 learning 合并。

2026-06-23 第十七轮再审查确认：Learning & Decision Memory 已完成治理/去重基础 v5。落点为 `packages/contracts/src/schemas/loops.schema.ts` 的 `LoopLearningGovernanceSchema` / `LoopLearningGovernanceRequestSchema`、`packages/contracts/src/api/loops.contract.ts` 的 `governLearning` API、`apps/api/src/modules/loops/loops-file-store.service.ts` 的 `.loops/learning-governance.json` 读写和 `readRecentLearnings` 过滤、`apps/api/src/modules/loops/loops.service.ts` / `loops.controller.ts` 的治理入口，以及 `apps/web/app/loops/page.tsx` 的 stale learning dismiss 操作。当前 v5 支持人工 dismiss，并支持 merge API/file-backed source->target 记录；dismissed learning 和 merged source 不再进入 recent recall。测试覆盖 contract schema、后端 finalize->govern->recall 行为和 dashboard dismiss mutation。merge UI 已由第二十一轮补齐，自动 fingerprint/相似度建议已由第二十四轮补齐；仍需要跨 workspace 去重策略。

2026-06-23 第十八轮再审查确认：Runtime Security Gate 已完成 runtime canary 检测 v3。落点为 `packages/contracts/src/schemas/loops.schema.ts` 的 `LoopRuntimeSecurityPolicySnapshot.canary`、`apps/api/src/modules/loops/loops-runner.service.ts` 的 `LOOPS_RUNTIME_CANARY` env-token 注入、泄露检测和输出脱敏、`apps/api/src/modules/loops/loops-file-store.service.ts` 的 test record Markdown canary 摘要，以及 `apps/api/src/modules/loops/loops-runner.service.spec.ts` / contract schema 测试。当前 v3 在允许命令执行时 armed canary；若 stdout/stderr 泄露 canary，会把命令标记为 `runtime-security:canary` 失败并在持久化前替换为 `[LOOPS_RUNTIME_CANARY_REDACTED]`。Exception Center 聚合已由第二十五轮补齐；后续仍需要真实 network/write sandbox、human override 审批记录和发布 canary。

2026-06-23 第十九轮再审查确认：Browser QA Worker 已完成 report-only v1。落点为 `packages/contracts/src/schemas/loops.schema.ts` 的 `LoopBrowserQaRequestSchema` / `LoopBrowserQaReportSchema`、`packages/contracts/src/api/loops.contract.ts` 的 `runBrowserQa` API、`apps/api/src/modules/loops/loops-browser-qa-worker.service.ts` 的 Playwright CLI worker、`apps/api/src/modules/loops/loops-file-store.service.ts` 的 `.loops/runs/<issueId>/browser-qa/<reportId>.json/.md` 写入读取、`apps/api/src/modules/loops/loops.service.ts` 的 detail/evidence/release gate 集成，以及 API/contract 测试。当前 v1 使用项目现有 web 包的 Playwright CLI 打开目标 URL，采集 title、截图路径、console error 和 4xx/5xx network summary，report-only 写入 evidence；未做 cookie import 或自动修复。前端触发 UI 已由第二十三轮补齐，Playwright trace evidence 已由第二十六轮补齐；仍需要登录态说明/测试账号治理、visual regression、browser handoff 和 QA bug 自动生成 regression test。

2026-06-23 第二十轮再审查确认：Second Opinion Agent 已完成 Claude Code secondary worker v2。落点为 `packages/contracts/src/api/loops.contract.ts` 的 `runSecondOpinion` API、`apps/api/src/modules/loops/loops-second-opinion-worker.service.ts` 的 Claude Code CLI secondary reviewer worker、`apps/api/src/modules/loops/loops-file-store.service.ts` 的 `.loops/runs/<issueId>/second-opinion.json/.md` 写入读取、`apps/api/src/modules/loops/loops.service.ts` 的持久化 second opinion 优先读取和 evidence/release gate 集成，以及 API 测试。当前 v2 使用项目现有 Codex primary / Claude Code secondary 归因：CLI 可用时由 Claude Code 独立输出 JSON review；CLI 不可用或 schema 不符时写入 pending/not_run，不冒充审查通过。finding fingerprint 精确比对已由第二十二轮补齐，前端触发 UI 已由第二十三轮补齐；仍需要 conflict human gate 和可配置 release hard gate。

2026-06-23 第二十一轮再审查确认：Learning & Decision Memory 已完成 Dashboard merge UI v6。落点为 `apps/web/app/loops/page.tsx` 的 stale learning Merge 操作、`apps/web/app/loops/page.test.tsx` 的 merge mutation 断言，以及 `apps/web/locales/en/loops.json` / `apps/web/locales/zh-CN/loops.json` 翻译。当前 v6 在 stale learning 卡片上支持将 source learning 合并到 top learning，调用既有 `governLearning` merge API 并持久化 source->target governance；dismiss/merge 都可从 Dashboard 触发。自动 fingerprint/相似度建议已由第二十四轮补齐；仍需要跨 workspace 去重策略。

2026-06-23 第二十二轮再审查确认：Second Opinion Agent 已完成 finding fingerprint 精确比对 v3。落点为 `packages/contracts/src/schemas/loops.schema.ts` 的 `LoopSecondOpinionFindingSchema`、reviewer `findings` 和 comparison fingerprint 分组，`apps/api/src/modules/loops/loops-second-opinion-comparison.util.ts` 的 fingerprint 规范化/去重/比对，`apps/api/src/modules/loops/loops-second-opinion-worker.service.ts` 的 Claude Code secondary findings 接入，以及 `apps/api/src/modules/loops/loops-file-store.service.ts` 的 second-opinion Markdown fingerprint evidence 渲染。当前 v3 按 fingerprint 标记 agreement、primary-only、secondary-only，并把“同一 fingerprint 但 severity 不一致”标为 conflict；`requiredForRelease=false` 不变，尚未把 conflict 升级为 human gate 或发布硬门禁。测试覆盖 contract schema、comparison 纯函数、API service 和 Web detail fixture。

2026-06-23 第二十三轮再审查确认：Browser QA Worker 已完成 Loop Detail 前端触发 UI v2，Second Opinion Agent 已完成 Loop Detail 前端触发 UI v4。落点为 `apps/web/lib/api/contracts/hooks/loops.ts` 的 `useRunLoopBrowserQa` / `useRunLoopSecondOpinion` mutation hooks、`apps/web/app/loops/[issueId]/use-loop-operations.ts` 的 Browser QA 表单 payload 组装和 Second Opinion mutation 调用、`apps/web/app/loops/[issueId]/page.tsx` 的 Delivery Actions 区块，以及英中翻译。当前 UI 支持输入 target URL、checked flows、notes 触发 report-only Browser QA，并支持触发 Claude Code secondary reviewer；成功后复用现有 issue/list/metrics 缓存失效刷新 detail。当时未做登录态导入、Playwright trace、visual regression、自动修复，也未把 Second Opinion conflict 升级为 human gate 或 release hard gate；其中 Playwright trace 已由第二十六轮补齐。测试覆盖 detail 页面渲染/提交和 `useFormState` mutation payload。

2026-06-23 第二十四轮再审查确认：Learning & Decision Memory 已完成自动 fingerprint/tags + 相似 merge suggestions v7。落点为 `packages/contracts/src/schemas/loops.schema.ts` 的 `LoopLearning.fingerprint/tags/similarLearningIds`、`apps/api/src/modules/loops/loops-learning-memory.util.ts` 的本地 hash/tag/Jaccard-style similarity 计算、`apps/api/src/modules/loops/loops-file-store.service.ts` 的旧 learning 读取时内存态 enrichment 和 Markdown evidence 渲染、`apps/api/src/modules/loops/loops.service.ts` 的 finalize learning enrichment，以及 `apps/web/app/loops/page.tsx` 的 stale learning similarity hint 和建议 merge target 优先级。当前 v7 不引入外部向量库，不自动合并，只为人工 merge 提供可审计建议；仍需要跨 workspace 去重策略、自动合并审批治理和更强的相似度模型。

2026-06-23 第二十五轮再审查确认：Runtime Security Gate 已完成 Dashboard Exception Center 聚合 v4。落点为 `packages/contracts/src/schemas/loops.schema.ts` 的 `LoopRuntimeSecurityExceptionSchema` 和 `LoopIssueListItem.runtimeSecurityExceptions`、`apps/api/src/modules/loops/loops.service.ts` 的 list detail-backed runtime security failedTests 聚合、`apps/web/app/loops/loops-dashboard-model.ts` 的 `runtime-security` Exception Center source，以及 dashboard model/page 测试。当前 v4 将 `runtime-security:*` failedTests 从 test record evidence 提升为列表结构化异常，展示 owner/action/evidence/impact/retryAction；它不提供 human override，也不声明 network/write 已真实隔离。

2026-06-23 第二十六轮再审查确认：Browser QA Worker 已完成 Playwright trace evidence v3。落点为 `packages/contracts/src/schemas/loops.schema.ts` 的 `LoopBrowserQaReport.traces`、`apps/api/src/modules/loops/loops-browser-qa-worker.service.ts` 的 Playwright tracing start/stop、`apps/api/src/modules/loops/loops-file-store.service.ts` 的 `.loops/runs/<issueId>/browser-qa/<reportId>/trace.zip` 路径和 Markdown `Playwright Traces` 渲染，以及 `apps/api/src/modules/loops/loops.service.ts` 的 Browser QA evidence 摘要。当前 v3 在 report-only QA 中采集 screenshot/snapshot/source trace zip，便于后续人工或工具化复盘；仍不处理登录态导入、visual regression、browser handoff 或 QA bug 自动生成 regression test。

2026-06-23 第二十七轮再审查确认：七个 Epic 已完成 Delivery Governance v1 推进。落点为 `packages/contracts/src/schemas/loops.schema.ts` 的 `LoopDeliveryGovernance` / `LoopDeliveryGovernanceRequest`、`packages/contracts/src/api/loops.contract.ts` 的 `governDelivery` API、`apps/api/src/modules/loops/loops-file-store.service.ts` 的 `.loops/runs/<issueId>/delivery-governance.json/.md`、`apps/api/src/modules/loops/loops.service.ts` 的 review gate override、second opinion policy、release canary checklist、runtime override 和 workflow default 派生，以及 `apps/web/app/loops/[issueId]/page.tsx` 的 Delivery Actions 治理控件。当前 v1 支持记录 workflow default、review gate waiver/blocked/passed、Second Opinion requiredForRelease/conflictHumanGate、release canary、runtime override、Browser QA session policy 和 learning policy；它是治理/审计/门禁派生层，不声明已具备真实 network/write sandbox、浏览器 handoff、visual regression 或自动合并 worker。

2026-06-23 第二十八轮再审查确认：Browser QA Worker 已完成 visual regression / browser handoff artifact v5，Learning & Decision Memory 已完成 auto-merge worker v9，Runtime Security Gate 已完成 network/write 命令策略阻断 v6。落点为 `LoopBrowserQaReport.visualDiffs/handoffs`、`apps/api/src/modules/loops/loops-browser-qa-worker.service.ts` 的 baseline screenshot、changed screenshot diff copy 和 handoff JSON 写入、`apps/api/src/modules/loops/loops-file-store.service.ts` 的 Browser QA Markdown visual/handoff 渲染和 `runLearningAutoMergeWorker`、`packages/contracts/src/api/loops.contract.ts` 的 `runLearningAutoMergeWorker` API、`apps/web/app/loops/page.tsx` 的 Learning Memory merge worker 触发，以及 `apps/api/src/modules/loops/loops-runner.service.ts` 的 network tool/package install 与跨 workspace 写入模式阻断。当前 v5/v6/v9 是可执行的 artifact/worker/command-policy 层：会产生 baseline/diff/handoff、pending auto-merge approvals 和 runtime-security failedTests；仍不声明具备 OS/container 级网络隔离、高级像素阈值视觉对比、多 viewport browser handoff 或自动合并免审批落库。

运行时边界标注：本项目底层运行时以 Codex CLI 和 Claude Code CLI 为基础。gstack 的多 host、pair-agent、OpenClaw 等能力仅作为竞品启发，不应直接扩大本项目运行时范围；后续实现应优先围绕 Codex planner/reviewer 与 Claude Code implementer 的双 runtime 编排、门禁和证据归因。

剩余后续 Epic：Browser QA Worker 的真实 authenticated session profile、高级像素阈值/多 viewport visual regression 与 QA bug 自动回归，Learning & Decision Memory 的真实跨 workspace 索引执行和审批 UI，Second Opinion Agent 的冲突 human gate 队列和 release hard gate UI，Runtime Security Gate 的 OS/container 级 network/write 隔离和 override 执行层审批拦截，以及 Release Gate 的 rollback/canary worker 与真实发布阻断仍需要 worker/runtime 执行、审计持久化或更细粒度的 Codex/Claude Code CLI 运行归因，不适合作为本轮结构化 contract 派生能力继续扩张。它们保持为后续 Epic，避免把 gstack 的 slash-command/多宿主能力误实现成本项目的底层运行时范围。

## 文档导航

- [01-product-analysis.md](01-product-analysis.md)：gstack 产品结构、用户心智、能力拆解。
- [02-competitive-matrix.md](02-competitive-matrix.md)：gstack 与 DofeAI、OpenHands、Cline、Aider、Goose、SWE-agent 的矩阵对比。
- [03-optimization-roadmap.md](03-optimization-roadmap.md)：面向本项目的实施路线图和 contract 建议。
- [04-source-notes.md](04-source-notes.md)：事实来源、版本、仓库结构和证据摘录。

## 结论

gstack 证明了一个方向：AI coding 的护城河不是“能不能改代码”，而是“能不能把模糊意图变成可审阅、可验证、可发布、可学习的流程”。DofeAI 已经拥有团队控制面的雏形，应该避开复制 slash command 包，转而把 gstack 的角色化流程、安全门禁、浏览器 QA、记忆沉淀产品化为 Loops 的结构化能力。
