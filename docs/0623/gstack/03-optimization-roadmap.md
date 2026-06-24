# 基于 gstack 的 DofeAI 优化路线图

日期：2026-06-24
适用边界：本项目以 Codex CLI + Claude Code CLI 为底层运行时。gstack 的多 host 能力只作为竞品启发，不作为当前阶段实现目标。

## 总体原则

1. 不复制命令，抽象流程。
2. 不泛化 host，强化 Codex planner/reviewer 与 Claude Code implementer/secondary reviewer 的职责归因。
3. 不只展示状态，沉淀证据。
4. 不只 report-only，关键发布/安全门禁必须能 enforce。
5. 不只做单次任务，把学习、决策、风险和发布结果带到下一次 Loop。

## Epic 1：Workflow Recipe

状态：✅ P2 闭合。已实施 dashboard v1 + 后端 contract/list/detail 派生 v2 + detail Delivery Controls v3 + 创建时 per-loop recipe snapshot v4 + delivery governance workflow default 记录 v5 + Workspace Recipe Admin API/dashboard v8。2026-06-24 复审修正：`GET /loops/workspace-recipes` 已按项目列表契约标准返回 `list/total/page/limit`。

### 背景

gstack 的最大产品资产是 Think -> Plan -> Build -> Review -> Test -> Ship -> Reflect 的流程心智。DofeAI 已经把该心智转成 `LoopWorkflowRecipe`，下一步应让团队可配置、可审计、可量化。

### 已完成

- `LoopWorkflowRecipe` Zod contract 和类型导出。
- 后端 list/detail 派生 workflow steps、runtime owner、humanGate、evidenceIds。
- 创建 Loop 时固化 per-loop recipe snapshot，保留 `source=loop-snapshot`。
- Detail 展示 recipe timeline、当前 gate、runtime owner 和 evidence link count。
- Delivery governance 可记录 feature/bugfix/refactor/docs/ops 的 workflow default recipeId。

### 非阻断增强

- Workspace Recipe Admin 已能查看 workspace recipe defaults；后续可增强为可视化版本 diff、启停步骤与历史版本回滚。
- 新建 Loop 已有 live preview；后续可进一步展示 workspace default recipe 与模板 recipe 的差异。
- Recipe metrics 已有 blocker/usage 基础；cycle time、first-pass、release success rate 可进入长期运营指标，不作为当前 gstack P0/P1/P2 闭环阻断项。

## Epic 2：Multi-review Gate

状态：✅ P1 闭合。已实施 dashboard v1 + 后端 `LoopReviewGate` contract/list/detail 派生 v2 + detail Delivery Controls v3 + Review Inbox gate 聚合 v5 + file-backed gate override/waiver 审计 v6 + per-loop required gates 配置 v7 + Second Opinion conflict queue owner/SLA 展示 v8/v9。

### 背景

gstack 的 `/autoplan` 会串联 CEO、Design、Eng、DX review。DofeAI 已把 review 类型结构化为 product / architecture / design / devex / security / code，并能影响 Release Gate。

### 已完成

- Dashboard 派生 Product / Architecture / Code / Security gate。
- `LoopReviewGate` Zod contract 和类型导出。
- 后端 list/detail payload 派生 gate，并限制 reviewer 为 Codex、Claude Code、human、system。
- Detail 展示 gate 状态、reviewer、findings、waiver reason。
- Review Inbox 按 gate kind 聚合人工决策项。
- Delivery governance 可记录 passed/blocked/waived override。
- Delivery governance 可配置 per-loop required gates，Detail Delivery Controls 提供 required review gates 表单。
- Release Gate 的 `requiredReviewsPassed` 引用持久化 gate 状态。
- Release Gate 只按当前 loop 配置的 required gates 判断 `requiredReviewsPassed`。

### 非阻断增强

- Review Inbox 已展示 Second Opinion conflict owner/SLA；后续可扩展到所有 gate 的批量 waive/assign。
- Design/DevEx gate 已有结构化 gate 位；专门 reviewer 编排可作为更细粒度流程包增强，不阻断当前 P1 闭环。

## Epic 3：Browser QA Worker

状态：✅ P1/P2 闭合。已实施 report-only API + Playwright CLI worker + trace evidence + auth session ref/session policy governance + visualDiffs/handoff artifacts + multi-viewport contract + 逐 viewport worker artifact + pixel-threshold `changedPixels` evidence + Loop Detail QA artifact 摘要。R7 新增 authenticated session profile（cookie/token/header）、ignore regions/dynamic content masks；R8 新增 detail 内嵌 screenshot/trace/diff artifact 预览入口。

### 背景

gstack 的 persistent browser 是强差异能力。DofeAI 要成为交付控制面，必须验证用户可见结果，而不只是验证代码 diff。

### 已完成

- `LoopBrowserQaRequest` / `LoopBrowserQaReport` contract（含 `authSession` 支持 cookie/token/header 三种 authMode）。
- `runBrowserQa` API 和 Loop Detail Delivery Actions 触发 UI。
- Playwright CLI worker 打开目标 URL，采集 title、screenshot、console errors、4xx/5xx network failures。
- 采集 Playwright trace zip，并渲染到 file-backed Markdown evidence。
- 支持 `authSessionRef` 和 Browser QA session policy。
- **R7：Authenticated session profile**：测试账号、cookie/token/header 三种 authMode、`buildContextOptions()` 在 Playwright 脚本中注入登录态。
- 支持 `viewports` contract，并在 report 中记录 viewport identity。
- Browser QA worker 按 viewport 独立生成 screenshot、trace、baseline、diff 和 handoff artifact。
- Browser QA worker 使用 pixel-threshold visual regression 引擎写入 `changedPixels` evidence，并在 Markdown evidence 中展示。
- **R7：Visual regression ignore/mask**：`IgnoreRegion` 区域忽略、`DynamicContentMask` 动态内容 mask、`isPixelIgnored()` 跳过检查。
- 写入 handoff JSON，记录 targetUrl、title、viewport、screenshot、trace、console/network 摘要。
- Loop Detail 展示最新 Browser QA artifact 摘要，包括 screenshot/trace/handoff 数量、visual diff 状态、viewport、changedPixels 和 artifact path。
- **R8：Browser QA embedded preview**：新增 `getBrowserQaArtifact` contract/API/controller/service、file-store 安全路径解析、前端 `getBrowserQaArtifactUrl()` 和 detail 页 visual diff 缩略图预览。
- Release Gate 读取最新 Browser QA report 判断 `browserQaPassed`。

### 非阻断增强

- QA bug regression candidate 可作为后续自动测试生成增强；当前 P1/P2 的 authenticated QA、visual regression、artifact preview 已闭合。

## Epic 4：Learning & Decision Memory

状态：✅ P1 闭合。已实施 finalize 后 LoopLearning、detail/dashboard 展示、新建 preview recall、dismiss/merge/approve-merge/reject-merge/deprecate/supersede governance、similarity suggestions、delivery governance learning policy、auto-merge candidates、dashboard pending approval UI、dashboard supersede UI、aging policy 自动 deprecate、cross-workspace recall 基础、learning governance service、file-backed cross-workspace index worker/API/UI/artifact。R7 新增 DB-backed `LoopLearningRecord` Prisma 模型（含 workspace/repo/lifecycle/confidence/reuseCount/supersede 治理字段及多维度索引）。

### 背景

gstack 的 `/learn` 和 GBrain 强调跨会话复利。DofeAI 的优势是能把 evidence、review、test、PR 和 runtime 结果结构化成团队知识资产。

### 已完成

- Loop finalize 后生成 decision / test_policy / ownership / pitfall learning。
- Loop detail 展示 Learning Memory 摘要、类型、置信度、证据链接数和 repo 来源。
- 新建 Loop preview 按目标 repo 展示 recent learnings。
- Dashboard 展示 top/stale learnings。
- `LoopLearningGovernance` contract 与 `governLearning` API 支持 dismiss/merge/approve-merge/reject-merge/deprecate/supersede。
- `.loops/learning-governance.json` 持久化治理记录，并过滤 dismissed/merged/deprecated/superseded learning。
- 自动生成 fingerprint/tags/similarLearningIds。
- `runLearningAutoMergeWorker` 将 similarity suggestions 固化为 pending approval candidates，并执行 aging policy 自动 deprecate 低置信过期 learning。
- Dashboard Learning Memory 已展示 pending approvals，并可 approve/reject auto-merge candidate；stale learning 可手动 supersede 到更新 learning。
- `readRecentLearnings` 支持在策略触发时进行 cross-workspace recall。
- `LoopsLearningGovernanceService` 提供 cross-workspace index、approval queue、approve/reject/deprecate、aging policy 的服务层基础。
- `runLearningIndexWorker` 已将 active cross-workspace learnings 物化到 `.loops/learnings/cross-workspace-index.json/.md`，contract/API/dashboard 可查看 total/workspaces/repos/duplicateFingerprints/reusable 和 artifact ref。

### 非阻断增强

- DB-backed/global learning index 的 Prisma 模型和生成服务已落地；后续可把 file-backed worker 的读取路径逐步切到 DB 查询与后台重建。
- lifecycle evidence drilldown 与 reuse/conflict/reverted quality metrics 属于治理深水区增强，不阻断当前 P1 闭环。

## Epic 5：Second Opinion Agent

状态：✅ P1 闭合。已实施 report-only contract/detail v1 + Claude Code secondary reviewer worker/file-backed evidence v2 + finding fingerprint 精确比对 v3 + Loop Detail 触发 UI v4 + delivery governance requiredForRelease/conflictHumanGate policy v5 + conflict resolve API/UI operation v6 + resolution evidence 审计 v7 + release hard gate 引用 + Review Inbox conflict queue/SLA/owner 展示 v8 + Loop Detail conflict fingerprint drilldown + 批量 fingerprint resolve v9。R7 新增 DB-backed `LoopSecondOpinionRecord` Prisma 模型（含 findings/comparison/conflicts/resolutions/fingerprint 索引）。

### 背景

gstack 的 `/codex` 用不同模型做独立审查，并对比重叠/差异 findings。DofeAI 当前严格围绕 Codex primary 与 Claude Code secondary 做 reviewer 归因。

### 已完成

- `LoopSecondOpinion` contract 表达 Codex primary、Claude Code secondary、agreement/conflict/primary-only/secondary-only。
- `runSecondOpinion` API 触发 Claude Code secondary reviewer worker。
- Second Opinion 写入 `.loops/runs/<issueId>/second-opinion.json/.md`。
- CLI 不可用或 schema 不符时记录 pending/not_run，不冒充通过。
- finding fingerprint 精确比对，标记 agreement、primary-only、secondary-only、conflict。
- Delivery governance 可配置 `requiredForRelease` 与 `conflictHumanGate`。
- `resolveSecondOpinion` API 支持 accept-primary、accept-secondary、waive、request-changes。
- `resolveSecondOpinion` 支持单个 `findingFingerprint` 和批量 `findingFingerprints`，会逐条写入 `secondOpinionResolutions` 审计记录，并同步更新 code review gate；request-changes 会保持 gate blocked，不会误标为通过。
- `enforceReleaseGate` 在 requiredForRelease 且仍有 unresolved conflict fingerprint 时阻断 finalize。
- Dashboard Review Inbox 独立派生 Second Opinion conflict queue item，展示 owner、age、SLA 和 Resolve 入口。
- Loop Detail 展示 conflict fingerprints drilldown，并可批量 accept primary、accept secondary 或 waive。

### 非阻断增强

- conflict severity/file/runtime/security/release 分类、finding 原文工作台、持久化队列 worker 可作为后续团队运营增强。
- 当前 P1 范围的二次审查记录、fingerprint conflict、批量 resolve、release hard gate 和 DB model 已闭合。

## Epic 6：Release Gate

状态：✅ P0 闭合。已实施 dashboard Release Readiness/Ready to Ship lane + 后端 `LoopReleaseGate` contract/list/detail 派生 + detail checklist + PR summary evidence + file-backed release canary checklist + `runReleaseCanary` API + canary Browser QA evidence 持久化 + 环境 owner/rollback note 控制面 + 高风险 canary 后端阻断 + finalize 前 hard gate enforce。R7 新增 CI/CD health check 集成（`checkDeploymentHealth()` 轮询 /health 端点）。

### 背景

gstack 的 `/ship`、`/land-and-deploy`、`/canary` 把发布变成流程。DofeAI 已经从 readiness dashboard 进入 enforce 阶段。

### 已完成

- Dashboard Release Readiness 和 Ready to Ship lane。
- `LoopReleaseGate` Zod contract 和 checklist。
- 后端 list/detail 派生 spec、implementation、tests、required reviews、Browser QA、PR/rollback/canary checklist。
- Detail 展示 release checklist、blocker 和 evidence link count。
- PR summary 自动引用 present evidence artifacts。
- Delivery governance 可记录 release canary status/targetUrl/environment/environmentOwner/rollbackNote/reason。
- `runReleaseCanary` API 执行 Browser QA subset smoke check，持久化 canary Browser QA report，并记录 canary result。
- `runReleaseCanary` 会追加 deployment health check step，轮询 `/health`、`/api/health`、`/_health`，失败会影响 canary pass 判定。
- canary 会按 Browser QA report status 判定：只有 passed 才通过，failed/blocked 会写入 failed canary governance。
- high risk canary 缺 rollbackNote 或 environmentOwner 时会被后端拒绝。
- `enforceReleaseGate` 在 finalize 前阻断 spec/test/review/second opinion/browser QA/rollback/canary blocker。

### 非阻断增强

- CI/CD provider webhook（GitHub Actions、Vercel、Railway、自定义 webhook）、指标采样和自动 rollback proposal 属于 provider 深度集成，不阻断当前 P0 release gate/canary/health check 闭环。
- Release evidence 已能进入 PR evidence/comment 链路；后续可扩展为 release note 模板。

## Epic 7：Runtime Security Gate

状态：✅ P0 闭合。已实施 runner shell control operator 阻断 + test command policy snapshot + runtime env-token canary 检测/脱敏 + Dashboard Exception Center + file-backed runtime override 审计 + network/write 命令策略阻断 + sandbox profile 类型基础 + sandbox profile allowlist/denylist 实际执行。R7 新增 Docker 容器执行层接入（`runCommandInDocker()`，`sandboxBackend: 'docker'`）。

### 背景

gstack 的 guard/freeze/careful 体现执行前安全。DofeAI 已从展示型 permission 进入 command-policy 和 release blocker 阶段，但还没完成执行环境强约束。

### 已完成

- runner 测试命令执行前阻断 shell control operators。
- runner 每次 test-command run 记录 `LoopRuntimeSecurityPolicySnapshot`。
- file-backed test record Markdown 渲染 runtime security policy。
- 允许命令注入 `LOOPS_RUNTIME_CANARY`，检测 stdout/stderr 泄露并脱敏。
- `runtime-security:*` failedTests 聚合到 Dashboard Exception Center。
- Delivery governance 可记录 runtime override 的 scope、原因、操作者和过期时间。
- 命令进入 shell 前阻断常见 network tools/package install。
- 命令进入 shell 前阻断明显跨 workspace 写入模式。
- runner service 已出现 sandbox profile 类型：network、writeScope、secretMode、blockedNetworkTools、blockedWritePatterns。
- sandbox profile 的 `allowedCommands`、`extraBlockedTools`、`extraBlockedPatterns` 已实际参与命令策略判定，并写入 policy snapshot。
- `shellEnforcement: strict-allowlist` 时会走 Docker sandbox backend，policy snapshot 标记 `sandboxBackend: docker`，并记录 network/write sandbox enforcement。

### 非阻断增强

- Docker backend 已提供 OS/container 级 `--network=none` 与 read-only/cap-drop 执行层；后续可细化 network allowlist 和 writeScope overlay/mount 策略。
- override 执行层审批拦截、secret canary 扩展到 LLM prompt/trace/Browser QA handoff 属于更深层治理增强，不阻断当前 P0 runtime sandbox 闭环。

## Epic 8：Loop Bench 与质量度量

状态：✅ P2 闭合。已完成 dashboard 首版 + file-backed trend snapshot worker。`buildLoopBench` 已从现有 Loop list、release gate、runtime exception、cost 与 learning evidence 派生 7 项质量指标，并在 Loops dashboard 展示；`runLoopBenchTrendWorker` 会将 7 项指标物化到 `.loops/bench-trends/history.json/latest.json/<timestamp>.json`，metrics API 与 dashboard 展示 latest trend、history count、delta 和 artifact ref。R8 新增 workspace/repo/recipe drilldown contract/API/hook/dashboard；2026-06-24 复审确认 dashboard 已读取并展示 drilldown metrics。

### 已实现指标

| 指标                         | 含义                            |
| ---------------------------- | ------------------------------- |
| First-pass review rate       | 首轮 review 通过率              |
| Second opinion conflict rate | 二次审查冲突率                  |
| Browser QA regression rate   | 浏览器 QA 回归失败率            |
| Release blocker rate         | 发布阻断率                      |
| Runtime violation rate       | runtime security 违规率         |
| Learning reuse rate          | learning 被召回并改善结果的比例 |
| Canary pass rate             | canary 首次通过率               |

### 非阻断增强

- Dashboard 已通过 `getLoopBenchDrilldown` 展示 workspace/repo/recipe 维度指标；后续可增强交互筛选联动和更长期 per-period 聚合。
- PR summary 引用关键质量指标、Learning outcome 关联量化可作为后续 release review/运营分析增强。

## 路线图汇总

| 阶段     | 优先事项                                                                                                                  | 结果                                  |
| -------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| R7       | Runtime Security 执行层隔离、Release CI/CD 健康检查、Browser QA auth/ignore-mask、DB-backed learning/second-opinion model | ✅ 已完成                             |
| R8       | Browser QA embedded preview、Workspace Recipe Admin、Loop Bench workspace/repo/recipe drilldown                           | ✅ 已完成                             |
| 后续增强 | Provider webhook、自动 rollback proposal、finding/evidence 工作台、长期质量运营指标                                       | 非阻断，超出当前 gstack P0/P1/P2 闭环 |

## 不建议立即做

- 不建议复刻 gstack 54 个技能；会制造维护负担。
- 不建议把底层运行时泛化为所有 host；当前应坚持 Codex CLI + Claude Code CLI。
- 不建议用个人 cookie import 做 Browser QA 登录态；应使用测试账号/session ref。
- 不建议让 auto-merge learning 自动生效；必须有审批和生命周期。
- 不建议只靠前端状态派生标记 worker/runtime 能力完成。
