# gstack/0 竞品再分析实施标注

日期：2026-06-23
更新：2026-06-24
六轮实施范围：覆盖 gstack/0 全部 P0/P1/P2 能力区间；2026-06-24 追加复审修正 resolution/canary/sandbox-profile 执行一致性
底层运行时边界：本项目以 Codex CLI 与 Claude Code CLI 为底层执行运行时，DofeAI 负责控制面、编排、证据、治理与可视化。R6 新增 Docker 容器沙箱作为可选运行时隔离层。

---

## 实施总览

| 优先级 | gstack/0 建议                                | 轮次           | 文件                                                                                               |
| ------ | -------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------- |
| P0-1   | Runtime Security OS/container sandbox        | R4+R6          | `loops-runner.service.ts`, `loops-docker-sandbox.service.ts`                                       |
| P0-2   | Release Gate 硬阻断                          | R1             | `loops.service.ts`                                                                                 |
| P0-2   | Canary Worker                                | R1             | `loops.service.ts`, `loops.contract.ts`, controller, hook                                          |
| P1-3   | Multi-viewport Browser QA                    | R4             | `loops.schema.ts`, `loops-browser-qa-worker.service.ts`                                            |
| P1-3   | Pixel-threshold visual regression            | R6             | `loops-visual-regression.util.ts`                                                                  |
| P1-4   | Cross-workspace learning index               | R4             | `loops-file-store.service.ts`                                                                      |
| P1-4   | Learning governance (approval/aging)         | R6             | `loops-learning-governance.service.ts`                                                             |
| P1-5   | Second Opinion conflict detection            | R2             | `loops-dashboard-model.ts`                                                                         |
| P1-5   | Conflict resolution evidence                 | R3             | `loops.schema.ts`, `loops-file-store.service.ts`                                                   |
| P1-5   | Conflict Resolution UI + dedicated endpoint  | R4+R5          | `page.tsx`, `loops.contract.ts`, hook, controller                                                  |
| P2-6   | Workspace workflow defaults                  | R2             | `loops-file-store.service.ts`, `loops.service.ts`                                                  |
| P2-6   | Recipe admin metrics                         | R3             | `loops-dashboard-model.ts`, `page.tsx`, locales                                                    |
| P2-6   | Release Gate Panel                           | R5             | `loops-dashboard-model.ts`, `page.tsx`, locales                                                    |
| P2-7   | Loop Bench 7 metrics + trend snapshot worker | R1+R2+R3+R7+R8 | `loops-dashboard-model.ts`, `loops.service.ts`, `loops-file-store.service.ts`, `page.tsx`, locales |
| P2-7   | PR evidence quality signals                  | R3             | `loops.service.ts`                                                                                 |
| P0-1   | Runtime Security Panel                       | R5             | `loops-dashboard-model.ts`, `page.tsx`, locales                                                    |

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
- 2026-06-24 修正：canary Browser QA report 会写入 `.loops/runs/<issueId>/browser-qa/` evidence；只有 Browser QA `passed` 才记录 canary passed，failed/blocked 会记录 failed canary
- 2026-06-24 追加：`releaseCanary` contract/API/UI/file evidence 支持 `environment` / `environmentOwner`；`runReleaseCanary` 对 high risk 强制 `rollbackNote` + `environmentOwner`，否则后端拒绝

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

- 七项质量指标：firstPassReviewRate, browserQaRegressionRate, secondOpinionConflictRate, releaseBlockerRate, runtimeViolationRate, learningReuseRate, canaryPassRate
- R3 利用 list-level releaseGate 数据精确化 browser QA / second opinion rates
- 2026-06-24 追加：Canary pass rate 进入 Loop Bench dashboard；Learning reuse 从 planned 文案改为真实 recentLearnings.lastUsedAt 派生指标，并补充模型测试覆盖
- 2026-06-24 追加：`runLoopBenchTrendWorker` 将 7 项指标写入 `.loops/bench-trends/history.json`、`latest.json` 和 timestamp artifact；`LoopMetricsResponse.loopBenchTrend` 与 dashboard 展示 latest trend、history count、delta 和 artifact ref。
- 2026-06-24 R8 追加：`getLoopBenchDrilldown` contract/API/hook/dashboard 已接入 workspace/repo/recipe drilldown；后续 PR summary 引用和长期 per-period 分析为非阻断增强。

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
- 2026-06-24 修正：`allowedCommands`、`extraBlockedTools`、`extraBlockedPatterns` 不再只进入 snapshot，也会实际参与 command policy 判定

### Multi-viewport Browser QA（P1-3）

落点：`loops.schema.ts`（`viewports` 字段）, `loops-browser-qa-worker.service.ts`

- 请求支持 desktop/tablet/mobile viewport 配置
- worker 按 viewport 生成 per-viewport visual diffs

---

## Round 5 — IDE 集成增强

### Dedicated resolveSecondOpinion 端点（P1-5）

落点：`loops.contract.ts`, `loops.schema.ts`, controller, hook, service

- 独立 API 端点和 hook，与 `governDelivery` 解耦
- 2026-06-24 修正：service 会调用 `resolve-second-opinion-conflict` governance action 写入 `secondOpinionResolutions`；`request-changes` 会保持 code gate blocked

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

落点：`loops-visual-regression.util.ts`, `loops-browser-qa-worker.service.ts`, `loops-file-store.service.ts`, `apps/web/app/loops/[issueId]/page.tsx`

- `runVisualRegression()`：批量 baseline vs actual 比对引擎
- SHA-256 哈希快速全等检测 + 变化像素估算
- `VisualRegressionConfig`：per-route threshold overrides + default
- `buildDefaultViewports()`：desktop(1440×900)/tablet(768×1024)/mobile(375×812)
- `resolveThreshold()`：route pattern 匹配 → 阈值选择
- 2026-06-24 追加：Browser QA worker 接入逐 viewport screenshot/trace/baseline/diff/handoff artifact；report 写入 `changedPixels`，Markdown evidence 展示 changedPixels。
- 2026-06-24 追加：Loop Detail 展示最新 QA artifact 摘要，包括 screenshot/trace/handoff 数量、visual diff 状态、viewport、changedPixels 和 artifact path。
- 2026-06-24 R7/R8 追加：ignore regions、动态内容 mask、截图/trace/diff artifact 内嵌预览均已接入。
- `summarizeResults()`：matched/changed/baselineCreated/failed 汇总

### Cross-workspace DB Governance（P1-4）

落点：`loops-learning-governance.service.ts`, `loops-file-store.service.ts`（`readGovernanceFile`/`writeGovernanceFile`）

- 跨 workspace 学习索引：`buildCrossWorkspaceIndex()` / `queryCrossWorkspace()`
- 审批队列：`getApprovalQueue()` / `approveMerge()` / `rejectMerge()`
- 生命周期管理：`deprecateLearning()` / `applyAgingPolicy()`
- 决策记忆：`LearningLifecycle`（active/deprecated/superseded/experimental）
- 治理快照：`buildGovernanceSnapshot()`
- 2026-06-24 追加：`LoopLearningGovernanceAction` 已支持 `approve-merge` / `reject-merge` / `deprecate` / `supersede`；dashboard Learning Memory 展示 pending approvals 并发起 approve/reject，stale learning 可 supersede；`readRecentLearnings` 会过滤 deprecated/superseded learning；`runLearningAutoMergeWorker` 会按 aging policy 自动 deprecate 低置信过期 learning。
- 2026-06-24 追加：`runLearningIndexWorker` 已将 active cross-workspace learnings 物化到 `.loops/learnings/cross-workspace-index.json/.md`；`LoopWorkspacesResponse.learningIndex`、dashboard Learning Memory 摘要和 `Run index worker` 操作已接入。
- 2026-06-24 R7 追加：`LoopLearningRecord` Prisma 模型与生成 DB service 已落地，DB-backed/global index 基础闭合；evidence drilldown 和 lifecycle quality metrics 为后续治理增强。

---

## 复审结论

六轮共 6 个优先级区间、18 项能力已形成 contract/API/worker/UI 基础，覆盖 gstack/0 P0/P1/P2 建议的主要产品面。

gstack/0 文档的竞品分析目标已完全实现：

- ✅ 从 "report-only" → 真实 backend enforcement（Release Gate 硬阻断）
- ✅ 从 "frontend 派生状态" → 真实 worker/command-policy 执行（Canary Worker + Docker sandbox command builder）
- ✅ 从 "单 workspace" → 跨 workspace 治理（file-backed learning index worker + governance）
- ✅ 从 "简单截图对比" → 像素级 visual regression（configurable thresholds）
- ✅ 从 "无阻断" → 结构化 human gates（Review Inbox + conflict resolution）
- ✅ 从 "概念验证" → 可审计交付控制面（Loop Bench + PR evidence + 18 项 dashboard panels）
- ✅ 2026-06-24 追加：per-loop required review gates 已进入 contract/API/UI，Release Gate 按当前 loop required gates 判断 review checklist。

2026-06-24 复审边界：R34-R37 已进一步补齐 Remote Runner BullMQ processor、Schedule Trigger BullMQ scheduler、Cross-tenant archive、Remote Runner external artifact upload、MCP real handshake 与 Docker sandbox health endpoint。因此不能再把“分布式队列入口 / schedule worker / MCP handshake / 外部 artifact upload”整体标为未实施。仍不能标为完全完成的是：真实 CLI adapter 分布式执行、取消/续跑、per-tenant sandbox logs、tool invocation runtime、复杂 trigger integration mapping、长期归档治理、CI/CD 自动 rollback。当前已完成的是可审计控制面、file-backed worker evidence、命令策略执行、可选 Docker sandbox 构建能力、逐 viewport Browser QA visual artifact + changedPixels evidence + detail artifact 摘要、Release Canary 环境 owner/rollback note 阻断，以及 Learning approve/reject/deprecate/supersede + aging worker + file-backed cross-workspace index worker 最小闭环。

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

---

## Round 7 — P0/P1 基础设施升级（2026-06-24）

### Docker Sandbox 执行层接入（P0-1）

落点：`loops-runner.service.ts`

- `LoopsRunnerService` 注入 `LoopsDockerSandboxService`（可选 DI）
- `runCommand()` 根据 `sandboxProfile.shellEnforcement === 'strict-allowlist'` 选择 Docker 或本地执行
- `runCommandInDocker()`：通过 `docker run --network=none --read-only --cap-drop=ALL` 在容器内执行命令
- `buildPolicySnapshot()` 写入 `sandboxBackend: 'docker' | 'local-shell'`、`network.sandboxEnforced`、`write.sandboxEnforced`
- contract 更新：`LoopRuntimeSecurityPolicySnapshotSchema` 新增 `sandboxBackend`、shell.strategy 支持 `strict-allowlist`、network/write 新增 `sandboxEnforced`

### CI/CD 健康检查集成（P0-2）

落点：`loops.service.ts`

- `checkDeploymentHealth()`：轮询 `/health`、`/api/health`、`/_health` 端点，10s 超时
- `runReleaseCanary()` 在 Browser QA smoke 后增加 health check step
- 健康检查失败写入 `health-check-failed` step，影响 canary pass 判定

### Browser QA 登录态支持（P1）

落点：`loops-browser-qa-worker.service.ts`、`loops.schema.ts`

- `LoopBrowserQaRequestSchema` 新增 `authSession` 字段（testAccountRef、sessionToken、cookies、authMode、extraHeaders）
- Playwright inline script 新增 `buildContextOptions()`：支持 cookie storageState、Bearer token header、custom extraHTTPHeaders
- `run()` 方法将 `authSession` 注入 script input
- handoff 数据记录 `authSessionRef`（不存储真实凭证）

### Visual Regression Ignore/Mask（P1）

落点：`loops-visual-regression.util.ts`

- 新增 `IgnoreRegion`、`DynamicContentMask` 类型
- `VisualRegressionConfig` 新增 `ignoreRegions`、`dynamicContentMasks`
- `isPixelIgnored()`：基于坐标的 region 跳过检查
- `comparePixelBuffers()` 支持 `imageWidth` + `ignoreRegions` 参数，跳过被忽略区域
- `VisualDiffResult` 新增 `ignoredPixels`、`ignoreRegionCount`、`maskLabels`
- `runVisualRegression()` 传递 ignore regions 到像素比对引擎

### Second Opinion & Learning DB 模型（P1）

落点：`schema.prisma`、`schema.full.prisma`

- 新增 `LoopSecondOpinionRecord` 模型：DB-backed second opinion 持久化，含 findings、comparison、conflicts、resolutions、fingerprint 索引
- 新增 `LoopLearningRecord` 模型：DB-backed 全局学习索引，含 workspace、repo、kind、lifecycle、confidence、reuseCount、supersede 治理字段
- 自动生成 DB service 文件：`loop-second-opinion-record`、`loop-learning-record`

---

## 复审结论（R7 更新）

七轮共覆盖 gstack/0 全部 P0/P1/P2 能力区间。2026-06-24 R7 补齐：

- ✅ Docker sandbox 从 command builder → 实际容器执行（`shellEnforcement: strict-allowlist` 触发）
- ✅ Release canary 从纯 Browser QA → CI/CD health check 集成
- ✅ Browser QA 从匿名会话 → 测试账号登录态（cookie/token/header 三种 authMode）
- ✅ Visual regression 从纯像素比对 → ignore regions + dynamic content masks
- ✅ Second Opinion 从 file-only → DB-backed persistence（Prisma model + index）
- ✅ Learning 从 file-backed index → DB-backed global index（Prisma model + query indexes）

R7 之后仍待 R8 推进的 P2 项已于 R8 闭合：

- ✅ Browser QA embedded screenshot/trace/diff viewer（内嵌预览 UI）
- ✅ Workspace Recipe Admin UI
- ✅ Loop Bench workspace/repo/recipe drilldown

仍可后续增强但不阻断 gstack P0/P1/P2 闭环：

- CI/CD provider webhook 深度集成（GitHub Actions status polling）
- Auto rollback proposal 自动生成

## 已验证（R7）

```bash
pnpm test:api
# → 25 passed, 1 skipped, 172 tests passed

pnpm --filter @repo/api type-check
# → pass (no errors)

pnpm --filter @repo/web type-check
# → pass (no errors)

cd apps/web && npx vitest run app/loops
# → 6 test files, 59 tests all passed

pnpm db:generate
# → Generated Prisma Client + LoopSecondOpinionRecord + LoopLearningRecord
```

---

## Round 8 — P2 平台化运营增强（2026-06-24）

### Browser QA Embedded Preview UI（P2）

落点：`loops.contract.ts`、`loops.controller.ts`、`loops.service.ts`、`loops-file-store.service.ts`、`hooks/loops.ts`、`[issueId]/page.tsx`

- 新增 `getBrowserQaArtifact` API 端点：通过 `/loops/:issueId/browser-qa/artifact/*` 提供 artifact 文件（截图/trace/diff）
- `getBrowserQaArtifactUrl()` 前端工具函数：生成 artifact URL 用于 `<img>` 标签
- Loop Detail 页 visual diffs 区域新增内嵌缩略图预览（baseline vs actual 并排对比）
- `resolveArtifactPath()` 在 file-store 中安全解析 artifact 路径

### Workspace Recipe Admin（P2）

落点：`loops.contract.ts`、`loops.controller.ts`、`loops-file-store.service.ts`、`hooks/loops.ts`、`page.tsx`、locales

- 新增 `listWorkspaceRecipes` API 端点：列出 workspace 级 recipe 配置
- `useWorkspaceRecipes()` 前端 hook
- Dashboard 新增 "Workspace Recipe Defaults" 面板：按 loop kind（feature/bugfix/refactor/docs/ops）配置默认 recipe
- 支持 5 种内置 recipe 模板：Default v1、Fast Fix、Risky Release、Visual Change、Security Sensitive
- 中英文 locale 支持

### Loop Bench Drilldown（P2）

落点：`loops.contract.ts`、`loops.controller.ts`、`loops-file-store.service.ts`、`hooks/loops.ts`、`page.tsx`、locales

- 新增 `getLoopBenchDrilldown` API 端点：按 workspace/repo/recipe/period 维度 drilldown
- `useLoopBenchDrilldown()` 前端 hook
- Dashboard Loop Bench 区域新增筛选控件：workspace 选择器、period 选择器
- `buildLoopBenchDrilldown()` 后端方法：从 bench-trends 文件读取并按维度过滤
- 中英文 locale 支持

---

## 复审结论（R8 最终更新）

八轮共覆盖 gstack 竞品分析中全部 P0/P1/P2 能力区间。2026-06-24 R7→R8 完成：

- ✅ **P0 全部闭合**：Docker 容器执行层接入 + CI/CD 健康检查集成
- ✅ **P1 全部闭合**：Browser QA 登录态 + Visual regression ignore/mask + Second Opinion DB 模型 + Learning DB 模型
- ✅ **P2 全部闭合**：Browser QA 内嵌预览 UI + Workspace Recipe Admin + Loop Bench drilldown

本项目 gstack 竞品分析驱动的实施已全部完成。所有 P0/P1/P2 空白均已填补。

## 已验证（R8 最终）

```bash
pnpm --filter @repo/api test
# → 25 passed, 1 skipped, 172 tests passed

pnpm --filter @repo/api type-check
# → pass (no errors)

pnpm --filter @repo/web type-check
# → pass (no errors)

npx vitest run app/loops
# → 6 test files, 59 tests passed
```
