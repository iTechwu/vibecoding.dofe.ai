# 基于 gstack 的 DofeAI 优化路线图

## 总体原则

1. 不复制命令，抽象流程。
2. 不只展示状态，沉淀证据。
3. 不只允许 agent 执行，给每一步设置可审阅门禁。
4. 不只做单次任务，把学习和决策带到下一次 Loop。

## Epic 1：Workflow Recipe

状态：已实施 dashboard v1 + 后端 contract/list/detail 派生 v2 + detail Delivery Controls v3 + 创建时 per-loop recipe snapshot v4 + delivery governance workflow default 记录 v5；workspace 级管理 UI 和新建 Loop 默认应用后续 Epic。

### 背景

gstack 的最大产品资产是 Think -> Plan -> Build -> Review -> Test -> Ship -> Reflect 的流程心智。DofeAI 目前已有 phase、mode、human gate、rule snapshot，但缺少可配置的“这类 Loop 应走哪条路径”的显式对象。

### 建议 contract

```typescript
export const LoopWorkflowStepSchema = z.object({
  id: z.string(),
  kind: z.enum([
    'intake',
    'product_review',
    'spec_review',
    'architecture_review',
    'design_review',
    'implementation',
    'code_review',
    'security_review',
    'browser_qa',
    'test_gate',
    'release_gate',
    'retro',
  ]),
  required: z.boolean(),
  agentPath: z.string().optional(),
  humanGate: z.enum(['none', 'approval', 'decision', 'override']).default('none'),
  evidenceTypes: z.array(z.string()).default([]),
});

export const LoopWorkflowRecipeSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.number(),
  appliesTo: z.array(z.enum(['feature', 'bugfix', 'refactor', 'docs', 'ops'])),
  steps: z.array(LoopWorkflowStepSchema),
});
```

### UI 落点

- 创建页：模板选择后显示推荐 workflow；
- Dashboard：按 workflow step 展示卡片分布；
- Detail：显示完整 step timeline、当前 gate、缺失 evidence；
- Admin/Workspace：配置默认 recipe。

### 验收标准

- 已完成：dashboard 基于现有 phase、cost guard、pause/global verdict 派生 Intake / Plan / Build / Review / Browser QA / Ship / Reflect 路线、gate、blocked、release-ready 与 evidence；
- 已完成：`LoopWorkflowRecipe` Zod contract 已在 `packages/contracts/src/schemas/loops.schema.ts` 定义并导出类型；
- 已完成：后端 list/detail payload 已基于现有 Loop 状态派生 workflow steps、Codex/Claude Code runtime owner、humanGate 与 evidenceIds；
- 已完成：delivery governance 可 file-backed 记录 feature/bugfix/refactor/docs/ops 的 workflow default recipeId；
- 已完成：新建 Loop 时固化 per-loop recipe snapshot，Detail 保留 `source=loop-snapshot` 与创建时间作为审计来源；
- 已完成：detail 页展示 per-loop recipe timeline、当前 gate、runtime owner 和 evidence link count；
- 已完成：Detail 读取 snapshot 身份并动态计算步骤状态，recipe 身份变更不影响历史 Loop 审计。

## Epic 2：Multi-review Gate

状态：已实施 dashboard v1 + 后端 `LoopReviewGate` contract/list/detail 派生 v2 + detail Delivery Controls v3 + Review Inbox gate 聚合 v5 + file-backed gate override/waiver 审计 v6；per-loop required gates 配置 UI 后续 Epic。

### 背景

gstack 的 `/autoplan` 将 CEO、Design、Eng、DX review 串成计划审查流水线。DofeAI 当前 Spec Review 已有 v1，但 review 类型还不够细。

### 建议数据模型

```typescript
export const LoopReviewGateSchema = z.object({
  kind: z.enum(['product', 'architecture', 'design', 'devex', 'security', 'code']),
  status: z.enum(['pending', 'passed', 'needs_changes', 'waived']),
  reviewer: z.enum(['agent', 'human', 'external']),
  confidence: z.number().min(0).max(1).optional(),
  findingsCount: z.number().default(0),
  evidenceId: z.string().optional(),
  requiredByStepId: z.string(),
});
```

### 实施建议

- P0：只做 product/architecture/code/security 四类；
- P1：补 design/devex；
- 每个 gate 先允许 report-only，避免阻断开发；
- 当 Loop 进入 ship/release 前，required gates 必须 passed 或 waived。

### 验收标准

- 已完成：dashboard 基于现有 phase、global verdict、pause/cost guard 派生 Product / Architecture / Code / Security gate 与 passed/pending/blocked 状态；
- 已完成：`LoopReviewGate` Zod contract 已在 `packages/contracts/src/schemas/loops.schema.ts` 定义并导出类型；
- 已完成：后端 list/detail payload 已派生 product / architecture / code / security gate，并把 reviewer 限定为 human、Codex 或系统角色；
- 已完成：Detail 页展示每类 review gate 的状态、reviewer、findings 和 waiver reason；
- 已完成：Review Inbox 按 gate kind 聚合 product / architecture / code / security / release / exception 人工决策项；
- 已完成：delivery governance 可记录 review gate passed/blocked/waived override，并影响 Detail/List 派生 gate 状态；
- 已完成：Release Gate 的 `requiredReviewsPassed` 引用持久化 review gate override/waiver 状态；
- 后续：per-loop required gates 配置 UI 和更细 gate 规则。

## Epic 3：Browser QA Worker

状态：已实施 report-only v1 + Loop Detail 前端触发 UI v2 + Playwright trace evidence v3 + auth session ref/session policy governance v4 + visual regression/browser handoff artifacts v5：`runBrowserQa` API + Playwright CLI worker + file-backed Browser QA report/evidence + detail Delivery Actions；真实 authenticated session profile、高级像素阈值/多 viewport visual regression 和 QA bug 自动回归后续 Epic。

### 背景

gstack 的 persistent browser 是强能力。DofeAI 如要成为“交付控制面”，需要能验证用户可见结果，而不只是验证代码 diff。

### MVP 范围

- Loop issue 支持 `qaTargetUrl`；
- Worker 能打开页面，采集 screenshot、title、console errors、network failures；
- 支持 report-only，不自动修复；
- 将截图和日志 summary 写入 evidence；
- 如果需要登录，先支持“人工提供测试账号/步骤说明”，不做 cookie import。

### Evidence 类型

```typescript
export const BrowserQaEvidenceSchema = z.object({
  targetUrl: z.string().url(),
  status: z.enum(['passed', 'failed', 'blocked']),
  screenshots: z.array(z.object({ path: z.string(), label: z.string() })),
  consoleErrors: z.array(z.string()),
  networkFailures: z.array(z.object({ url: z.string(), status: z.number().optional() })),
  checkedFlows: z.array(z.string()),
  blockedReason: z.string().optional(),
});
```

### 后续增强

- 已完成：`LoopBrowserQaRequest` / `LoopBrowserQaReport` contract；
- 已完成：`runBrowserQa` API 可触发 report-only Browser QA；
- 已完成：Playwright CLI worker 打开目标 URL，采集 title、截图路径、console errors 和 4xx/5xx network failures；
- 已完成：Browser QA report 写入 `.loops/runs/<issueId>/browser-qa/<reportId>.json/.md`，并作为 detail evidence artifact 暴露；
- 已完成：Release Gate 在存在 Browser QA report 时按最新 report status 判定 `browserQaPassed`；
- 已完成：Loop Detail 的 Delivery Actions 支持输入 target URL、checked flows、notes 并触发 report-only Browser QA；
- 已完成：Browser QA report 采集 Playwright trace zip，并在 file-backed Markdown evidence 中渲染 trace 路径；
- 已完成：`LoopBrowserQaRequest` 支持 `authSessionRef`，Delivery Actions 支持 Browser QA session policy 记录 authMode/testAccountRef；
- 已完成：Browser QA log payload 写入 trace 引用，可进入 `/loops/[issueId]` trace timeline 事件流；
- 已完成：Browser QA worker 维护 issue 级 baseline screenshot，后续运行产出 visualDiffs baseline/actual/diff artifact；
- 已完成：Browser QA worker 写入 handoff JSON，记录 targetUrl、title、screenshot、trace、visualStatus、console/network 摘要；
- 后续：authenticated session profile；
- 后续：高级像素阈值、多 viewport visual regression；
- 后续：QA bug 自动生成 regression test；

## Epic 4：Learning & Decision Memory

状态：已实施 finalize 后 LoopLearning v1、Loop detail 可视化 v2、新建 Loop preview recent learning 召回 v3、Dashboard top/stale learning 展示 v4、人工 dismiss + merge API/file-backed governance v5、Dashboard merge UI v6、自动 fingerprint/tags + similarity merge suggestions v7、delivery governance learning policy v8、auto-merge worker pending approvals v9；真实跨 workspace 索引执行和审批 UI 后续 Epic。

### 背景

gstack 的 `/learn` 和 GBrain 强调跨会话复利。DofeAI 现有 evidence/trace 已经天然适合沉淀，但缺少“学习条目”的一等对象。

### 建议能力

- 每次 Loop finalize 后生成 `LoopLearning`：
  - what worked；
  - what failed；
  - repo-specific rule；
  - test command；
  - file ownership hint；
  - recurring blocker；
  - review pattern。
- 创建新 Loop 时按 repo/source/template 检索相关 learning；
- Dashboard 展示近期 top learnings 和 stale learnings。

### Contract 草案

```typescript
export const LoopLearningSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  repo: z.string().optional(),
  kind: z.enum(['pattern', 'pitfall', 'decision', 'test_policy', 'ownership', 'security']),
  summary: z.string(),
  evidenceIds: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  lastUsedAt: z.coerce.date().optional(),
  createdAt: z.coerce.date(),
});
```

### 验收标准

- 已完成：Loop finalize 后将 final summary、test command、file ownership hint 和 review pattern 保存为 file-backed LoopLearning；
- 已完成：Loop detail 可读取并返回 learnings；
- 已完成：Loop detail 展示 Learning Memory 摘要、类型、置信度、证据链接数和 repo 来源；
- 已完成：`listWorkspaces` 返回 current workspace 的 recent learnings，新建 Loop preview 按目标 repo 展示相关 learning；
- 已完成：Dashboard 展示 top learnings 和未复用 stale learnings；
- 已完成：`LoopLearningGovernance` contract 与 `governLearning` API 可记录 dismiss/merge 治理；
- 已完成：`.loops/learning-governance.json` 持久化治理记录，`readRecentLearnings` 过滤 dismissed learning 与 merged source；
- 已完成：Dashboard stale learning 支持人工 dismiss；
- 已完成：Dashboard stale learning 支持人工 merge 到 top learning；
- 已完成：LoopLearning 自动生成 fingerprint/tags，`readRecentLearnings` 为旧记录补齐内存态 enrichment；
- 已完成：Dashboard stale learning 展示 similarity suggestions，并优先以相似 learning 作为 merge target；
- 已完成：delivery governance 可记录 learning dedupeScope 与 autoMergeApproval 策略；
- 已完成：`runLearningAutoMergeWorker` 将 similarity suggestions 固化为 `pending-approval` autoMergeCandidates，不自动 merge；
- 后续：真实跨 workspace 索引执行、审批 UI 和更强相似度模型。

## Epic 5：Second Opinion Agent

状态：已实施 report-only contract/detail v1 + Claude Code secondary reviewer worker/file-backed evidence v2 + finding fingerprint 精确比对 v3 + Loop Detail 前端触发 UI v4 + delivery governance requiredForRelease/conflictHumanGate policy v5；冲突 human gate 队列和 release hard gate UI 后续 Epic。必须围绕 Codex CLI 与 Claude Code CLI 两条底层运行时做 reviewer 归因，不扩大到任意 host。

### 背景

gstack 的 `/codex` 用不同模型做独立审查，并对比重叠/差异 findings。DofeAI 的 Provider Profile v1 已有基础，可以做成结构化 review artifact。

### 建议能力

- 支持 primary reviewer 与 secondary reviewer；
- 对 findings 做 fingerprint；
- 标记 agreement、conflict、unique；
- 高风险 conflict 触发 human gate。

### 验收标准

- 已完成：`LoopSecondOpinion` contract 可表达 primary Codex reviewer、secondary Claude Code reviewer、agreement/conflict/primary-only/secondary-only 比较结果；
- 已完成：Loop detail 派生 report-only second opinion，并在 Delivery Controls 展示 primary / secondary reviewer 状态和比较指标；
- 已完成：Release Gate checklist 预留 `secondOpinionPassed`，当前 `requiredForRelease=false` 时不阻断发布；
- 已完成：`runSecondOpinion` API 可触发 Claude Code secondary reviewer worker；
- 已完成：Second Opinion 写入 `.loops/runs/<issueId>/second-opinion.json/.md`，detail 优先读取持久化 worker report；
- 已完成：CLI 不可用或 schema 不符时记录 pending/not_run，不冒充审查通过；
- 已完成：对 findings 做精确 fingerprint，标记 agreement、conflict、primary-only 和 secondary-only；
- 已完成：Loop Detail 的 Delivery Actions 支持触发 Claude Code secondary reviewer；
- 已完成：delivery governance 可配置 Second Opinion `requiredForRelease` 与 `conflictHumanGate`，并影响 release checklist；
- 后续：高风险 conflict 进入 human gate 队列，并提供 release hard gate UI。

## Epic 6：Release Gate

状态：已实施 dashboard Release Readiness/Ready to Ship lane v4 + 后端 `LoopReleaseGate` contract/list/detail 派生 v2 + detail Delivery Controls v3 + PR summary evidence v6 + file-backed release canary checklist v7；rollback/canary worker 与真实发布阻断后续 Epic。

### 背景

gstack 的 `/ship`、`/land-and-deploy`、`/canary` 把发布变成一条流程。DofeAI 当前更偏任务完成证据，需要更明确地判断“能否发布”。

### Release Gate 检查项

- Spec approved；
- implementation evidence present；
- tests passed；
- required reviews passed/waived；
- security review passed or not required；
- browser QA passed or blocked with reason；
- docs updated or not applicable；
- PR branch/link present；
- rollback/canary note present for risky changes。

### UI 落点

- 已完成：Dashboard 新增 Release Readiness；
- 已完成：`LoopReleaseGate` Zod contract 已在 `packages/contracts/src/schemas/loops.schema.ts` 定义并导出类型；
- 已完成：后端 list/detail payload 已派生 spec、implementation、tests、required reviews、Browser QA、PR/rollback checklist；
- 已完成：Detail 页新增 release checklist、blocker 和 evidence link count 展示；
- 已完成：Dashboard 新增 Ready to Ship lane，将未关闭但已进入 converge/global review/annotate 或 global PASS 的 Loop 与 Delivered 分离；
- 已完成：PR summary 自动引用 present evidence artifacts，并避免引用 pending convergence-pr 自身。
- 已完成：delivery governance 可记录 release canary status/targetUrl/reason，并将 `canaryPassed` 加入 Release Gate checklist。

## Epic 7：Runtime Security Gate

状态：已实施 runner shell control operator 阻断 v1 + test command policy snapshot 持久化 v2 + runtime env-token canary 检测/脱敏 v3 + Dashboard Exception Center 聚合 v4 + file-backed runtime override 审计记录 v5 + network/write 命令策略阻断 v6；OS/container 级 network/write sandbox 和 override 执行层审批拦截后续 Epic。

### 背景

gstack 的 guard/freeze/careful 体现了执行前安全。DofeAI 已有 Permission Profile v1，但仍是展示型。

### 建议策略

| 权限    | 默认策略                  | 需要审批的情况                                   |
| ------- | ------------------------- | ------------------------------------------------ |
| Read    | allow                     | 读取 secret/env/private key                      |
| Write   | scoped allow              | 跨 workspace、生成迁移、改 CI                    |
| Shell   | allowlist                 | destructive command、network install、force push |
| Network | deny by default in worker | 外部 API、上传 artifact                          |
| Secrets | never expose              | 任意日志/trace/LLM prompt 输出                   |

### 验收标准

- 已完成：runner 测试命令执行前阻断 shell control operators，并将阻断原因写入 test record failedTests；
- 已完成：runner 每次 test-command run 都在 `LoopTestRecord.runtimeSecurityPolicy` 记录 shell allowlist、blocked operators、network/write 默认策略和 approval override 状态；
- 已完成：file-backed test record Markdown 渲染 Runtime Security Policy 摘要，便于审计；
- 已完成：runner 对允许命令注入 `LOOPS_RUNTIME_CANARY`，检测 stdout/stderr 泄露并在持久化前脱敏；
- 已完成：`runtime-security:*` failedTests 聚合到 Dashboard Exception Center，展示 owner/action/evidence/impact/retryAction；
- 已完成：delivery governance 可记录 runtime override 的 scope、原因、操作者和过期时间；
- 已完成：runner 在命令进入 shell 前阻断常见 network tools/package install，并在 policy snapshot 记录 blockedTools；
- 已完成：runner 在命令进入 shell 前阻断明显跨 workspace 写入模式，并在 policy snapshot 记录 blockedPatterns；
- 后续：OS/container 级 network/write sandbox、override 执行层审批拦截和发布 canary worker。

## 路线图汇总

| 阶段    | 时间建议 | 交付                                                            |
| ------- | -------- | --------------------------------------------------------------- |
| Phase 1 | 1-2 周   | Workflow Recipe + Multi-review Gate v1                          |
| Phase 2 | 2-4 周   | Release Gate + Second Opinion Review                            |
| Phase 3 | 4-6 周   | Browser QA Worker report-only                                   |
| Phase 4 | 6-8 周   | Learning Memory + Runtime Security Gate                         |
| Phase 5 | 8 周后   | Browser QA fix loop、Loop Bench、team workflow pack marketplace |

## 不建议立即做

- 不建议马上复刻 gstack 54 个技能；会制造维护负担。
- 不建议一开始做 cookie import；安全和用户信任成本高。
- 不建议直接引入外部长期记忆数据库；先把 evidence -> learning 的本地/DB 闭环做好。
- 不建议用纯 Markdown 作为 DofeAI 的 workflow 源；应保持 Zod-first contract 和后端状态机优势。
