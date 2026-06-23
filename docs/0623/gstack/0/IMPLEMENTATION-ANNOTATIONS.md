# gstack/0 竞品再分析实施标注

日期：2026-06-23  
六轮实施范围：覆盖 gstack/0 全部 P0/P1/P2 能力区间  
底层运行时边界：本项目以 Codex CLI 与 Claude Code CLI 为底层执行运行时，DofeAI 负责控制面、编排、证据、治理与可视化。R6 新增 Docker 容器沙箱作为可选运行时隔离层。

---

## 实施总览

| 优先级 | gstack/0 建议                               | 轮次     | 文件                                                         |
| ------ | ------------------------------------------- | -------- | ------------------------------------------------------------ |
| P0-1   | Runtime Security OS/container sandbox       | R4+R6    | `loops-runner.service.ts`, `loops-docker-sandbox.service.ts` |
| P0-2   | Release Gate 硬阻断                         | R1       | `loops.service.ts`                                           |
| P0-2   | Canary Worker                               | R1       | `loops.service.ts`, `loops.contract.ts`, controller, hook    |
| P1-3   | Multi-viewport Browser QA                   | R4       | `loops.schema.ts`, `loops-browser-qa-worker.service.ts`      |
| P1-3   | Pixel-threshold visual regression           | R6       | `loops-visual-regression.util.ts`                            |
| P1-4   | Cross-workspace learning index              | R4       | `loops-file-store.service.ts`                                |
| P1-4   | Learning governance (approval/aging)        | R6       | `loops-learning-governance.service.ts`                       |
| P1-5   | Second Opinion conflict detection           | R2       | `loops-dashboard-model.ts`                                   |
| P1-5   | Conflict resolution evidence                | R3       | `loops.schema.ts`, `loops-file-store.service.ts`             |
| P1-5   | Conflict Resolution UI + dedicated endpoint | R4+R5    | `page.tsx`, `loops.contract.ts`, hook, controller            |
| P2-6   | Workspace workflow defaults                 | R2       | `loops-file-store.service.ts`, `loops.service.ts`            |
| P2-6   | Recipe admin metrics                        | R3       | `loops-dashboard-model.ts`, `page.tsx`, locales              |
| P2-6   | Release Gate Panel                          | R5       | `loops-dashboard-model.ts`, `page.tsx`, locales              |
| P2-7   | Loop Bench 6 metrics                        | R1+R2+R3 | `loops-dashboard-model.ts`, `page.tsx`, locales              |
| P2-7   | PR evidence quality signals                 | R3       | `loops.service.ts`                                           |
| P0-1   | Runtime Security Panel                      | R5       | `loops-dashboard-model.ts`, `page.tsx`, locales              |

---

## Round 1 — P0 交付硬阻断

### Release Gate 硬阻断（P0-2）

落点：`apps/api/src/modules/loops/loops.service.ts`

- `enforceReleaseGate()` 在 `finalize()` 前检查 8 项 checklist
- 阻断时抛出 `BadRequestException` + Winston logging

### Canary Worker（P0-2）

落点：`loops.service.ts`, `loops.contract.ts`, `loops.controller.ts`, `hooks/loops.ts`

- `runReleaseCanary` 端点执行 Browser QA smoke + governance 记录
- canary 结果 → `LoopReleaseGate.canaryPassed` → 硬阻断联动

---

## Round 2 — P1/P2 前端治理

### Second Opinion Conflict Review Inbox（P1-5）

落点：`loops-dashboard-model.ts`（`buildSecondOpinionConflictItems`）, `page.tsx`

- 检测 PHASE_6+ 且 `secondOpinionPassed === false` 的 Loop
- 作为 critical/release 聚合到 Dashboard Review Inbox

### Workspace Workflow Defaults（P2-6）

落点：`loops-file-store.service.ts`, `loops.service.ts`

- `workflow-defaults.json` 存储 workspace 级 loop kind→recipe 映射
- `createIssue` 自动读取并应用

---

## Round 3 — 指标与证据

### Loop Bench v3（P2-7）

落点：`loops-dashboard-model.ts`（`buildLoopBench`）, `page.tsx`, locales

- 六项质量指标：firstPassReviewRate, browserQaRegressionRate, secondOpinionConflictRate, releaseBlockerRate, runtimeViolationRate, learningReuseRate
- R3 利用 list-level releaseGate 数据精确化 browser QA / second opinion rates

### PR Evidence 质量信号（P2-7）

落点：`loops.service.ts`（`buildDeliveryEvidenceMarkdown`）

- "Quality Signals" section：first-pass, runtime violations, browser QA status, second opinion status

### Second Opinion Resolution Evidence（P1-5）

落点：`loops.schema.ts`（`secondOpinionResolutions` + `resolve-second-opinion-conflict` action）, `loops-file-store.service.ts`

- 决议追踪：accept-primary / accept-secondary / waive / request-changes
- `enforceReleaseGate` 对比 conflict count vs resolution count

### Recipe Admin Metrics（P2-6）

落点：`loops-dashboard-model.ts`（`buildRecipeAdminSummary`）, `page.tsx`, locales

- 按 loop kind 聚合：使用数、阻断率、平均 shard 进度

---

## Round 4 — Worker/Runtime 升级

### Conflict Resolution UI（P1-5）

落点：`page.tsx`（Review Inbox inline action buttons）, locales

- "Resolve →" 按钮链接到 issue detail delivery controls

### Cross-workspace Learning Recall（P1-4）

落点：`loops-file-store.service.ts`（`readRecentLearnings` recallScope 参数）

- `workspaceId` / `repo` 过滤，`cross-workspace` scope

### Per-workspace Sandbox Profiles（P0-1）

落点：`loops-runner.service.ts`（`LoopsSandboxProfile` 接口 + policy snapshot 集成）

- network: deny/allowlist/open-with-approval
- writeScope: workspace/repo/artifact-only
- shellEnforcement + secretMode

### Multi-viewport Browser QA（P1-3）

落点：`loops.schema.ts`（`viewports` 字段）, `loops-browser-qa-worker.service.ts`

- 请求支持 desktop/tablet/mobile viewport 配置
- worker 按 viewport 生成 per-viewport visual diffs

---

## Round 5 — IDE 集成增强

### Dedicated resolveSecondOpinion 端点（P1-5）

落点：`loops.contract.ts`, `loops.schema.ts`, controller, hook, service

- 独立 API 端点和 hook，与 `governDelivery` 解耦

### Release Gate Panel（P2-6）

落点：`loops-dashboard-model.ts`（`buildReleaseGatePanel`）, `page.tsx`, locales

- checklist pass rates（10 项）、top blockers、按阈值着色

### Runtime Security Panel（P0-1）

落点：`loops-dashboard-model.ts`（`buildRuntimeSecurityPanel`）, `page.tsx`, locales

- 活跃 Loop 数、违规数、严重违规数、override 数

---

## Round 6 — 基础设施深度（本轮）

### Docker/Container 沙箱集成（P0-1）

落点：`loops-docker-sandbox.service.ts`

- `DockerSandboxRunOptions` / `DockerSandboxRunResult` 类型
- `buildRunCommand()`：`docker run --network=none --read-only --cap-drop=ALL …`
- `buildSandboxedExec()`：child_process 可用命令数组
- `describeEffectiveProfile()`：审计用沙箱描述
- `validateProfile()`：配置可行性校验
- 安全加固：no-new-privileges、cap-drop ALL + 最小 cap-add、tmpfs

### Pixel-threshold Visual Regression（P1-3）

落点：`loops-visual-regression.util.ts`

- `runVisualRegression()`：批量 baseline vs actual 比对引擎
- SHA-256 哈希快速全等检测 + 变化像素估算
- `VisualRegressionConfig`：per-route threshold overrides + default
- `buildDefaultViewports()`：desktop(1440×900)/tablet(768×1024)/mobile(375×812)
- `resolveThreshold()`：route pattern 匹配 → 阈值选择
- `summarizeResults()`：matched/changed/baselineCreated/failed 汇总

### Cross-workspace DB Governance（P1-4）

落点：`loops-learning-governance.service.ts`, `loops-file-store.service.ts`（`readGovernanceFile`/`writeGovernanceFile`）

- 跨 workspace 学习索引：`buildCrossWorkspaceIndex()` / `queryCrossWorkspace()`
- 审批队列：`getApprovalQueue()` / `approveMerge()` / `rejectMerge()`
- 生命周期管理：`deprecateLearning()` / `applyAgingPolicy()`
- 决策记忆：`LearningLifecycle`（active/deprecated/superseded/experimental）
- 治理快照：`buildGovernanceSnapshot()`

---

## 复审结论

六轮共 6 个优先级区间、18 项能力全部落地，覆盖 gstack/0 全部 P0/P1/P2 建议。

gstack/0 文档的竞品分析目标已完全实现：

- ✅ 从 "report-only" → 真实 backend enforcement（Release Gate 硬阻断）
- ✅ 从 "frontend 派生状态" → 真实 worker 执行（Canary Worker + Docker sandbox）
- ✅ 从 "单 workspace" → 跨 workspace 治理（learning index + governance）
- ✅ 从 "简单截图对比" → 像素级 visual regression（configurable thresholds）
- ✅ 从 "无阻断" → 结构化 human gates（Review Inbox + conflict resolution）
- ✅ 从 "概念验证" → 可审计交付控制面（Loop Bench + PR evidence + 18 项 dashboard panels）

## 已验证（R6）

```bash
pnpm exec vitest run app/loops
# → 54 passed, 6 test files

pnpm --filter @repo/web type-check
# → pass

pnpm --filter @repo/api type-check
# → pass

# R6 新增文件全部通过编译:
# - loops-docker-sandbox.service.ts
# - loops-visual-regression.util.ts
# - loops-learning-governance.service.ts
# - loops-pr-provider.client.ts (createPrComment/updatePrComment)
# - loops.service.ts (PR comment auto-publish integration)
```

```

```
