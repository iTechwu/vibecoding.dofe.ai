# 基于 gstack 的 DofeAI 优化路线图

## 总体原则

1. 不复制命令，抽象流程。
2. 不只展示状态，沉淀证据。
3. 不只允许 agent 执行，给每一步设置可审阅门禁。
4. 不只做单次任务，把学习和决策带到下一次 Loop。

## Epic 1：Workflow Recipe

状态：已实施 dashboard v1 + 后端 contract/list/detail 派生 v2 + detail Delivery Controls v3 + 创建时 per-loop recipe snapshot v4；workspace 默认配置后续 Epic。

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
- 后续：workspace 级 feature/bugfix/docs 默认 recipe 配置；
- 已完成：新建 Loop 时固化 per-loop recipe snapshot，Detail 保留 `source=loop-snapshot` 与创建时间作为审计来源；
- 已完成：detail 页展示 per-loop recipe timeline、当前 gate、runtime owner 和 evidence link count；
- 已完成：Detail 读取 snapshot 身份并动态计算步骤状态，recipe 身份变更不影响历史 Loop 审计。

## Epic 2：Multi-review Gate

状态：已实施 dashboard v1 + 后端 `LoopReviewGate` contract/list/detail 派生 v2 + detail Delivery Controls v3 + Review Inbox gate 聚合 v5；waiver 审计持久化后续 Epic。

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
- 后续：Release Gate 引用持久化 review gate 状态。

## Epic 3：Browser QA Worker

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

- Playwright trace；
- authenticated session profile；
- visual regression；
- browser handoff；
- QA bug 自动生成 regression test；
- 与 `/loops/[issueId]` trace timeline 合并。

## Epic 4：Learning & Decision Memory

状态：已实施 finalize 后 LoopLearning v1、Loop detail 可视化 v2、新建 Loop preview recent learning 召回 v3、Dashboard top/stale learning 展示 v4；跨 Loop 去重和治理后续 Epic。

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
- 后续：learning 可被人工 dismiss/merge；
- 后续：跨 Loop 去重和同类 learning 合并。

## Epic 5：Second Opinion Agent

状态：已实施 report-only contract/detail v1；真实 Claude Code secondary reviewer worker、finding fingerprint 比对和发布硬门禁后续 Epic。必须围绕 Codex CLI 与 Claude Code CLI 两条底层运行时做 reviewer 归因，不扩大到任意 host。

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
- 后续：真实 Claude Code secondary reviewer worker 产出独立 review evidence；
- 后续：对 findings 做 fingerprint，标记 agreement、conflict、unique；
- 后续：高风险 conflict 触发 human gate，并可配置为 release hard gate。

## Epic 6：Release Gate

状态：已实施 dashboard Release Readiness/Ready to Ship lane v4 + 后端 `LoopReleaseGate` contract/list/detail 派生 v2 + detail Delivery Controls v3 + PR summary evidence v6；rollback/canary 与真实发布阻断后续 Epic。

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

## Epic 7：Runtime Security Gate

状态：已实施 runner shell control operator 阻断 v1 + test command policy snapshot 持久化 v2；network/write 真实隔离、审批流和 canary 检测后续 Epic。

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
- 被阻断命令进入 Exception Center；
- human override 有原因、操作者、过期时间。

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
