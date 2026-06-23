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

| 优先级 | 建议                                                                     | 验收                                                                                                                                                                                                                            |
| ------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0     | Loop Workflow Recipe：把当前 phase/mode/rule snapshot 映射为可配置工作流 | 已实施 v3：dashboard v1 + 后端 `LoopWorkflowRecipe` contract/list/detail 派生 + detail 页 Delivery Controls 工作流时间线；后续仍需创建时 per-loop recipe snapshot 与 workspace 默认配置 |
| P0     | Multi-review Gate：引入 CEO/Design/Eng/DX/Security review 槽位           | 已实施 v3：dashboard v1 + 后端 `LoopReviewGate` contract/list/detail 派生 + detail 页 Product / Architecture / Code / Security gates 展示；后续仍需持久化 waiver 审计和 per-loop required gates   |
| P1     | Browser QA Worker：为 Loops 增加真实浏览器检查能力                       | 支持 staging URL、登录态说明、截图、console/network summary、bug evidence                                                                                                                                                       |
| P1     | Learning & Decision Memory：把 evidence/trace/review 变成可检索资产      | 新增 loop learnings、decision log、failure pattern；后续 Loop 创建时可召回                                                                                                                                                      |
| P1     | Second Opinion Agent：结构化接入 Codex/Claude 双模型审查                 | review evidence 能区分 primary/secondary reviewer、重叠 findings、冲突 findings                                                                                                                                                 |
| P1     | Release Gate：从“任务完成”升级为“可发布”                                 | 已实施 v3：dashboard v1 + 后端 `LoopReleaseGate` contract/list/detail 派生 + detail 页 release checklist 展示；后续仍需 PR 摘要、canary 与真实发布阻断                        |
| P1     | Runtime Security Gate：把权限画像从展示升级为执行约束                    | shell/network/write 权限有策略、审批、阻断和审计记录                                                                                                                                                                            |
| P2     | Team Workflow Pack：将团队推荐流程写入 repo 可版本化配置                 | 可导入/导出 workflow pack；和 AGENTS.md/CLAUDE.md 规则形成双向校验                                                                                                                                                              |

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

运行时边界标注：本项目底层运行时以 Codex CLI 和 Claude Code CLI 为基础。gstack 的多 host、pair-agent、OpenClaw 等能力仅作为竞品启发，不应直接扩大本项目运行时范围；后续实现应优先围绕 Codex planner/reviewer 与 Claude Code implementer 的双 runtime 编排、门禁和证据归因。

剩余后续 Epic：Browser QA Worker、Learning & Decision Memory、Second Opinion Agent、Runtime Security Gate 仍需要 worker/runtime 执行、审计持久化或更细粒度的 Codex/Claude Code CLI 运行归因，不适合作为本轮结构化 contract 派生能力继续扩张。它们保持为后续 Epic，避免把 gstack 的 slash-command/多宿主能力误实现成本项目的底层运行时范围。

## 文档导航

- [01-product-analysis.md](01-product-analysis.md)：gstack 产品结构、用户心智、能力拆解。
- [02-competitive-matrix.md](02-competitive-matrix.md)：gstack 与 DofeAI、OpenHands、Cline、Aider、Goose、SWE-agent 的矩阵对比。
- [03-optimization-roadmap.md](03-optimization-roadmap.md)：面向本项目的实施路线图和 contract 建议。
- [04-source-notes.md](04-source-notes.md)：事实来源、版本、仓库结构和证据摘录。

## 结论

gstack 证明了一个方向：AI coding 的护城河不是“能不能改代码”，而是“能不能把模糊意图变成可审阅、可验证、可发布、可学习的流程”。DofeAI 已经拥有团队控制面的雏形，应该避开复制 slash command 包，转而把 gstack 的角色化流程、安全门禁、浏览器 QA、记忆沉淀产品化为 Loops 的结构化能力。
