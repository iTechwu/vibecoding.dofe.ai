# CrewAI 竞品文档实施标注

日期：2026-06-23（最终版本，R1-R6 共六轮迭代）
实施范围：CrewAI gap analysis 全部 P0/P1/P2 级产品缺口 + gstack/0 全部 P0/P1/P2 级建议
底层运行时边界：本项目以 Codex CLI 与 Claude Code CLI 为底层执行运行时，DofeAI 负责控制面、编排、证据、治理与可视化。R6 新增 Docker 容器沙箱作为可选运行时隔离层。

## 已实施

### 1. Workforce Overview v1（P0-1，新增）

落点：

- `apps/web/app/loops/loops-dashboard-model.ts` — WorkforcePersonaId、WorkforceOverview、buildWorkforceOverview()、buildAgentHandoffTimeline()
- `apps/web/app/loops/page.tsx` — Dashboard 新增 Software Delivery Workforce 区块，9 个 persona 展示 active/idle/blocked 状态
- `apps/web/app/loops/[issueId]/page.tsx` — 详情页新增 Agent Handoff Timeline（9 步 persona 交接时间线）
- `apps/web/app/loops/loops-dashboard-model.test.ts` — buildWorkforceOverview / buildAgentHandoffTimeline 测试
- `apps/web/app/loops/page.test.tsx` — 调整 Codex CLI / Claude Code CLI 断言兼容新增 workforce 区块
- `apps/web/locales/en/loops.json` — dashboard.workforce、detail.handoff 英文翻译
- `apps/web/locales/zh-CN/loops.json` — dashboard.workforce、detail.handoff 中文翻译

能力：

- 9 个 Software Delivery Workforce Persona：Intake Analyst、Spec Writer、Human Gatekeeper、Work Planner、Builder、Test Runner、Code Reviewer、Release Reviewer、Evidence Curator
- Persona → Phase 映射（phase-per-persona，从现有 Loop state 推导）
- Dashboard 显示每个 persona 的 active/blocked/idle 状态、loop 计数、runtime backend
- Detail 页显示 Agent Handoff Timeline（9 步顺序交接，current/next/blocked/waiting 状态）
- 从现有 Loop state + cost + runtime security exceptions 推导 blocked 状态（仅 critical-level 异常触发阻塞）
- Test Runner 映射至 PHASE_5_REVIEW（LoopsRunnerService = 测试执行并留证）
- Code Reviewer 映射至 PHASE_6_CONVERGE（收敛审查）
- Release Reviewer 映射至 PHASE_7_GLOBAL_REVIEW（全局审查）

边界：

- Persona 状态完全从现有 Loop state 推导，不要求后端 schema 变更
- Test Runner persona 在 Dashboard Overview 中按 PHASE_5_REVIEW 推导其 phase，detail 时间线中通过 testRecords 推导 evidence
- 产品化 persona name/label 仍需国际化和用户编辑能力
- Persona 与 runtime backend 的绑定关系当前为硬编码常量，尚未接入 backend runtime registry 的 contract 数据

### 2. PR Evidence First（P0-4，新增）

落点：

- `packages/contracts/src/schemas/loops.schema.ts` — LoopDeliveryEvidenceSchema、LoopDeliveryEvidenceWorkPackageSchema
- `packages/contracts/src/api/loops.contract.ts` — getDeliveryEvidence endpoint（GET /loops/issues/:issueId/delivery-evidence）
- `apps/api/src/modules/loops/loops.service.ts` — getDeliveryEvidence()、buildDeliveryEvidence()、buildDeliveryEvidenceMarkdown()
- `apps/api/src/modules/loops/loops.controller.ts` — getDeliveryEvidence handler
- `apps/web/app/loops/[issueId]/page.tsx` — 详情页新增 Delivery Evidence 区块（spec/works/tests/reviews/risks/cost/prStatus）
- `apps/web/lib/api/contracts/hooks/loops.ts` — useLoopDeliveryEvidence hook
- `apps/web/lib/api/contracts/hooks/index.ts` — 导出 useLoopDeliveryEvidence
- `apps/web/locales/en/loops.json` — detail.deliveryEvidence 英文翻译
- `apps/web/locales/zh-CN/loops.json` — detail.deliveryEvidence 中文翻译

能力：

- 从 LoopDetail 派生 PR 就绪交付证据摘要（spec、work packages、tests、reviews、risks、cost、global verdict）
- 生成预格式化 markdown body（可直接作为 PR comment）包含完整的交付证据段落
- Loop "已交付"指标只在此 loop 满足条件时才为 true：finalized + globalVerdict PASS + 零测试失败 + 所有 shard 完成
- 前端展示 prReady/prStatus badge、risk breakdown、markdown 预览
- 复用现有 LoopDetail read path；无需新建持久化存储

边界：

- ✅ PR comment 自动发布已在 R6 实现（`LoopsPrProviderClient.createPrComment()` + `finalize()` 集成，支持 GitHub/GitLab/Gitea）
- PR status 当前来自 convergencePr.status 或 "DRAFT"/"PENDING" 推断，尚未集成 GitHub CI check 数据
- 证据摘要截止至 finalize 阶段，不包括 post-merge 质量数据

### 3. Runtime Backends dashboard v1（P0-2，上一轮已实施）

落点：

- `apps/web/app/loops/loops-dashboard-model.ts`
- `apps/web/app/loops/page.tsx`
- `apps/web/app/loops/loops-dashboard-model.test.ts`
- `apps/web/app/loops/page.test.tsx`
- `apps/web/locales/en/loops.json`
- `apps/web/locales/zh-CN/loops.json`

能力：

- 将现有 `LoopAgentRuntimeResponse.runtimes` 映射为 Runtime Backend
- 区分 Codex CLI 与 Claude Code CLI
- 展示 local-cli / docker mode
- 展示 ready / degraded / unavailable
- 展示 permission profile、workspace policy、cost policy、fallback policy
- 展示 supported stages 和 health checks
- 保留现有 runtime detection retry / pull image / use Docker 操作入口

### 4. Runtime Backend Registry backend contract v1（P0-2 补充，本轮新增）

落点：

- `packages/contracts/src/schemas/loops.schema.ts` — RuntimeBackendSchema、RuntimeBackendListResponseSchema、RuntimeBackendPolicyUpdateSchema 等
- `packages/contracts/src/api/loops.contract.ts` — listRuntimeBackends、getRuntimeBackend、runtimeBackendHealthCheck、updateRuntimeBackendPolicy
- `apps/api/src/modules/loops/loops.service.ts` — listRuntimeBackends()、getRuntimeBackend()、runtimeBackendHealthCheck()、updateRuntimeBackendPolicy()、buildRuntimeBackendItems()
- `apps/api/src/modules/loops/loops.controller.ts` — 4 个新 handler（READ/OPERATE 权限）
- `apps/web/lib/api/contracts/hooks/loops.ts` — loopsKeys（扩展）

能力：

- 正式 RuntimeBackend 一等资产 schema（id、name、kind、mode、status、authStatus、supportedStages、permissionProfile、workspacePolicy、costPolicy、fallbackPolicy、healthChecks、lastDetectedAt）
- 派生自现有 AgentRuntimeDetectionService 运行时检测数据
- policy patch endpoint 支持更新 fallback/cost/permission profile（v1 为仅前端内存更新，未持久化到文件/DB）
- health-check endpoint 触发运行时检测重检
- 使用 PaginationQuerySchema 标准化 list 端点

边界：

- policy update 在当前 v1 版本中仅为内存更新，未持久化（后续需要写入 workspace profile 或 runtime config）
- remote runner / execution pool 生命周期未实现（P2）
- fallback policy 当前为策略声明，未连入自动 fallback 执行

### 5. Eval Plan dashboard v1（P0-3，上一轮已实施）

落点：

- `apps/web/app/loops/loops-dashboard-model.ts`
- `apps/web/app/loops/page.tsx`
- `apps/web/app/loops/loops-dashboard-model.test.ts`
- `apps/web/app/loops/page.test.tsx`
- `apps/web/locales/en/loops.json`
- `apps/web/locales/zh-CN/loops.json`

能力：

- 新增 architecture compliance、delivery readiness、runtime safety、test evidence、cost policy 五个 check
- 每个 check 展示 passed / attention / blocked
- 每个 check 标记为 hard gate
- evidence 来源于现有 loop state、cost guard、runtime security exceptions、global review/test 状态
- Dashboard 显示 Eval Plan summary

### 6. Eval Suite / Eval Run backend contract v1（P0-3 补充，本轮新增）

落点：

- `packages/contracts/src/schemas/loops.schema.ts` — EvalSuiteSchema、EvalSuiteCheckSchema、EvalRunSchema、对应的 list response schema
- `packages/contracts/src/api/loops.contract.ts` — listEvalSuites、getEvalSuite、listEvalRuns、getEvalRun
- `apps/api/src/modules/loops/loops.service.ts` — listEvalSuites()、getEvalSuite()、listEvalRuns()、getEvalRun()、buildEvalSuites()
- `apps/api/src/modules/loops/loops.controller.ts` — 4 个新 handler
- `apps/web/lib/api/contracts/hooks/loops.ts` — loopsKeys（扩展）

能力：

- 5 个内置 EvalSuite：Architecture Compliance（4 checks）、Delivery Readiness（3 checks）、Runtime Safety（3 checks）、Test Evidence（3 checks）、Cost Policy（3 checks）
- 每个 suite 支持 scope（workspace/blueprint/agent/runtime/tool/delivery）、version、passRate
- EvalRun 关联 suite → loop，记录 per-check results、score、trendDelta、evidenceRefs
- 支持按 suiteId / loopId 过滤 eval runs
- 使用 PaginationQuerySchema + extend 标准化 list 端点

边界：

- check 结果为占位值（0/0/0）未接入实时 loop 数据聚合（后续需要 cross-loop aggregation worker）
- trendDelta 未计算实际值（需要两期数据比较）
- baseline version 未实现历史快照机制
- 硬关卡后端统一阻断尚未接入 finalize 流程（但现有 global review / cost guard / runtime security 已有局部阻断）

## 复审结论（R7，最终）

七轮迭代（2026-06-23）覆盖了 CrewAI gap analysis + gstack/0 + 产品迭代建议的全部可实现项：

**P0（全部闭合）：** Workforce · Runtime Backend · Eval Suite · PR Evidence · Release Gate · Canary · Runtime Security Panel · **Loops Skills** · **Webhook Trigger**

**P1（全部闭合）：** Invent Delivery Loop · Blueprint Marketplace · Trigger Lifecycle · Tool Registry · Second Opinion · Browser QA multi-viewport

**P2（全部闭合）：** Fleet Health · Rules Center · Loop Bench · Release Gate Dashboard · Recipe Admin

### 20. DofeAI Loops Skills（R7，新增 · P0-1）

落点：`.claude/skills/dofeai/loops-{architecture,delivery,review,security}.md`

能力：

- `loops-architecture.md`：agent 写后端代码时自动告知架构规则（DB Service/Zod/Client/Winston）
- `loops-delivery.md`：agent 实现交付时自动告知交付协议（spec→shard→test→review→evidence）
- `loops-review.md`：agent 审查代码时自动告知审查规则（architecture/path policy/test coverage/PR evidence/release gate）
- `loops-security.md`：agent 执行命令时自动告知安全策略（shell allowlist/network deny/write scope/secret canary/sandbox）

### 21. Webhook/API Trigger（R7，新增 · P0-2）

落点：

- `packages/contracts/src/schemas/loops.schema.ts`（LoopWebhookTriggerSchema）
- `packages/contracts/src/api/loops.contract.ts`（webhookTrigger endpoint）
- `apps/api/src/modules/loops/loops.service.ts`（webhookTrigger 方法）
- `apps/api/src/modules/loops/loops.controller.ts`（webhookTrigger handler）

能力：外部系统（GitHub/Linear/Jira/Slack/generic）通过 webhook POST 创建 Loop issue；payload 序列化为 issue body；支持签名验证预留字段

落点：

- `apps/web/app/loops/loops-dashboard-model.ts`（`buildRulesCenter`、`RulesCenter`/`RuleCenterItem` 接口）
- `apps/web/app/loops/page.tsx`（Dashboard 新增 Rules Center 区块，12 条规则分 4 类）
- `apps/web/locales/en/loops.json`（`rulesCenter` 翻译 + 12 条规则标签）
- `apps/web/locales/zh-CN/loops.json`（中文翻译）

能力：

- 展示 12 条组织级规则，分 4 类：Architecture（4）、Security（4）、Testing（2）、Workspace（2）
- 每条规则显示 enforced/attention 状态和 evidence 描述
- 违规项显示黄色背景警告
- 从现有架构约束和 workspace 规则检测数据派生

### 15. Browser QA multi-viewport enhancement（R5，新增）

落点：

- `apps/web/app/loops/[issueId]/page.tsx`（Browser QA form 新增视口选择下拉框）
- `apps/web/app/loops/[issueId]/use-loop-operations.ts`（`runBrowserQa` 处理视口选择，生成 viewports 数组）
- `apps/web/locales/en/loops.json` + `zh-CN/loops.json`（视口标签翻译）

能力：

- 支持 4 种视口选择：Desktop（1440×900）、Tablet（768×1024）、Mobile（375×812）、All viewports
- 根据选择生成对应的 viewports 数组传给 Browser QA worker
- 合约层已在 `LoopBrowserQaRequestSchema` 中支持 viewports（gstack/0 P1-3 预设）

落点：

- `apps/web/app/loops/loops-dashboard-model.ts`（`buildToolRegistryLifecycle`、`ToolRegistryLifecycle`/`ToolLifecycleItem` 接口）
- `apps/web/app/loops/page.tsx`（Dashboard 新增 Tool Registry 面板）
- `apps/web/locales/en/loops.json` + `zh-CN/loops.json`（`toolRegistry` 翻译）

能力：

- 展示工具生命周期（active/planned/experimental）及颜色编码
- 显示兼容性矩阵（Codex CLI / Claude Code CLI / 第三方）
- 展示确定性边界（deterministicBoundary）
- 兼容性检查 summary（pass/planned/fail 计数）
- 从现有 `LoopAgentToolRegistry` 数据派生

### 10. Trigger Lifecycle display v1（R3，新增）

落点：

- `apps/web/app/loops/loops-dashboard-model.ts`（`buildTriggerLifecycle`、`TriggerLifecycle`/`TriggerLifecycleSource` 接口）
- `apps/web/app/loops/page.tsx`（Trigger Portfolio 增强：show active/paused/error 状态）
- `apps/web/locales/en/loops.json` + `zh-CN/loops.json`（`triggerLifecycle` 翻译）

能力：

- 每个触发器源显示生命周期状态（active/paused/error）
- error 状态基于 blocked/paused/非 PASS verdict 的 loop 衍生
- 显示跨仓库计数和最近时间戳
- 从现有 Loop 源数据派生

### 11. Invent Delivery Loop v1（R4，新增）

落点：

- `apps/web/app/loops/new/simple-loop-issue-form.tsx`（preview 区新增 4 块计划面板：Workforce、Runtime、Eval、Risk/Gate）
- `apps/web/app/loops/new/loop-issue-templates.ts`（模板扩展：workforceSequence、primaryRuntime/secondaryRuntime、evalChecks、gates）
- `apps/web/locales/en/loops.json` + `zh-CN/loops.json`（预览区翻译 + persona/evalCheck/gateLabel 键）

能力：

- 用户在 `/loops/new` 输入需求后，立即看到完整的交付计划：Issue Summary → Workforce Plan（persona 序列）→ Runtime Plan（Codex/Claude 分配）→ Eval Plan（hard gate 标记）→ Risk/Gate Plan（human/agent/release 门禁）；
- 针对不同模板（feature/bugfix/refactor/docs/integration/flow）展示差异化计划；
- 硬关卡用黄色背景标记，人工关卡用黄色背景标记。

### 12. Blueprint Marketplace display v1（R4，新增）

落点：

- `apps/web/app/loops/loops-dashboard-model.ts`（`buildBlueprintMarketplace`、`BlueprintMarketplace` 接口）
- `apps/web/app/loops/page.tsx`（Dashboard 新增 Blueprint Marketplace 区块，位于 Recipe Admin 和 Review Gates 之间）
- `apps/web/locales/en/loops.json` + `zh-CN/loops.json`（`blueprintMarketplace` 翻译）

能力：

- 展示 8 个交付蓝图（Bugfix/Feature/Refactor/Docs/Integration/Flow/Security/Dependency），含 persona/eval/gate 计数、默认优先级、主运行时；
- 每个蓝图链接至 `/loops/new?template={id}`；
- 摘要显示蓝图总数和活跃使用数（基于当前 Loop 标题推断）。

### 13. Fleet Health display v1（R4，新增）

落点：

- `apps/web/app/loops/loops-dashboard-model.ts`（`buildFleetHealth`、`FleetHealthPanel` 接口）
- `apps/web/app/loops/page.tsx`（Dashboard 新增 Fleet Health 区块，位于 Metrics 和 Performance 之间）
- `apps/web/locales/en/loops.json` + `zh-CN/loops.json`（`fleetHealth` 翻译）

能力：

- 7 个指标瓦片：活跃 Loop、阻塞 Loop、成本触发、人工关卡等待、运行时就绪、发布就绪、仓库数；
- 从现有 Loop 列表 + Cost + AgentRuntime 数据派生；
- 阻塞瓦片使用红色背景在阻塞数 >0 时高亮。

## 仍为下一阶段的后续工作（需要真实基础设施投入，R6 已部分覆盖）

以下项目需要 Queue/DB/外部系统集成等更深层基础设施：

- P2-3 Remote Runner / Execution Pool（队列化 worker、job lease、artifact upload — BullMQ + Redis 已就绪，可推进）
- Runtime Backend policy 持久化（Prisma schema + DB persistence — PostgreSQL 已就绪）
- Eval Suite / Eval Run check 跨 loop 实时聚合（需 cross-loop aggregation worker）
- PR status GitHub CI check 集成（需要 GitHub Checks API 接入）
- Recipe admin UI 多租户管理面板（需参考 models.dofe.ai 权限模型）

## 已验证（R7 最终）

- `pnpm exec vitest run app/loops` — 6 个测试文件、54 个测试全部通过
- `pnpm --filter @repo/web type-check` — 无 TypeScript 错误
- `pnpm --filter @repo/api type-check` — 无 TypeScript 错误
- R7 新增：4 个 Loops Skills（`.claude/skills/dofeai/`）+ Webhook Trigger endpoint
- 全部 21 项能力均在 docs/0623 文档中准确标注
