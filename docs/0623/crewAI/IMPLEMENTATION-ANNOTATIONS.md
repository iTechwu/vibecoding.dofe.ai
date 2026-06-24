# CrewAI 竞品文档实施标注

日期：2026-06-24（R32 复审标注）
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
- policy patch endpoint 支持更新 fallback/cost/permission profile；R11 已持久化到 `.loops/runtime-backend-policies.json`
- health-check endpoint 触发运行时检测重检
- 使用 PaginationQuerySchema 标准化 list 端点

边界：

- policy update 已有 file-backed fallback；R16 已补齐 DB 级 policy persistence
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

### 6. Eval Suite / Eval Run backend contract v1（P0-3 补充，本轮新增；R13 已增强）

落点：

- `packages/contracts/src/schemas/loops.schema.ts` — EvalSuiteSchema、EvalSuiteCheckSchema、EvalRunSchema、对应的 list response schema
- `packages/contracts/src/api/loops.contract.ts` — listEvalSuites、getEvalSuite、listEvalRuns、getEvalRun
- `apps/api/src/modules/loops/loops.service.ts` — listEvalSuites()、getEvalSuite()、listEvalRuns()、getEvalRun()、buildEvalSuites()、collectEvalEvidence()
- `apps/api/src/modules/loops/loops.controller.ts` — 4 个新 handler
- `apps/web/lib/api/contracts/hooks/loops.ts` — loopsKeys（扩展）

能力：

- 5 个内置 EvalSuite：Architecture Compliance（4 checks）、Delivery Readiness（3 checks）、Runtime Safety（3 checks）、Test Evidence（3 checks）、Cost Policy（3 checks）
- 每个 suite 支持 scope（workspace/blueprint/agent/runtime/tool/delivery）、version、passRate
- EvalRun 关联 suite → loop，记录 per-check results、score、trendDelta、evidenceRefs
- 支持按 suiteId / loopId 过滤 eval runs
- 使用 PaginationQuerySchema + extend 标准化 list 端点
- R13 已将 suite/check 结果从现有 Loop evidence 同步派生：global verdict、spec approval、convergence PR、runtime security policy、test record、coverage、cost guard、implementation duration 等都会进入 passCount / failCount / blockedCount。
- R13 已将 EvalRun 的 per-loop checkResults 与 score 从同一套证据计算，避免 suite 列表和 run 明细口径不一致。

边界：

- v1 是 request-time 同步派生聚合，不是后台实时 aggregation worker；大规模跨租户趋势仍需独立 worker/索引。
- R19 已补齐 trendDelta、baselineScore、baselineVersion 的历史快照计算。
- 跨 blueprint 的 Eval historical baseline version 已通过 `.loops/eval-trends/history.json` 物化；跨租户长期归档仍是后续。
- ✅ 硬关卡后端统一阻断已接入 finalize 流程（`enforceReleaseGate()` 在 `finalize()` 前检查 8 项 checklist，阻断时抛出 BadRequestException）

### 52. Schedule Trigger Backend v1（R30c，新增 · P1-3）

落点：

- `packages/contracts/src/schemas/loops.schema.ts` — `LoopScheduleTriggerSchema`、`CreateScheduleTriggerRequestSchema`、`UpdateScheduleTriggerRequestSchema`、`LoopScheduleTriggerListResponseSchema`
- `packages/contracts/src/api/loops.contract.ts` — `listScheduleTriggers`、`getScheduleTrigger`、`createScheduleTrigger`、`updateScheduleTrigger`、`deleteScheduleTrigger` 共 5 个端点
- `apps/api/src/modules/loops/loops.service.ts` — `listScheduleTriggers()`、`getScheduleTrigger()`、`createScheduleTrigger()`、`updateScheduleTrigger()`、`deleteScheduleTrigger()`、`computeNextCronTime()`、`computeRetryBackoff()`
- `apps/api/src/modules/loops/loops.controller.ts` — 5 个新 handler（对应 READ/CREATE/OPERATE/ADMIN 权限）
- `apps/api/src/modules/loops/loops-file-store.service.ts` — schedule trigger CRUD 文件态持久化（`.loops/triggers/schedules/`）

能力：

- 支持 cron-based 定时创建 Loop（daily/weekly/custom 表达式）
- 每个 schedule trigger 包含模板 title、body、priority、acceptanceCriteria、targetRepo
- 支持 active/paused/error 生命周期状态
- 支持 nextRunAt 推导（简单 cron 解析）
- 支持 maxFailures 熔断保护
- 所有写操作进入 audit log

边界：

- v1 cron 解析仅支持简单 daily/weekly 表达式，复杂 cron 仍需后续完善
- schedule trigger 执行需外部 scheduler 轮询或 cron-job 触发
- 不包含分布式锁（单节点 v1）

### 53. Trigger Lifecycle Management v1（R30c，新增 · P1-3）

落点：

- `packages/contracts/src/schemas/loops.schema.ts` — `LoopTriggerExecutionSchema`、`LoopTriggerRetryRequestSchema`、`LoopTriggerReplayRequestSchema`、`LoopTriggerDeadLetterSchema` 及 list response schema
- `packages/contracts/src/api/loops.contract.ts` — `listTriggerExecutions`、`retryTriggerExecution`、`replayTriggerExecution`、`listDeadLetters` 共 4 个端点
- `apps/api/src/modules/loops/loops.service.ts` — `listTriggerExecutions()`、`retryTriggerExecution()`、`replayTriggerExecution()`、`listDeadLetters()`
- `apps/api/src/modules/loops/loops.controller.ts` — 4 个新 handler（对应 READ/OPERATE 权限）
- `apps/api/src/modules/loops/loops-file-store.service.ts` — trigger execution 持久化、dead-letter queue 管理（`.loops/triggers/executions/`、`.loops/triggers/dead-letters/`）

能力：

- 追踪 trigger execution 的完整生命周期（pending → running → completed/failed/dead_lettered）
- retry 支持指数退避（2^attempt 分钟，max 60 分钟）
- maxRetries 耗尽后自动进入 dead-letter queue
- replay 基于原始 execution 创建新的 pending execution
- dead-letter list 支持分页查询，便于运维审查

边界：

- v1 为文件态 control plane，不包含真实 message queue 集成
- retry 不自动触发执行，需要外部 worker 轮询 pending executions
- 跨租户 dead-letter 聚合和告警仍待后续

### 54. Tool Registry Backend v1（R31a，新增 · P1-4）

落点：

- `packages/contracts/src/schemas/loops.schema.ts` — `LoopToolSchema`、`RegisterToolRequestSchema`、`UpdateToolRequestSchema`、`LoopToolListResponseSchema`、`ToolHealthCheckResponseSchema`、`ToolTestResponseSchema`
- `packages/contracts/src/api/loops.contract.ts` — `listTools`、`getTool`、`registerTool`、`updateTool`、`toolHealthCheck`、`testTool` 共 6 个端点
- `apps/api/src/modules/loops/loops.service.ts` — `listTools()`、`getTool()`、`registerTool()`、`updateTool()`、`toolHealthCheck()`、`testTool()`
- `apps/api/src/modules/loops/loops.controller.ts` — 6 个新 handler（READ/CREATE/OPERATE 权限 + audit log）
- `apps/api/src/modules/loops/loops-file-store.service.ts` — tool CRUD 文件态持久化（`.loops/tools/`）
- `apps/web/lib/api/contracts/hooks/loops.ts` — `useLoopsTools()` hook

能力：

- Tool 从只读 capability registry 升级为可治理的注册表：register/update/health-check/test
- 每个 tool 包含完整 lifecycle（active/planned/experimental/deprecated）、auth 配置、permissions、compatibility 矩阵、health 状态
- 7 个 tool category：repo/build/qa/collaboration/runtime/security/custom
- 所有写操作进入 audit log
- 与现有前端 `buildToolRegistryLifecycle()` 数据模型兼容

边界：

- v1 testTool 是控制面 smoke test，不执行真实 tool invocation（需 provider/client 层集成）

### 55. Delivery Blueprint Marketplace Backend v1（R31b，新增 · P1-2）

落点：

- `packages/contracts/src/schemas/loops.schema.ts` — `LoopBlueprintSchema`、`CreateBlueprintRequestSchema`、`UpdateBlueprintRequestSchema`、`LoopBlueprintListResponseSchema`
- `packages/contracts/src/api/loops.contract.ts` — `listBlueprints`、`getBlueprint`、`createBlueprint`、`updateBlueprint` 共 4 个端点
- `apps/api/src/modules/loops/loops.service.ts` — `listBlueprints()`、`getBlueprint()`、`createBlueprint()`、`updateBlueprint()`、`seedDefaultBlueprints()`
- `apps/api/src/modules/loops/loops.controller.ts` — 4 个新 handler（READ/CREATE/OPERATE 权限 + audit log）
- `apps/api/src/modules/loops/loops-file-store.service.ts` — blueprint CRUD 文件态持久化（`.loops/blueprints/`）
- `apps/web/lib/api/contracts/hooks/loops.ts` — `useLoopsBlueprints()` hook

能力：

- 8 个内置 delivery blueprint（bugfix/feature/refactor/docs/integration/flow/security/dependency），首次 list 时自动 seed
- 每个 blueprint 包含 personaSequence、evalSuiteId、gateProfile（human/agent/release）、runtimePolicy（primary/fallback）、evidenceTemplate
- 版本化（1.0.0）+ active/inactive 生命周期
- 与现有前端 `buildBlueprintMarketplace()` 数据模型兼容
- 所有写操作进入 audit log

边界：

- v1 为文件态 persistence；跨租户共享、clone、version rollback 仍待推进

### 56. Rules Center Enforcement v1（R32a，新增 · P2-2）

落点：

- `apps/api/src/modules/loops/loops.service.ts` — `checkRulesCompliance()` + `enforceReleaseGate()` 集成
- `apps/api/src/modules/loops/loops-file-store.service.ts` — 复用现有 rule snapshot/enforcement 数据

能力：

- Release Gate 新增 Rules Center 合规检查（在 canary 检查之后）
- 自动检测 5 类规则违规：敏感文件修改（.env/secrets）、未附测试的源码变更、API 变更缺 contract 更新、Controller 中直接 HTTP 调用、非 TODO shard 缺 implementation record
- 违规时返回结构化 blockers，阻止 finalize
- 复用现有 `LoopRuleSnapshot` 与 `LoopRuleSnapshotEnforcement` 数据
- 从 `implementationRecords.changedFiles` + `testRecords` + `deliveryGovernance` 自动派生

### 57. GitHub Label→Blueprint Auto-Mapping v1（R32a，新增 · P1-3）

落点：

- `apps/api/src/modules/loops/loops.service.ts` — `mapGitHubLabelsToBlueprint()` + `webhookTrigger()` 集成

能力：

- GitHub issue webhook 携带 labels 时，自动映射到 DofeAI delivery blueprint
- 标签→优先级推导：P0/critical/blocker→P0, P1/high/bug→P1, P3/low/docs→P3
- 标签→蓝图映射：feature→bp-feature, bug→bp-bugfix, security→bp-security, documentation→bp-docs, dependencies→bp-dependency, refactor→bp-refactor, integration→bp-integration
- 映射信息 auto-enrich issue body（标注 blueprint + labels + priority）
- 无标签时退回原始 webhook 流程

### 58. Schedule Trigger Manual Fire v1（R32a，新增 · P1-3）

落点：

- `packages/contracts/src/api/loops.contract.ts` — `POST /loops/triggers/schedules/:triggerId/fire`
- `apps/api/src/modules/loops/loops.service.ts` — `fireScheduleTrigger()`
- `apps/api/src/modules/loops/loops.controller.ts` — `fireScheduleTrigger` handler（OPERATE 权限 + audit log）

能力：

- 手动触发 schedule trigger 立即创建 Loop issue（不依赖外部 cron scheduler）
- 自动更新 trigger 的 lastRunAt/nextRunAt/failureCount
- failureCount 达 maxFailures 时自动将 trigger 状态置为 error
- paused 状态的 trigger 拒绝执行并返回描述性消息
- 每次 fire 记录为 TriggerExecution（completed/failed）

### 59. Blueprint Version Rollback v1（R32a，新增 · P1-2）

落点：

- `packages/contracts/src/api/loops.contract.ts` — `POST /loops/blueprints/:blueprintId/rollback`
- `apps/api/src/modules/loops/loops.service.ts` — `rollbackBlueprint()`
- `apps/api/src/modules/loops/loops.controller.ts` — `rollbackBlueprint` handler（ADMIN 权限 + audit log）
- `apps/api/src/modules/loops/loops-file-store.service.ts` — `writeBlueprintHistory()` / `listBlueprintHistory()`（`.loops/blueprints/history/{blueprintId}/`）

能力：

- 每次 rollback 前将当前版本写入 history snapshot
- 支持指定 targetVersion 回滚，或默认回滚到最新历史版本
- history 按 archivedAt 降序排列
- 所有 rollback 操作进入 audit log

## 复审结论（R32）

三十二轮迭代覆盖了 CrewAI gap analysis + gstack/0 + 产品迭代建议中的全部 P0/P1/P2 级控制面 v1 可实现项。R32 补齐了 Rules Center 硬门禁、GitHub label→blueprint 自动映射、Schedule trigger 手动触发与 Blueprint version rollback 四个基础设施 Epic。

**P0（v1 控制面闭合）：** Workforce · Runtime Backend · Eval Suite · PR Evidence · Release Gate · Canary · Runtime Security Panel · Loops Skills · Webhook Trigger

**P1（v1 控制面闭合）：** Invent Delivery Loop · Blueprint Marketplace CRUD · Schedule Trigger · **Schedule Trigger Manual Fire** · Trigger Lifecycle · Tool Registry CRUD · **GitHub Label→Blueprint Auto-Mapping** · Second Opinion · Browser QA multi-viewport · Delivery Flow Pipeline

**P2（v1 控制面闭合）：** Fleet Health · **Rules Center Enforcement** · Loop Bench · Release Gate Dashboard · Recipe Admin · **Blueprint Version Rollback**

### R32 新增闭合项

- **Rules Center Enforcement v1（P2-2）** — 5 类规则违规自动检测 + release gate 硬阻断
- **GitHub Label→Blueprint Auto-Mapping v1（P1-3）** — 14 种标签→7 个 blueprint + 优先级推导
- **Schedule Trigger Manual Fire v1（P1-3）** — `POST /loops/triggers/schedules/:id/fire`
- **Blueprint Version Rollback v1（P1-2）** — `POST /loops/blueprints/:id/rollback` + version history persistence
- **SourceKind/SourceChannel 扩展** — 新增 `schedule` 入口类型到 Zod schema

三十一轮迭代覆盖了 CrewAI gap analysis + gstack/0 + 产品迭代建议中的全部 P0/P1/P2 级控制面 v1 可实现项。R31 闭合了最后两个 P1 缺口：Tool Registry 后端 CRUD（P1-4）与 Blueprint Marketplace 后端 CRUD（P1-2）。

R31.1 为回归复审与质量门禁补正：`pnpm quality:gate` 首次复跑发现两个 `as any` 违反架构门禁，已在 `apps/api/src/modules/loops/loops-file-store.service.ts` 与 `apps/api/src/modules/loops/loops.controller.ts` 修正为类型化索引 / typed Fastify wildcard params。复跑 `pnpm check:architecture`、API 类型检查与 Loops service 聚焦测试均通过。

**P0（v1 控制面闭合）：** Workforce · Runtime Backend · Eval Suite · PR Evidence · Release Gate · Canary · Runtime Security Panel · Loops Skills · Webhook Trigger

**P1（v1 控制面闭合）：** Invent Delivery Loop · **Blueprint Marketplace CRUD** · Schedule Trigger · Trigger Lifecycle · **Tool Registry CRUD** · Second Opinion · Browser QA multi-viewport · Delivery Flow Pipeline

**P2（v1 控制面闭合）：** Fleet Health · Rules Center · Loop Bench · Release Gate Dashboard · Recipe Admin

### R31 新增闭合项

- **Tool Registry Backend v1（P1-4）** — 6 个 CRUD endpoint + health-check/test + 文件态持久化 + audit log
- **Blueprint Marketplace Backend v1（P1-2）** — 4 个 CRUD endpoint + 8 内置 blueprint seed + 文件态持久化 + audit log
- **zh-CN locale fix** — 修复 `loops.json` 结构性 JSON 错误（dashboard 对象提前闭合），i18n 测试恢复通过

### R31.1 质量门禁补正

- **Architecture gate fix** — 去除 Loops production code 中的 `as any`：Loop Bench drilldown 使用 `Record<string, number>` 安全索引，Browser QA artifact wildcard route 使用 `BrowserQaArtifactRequest` 窄类型。
- **文档复审标注** — `03-gap-analysis.md` 与 `README.md` 已将 Tool Registry / Blueprint Marketplace 从“待推进/展示层”更新为 R31 backend CRUD v1 已闭合，并明确剩余工作属于 provider invocation、跨租户治理、version rollback 等后续基础设施 Epic。

### 23. SSO Asset Permissions v1（R9，新增 · P1-3）

落点：

- `packages/contracts/src/schemas/loops.schema.ts`（`LoopAssetPermissionsResponseSchema`、资产 kind/action schema）
- `packages/contracts/src/api/loops.contract.ts`（`GET /loops/asset-permissions`）
- `apps/api/libs/domain/auth/src/permission.service.ts`（`getUserPermissionSnapshot()`，直接消费 SSO permissions/roles）
- `apps/api/src/modules/loops/loops.service.ts`（`assetPermissions()` 从 `vibecoding:loops:{read|create|operate|admin}` 派生资产权限矩阵；`assertAssetPermission()` 提供写操作硬门禁）
- `apps/api/src/modules/loops/loops.controller.ts`（assetPermissions handler；runtime backend health-check / policy patch 传入 SSO 身份上下文）
- `apps/web/lib/api/contracts/hooks/loops.ts`（`useLoopsAssetPermissions()`）
- `apps/web/app/loops/page.tsx`（Capability Registry 下新增 SSO Asset Permissions 面板）
- `apps/web/app/loops/page.test.tsx` 与 `apps/api/src/modules/loops/loops.service.spec.ts`（前后端回归覆盖）

能力：

- 参考 `../agents.dofe.ai`：SSO 是租户身份、角色、权限的唯一权威来源；本项目只做消费与派生，不维护本地角色真相源。
- 覆盖 workspace、blueprint、runtime-backend、tool、eval-suite、trigger、remote-runner、mcp-server、ci-check 九类 Loops 控制面资产。
- read/create/operate/admin 四级模块权限映射为资产级 granted/blocked。
- super admin 直接获得全部 Loops 资产授权。
- `runtime-backend` 的现有写操作（health-check / policy patch）已通过 `assertAssetPermission()` 接入 SSO asset permission 硬门禁。

边界：

- v1 已覆盖权限矩阵、Dashboard 可见性、runtime-backend 写门禁、R10 MCP server / CI checks 配置控制面写门禁，以及 R12 Remote Runner pool/lease 控制面写门禁。
- 资产级权限仍复用 `vibecoding:loops:*` 模块权限，尚未引入 SSO 侧 per-asset policy 细粒度资源 ID。

### 24. MCP Server Registry + CI Checks Registry v1（R10，新增 · P1-2/P2-3）

落点：

- `packages/contracts/src/schemas/loops.schema.ts`（`LoopMcpServerSchema`、`LoopCiCheckIntegrationSchema`、action/list response schema）
- `packages/contracts/src/api/loops.contract.ts`（`/loops/mcp-servers` 与 `/loops/ci-checks` list/connect/disconnect/test）
- `apps/api/src/modules/loops/loops.service.ts`（派生 MCP/CI registry，connect/disconnect/test 均复用 `assertAssetPermission()`）
- `apps/api/src/modules/loops/loops.controller.ts`（MCP/CI handlers + audit log）
- `apps/web/lib/api/contracts/hooks/loops.ts` 与 `hooks/index.ts`（`useLoopsMcpServers()`、`useLoopsCiChecks()`）
- `apps/api/src/modules/loops/loops.service.spec.ts` 与 `packages/contracts/src/__tests__/schemas.test.ts`（schema 与 SSO 门禁覆盖）

能力：

- MCP Server Registry v1：list/connect/disconnect/test，展示 protocol、transport、toolIds、permissionProfile、authStatus、health、risks。
- CI Checks Registry v1：list/connect/disconnect/test，展示 provider、requiredForRelease、checkSuites、targetRef、health、risks。
- `mcp-server` 写操作要求 SSO `vibecoding:loops:admin`；`ci-check` 写操作要求 SSO `vibecoding:loops:operate`。
- 所有配置写操作进入 audit log，保持企业治理可追溯。

边界：

- 当前 MCP 仍为控制面 v1：R18 已补齐 test 响应的 execution audit metadata，但不直接执行真实 MCP handshake / tool invocation。
- R17/R23 已接入 GitHub Checks API check-run 发布与 publication artifact；provider secret 管理、GitHub App installation、MCP client bootstrap 与真实 tool invocation 仍是后续 provider/client 层 Epic。

### 25. Runtime Backend Policy Persistence v1（R11，新增 · P0-2）

落点：

- `apps/api/src/modules/loops/loops-file-store.service.ts`（`readRuntimeBackendPolicies()`、`patchRuntimeBackendPolicy()`）
- `apps/api/src/modules/loops/loops.service.ts`（`updateRuntimeBackendPolicy()` 写入 file store，`buildRuntimeBackendItems()` 合并持久化 policy）
- `apps/api/src/modules/loops/loops.service.spec.ts`（更新后重读 backend 仍保留 fallback/cost/permission profile）

能力：

- `PATCH /loops/runtime-backends/:id/policy` 不再只是返回对象内存 patch；会写入 `.loops/runtime-backend-policies.json`。
- `GET /loops/runtime-backends/:id` 与 list 派生 runtime backend 时会合并已持久化的 fallbackPolicy、costPolicy、permissionProfile。
- 继续复用 R9 SSO `runtime-backend` operate asset permission 写门禁。

边界：

- R11 是 `.loops` 文件态 fallback；R16 已将 NestJS 生产路径切到 DB persistence。
- fallback policy 仍是策略声明，尚未连入自动 fallback 执行。

### 40. Runtime Backend Policy DB Persistence v1（R16，新增 · P0-2）

落点：

- `apps/api/prisma/schema.prisma` / `schema.full.prisma`（新增 `LoopRuntimeBackendPolicy`）
- `apps/api/prisma/migrations/20260624064000_add_loop_runtime_backend_policy/migration.sql`
- `apps/api/generated/db/modules/loops/loops-db.service.ts`（`listRuntimeBackendPolicies()`、`upsertRuntimeBackendPolicy()`）
- `apps/api/src/modules/loops/loops-persistence.service.ts`（DB-backed read/patch）
- `apps/api/src/modules/loops/loops.service.ts`（优先 DB persistence，standalone fallback 到 `.loops` file store）

能力：

- Runtime Backend policy patch 已可落 DB，并通过 DB Service 层参数化 query 执行。
- API / Service 层不直接访问 Prisma，符合仓库 DB Service 边界。
- `.loops/runtime-backend-policies.json` 保留为 CLI / standalone fallback。

边界：

- fallback policy 自动执行仍未接入 runtime orchestration。

### 41. GitHub Checks API Publish v1（R17，新增 · P0-4/P2-3）

落点：

- `packages/contracts/src/schemas/loops.schema.ts`（`LoopCiCheckActionSchema` 新增 `headSha`、status、conclusion、summary 等发布输入）
- `apps/api/src/modules/loops/adapters/loops-pr-provider.client.ts`（`publishGithubCheckRun()`）
- `apps/api/src/modules/loops/loops.service.ts`（`testCiCheck()` 传入 `headSha` 时发布真实 GitHub check-run）
- `apps/api/src/modules/loops/adapters/loops-pr-provider.client.spec.ts`
- `apps/api/src/modules/loops/loops.service.spec.ts`

能力：

- CI Checks Registry 不再只停留在控制面；具备 GitHub Checks API 真实 check-run 发布路径。
- 外部 API 调用仍集中在 `LoopsPrProviderClient` Client 层。
- SSO `ci-check` operate 写门禁继续生效。

边界：

- Work Package→commit 映射、PR→DofeAI evidence 反向链接已在 R29 补齐。

### 44. GitHub Checks Publication Artifact v1（R23，新增 · P0-4/P2-3）

落点：

- `packages/contracts/src/schemas/loops.schema.ts`（`LoopCiCheckIntegrationSchema.lastPublication`）
- `apps/api/src/modules/loops/loops-file-store.service.ts`（`writeCiCheckPublication()` 写入 `.loops/ci-checks/{id}/publications/{headSha}-{publishedAt}.json`）
- `apps/api/src/modules/loops/loops.service.ts`（`testCiCheck()` 成功/失败发布路径均持久化 publication artifact）
- `apps/api/src/modules/loops/loops.service.spec.ts` 与 `packages/contracts/src/__tests__/schemas.test.ts`

能力：

- GitHub Checks API 真实 check-run 发布结果不再只存在于即时响应；会写入 durable publication artifact。
- `lastPublication` 返回 artifactRef、provider、headSha、checkRunId、url、outcome、reason、publishedAt。
- 成功与失败路径都会记录 `.loops` artifact 和 `.loops/log.jsonl` 事件，便于后续审计、重试与 PR evidence 反向链接；R29 已将反向链接写入 publication record。
- 外部 GitHub API 调用仍只在 `LoopsPrProviderClient` client 层。

边界：

- Work Package→commit 映射、PR→DofeAI evidence 反向链接、GitHub App installation/secret 管理已在 R29 补齐 v1。

### 49. GitHub Checks Publication History Index v1（R28，新增 · P0-4/P2-3）

落点：

- `apps/api/src/modules/loops/loops-file-store.service.ts`（`writeCiCheckPublication()` 同步维护 `publications/index.json`）
- `apps/api/src/modules/loops/loops.service.spec.ts`

能力：

- GitHub Checks publication 不再只写单次 artifact；每个 integration 维护 history index。
- 每次成功或失败发布都会更新 `.loops/ci-checks/{id}/publications/index.json`。
- index 包含 `latest`、`entries`、`updatedAt`，entries 保留最近 50 条 publication record。
- R29.1 已通过公开 API/UI 消费 index，审计导出、PR evidence backlink 可直接读取 history，无需扫描 publications 目录。

边界：

- R28 是 file-backed publication history index；R29.1 已新增公开 list publication API 与 Dashboard history view。
- Work Package→commit 映射、PR→DofeAI evidence 反向链接、GitHub App installation/secret 管理已在 R29 补齐 v1。

### 50. PR Evidence Backlink + Work Package Commit Map v1（R29，新增 · P0-4/P2-3）

落点：

- `packages/contracts/src/schemas/loops.schema.ts`（`LoopConvergencePrSchema.commits`、`LoopDeliveryEvidenceWorkPackageSchema`、`LoopCiCheckActionSchema`、`LoopCiCheckIntegrationSchema.lastPublication`）
- `apps/api/src/modules/loops/adapters/loops-git-adapter.interface.ts`（`LoopsCommitShardResult.commitSha`）
- `apps/api/src/modules/loops/adapters/cli-loops-git.adapter.ts`（commit 后读取 `git rev-parse HEAD`，PR body 显示短 SHA）
- `apps/api/src/modules/loops/loops.service.ts`（Delivery Evidence work package 注入 commit metadata；CI check publication 派生 `workPackageCommitMap` 与 `evidenceBacklink`）
- `apps/api/src/modules/loops/loops-file-store.service.ts`（publication artifact/index 持久化 issue/pr/evidence backlink 与 work package commit map）
- `apps/api/src/modules/loops/adapters/loops-pr-provider.client.ts`（GitHub App installation id、private key secret ref、tokenSource 配置读取与 installation access token exchange）
- `apps/api/src/modules/loops/loops.service.spec.ts` 与 `apps/api/src/modules/loops/adapters/loops-pr-provider.client.spec.ts`

能力：

- Work Package（Shard）在 convergence PR、Delivery Evidence、CI Checks publication artifact 中都能关联 commit message、branch 与 commit SHA。
- `testCiCheck()` 支持传入 `issueId`、`prId`、`evidenceBacklink`；发布 GitHub Check Run 时保留 `detailsUrl`，本地 publication/index 同步记录 DofeAI evidence 反向链接。
- finalize 后 PR evidence comment 改为基于写入 convergence PR 后的最新 detail 生成，避免 PR comment 缺失刚生成的 commit map。
- PR provider 配置新增 `LOOPS_GITHUB_APP_ID`、`LOOPS_GITHUB_APP_INSTALLATION_ID`、`LOOPS_GITHUB_APP_PRIVATE_KEY_SECRET_REF`、`LOOPS_PR_TOKEN_SECRET_REF` 与 `tokenSource`，只记录 secret 引用和来源，不暴露 secret 值。
- GitHub provider 在没有静态 `LOOPS_PR_TOKEN` 时可用 GitHub App JWT 兑换 installation access token，并复用于 PR、PR comment 与 Checks API 调用。

边界：

- R29 已完成配置读取、publication/evidence 贯通与 GitHub App JWT→installation token 真实兑换 v1。
- R29.1 已完成公开 list publication API 与 Dashboard UI history view；CI publication history 仍以 file-backed index 为 durable source，后续可追加导出/检索/跨租户归档。

### 51. CI Check Publication History API/UI v1（R29.1，新增 · P0-4/P2-3）

落点：

- `packages/contracts/src/schemas/loops.schema.ts`（`LoopCiCheckPublicationSchema`、`LoopCiCheckPublicationHistorySchema` 与 Work Package commit map schema）
- `packages/contracts/src/api/loops.contract.ts`（`GET /loops/ci-checks/:id/publications`）
- `apps/api/src/modules/loops/loops-file-store.service.ts`（`readCiCheckPublications()` 读取并规范化历史 index，兼容旧 artifact 缺省 workPackageCommitMap）
- `apps/api/src/modules/loops/loops.service.ts` 与 `loops.controller.ts`（`listCiCheckPublications()`，READ 权限）
- `apps/web/lib/api/contracts/hooks/loops.ts` 与 `hooks/index.ts`（`useLoopsCiCheckPublications()`）
- `apps/web/app/loops/page.tsx`（Dashboard 新增 CI Evidence Publications 面板）
- `apps/web/locales/en/loops.json`、`apps/web/locales/zh-CN/loops.json`、`apps/web/app/loops/page.test.tsx`、`packages/contracts/src/__tests__/schemas.test.ts`、`apps/api/src/modules/loops/loops.service.spec.ts`

能力：

- CI publication history 从内部 file-backed index 升级为可消费 API。
- Dashboard 可见最新 publication 的 status、artifactRef、GitHub check-run link、DofeAI evidence backlink。
- Dashboard 展示 Work Package → commit SHA / branch / changed files 映射，工程审查者可从 CI evidence 回溯到实际提交。
- 后端读取旧 index 时会将缺省 `workPackageCommitMap` 规范化为空数组，保持 Zod contract 与历史 artifact 兼容。

边界：

- R29.1 交付的是 read-only history API/UI；批量导出、搜索过滤、跨租户长期归档仍可作为后续增强。

### 42. MCP Provider Execution Audit Metadata v1（R18，新增 · P1-2）

落点：

- `packages/contracts/src/schemas/loops.schema.ts`（`LoopMcpServerSchema.executionAudit`）
- `packages/contracts/src/__tests__/schemas.test.ts`
- `apps/api/src/modules/loops/loops.service.ts`（`testMcpServer()` 返回 auditRef/provider/action/outcome/toolCount/recordedAt）
- `apps/api/src/modules/loops/loops.service.spec.ts`

能力：

- MCP provider test 响应具备可追踪 execution audit metadata。
- Controller 既有 AuditLog 写入仍保留，响应中的 `auditRef` 可用于 UI/调用方关联一次测试执行。
- SSO `mcp-server` admin 写门禁继续生效。

边界：

- 真实 MCP handshake、tool invocation、provider secret bootstrap 尚未接入。

### 43. MCP Provider Durable Execution Audit Artifact v1（R22，新增 · P1-2）

落点：

- `packages/contracts/src/schemas/loops.schema.ts`（`LoopMcpServerSchema.executionAudit.artifactRef`）
- `apps/api/src/modules/loops/loops-file-store.service.ts`（`writeMcpExecutionAudit()` 写入 `.loops/mcp-audits/{providerId}/{auditRef}.json`）
- `apps/api/src/modules/loops/loops.service.ts`（`testMcpServer()` 持久化 execution audit artifact 并返回 `artifactRef`）
- `apps/api/src/modules/loops/loops.service.spec.ts` 与 `packages/contracts/src/__tests__/schemas.test.ts`

能力：

- MCP provider test 不再只返回响应级 metadata；每次 test 都会写 durable audit artifact。
- audit artifact 包含 providerId、action、outcome、toolIds/toolCount、transport、authStatus、reason、recordedAt、health。
- `executionAudit.artifactRef` 可用于 UI、审计导出或后续 provider worker 关联一次真实 MCP 执行。
- SSO `mcp-server` admin 写门禁与 controller AuditLog 继续生效。

边界：

- R22 仍不启动真实 MCP handshake/tool invocation；provider secret bootstrap 与真实 MCP client runtime 仍为后续。

### 48. MCP Provider Lifecycle Execution Audit v1（R27，新增 · P1-2）

落点：

- `apps/api/src/modules/loops/loops.service.ts`（`connectMcpServer()` / `disconnectMcpServer()` 写 durable execution audit artifact）
- `apps/api/src/modules/loops/loops.service.spec.ts`

能力：

- MCP provider execution audit 不再只覆盖 `test`；`connect` / `disconnect` / `test` 全生命周期动作均有 durable audit artifact。
- `connectMcpServer()` 与 `disconnectMcpServer()` 响应会返回 `executionAudit.auditRef`、`executionAudit.artifactRef`、provider/action/outcome/toolCount/recordedAt。
- artifact 继续写入 `.loops/mcp-audits/{providerId}/{auditRef}.json`，并保留 transport、authStatus、toolIds、reason、health。
- SSO `mcp-server` admin 写门禁继续在 artifact 写入前执行。

边界：

- R27 仍是 control-plane lifecycle audit，不启动真实 MCP handshake/tool invocation。
- provider secret bootstrap、真实 MCP client runtime、tool invocation replay 仍待后续实现。

### 26. Remote Runner Pool / Lease v1（R12，新增 · P2-3）

落点：

- `packages/contracts/src/schemas/loops.schema.ts`（`LoopRemoteRunnerSchema`、`LoopRemoteRunnerLeaseSchema`、lease/release request schema）
- `packages/contracts/src/api/loops.contract.ts`（`GET /loops/remote-runners`、`POST /loops/remote-runners/:id/leases`、`POST /loops/remote-runners/:id/leases/release`）
- `apps/api/src/modules/loops/loops.service.ts`（派生 remote runner pool、acquire/release control-plane lease）
- `apps/api/src/modules/loops/loops.controller.ts`（Remote Runner handlers + audit log）
- `apps/api/src/modules/loops/loops.service.spec.ts` 与 `packages/contracts/src/__tests__/schemas.test.ts`（pool/lease schema 与 SSO admin 门禁覆盖）

能力：

- Remote Runner pool 控制面可展示 status、runtimeBackends、capacity、queue、sandboxProfile、artifactRoot、leaseTtlSec、health、risks。
- acquire/release lease 写操作已复用 SSO `remote-runner` admin asset permission。
- lease 明确记录 artifactRoot、issueId、shardId、runtimeBackend、expiresAt，并说明执行仍通过 Codex CLI / Claude Code CLI adapters。
- 所有 lease 写操作进入 audit log。

边界：

- R12 为控制面 v1：不启动真实远端 worker，不维护分布式 lease 状态。
- R21 已补齐 artifact manifest provider v1；后续仍需要 BullMQ/Redis queue worker、真实 sandbox worker、external object storage upload、cancellation/resume、org quota。

### 41. Remote Runner Job / Artifact Provider v1（R21，新增 · P2-3）

落点：

- `packages/contracts/src/schemas/loops.schema.ts`（`LoopRemoteRunnerJobRequestSchema`、`LoopRemoteRunnerJobSchema`、artifact metadata schema）
- `packages/contracts/src/api/loops.contract.ts`（`POST /loops/remote-runners/:id/jobs`）
- `apps/api/src/modules/loops/loops-file-store.service.ts`（`writeRemoteRunnerJob` 写入 manifest/job 索引与 `.loops/log.jsonl`）
- `apps/api/src/modules/loops/loops.service.ts`（`runRemoteRunnerJob`，SSO `remote-runner` admin 门禁）
- `apps/api/src/modules/loops/loops.controller.ts`（Remote Runner job handler + audit log）
- `apps/api/src/modules/loops/loops.service.spec.ts` 与 `packages/contracts/src/__tests__/schemas.test.ts`（job schema、SSO admin 门禁、artifact manifest 落盘覆盖）

能力：

- 新增 `POST /loops/remote-runners/:id/jobs`，在 SSO admin 权限通过后创建 Remote Runner job。
- job 响应包含 runnerId、leaseId、issueId、shardId、runtimeBackend、workerKind、queued/started/finished timestamps、status、artifactRoot、artifacts。
- artifact provider v1 会真实写入 `.loops/runs/{runnerId}/jobs/{jobId}.json` 索引与 `.loops/runs/{runnerId}/jobs/{jobId}/manifest.json`，并计算 manifest `sha256` 与 `sizeBytes`。
- job 写操作进入 controller audit log 与 `.loops/log.jsonl`，后续可被 BullMQ/sandbox worker 复用。

边界：

- R21 不执行任意 shell command；Codex CLI / Claude Code CLI 仍是底层 runtime handoff 边界。
- 尚未实现分布式队列调度、取消/续跑、sandbox logs 汇聚、external artifact object storage、org quota。

### 47. Remote Runner Worker Artifact Bundle v1（R26，新增 · P2-3）

落点：

- `apps/api/src/modules/loops/loops-file-store.service.ts`（`writeRemoteRunnerJob()` 生成 manifest / worker receipt / worker log / trace artifact）
- `apps/api/src/modules/loops/loops.service.spec.ts`
- `packages/contracts/src/__tests__/schemas.test.ts`

能力：

- Remote Runner job artifact provider 从单 manifest 扩展为 worker artifact bundle。
- 每个 job 会写入：
  - `.loops/runs/{runnerId}/jobs/{jobId}/manifest.json`
  - `.loops/runs/{runnerId}/jobs/{jobId}/worker-receipt.json`
  - `.loops/runs/{runnerId}/jobs/{jobId}/worker.log`
  - `.loops/runs/{runnerId}/jobs/{jobId}/trace.json`
- job response 的 `artifacts` 数组包含 manifest/evidence/log/trace 四类 artifact metadata（sizeBytes + sha256）。
- worker receipt 明确记录 runtime handoff：Codex / Claude Code CLI / artifact-only，用于后续远端 worker 与审计回放。

边界：

- R26 仍不直接执行任意 shell command；真实执行仍应通过 Codex CLI / Claude Code CLI worker。
- 分布式队列调度、取消/续跑、external object storage upload、org quota 仍待后续实现。

### 27. Eval Suite Evidence Aggregation v1（R13，新增 · P0-3）

落点：

- `apps/api/src/modules/loops/loops.service.ts`（`collectEvalEvidence()`、`materializeEvalSuite()`、`evaluateEvalCheck()`、EvalRun per-loop check 结果计算）
- `apps/api/src/modules/loops/loops.service.spec.ts`（PASS / NEEDS-WORK / FAIL 三类 loop evidence 的 suite 聚合与 run 明细覆盖）

能力：

- `GET /loops/eval-suites` 不再返回 0/0/0 占位计数；会从最近 Loop 列表、detail、cost guard 同步派生每个 check 的 passCount / failCount / blockedCount。
- `GET /loops/eval-runs` 会按 suiteId / loopId 生成 loop 级 checkResults、status、score、evidenceRefs。
- Delivery Readiness 已基于 spec approval、global review verdict、convergence PR evidence 计算。
- Runtime Safety 已基于 runtime security policy 的 path/network/canary 快照计算。
- Test Evidence 已基于 test records、failure classification、coverage 计算。
- Cost Policy 已基于 token/call guard 与 implementation duration evidence 计算。

边界：

- 当前 request-time 聚合适合 v1 Dashboard/API；R19 已新增 file-backed historical baseline/trend worker。
- 跨租户实时聚合、长期归档、DB/队列化调度仍是后续 Epic；R14 已将 failed/attention eval hard gate 结构化接入 Dashboard Exception Center；R15 已完成单 Loop 创建时 workflow baseline evidence。

### 43. Eval Historical Baseline / Trend Worker v1（R19，新增 · P0-3）

落点：

- `packages/contracts/src/schemas/loops.schema.ts`（EvalRun baseline/trend 字段、`EvalTrendWorkerResponseSchema`）
- `packages/contracts/src/api/loops.contract.ts`（`POST /loops/eval-runs/historical-baseline-worker`）
- `apps/api/src/modules/loops/loops.controller.ts`（worker handler + audit log）
- `apps/api/src/modules/loops/loops-file-store.service.ts`（`.loops/eval-trends/history.json` / `latest.json`）
- `apps/api/src/modules/loops/loops.service.ts`（`runEvalTrendWorker()`、EvalRun baseline lookup）
- `apps/api/src/modules/loops/loops.service.spec.ts`
- `packages/contracts/src/__tests__/schemas.test.ts`

能力：

- Worker 会扫描当前 EvalRun，按 `blueprintId + suiteId` 聚合 runCount、averageScore、passRate。
- 每次运行物化 baseline snapshot，后续 EvalRun 返回 baselineVersion、baselineScore、trendDelta。
- 写入 Loops log，并通过 controller 进入 AuditLog。

边界：

- v1 为 `.loops` file-backed historical baseline；跨租户长期归档和队列化实时聚合仍待 DB/worker 基础设施承接。

### 44. Multi-tenant Recipe Admin UI Permissions v1（R20，新增 · P2）

落点：

- `apps/web/app/loops/loops-dashboard-model.ts`（`buildRecipeAdminSummary()` 接入 `LoopAssetPermissionsResponse`）
- `apps/web/app/loops/page.tsx`（Recipe Admin 展示 tenant scope、授权状态、SSO source permission）
- `apps/web/locales/en/loops.json` / `zh-CN/loops.json`
- `apps/web/app/loops/loops-dashboard-model.test.ts`
- `apps/web/app/loops/page.test.tsx`

能力：

- Recipe Admin 不再只是 loop kind 汇总；已接入 SSO asset permissions 作为多租户权限来源。
- Dashboard 能显示 `delivery-blueprints` 的 tenant scope、granted/blocked 状态和 `vibecoding:loops:create` 等 source permission。
- 与 `../agents.dofe.ai` 风格保持一致：权限核心来源为 SSO snapshot，而不是前端自造角色。

边界：

- v1 是管理面权限/治理可视化；配方 CRUD、版本回滚、跨租户审批流仍待后续实现。

### 45. Multi-tenant Recipe Admin Action Readiness v1（R24，新增 · P2）

落点：

- `apps/web/app/loops/loops-dashboard-model.ts`（`RecipeAdminActionId` / `RecipeAdminAction` / `buildRecipeAdminSummary()` action readiness 派生）
- `apps/web/app/loops/page.tsx`（Recipe Admin 新增 action readiness 卡片）
- `apps/web/locales/en/loops.json` / `zh-CN/loops.json`
- `apps/web/app/loops/loops-dashboard-model.test.ts`
- `apps/web/app/loops/page.test.tsx`

能力：

- Recipe Admin 已从“权限来源可视化”推进到“多租户管理动作 readiness”。
- 基于 SSO `delivery-blueprints` asset permission 派生 `createVersion`、`reviewApproval`、`rollbackVersion` 三类动作的 ready/blocked 状态。
- `createVersion` 以 SSO blueprint create 授权为准；`reviewApproval` 结合 SSO 授权与 blocked recipe loop 数；`rollbackVersion` 结合 SSO 授权与已有 active recipe baseline。
- 每个 action 暴露 evidence 与 source permission，页面只展示真实 readiness，不伪造尚未存在的 mutation 按钮。

边界：

- R24 仍是前端管理面 readiness，不执行配方 CRUD mutation。
- 版本回滚执行、审批流状态持久化、跨租户审批队列与 audit workflow 仍待后续后端/API 实现。

### 46. Multi-tenant Recipe Admin Action Request Artifact v1（R25，新增 · P2）

落点：

- `packages/contracts/src/schemas/loops.schema.ts`（`LoopRecipeAdminActionRequestSchema` / `LoopRecipeAdminActionResponseSchema`）
- `packages/contracts/src/api/loops.contract.ts`（`POST /loops/recipe-admin/actions`）
- `apps/api/src/modules/loops/loops-file-store.service.ts`（`writeRecipeAdminAction()` 写入 `.loops/recipe-admin/{tenant}/actions/{id}.json`）
- `apps/api/src/modules/loops/loops.service.ts`（`requestRecipeAdminAction()`，SSO `blueprint:create` 门禁）
- `apps/api/src/modules/loops/loops.controller.ts`（controller audit log）
- `apps/web/lib/api/contracts/hooks/loops.ts`（`useRequestRecipeAdminAction()`）
- `apps/web/app/loops/page.tsx`（Recipe Admin readiness 卡片可发起 Request）
- `apps/web/app/loops/page.test.tsx`、`apps/api/src/modules/loops/loops.service.spec.ts`、`packages/contracts/src/__tests__/schemas.test.ts`

能力：

- Recipe Admin action readiness 不再只是静态展示；ready action 可发起真实后端 action request。
- action request 通过 SSO `delivery-blueprints` / `vibecoding:loops:create` 权限校验。
- 每次请求会产生 tenant-scoped durable artifact：`.loops/recipe-admin/{tenant}/actions/{id}.json`。
- artifact 包含 actionId、blueprintId、recipeKind、targetVersion、tenant/team/actor、sourcePermission、reason、evidenceRefs、requestedAt 与 status。
- controller 同步写入 audit log，`.loops/log.jsonl` 记录 `RECIPE_ADMIN_ACTION_REQUESTED` 事件。

边界：

- R25 是真实可审计 action request，不是完整配方 CRUD 状态机。
- 审批队列 worker、版本回滚执行器、Recipe version DB model、跨租户审批状态持久化仍待后续实现。

### 28. Eval Failed Check → Exception Center v1（R14，新增 · P0-3）

落点：

- `apps/web/app/loops/loops-dashboard-model.ts`（`buildExceptionCenter()` 支持 `evalPlan`，新增 `eval` exception source）
- `apps/web/app/loops/page.tsx`（Dashboard 将 `evalPlan` 传入 Exception Center，并为 Eval Plan 区块提供 `#eval-plan` evidence anchor）
- `apps/web/app/loops/loops-dashboard-model.test.ts` 与 `apps/web/app/loops/page.test.tsx`（Eval gate exception 与页面证据联动覆盖）

能力：

- Eval Plan 中 hard gate 的 `blocked` check 会进入 Exception Center，级别为 critical，owner 为 Eval owner，action 为 Resolve hard gate。
- Eval Plan 中 hard gate 的 `attention` check 会进入 Exception Center，级别为 warning，action 为 Collect evidence。
- Exception item 保留原始 check evidence，并链接回 `/loops#eval-plan`，把 failed check 从展示型状态变成可处理队列。

边界：

- v1 为 Dashboard 派生，不新增后端持久化队列；跨租户历史统计仍归入后续 Eval trend/baseline worker。

### 29. Workflow Baseline Evidence v1（R15，新增 · P1-2/P1-5）

落点：

- `packages/contracts/src/schemas/loops.schema.ts`（`LoopWorkflowBaselineEvidenceSchema`，`LoopWorkflowRecipeSchema.baselineEvidence`）
- `apps/api/src/modules/loops/loops.service.ts`（`buildWorkflowBaselineEvidence()`，创建/读取 workflow recipe 时保留或派生 baseline evidence）
- `apps/api/src/modules/loops/loops.service.spec.ts`（创建 Issue 后 list/detail 均含 blueprint/runtime/eval/gate baseline evidence）
- `apps/web/app/loops/[issueId]/page.tsx`（Delivery Controls 展示 baseline evidence）
- `apps/web/app/loops/[issueId]/page.test.tsx` 与 locales（详情页可见性与中英文文案）

能力：

- 创建 Loop 时把 blueprint version、runtime plan、eval suite、human/release gate 计划写入 `workflowRecipe.baselineEvidence`。
- Loop list/detail 会保留创建时 snapshot，不因后续全局 defaults 变化而丢失基线。
- Detail Delivery Controls 中直接展示 baseline evidence，用户能看到创建时承诺的计划基线。

边界：

- v1 是单 Loop 创建基线，不是跨 blueprint / cross-loop 的 Eval historical baseline 索引。
- 不新增 DB 表；继续跟随 `.loops` workflow recipe snapshot 与现有 detail/list contract。

### 20. DofeAI Loops Skills（R7，新增 · P0-1）

落点：`.claude/skills/dofeai/loops-{architecture,delivery,review,security}.md`

能力：

- `loops-architecture.md`：agent 写后端代码时自动告知架构规则（DB Service/Zod/Client/Winston）
- `loops-delivery.md`：agent 实现交付时自动告知交付协议（spec→shard→test→review→evidence）
- `loops-review.md`：agent 审查代码时自动告知审查规则（architecture/path policy/test coverage/PR evidence/release gate）
- `loops-security.md`：agent 执行命令时自动告知安全策略（shell allowlist/network deny/write scope/secret canary/sandbox）

### 22. Delivery Flow Pipeline（R8，新增 · P1-1）

落点：

- `apps/web/app/loops/loops-dashboard-model.ts`（`buildDeliveryFlow`、`DeliveryFlow`/`DeliveryFlowStep` 接口）
- `apps/web/app/loops/page.tsx`（Dashboard 顶部新增 Delivery Flow Pipeline 可视化，10 步 → 箭头流程）
- `apps/web/app/loops/loops-dashboard-model.test.ts`（pipeline summary、runtime owner、gate kind、blocked step 测试）
- `apps/web/locales/en/loops.json` + `zh-CN/loops.json`（`deliveryFlow.title`）

能力：

- 可视化完整交付管道：Intake → Spec → Spec Review → Plan → Build → Test → Converge → Global Review → Annotate → Close
- 每步标注 runtime owner（Codex/Claude/Human/System）
- 每步标注 gate kind（none/human/agent/release）
- 活跃 loop 数颜色编码（绿=有活跃/红=有阻塞/灰=空闲）
- 阻塞步用红色背景标出

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

- P2-3 Remote Runner / Execution Pool（R21 已完成 job/artifact manifest provider v1；R26 已完成 worker receipt/log/trace artifact bundle；分布式队列、取消/续跑、sandbox worker 后续）
- Remote Runner external artifact upload / object storage（R21/R26 已完成 `.loops` artifact bundle；外部 upload 后续）
- MCP provider 真实 handshake / tool invocation（R18/R22/R27 已完成 execution audit metadata + durable lifecycle artifact；真实 provider 调用仍待接入）
- Runtime Backend policy DB 持久化（R16 已完成；`.loops` 保留 standalone fallback）
- Eval Suite / Eval Run 历史趋势、跨 blueprint baseline version 与后台实时聚合（R19 已完成 file-backed historical baseline/trend worker；跨租户长期归档和队列化调度仍待推进）
- PR status GitHub CI check 集成（R17/R23 已支持 GitHub Checks API check-run 发布 + publication artifact；R28 已完成 per-integration publication history index；R29 已完成 Work Package→commit 映射、evidence 反向链接与 GitHub App installation token exchange v1；R29.1 已完成公开 history API/UI；后续为导出、搜索过滤和跨租户归档）
- Recipe admin UI 多租户管理面板（R20 已完成 SSO 权限来源可视化；R24 已完成 action readiness；R25 已完成真实 action request artifact；完整 CRUD 状态机、版本回滚执行器、审批流持久化仍待推进）
- Schedule Trigger 执行引擎（R30c 已完成 cron-based trigger CRUD + file persistence；实际 cron 调度执行需外部 scheduler/cron-job 轮询；复杂 cron 表达式解析、分布式锁、multi-node 协调仍待推进）
- Trigger Lifecycle 自动执行（R30c 已完成 retry/replay/dead-letter 控制面；pending execution 自动重试、分布式 queue worker、外部告警集成仍待推进）

## 已验证（R31.1 当前复审）

- `pnpm --filter @repo/contracts test` — 3 suites、54 passed
- `pnpm --filter @repo/api test` — 25 suites passed、172 passed、3 skipped（另 1 个 DB smoke suite skipped）
- `pnpm --filter @repo/web test` — 10 files、71 passed；首次复跑曾出现 Dashboard 巨型用例 10s 超时，随后单测与完整 web suite 均通过，判定为并发环境抖动
- `pnpm --filter @repo/api type-check` — 通过
- `pnpm --filter @repo/web type-check` — 通过
- `pnpm check:architecture` — 通过；R31.1 已修复 quality gate 暴露的 `as any` 架构违规
- `pnpm --filter @repo/api test -- --runTestsByPath src/modules/loops/loops.service.spec.ts` — 68 passed

## 历史验证流水（R31 之前及 R31）

- `pnpm --filter @repo/web test -- loops-dashboard-model.test.ts --runInBand` — 10 个测试文件、67 个测试全部通过
- `pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand` — 31 个测试全部通过
- `pnpm --filter @repo/api type-check` — 通过
- `pnpm --filter @repo/web test -- page.test.tsx --runInBand` — 10 个测试文件、67 个测试全部通过
- `pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand` — R9 更新后 38 个测试全部通过
- `pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand` — R10 更新后 45 个测试全部通过
- `pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand` — R11 更新后 49 个测试全部通过
- `pnpm --filter @repo/api type-check` — R11 更新后通过
- `pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand` — R12 更新后 52 个测试全部通过
- `pnpm --filter @repo/contracts test -- schemas.test.ts --runInBand` — R12 更新后 16 个测试全部通过
- `pnpm --filter @repo/api type-check` — R12 更新后通过
- `pnpm --filter @repo/contracts test -- schemas.test.ts --runInBand` — R10 更新后 16 个测试全部通过
- `pnpm --filter @repo/web type-check` — R10 更新后通过
- R8 新增：Delivery Flow Pipeline 可视化（Dashboard 顶部 10 步管道）
- R9 新增：SSO Asset Permissions v1（参考 agents.dofe.ai，SSO 作为权限核心来源）
- R10 新增：MCP Server Registry + CI Checks Registry 控制面 v1（含 SSO asset permission 写门禁）
- R11 新增：Runtime Backend Policy `.loops` file-backed 持久化
- R12 新增：Remote Runner Pool / Lease 控制面 v1（含 SSO admin 写门禁）
- R13 新增：Eval Suite / Eval Run evidence aggregation v1（从现有 Loop evidence 派生 suite 计数与 run 明细）
- `pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand` — R13 更新后 54 个测试全部通过
- `pnpm --filter @repo/api type-check` — R13 更新后通过
- R14 新增：Eval failed/attention hard gate 结构化进入 Dashboard Exception Center
- R16 新增：Runtime Backend Policy DB persistence（Prisma model + DB Service + NestJS persistence 优先路径）
- R17 新增：GitHub Checks API check-run 发布（CI Checks Registry test + provider client）
- R18 新增：MCP provider test execution audit metadata（contract + service response）
- R19 新增：Eval historical baseline/trend worker（contract + API + `.loops/eval-trends` snapshots）
- R20 新增：Multi-tenant Recipe Admin UI permissions（SSO asset permission 接入 Dashboard）
- R21 新增：Remote Runner Job / Artifact Provider v1（contract + API + `.loops` job index/manifest artifact + SSO admin 门禁）
- R22 新增：MCP Provider Durable Execution Audit Artifact v1（`.loops/mcp-audits` artifact + `executionAudit.artifactRef`）
- R23 新增：GitHub Checks Publication Artifact v1（`.loops/ci-checks/.../publications` + `lastPublication.artifactRef`）
- R24 新增：Multi-tenant Recipe Admin Action Readiness v1（基于 SSO asset permission 派生 create/review/rollback readiness）
- R25 新增：Multi-tenant Recipe Admin Action Request Artifact v1（`POST /loops/recipe-admin/actions` + `.loops/recipe-admin/{tenant}/actions` artifact + UI Request）
- `pnpm --filter @repo/contracts test -- schemas.test.ts --runInBand` — R25 更新后 17 个测试全部通过
- `pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand` — R25 更新后 65 个测试全部通过
- `pnpm --filter @repo/api type-check` — R25 更新后通过
- `pnpm --filter @repo/web test -- page.test.tsx --runInBand` — R25 更新后 71 个测试全部通过
- `pnpm --filter @repo/web type-check` — R25 更新后通过
- R26 新增：Remote Runner Worker Artifact Bundle v1（manifest + worker receipt + worker log + trace artifacts）
- `pnpm --filter @repo/contracts test -- schemas.test.ts --runInBand` — R26 更新后 17 个测试全部通过
- `pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand` — R26 更新后 65 个测试全部通过
- `pnpm --filter @repo/api type-check` — R26 更新后通过
- R27 新增：MCP Provider Lifecycle Execution Audit v1（connect/disconnect/test 全生命周期 durable audit artifact）
- `pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand` — R27 更新后 66 个测试全部通过
- `pnpm --filter @repo/contracts test -- schemas.test.ts --runInBand` — R27 更新后 17 个测试全部通过
- `pnpm --filter @repo/api type-check` — R27 更新后通过
- R28 新增：GitHub Checks Publication History Index v1（`.loops/ci-checks/{id}/publications/index.json`）
- `pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand` — R28 更新后 66 个测试全部通过
- `pnpm --filter @repo/api type-check` — R28 更新后通过
- `pnpm --filter @repo/contracts test -- schemas.test.ts --runInBand` — R28 更新后 17 个测试全部通过
- R29 新增：PR Evidence Backlink + Work Package Commit Map v1（convergence PR / Delivery Evidence / CI Checks publication artifact 均记录 commit/evidence mapping；GitHub App installation token exchange v1）
- R29.1 新增：CI Check Publication History API/UI v1（`GET /loops/ci-checks/:id/publications` + Dashboard CI Evidence Publications + Work Package commit map 展示）
- `pnpm --filter @repo/contracts test -- schemas.test.ts --runInBand` — R29.1 更新后 17 个测试全部通过
- `pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand` — R29.1 更新后 68 个测试全部通过
- `pnpm --filter @repo/api test -- loops-pr-provider.client.spec.ts --runInBand` — R29 更新后 9 个测试全部通过
- `pnpm --filter @repo/api type-check` — R29.1 更新后通过
- `pnpm --filter @repo/web test -- page.test.tsx --runInBand` — R29.1 更新后 71 个测试全部通过
- `pnpm --filter @repo/web type-check` — R29.1 更新后通过
- `pnpm --filter @repo/web test -- loops-dashboard-model.test.ts --runInBand` — R24 更新后 71 个测试全部通过
- `pnpm --filter @repo/web test -- page.test.tsx --runInBand` — R24 更新后 71 个测试全部通过
- `pnpm --filter @repo/web type-check` — R24 更新后通过
- `pnpm --filter @repo/contracts test -- schemas.test.ts --runInBand` — R23 更新后 17 个测试全部通过
- `pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand` — R23 更新后 62 个测试全部通过
- `pnpm --filter @repo/api type-check` — R23 更新后通过
- `pnpm --filter @repo/contracts test -- schemas.test.ts --runInBand` — R22 更新后 17 个测试全部通过
- `pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand` — R22 更新后 62 个测试全部通过
- `pnpm --filter @repo/api type-check` — R22 更新后通过
- `pnpm --filter @repo/contracts test -- schemas.test.ts --runInBand` — R21 更新后 17 个测试全部通过
- `pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand` — R21 更新后 62 个测试全部通过
- `pnpm --filter @repo/api type-check` — R21 更新后通过
- `pnpm --filter @repo/web test -- loops-dashboard-model.test.ts --runInBand -t "exception center"` — R14 更新后 10 个测试文件、67 个测试全部通过
- `pnpm --filter @repo/web test -- page.test.tsx --runInBand` — R14 更新后 10 个测试文件、67 个测试全部通过
- `pnpm --filter @repo/web type-check` — R14 更新后通过
- R15 新增：Workflow baseline evidence v1（blueprint/runtime/eval/gate 创建基线进入 workflowRecipe 并在详情页展示）
- `pnpm --filter @repo/contracts test -- schemas.test.ts --runInBand` — R15 更新后 16 个测试全部通过
- `pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand -t "runs createIssue"` — R15 focused 更新后 58 个测试全部通过
- `pnpm --filter @repo/web test -- 'app/loops/[issueId]/page.test.tsx' --runInBand` — R15 更新后 10 个测试文件、67 个测试全部通过
- `pnpm --filter @repo/api type-check && pnpm --filter @repo/web type-check` — R15 更新后通过
- R8 修复：`apps/web/locales/zh-CN/loops.json` 的重复字段导致 JSON 解析失败问题
- R30c 新增：Schedule Trigger Backend v1（cron-based 定时 Loop 创建 + 5 个 CRUD endpoint）+ Trigger Lifecycle Management v1（retry/replay/dead-letter + 4 个 lifecycle endpoint）
- R31 新增：Tool Registry Backend v1（6 个 CRUD endpoint）+ Blueprint Marketplace Backend v1（4 个 CRUD endpoint + 8 内置 blueprint seed）
- `pnpm --filter @repo/api test` — R31 更新后 25 suites、172 passed
- `pnpm --filter @repo/web test` — R31 更新后 10 files、71 passed
- `pnpm --filter @repo/contracts test` — R31 更新后 3 suites、54 passed
- `pnpm --filter @repo/api type-check` — R31 更新后通过
- `pnpm --filter @repo/web type-check` — R31 更新后通过
- `pnpm quality:gate` — R31 文档曾标注 6/6 通过；R31.1 复跑时先暴露 `as any` 架构违规，修正后 `pnpm check:architecture` 已通过，完整 quality gate 见 R31.1 当前复审记录
- zh-CN locale JSON 结构性错误修复：dashboard 对象提前闭合导致 i18n 测试失败
- 剩余 Epic 已在本文档和 roadmap 中标注为后续基础设施工作
