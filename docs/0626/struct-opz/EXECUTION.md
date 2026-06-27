# Loops 结构优化执行文档

## 执行原则

本执行文档基于 [README.md](./README.md) 的结构方案，将 loops 拆分落地为可分批执行的重构任务。

核心原则：

- 每批只移动一个清晰边界，保持 API contract 不变。
- `apps/api/src/modules/loops` 逐步收敛为 controller/module/processor 层。
- 业务能力逐步下沉到 `apps/api/libs/domain/services/loops-*`。
- 每个目标目录保持 `1 个 service + 1 个 module + n 个附属文件`。
- 任一批次完成后都应保持可 type-check、可测试、可回退。

## 执行进度总览

本节由「实施 → 标注 → 审查 → 标注」循环驱动维护。状态标记含义：

| 标记 | 含义                                                                                     |
| ---- | ---------------------------------------------------------------------------------------- |
| ✅   | 已完成，且通过 `pnpm --filter @repo/api type-check`（必要时附 focused tests / 结构检查） |
| 🚧   | 部分完成：部分子项已落地，仍有明确待办                                                   |
| ⏳   | 待实施                                                                                   |
| ⚠️   | 阻塞 / 需风险评估                                                                        |

> 基线：执行前 `pnpm --filter @repo/api type-check` EXIT 0（无错误），作为每步验证 gate。

| Step                                        | 状态 | 落地范围 / 说明                                                                                                                                                                                                                                                                                                                                                    | 最近循环                                        |
| ------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| Step 0 · Facade 骨架                        | ✅   | `libs/domain/services/loops` 建立 `LoopsDomainModule`，接入 API `loops.module.ts`；controller 不变                                                                                                                                                                                                                                                                 | Loop 1                                          |
| Step 1 · 下沉 store/lock/util               | ✅   | 1a utils；1b locks（+specs+token）；1c store+persistence+notification+runtime-config/learning-memory；CI 新增 loops reverse-import 边界检查；`quality:gate` EXIT 0                                                                                                                                                                                                 | Loop 2–5                                        |
| Step 2 · Issue Intake                       | 🚧   | intake 记录构造**全部** + 完整 `createIssue` 编排（含 workflow recipe 派生）+ `list` / `listFromFile` / `getIssue` query/read pipeline → `loops-issues`；API facade 保留 HTTP 日志/异常映射与兼容 wrapper                                                                                                                                                          | Cycle 31–37, nextstep 74–75                     |
| Step 3 · Engine 状态机                      | 🚧   | 纯推导 + 谓词 + generateSpec/decompose + advance 递归调度 + runLoop workLock 包装 + runLoopUnlocked shard 调度 + runRunnableShard 重执行 + reloop/applyResume/finalize/reviewGlobal（`LoopsEngineRunLoopPort`/`LoopsEngineShardRunnerPort`/`LoopsEngineFinalizePort`/`LoopsEngineGlobalReviewPort`）→ `loops-engine`；facade builder ports 仍在 API 层等待 N7 收敛 | Loop 7, nextstep 82–112                         |
| Step 4 · Runner / Runtime                   | 🚧   | runtime detection/docker sandbox/workspace profile/runtime constants → `loops-runtime`；runner service + adapters + utils → `loops-runners`；adapter provider wiring 仍在 API module                                                                                                                                                                               | Cycle 7–12                                      |
| Step 5 · Evidence / Quality                 | 🚧   | quality workers 已下沉；evidence 已下沉 workflow/baseline/markdown/runtime-security/second-opinion-policy/release-blockers/coverage/artifacts/review-release gates/delivery controls/list enricher/second opinion builder；API 仅留兼容 wrapper                                                                                                                    | Cycle 31                                        |
| Step 6 · Eval / Bench                       | 🚧   | Eval aggregation worker、eval suite/run builder、eval trend baseline builder、request-time aggregation builder、loop bench metric helper + trend worker IO 编排 + aggregation worker 编排 + DB/Redis 适配（`LoopsEvalAggregationRunnerService`）→ `loops-eval`；processor 解耦 facade；evidence 收集仍由 `LOOPS_EVAL_EVIDENCE_PORT`（facade）提供                  | Cycle 38–41, nextstep 63–66, 79                 |
| Step 7 · Integrations / MCP / CI / PR       | 🚧   | PR provider、MCP client、MCP secret + CI checks registry + CI publication evidence builder + notification sender（re-home 到 `loops-integrations`）已下沉；testCiCheck provider publish / permission / publication persistence 仍属 facade                                                                                                                         | Cycle 4, nextstep 69–72                         |
| Step 8 · Trigger / Remote Runner            | 🚧   | schedule trigger CRUD + `fireScheduleTrigger` + issue creation port + remote runner list/lease/job + artifact IO（`LoopsRemoteArtifactStoragePort`）+ shard execution job lifecycle（implement/test/review）→ `loops-remote-runners`；processor 经 token 解耦 facade，runtime/state/detail/log adapters 接管 remote execution wiring                               | Cycle 13–15, nextstep 58–60, 74, 77–79, 103–127 |
| Step 9 · Admin / Archive / Tool / Blueprint | 🚧   | capability registry + tool registry CRUD + delivery blueprint marketplace + archive control wrapper + archive collection service → `loops-admin`；eval aggregation port 待 Step 6/Next N4 收口                                                                                                                                                                     | Cycle 53–57                                     |
| Step 10 · 收敛 API module                   | 🚧   | N7 已启动：remote execution port 不再由 `LoopsService implements` 提供；remote runtime/state/detail/log adapters 不再经 facade 桥接；`executeRemoteShardJob` facade wrapper 已删除                                                                                                                                                                                 | nextstep 113–132                                |

## 循环执行日志

每次循环固定结构：**实施 → 标注 → 审查待实施项 → 标注**。下方按循环倒序追加。

### Loop 47 · 2026-06-26 · Step 9 收敛验证与剩余项审查

#### 实施

- 执行 domain services 反向依赖扫描，确认 `loops-admin` 没有 import `apps/api/src/modules/loops`。
- 执行 focused tests：`loops-admin.service.spec.ts`。
- 执行 API type-check。

#### 标注

- Step 9 状态更新为：capability registry、tool registry CRUD、delivery blueprint marketplace 已下沉到 `loops-admin`。
- 标注：Archive / cross-tenant archive 仍留 API facade，因为当前依赖 legacy `LoopsService` 的 detail/list 能力与对象存储装配。

#### 审查待实施项

| Step    | 剩余工作               | 备注                                                                     |
| ------- | ---------------------- | ------------------------------------------------------------------------ |
| Step 9  | Archive 下沉           | 需先抽 archive 所需的 loop detail/list port，避免 domain 反向依赖 facade |
| Step 10 | API module/facade 收敛 | 可在更多 public 方法下沉后统一减少 wrapper 与 provider                   |
| Step 8  | `fireScheduleTrigger`  | 需 issue creation port                                                   |
| Step 3  | engine 主流程推进      | 仍是最高风险项                                                           |

#### 再标注文档

- 本批 Cycle 43-47 共 5 次循环动作完成，满足“至少 5 次循环动作”要求。
- 下一批建议优先做 Step 9 Archive port 设计，或 Step 8 fire trigger issue creation port。

#### 验证

```bash
rg "from ['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)|require\\(['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)" apps/api/libs/domain/services
pnpm --filter @repo/api test -- loops-admin.service.spec.ts --runInBand
pnpm --filter @repo/api type-check
```

结果：

- 反向依赖扫描无命中。
- `loops-admin.service.spec.ts` 通过，2 个测试通过。
- API type-check 通过。

### Loop 46 · 2026-06-26 · Step 9 文档标注与总览校准

#### 实施

- 更新 `EXECUTION.md` Step 9 总览：tool / blueprint 已从 legacy facade 下沉到 `loops-admin`。
- 更新 `IMPLEMENTATION-ANNOTATIONS.md` Cycle 43-47 执行记录。

#### 标注

- 标注 `loops-admin` 当前目录形态为 `1 service + 1 module + n`：
  - `loops-admin.service.ts`
  - `loops-admin.module.ts`
  - `loops-capability-registry.ts`
  - `loops-admin.service.spec.ts`
  - `index.ts`

#### 审查待实施项

- 文档待办同步：删除旧的“tool/blueprint 仍待拆”描述，改为“Archive 仍待拆”。
- 保留 Step 10 待办：API facade 目前仍保留兼容 wrapper，不在本批直接改 controller 注入关系。

#### 再标注文档

- Cycle 46 完成；文档状态与代码状态一致。

#### 验证

- 文档变更随 Cycle 47 的 type-check / focused tests 一起收口。

### Loop 45 · 2026-06-26 · Step 9 结构审查

#### 实施

- 审查 `loops-admin` module wiring：`LoopsAdminModule` imports `LoopsStoreModule`，providers/exports `LoopsAdminService` 与 `LoopsCapabilityRegistry`。
- 审查 `LoopsDomainModule` 已 re-export `LoopsAdminModule`，API `loops.module.ts` 继续只 import `LoopsDomainModule`。
- 审查 `LoopsService` 注入 `LoopsAdminService` 并用 `adminLogSink()` 保持日志兼容。

#### 标注

- 标注该切片未改 ts-rest contract、controller audit log、store persistence 格式。
- 标注 `LoopsService` 的 public 方法签名保持兼容，后续 Step 10 再考虑 controller 直连 domain service。

#### 审查待实施项

- `loops-admin` 不应接入 `PermissionService` / controller decorator / request user；权限与审计仍属于 API/controller 层。
- Archive 仍需窄 port；不能让 domain service 注入 legacy `LoopsService`。

#### 再标注文档

- Cycle 45 完成；进入文档总览同步。

#### 验证

- 结构审查由 Cycle 47 的反向依赖扫描覆盖。

### Loop 44 · 2026-06-26 · Step 9 admin service focused tests

#### 实施

- 新增 `apps/api/libs/domain/services/loops-admin/loops-admin.service.spec.ts`。
- 使用临时 `LOOPS_WORKSPACE_ROOT` 和真实 `LoopsFileStoreService` 验证：
  - tool register/list/health-check/persisted health。
  - 空 blueprint store 自动 seed 默认蓝图并可读取。

#### 标注

- 标注 Step 9 的 tool / blueprint 下沉具备 domain service 级别测试覆盖。
- 测试范围刻意不覆盖 controller 审计与 ts-rest response wrapper，二者未在本批改变。

#### 审查待实施项

- 仍待补：后续若迁 Archive，需要对应 archive service/port focused tests。
- 仍待补：Step 10 若移除 facade wrapper，需要 controller/service integration tests。

#### 再标注文档

- Cycle 44 完成，进入结构审查。

#### 验证

```bash
pnpm --filter @repo/api test -- loops-admin.service.spec.ts --runInBand
pnpm --filter @repo/api type-check
```

结果：

- `loops-admin.service.spec.ts` 通过，2 个测试通过。
- API type-check 通过。

### Loop 43 · Step 9 下沉 Tool Registry 与 Delivery Blueprint Marketplace

#### 实施

- 新增 `LoopsAdminService` 到 `apps/api/libs/domain/services/loops-admin/`。
- `LoopsAdminService` 承接：
  - `listTools`
  - `getTool`
  - `registerTool`
  - `updateTool`
  - `toolHealthCheck`
  - `testTool`
  - `listBlueprints`
  - `getBlueprint`
  - `createBlueprint`
  - `updateBlueprint`
  - `rollbackBlueprint`
  - 默认 blueprint seed。
- `LoopsAdminModule` imports `LoopsStoreModule`，注册并导出 `LoopsAdminService`。
- `loops-admin/index.ts` 导出 `LoopsAdminService`。
- `LoopsService` 注入 `LoopsAdminService`，相关 public API 改为委托；新增 `adminLogSink()` 保留原结构化日志行为。

#### 标注

- Step 9 状态：tool registry 与 delivery blueprint marketplace 已下沉。
- API facade 保留 public 方法、controller contract、审计日志与异常传播兼容。

#### 审查待实施项

- Archive 仍未下沉：`LoopsCrossTenantArchiveService` 当前仍由 legacy facade 包装，且依赖对象存储/SSO 装配。
- Step 10 暂不执行：不在本批删除 wrappers，避免同时改变 controller 注入与 domain 下沉。

#### 再标注文档

- Cycle 43 完成，下一轮补 focused tests。

#### 验证

```bash
pnpm --filter @repo/api type-check
```

结果：API type-check 通过。

### Loop 10 · 2026-06-26 · Step 5 启动（inferWorkflowKind → loops-evidence）+ 本批收口

#### 实施

- 新建 `apps/api/libs/domain/services/loops-evidence/`：`LoopsEvidenceService`（+ module + barrel），承接 `inferWorkflowKind`（workflow 类型推断，纯函数）。
- 类型处理：`LoopIssueDetail`/`LoopListItem` 是 `LoopsService` 内本地推导类型（`Awaited<ReturnType<LoopsFileStoreService['readDetail']>>` / `LoopListResponse['list'][number]`），未从 `@repo/contracts` 导出。为避免 domain service 反向 import src 或重依赖 store 类型，`inferWorkflowKind` 入参改用**结构类型** `WorkflowKindInput = { issue: { title; body?; targetRepo } }`（二者均兼容）。`LoopsService` 调用点相应改为只传 `{ issue }`（state 本就未用）。
- `LoopsService`：新增 `@Optional() evidence?: LoopsEvidenceService` + 自构造兜底；6 处 `this.inferWorkflowKind(` 改 `this.evidence.inferWorkflowKind(`；删除原方法定义。
- 接入 `LoopsDomainModule`。

#### 标注

- Step 5 状态：🚧 启动（纯 `inferWorkflowKind` ✅；evidence builder/gate/coverage enricher 群待后续）。
- 本批（Loop 6–10）累计交付：Step 2 intake 全部、Step 3 engine 纯推导、Step 4 runtime 三件套、Step 2 残留清偿、Step 5 启动。新增 5 个 domain 子目录（loops-issues / loops-engine / loops-runtime / loops-evidence + 既有 loops-store/loops-locks/loops facade）。
- `LoopsService` 通过 `@Optional + 自构造` 模式注入 4 个新 domain service（issues/engine/evidence 直接自构，issues 随 store/persistence/workspaceProfile），保持 standalone `new LoopsService(...)` 构造签名不变，spec/e2e 全程不破。

#### 验证（本批收口）

- `pnpm --filter @repo/api type-check` → EXIT 0。
- `pnpm exec jest` loops 相关 8 suite / 98 test pass（loops.service + simple-issue + loops-runtime + loops-store + loops-locks + loops-issues）。
- `pnpm quality:gate` → EXIT 0（含 Loops reverse-import 边界、type-check、contracts/sensitive-logs/utils-hygiene/sso-boundaries 全 PASS）。

#### 审查待实施项（Step 5–10 仍剩的大头，按风险升序）

| Step                      | 剩余工作                                                                                                                                               | 风险/前置                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| 5 evidence/quality        | `buildDeliveryEvidence`/`Markdown`、review/release gate、coverage、artifact builder、`withRequirementsCoverage`/`withDeliveryControlsList` enricher 群 | 大头；enricher 就位后解锁 Step 2 的 `list`/`getIssue` 完整迁出                    |
| 3 engine 推进             | `generateSpec`/`runLoop`/`advance`/`finalize` 等状态机推进                                                                                             | 最高风险；依赖 `syncAndRead`（→ store）+ evidence enricher（Step 5）              |
| 4 runners                 | adapters（agent/claude/git）+ `runner.service` + `agent-runtime-detection` + `docker-sandbox` + `runtime-command-builder`                              | 含 `LOOPS_*_adapter` token 绑定迁移；完成后可 re-home `loops-persistence.db.spec` |
| 6 eval                    | suite/run/bench trend/cross-tenant aggregation + processor                                                                                             | queue name 不变；processor 只留 entry                                             |
| 7 integrations            | MCP/CI/PR/notification（含从 store re-home notification-sender）                                                                                       | 外部 HTTP 集中 client 层                                                          |
| 8 triggers/remote-runners | webhook/schedule/retry/dead-letter + remote runner lease/job                                                                                           | webhook signature 不变                                                            |
| 9 admin                   | archive/tool/blueprint/capability-registry/dashboard 派生                                                                                              | 不反向依赖 controller                                                             |
| 10 收敛                   | 清空 API module 领域 provider，`loops.service.ts` 退化为薄 facade                                                                                      | 需前述步骤大头完成                                                                |

结论：Step 0–4 + Step 2(intake) + Step 5(启动) 已落地并通过 `quality:gate`；Step 5 enricher 群 + Step 3 engine 推进是后续最高价值/最高风险节点，建议各走独立循环并以 `loops.service.spec` + `quality:gate` 为 gate。

### Loop 9 · 2026-06-26 · Step 2 残留清偿（captureRuleSnapshot/resolveSimpleTargetRepo 迁入 loops-issues）

#### 实施

- 前置条件已满足：Loop 8 把 `LoopsWorkspaceProfileService` 下沉到 `loops-runtime`，`LoopsIssuesService` 现可注入其类型（domain→domain，无反向 import）。
- `LoopsIssuesService`：
  - 构造新增 `@Optional() workspaceProfile?: LoopsWorkspaceProfileService`。
  - 迁入 `captureRuleSnapshot(targetRepo, capturedAt)`（agent-readable rule snapshot）。
  - 迁入 `resolveSimpleTargetRepo(input)`（simple issue 目标仓库解析）。
- `LoopsIssuesModule` 追加 `imports: [LoopsRuntimeModule]`（取 workspaceProfile）。
- `LoopsService`：`createIssue` 的 `captureRuleSnapshot` 与 `createSimpleIssue` 的 `resolveSimpleTargetRepo` 改委托 `this.issues.*`；自构造兜底补传 `this.workspaceProfile`；删除两个原方法定义。

#### 标注

- Step 2 状态：🚧→「intake 记录构造**全部**完成」：createIssueId / normalizeSubmitter / resolveTargetRepo / writeIssueRecord / captureRuleSnapshot / resolveSimpleTargetRepo 均在 `loops-issues`。仅剩 `list`/`getIssue` 仍待 Step 5（依赖 delivery/coverage enricher）。
- 这是「bottom-up 清偿」的实例：Step 4 的整文件下沉直接解锁了 Step 2 的类型依赖残留，验证了「先沉淀共享依赖、再清偿上游残留」的路径有效。
- `list`/`getIssue` 仍未迁：`getIssue` 用 `withRequirementsCoverage`，`list` 用 `withDeliveryControlsList`，二者依赖 evidence/coverage builder 群（Step 5）。

#### 验证

- `pnpm --filter @repo/api type-check` → EXIT 0。
- `pnpm exec jest loops.service.spec + loops-simple-issue.spec` → 73/73 pass（createIssue/createSimpleIssue/rule-snapshot 路径无回归）。
- `pnpm check:architecture`（loops reverse-import 边界）→ PASS。

#### 审查待实施项（决定下一循环）

- 下一循环 Loop 10 = Step 5 启动：抽取纯 delivery predicate（如 `inferWorkflowKind`）到 `loops-evidence`，开始 evidence 域沉淀，为 `list`/`getIssue` 完整迁出铺路；随后跑全量 `quality:gate` 作为本批收口。
- 仍未清偿：`loops-persistence.db.spec` re-home（待 Step 4 adapter 下沉）；`list`/`getIssue`（待 Step 5 enricher 群）。

### Loop 8 · 2026-06-26 · Step 4 下沉 Runtime 叶子簇

#### 实施

- `git mv` 迁移到 `apps/api/libs/domain/services/loops-runtime/`（整文件搬迁，类 Step 1）：
  - `loops-runtime-images.ts`（Docker 镜像 / 本地 CLI 命令 / config 目录常量，纯 const）
  - `loops-docker.client.ts`（Docker Engine 控制点）+ spec
  - `loops-workspace-profile.service.ts`（workspace runtime profile，依赖上两者）+ spec
- 新建 `LoopsRuntimeModule`：注册 + export `LoopsDockerClient`、`LoopsWorkspaceProfileService`；接入 `LoopsDomainModule`。
- `loops-runtime/index.ts` barrel 导出 module + 两个 service + `export *` runtime 常量。
- API `loops.module.ts` 删除 2 个 import + 2 行 provider 注册（保留 `AgentRuntimeDetectionService`，仍依赖 `adapters/loops-process.util` 未迁）。
- 10 处消费方 import 改 `@app/services/loops-runtime`：`loops.service`/spec、`agent-runtime-detection`/spec、`loops-runtime-command-builder`/spec、`loops-second-opinion-worker`、2 个 adapter（workspaceProfile）。

#### 标注

- Step 4 状态：🚧 部分完成（runtime 三件套 + 常量 ✅；adapters / runner.service / agent-runtime-detection / docker-sandbox / runtime-command-builder 待后续批次）。
- `LoopsWorkspaceProfileService` 现位于 domain → **解锁 Step 2 残留**：`captureRuleSnapshot`/`resolveSimpleTargetRepo` 现可从 domain 引入其类型，下批可迁入 `loops-issues`。
- `AgentRuntimeDetectionService` 暂留 src：依赖 `adapters/loops-process.util`（属 loops-runners），随 adapter 一起迁。其 `LoopsDockerClient` 注入经 `LoopsRuntimeModule` re-export 仍可用。
- DI 行为不变：两个 service 仅注入 optional WINSTON logger；workspaceProfile 的 docker 依赖经同 module 注入。

#### 验证

- `pnpm --filter @repo/api type-check` → EXIT 0。
- `pnpm exec jest loops-runtime + loops.service.spec + agent-runtime-detection.spec` → 4 suite / 85 test pass。
- `pnpm check:architecture`（loops reverse-import 边界）→ PASS。

#### 审查待实施项（决定下一循环）

- 下一循环 Loop 9 = Step 5（evidence/quality）：最有价值的抽取是 `withRequirementsCoverage` + `withDeliveryControlsList` enricher，它们解锁 `list`/`getIssue` 的完整迁出（Step 2 残留）。但这俩 enricher 依赖一大群 delivery/coverage builder（`buildEvidenceArtifacts`/`buildRequirementsCoverage`/`buildDeliveryControls`/`buildReviewGates`/`buildReleaseGate`/…），是 Step 5 的大头，单独高风险循环。
- Step 4 残留（adapters + runner.service + agent-runtime-detection + docker-sandbox + runtime-command-builder）→ loops-runners 后续批次；含 `LOOPS_*_ADAPTER` token 绑定迁移（类 Step 1b token 迁移）。
- 待办清偿窗口：Loop 9 后视情况把 `captureRuleSnapshot`/`resolveSimpleTargetRepo` 迁入 loops-issues、`loops-persistence.db.spec` re-home loops-store。

### Loop 7 · 2026-06-26 · Step 3 抽取 Engine 状态推导原语

#### 实施

- 新建 `apps/api/libs/domain/services/loops-engine/`：`LoopsEngineService`（+ module + barrel），承接 4 个**纯**状态推导原语：
  - `nextResumePhase`（恢复 phase 选择）
  - `nextSpecVersion`（spec 版本自增）
  - `findRunnableShard`（下一个可执行 shard）
  - `formatPhase`（phase → label，连同 `PHASE_LABELS` 常量一起下沉）
- `LoopsEngineModule` 无外部 import（纯函数集合），export `LoopsEngineService`；接入 `LoopsDomainModule`。
- `LoopsService`：新增 `@Optional() engine?: LoopsEngineService` + 自构造兜底 `new LoopsEngineService()`（无 DI 依赖，零成本）；9 处 `this.<helper>(` 改 `this.engine.<helper>(`；删除 4 个原方法定义与 `PHASE_LABELS` 常量。

#### 标注

- Step 3 状态：🚧 部分完成（纯状态推导原语 ✅；状态机推进方法待后续）。
- 范围收缩原因（最高风险节点，谨慎处理）：`generateSpec`/`runLoop`/`advance`/`finalize` 等推进方法重度依赖 `syncAndRead`（persistence/store 双读 + `withRequirementsCoverage` enrich）+ runner + evidence/quality。干净抽取需要先把 detail-read/write（→ store）与 coverage enrich（→ Step 5 evidence）沉淀。本批只动**纯函数**，零行为风险，先把 `loops-engine` domain service 与委托骨架立起来。
- `costGuardedState`（依赖 `store.enforceCostGuard`）暂留 facade，随 store 编排一起迁。

#### 验证

- `pnpm --filter @repo/api type-check` → EXIT 0。
- `pnpm exec jest src/modules/loops/loops.service.spec.ts` → 68/68 pass（advance/runLoop/decompose 等状态机路径无回归）。
- `pnpm check:architecture`（loops reverse-import 边界）→ PASS。

#### 审查待实施项（决定下一循环）

- 下一循环 Loop 8 = Step 4（runner/runtime/workspace）：相对 tractable，因多为**整文件搬迁**（adapters、`loops-runner.service`、`agent-runtime-detection`、`loops-workspace-profile`、`loops-docker.client`、`loops-docker-sandbox`、`loops-runtime-images`、`loops-runtime-command-builder.util`），类似 Step 1。完成后可清偿：
  - 把 `captureRuleSnapshot`/`resolveSimpleTargetRepo` 迁入 `loops-issues`（workspaceProfile 类型可从 domain 引入）。
  - 把 `loops-persistence.db.spec.ts` re-home 到 `loops-store`（adapter 类型可从 domain 引入）。
- Step 3 残留（engine 推进方法）需 Step 4（runner）+ Step 5（evidence enricher）就位后再做完整抽取，单独高风险循环。

### Loop 6 · 2026-06-26 · Step 2 抽取 Issue Intake 记录原语

#### 实施

- 新建 `apps/api/libs/domain/services/loops-issues/`：`LoopsIssuesService`（+ module + barrel），承接 4 个 intake 记录原语：
  - `createIssueId`（纯，id 生成）
  - `normalizeSubmitter`（纯，SSO 优先）
  - `resolveTargetRepo`（路径策略校验，依赖 store util）
  - `writeIssueRecord`（`.loops` + DB persistence 双写编排）
- `LoopsIssuesModule` imports `LoopsStoreModule`（取 `LoopsFileStoreService` + `LOOPS_PERSISTENCE`），export `LoopsIssuesService`；接入 `LoopsDomainModule`。
- `LoopsService`：
  - 新增 `@Optional() issues?: LoopsIssuesService` 末位构造参数 + 构造体内自构造兜底（`this.issues = issues ?? new LoopsIssuesService(this.store, this.persistence)`）——保持 standalone `new LoopsService(...)` 构造签名不变（spec/e2e 不破）。
  - `createIssue` / `resolveSimpleTargetRepo` 改为委托 `this.issues.*`；删除 4 个原方法定义与孤立的 `resolveAllowedTargetRepo` import。

#### 标注

- Step 2 状态：🚧 部分完成（intake 记录原语 ✅；`list`/`getIssue`/`captureRuleSnapshot`/`resolveSimpleTargetRepo` 待后续 Step）。
- 范围收缩原因（诚实记录）：8000 行 `LoopsService` 是强耦合「泥球」，方法抽取受共享 enricher/builder 约束：
  - `list`/`getIssue` 依赖 `withRequirementsCoverage` / `withDeliveryControlsList`（delivery/coverage enricher，属 Step 5 evidence/quality）——无法在 Step 2 干净抽取，除非把 enricher 一并搬走（跨步）。
  - `captureRuleSnapshot` / `resolveSimpleTargetRepo` 依赖 `LoopsWorkspaceProfileService`（仍在 `src/modules/loops`，属 Step 4 loops-runtime）——搬入会形成 domain→src 反向 type import（CI 边界会拦）。故保留 facade，待 Step 4 workspaceProfile 下沉后迁入。
  - `createIssue` 的 workflow recipe 派生（`inferWorkflowKind` / `buildWorkflowRecipe`）依赖 delivery-status builder（Step 5），故 recipe 派生留 facade，只把纯记录原语下沉。
- 这是「bottom-up」现实：干净的方法级抽取需要先抽出共享 enricher/builder（→ Step 5），plan 的 top-down 顺序（issues 先于 evidence）在泥球里需要折中。已在本日志固化该结论供后续 Step 决策。

#### 验证

- `pnpm --filter @repo/api type-check` → EXIT 0。
- `pnpm exec jest src/modules/loops/loops.service.spec.ts` → 68/68 pass（createIssue 委托路径无回归）。
- `pnpm exec jest loops.service.spec + loops-simple-issue.spec` → 73/73 pass。
  - ⚠️ 首次联合跑出现 1 例 release-canary 测试 flake（`runReleaseCanary` + `checkDeploymentHealth` 的 setTimeout/timeout 时序，与本次 intake 抽取无关），重跑稳定通过；判定为既有 flake，非 Step 2 回归。
- `pnpm check:architecture`（含 loops reverse-import 边界）→ PASS。

#### 审查待实施项（决定下一循环）

- 下一循环 Loop 7 = Step 3（engine 状态机）：`generateSpec`/`reviewSpec`/`decompose`/`runLoop`/`advance`/`reviewGlobal`/`reloop`/`finalize`/shard recovery/`costGuardedState` 等。最高风险节点。
- 关键依赖前置：engine 方法大量调用 `syncAndRead`（persistence/store 双读 + coverage enrich）。干净抽取 engine 需要 `syncAndRead` + `readDetail` + `withRequirementsCoverage` 先有归属（→ store / evidence）。Loop 7 将先评估是否先抽 detail-read/write 到 store，再动 engine。
- 待办登记（Step 2 残留，随对应 Step 清偿）：
  - `list`/`getIssue` 完整抽取 → Step 5（evidence/quality enricher 就位后）。
  - `captureRuleSnapshot`/`resolveSimpleTargetRepo` → Step 4（workspaceProfile 下沉后）。

### Loop 5 · 2026-06-26 · Step 1 收敛 + 全局审查

#### 实施（收敛动作）

- 宽 focused tests（file-store / persistence / util 消费方）：`loops-runner`、`runtime-command-builder`、`workspace-profile`、`agent-runtime-detection`、`docker.client`、`second-opinion-comparison`、`cost-guard`、`learning-memory` → 7 suite / 31 test pass。
- 关键回归 `loops.service.spec.ts`（构造完整 `LoopsService`，68 test）→ 全过，证明 store/locks/persistence/utils 下沉后 DI 与行为无回归。
- 把结构防线固化进 CI：在根 `scripts/check-architecture.sh` 新增 section「Loops domain reverse-import boundary」，用 `check_no_matches` 禁止 `apps/api/libs/domain/services` 反向 import `src/modules/loops`。正则只匹配 import/from/require/动态 import 中的路径，docstring 里无引号包围的 `src/modules/loops` 字面量不误报（已验证：本 module 的依赖方向注释不被命中）。该脚本已挂在 `pnpm quality:gate` → `check:architecture`。

#### 标注

- Step 1 状态：✅ 已完成（1a utils + 1b locks + 1c store/persistence/notification/runtime-config/learning-memory）。
- 全量 gate：`pnpm quality:gate` → EXIT 0（含 `check:architecture` 含新 loops 边界、`type-check`、contracts/sensitive-logs/utils-hygiene/sso-boundaries）。
- Step 1 验收对照 README P1：
  - ✅ spec 跟随源文件迁移（learning-memory、notification-sender、work-lock、redis-lock 随迁；persistence.db.spec 因 adapter 耦合暂留 src，已登记）。
  - ✅ API 层不再直接持有 file-store / lock / persistence provider（全部下沉到 domain module）。
  - ✅ 无 `libs/domain/services/**` import `src/modules/**`（CI 强制）。

#### 审查待实施项（Step 2–10 精确 backlog）

Step 2–9 的本质：把方法从 8000 行 `LoopsService` 抽到 domain service，`LoopsService` 退化为委托 facade。风险显著高于 Step 1（Step 1 是整文件搬迁，Step 2+ 是方法抽取 + 私有状态/依赖重织 + 保持 3195 行 spec 不回归）。建议每步仍走「实施 → 标注 → 审查 → 标注」循环，每步独立 type-check + `loops.service.spec`。

| Step                                      | 目标域                       | 主要抽取方法/文件                                                                                                                                                                                         | 关键风险                                                                                                                            |
| ----------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 2 · loops-issues                          | issue intake/query           | `list`/`getIssue`/`createIssue`/`createSimpleIssue`/`listFromFile`/submitter 归一化/`createIssueId`/`captureRuleSnapshot`                                                                                 | submitter 派生自 Auth；与 store/persistence 强耦合                                                                                  |
| 3 · loops-engine                          | 状态机                       | `generateSpec`/`reviewSpec`/`decompose`/`runLoop`/`advance`/`reviewGlobal`/`reloop`/`finalize`/shard recovery/`costGuardedState`/`nextResumePhase`/`nextSpecVersion`                                      | 最高风险：CLOSED 幂等、人工关卡、cost guard；依赖 store/locks/runners/evidence/quality                                              |
| 4 · loops-runners + loops-runtime         | runner/runtime/workspace     | adapters（agent/claude/git）+ `runtime-command-builder`/`runner.service`/`agent-runtime-detection`/`workspace-profile`/`docker.client`/`docker-sandbox`/`runtime-images`                                  | adapter DI token（`LOOPS_*_ADAPTER`）迁移；secret 脱敏；mount policy。完成后可把 `loops-persistence.db.spec` re-home 到 loops-store |
| 5 · loops-evidence + loops-quality        | 证据/质量                    | `getDeliveryEvidence`/`buildDeliveryEvidence(Markdown)`/review & release gates/coverage/`browser-qa-worker`/`second-opinion-worker`/`learning-governance`/`visual-regression`/`second-opinion-comparison` | evidence markdown 外部字段不变；release gate 阻断策略不变。完成后评估 `learning-memory.util` 是否随迁 loops-quality                 |
| 6 · loops-eval                            | eval/bench                   | `listEvalSuites`/`getEvalSuite`/`listEvalRuns`/`getEvalRun`/bench trend workers/cross-tenant aggregation/`eval-aggregation-worker`/cache health                                                           | BullMQ queue name 不变；processor 只留 queue entry。`loops-eval-aggregation-worker.service` 随迁                                    |
| 7 · loops-integrations                    | 集成/MCP/CI/PR/通知          | `pr-provider.client`/`mcp-client`/`mcp-secret`/`notification-sender`（从 store re-home）/MCP & CI list/connect/disconnect/test/PR comment                                                                 | 外部 HTTP 集中到 client 层（Rule 3）；secret 存储/重试策略不变；不反向依赖 engine                                                   |
| 8 · loops-triggers + loops-remote-runners | trigger/远程 runner          | `webhookTrigger`/schedule CRUD+fire/retry+replay/dead-letter/remote runner list/lease/job/artifact                                                                                                        | webhook signature contract 不变；`trigger-scheduler.processor` 只留 queue entry；remote runner 权限门禁不变                         |
| 9 · loops-admin                           | admin/archive/tool/blueprint | cross-tenant archive/tool registry/blueprint CRUD+rollback/recipe admin/`capability-registry`/metrics+action+risk queue/resume summary                                                                    | archive 存储位置不变；不反向依赖 controller 权限 decorator                                                                          |
| 10 · 收敛 API module                      | 清空领域 provider            | 删除/迁出旧 `loops.service.ts` 体；`loops.module.ts` 只剩 controller/module/processor/decorator；补结构测试                                                                                               | 需前面所有步骤完成；最后跑 `quality:gate`                                                                                           |

#### 跨步技术债（Step 1 遗留，随对应 Step 清偿）

- `LoopsNotificationSender` 暂置 loops-store → Step 7 re-home loops-integrations。
- `loops-runtime-config.util` 暂置 loops-store → Step 4 re-home loops-runtime（或确认留存）。
- `loops-learning-memory.util` 暂置 loops-store → Step 5 评估随 learning governance 迁 loops-quality。
- `loops-persistence.db.spec.ts` 暂留 src/modules/loops → Step 4 adapter 下沉后 re-home loops-store。

#### 结论

Step 0 + Step 1 已完成并通过 `quality:gate`。Step 2–10 为方法级抽取，建议按 2→3→4→5→6→7→8→9→10 顺序、每步一循环推进；Step 3（engine）与 Step 10（收敛）为最高风险节点，需以 `loops.service.spec` + `quality:gate` 为 gate。

### Loop 4 · 2026-06-26 · Step 1c 下沉 Persistence + File Store

#### 实施

- `git mv` 迁移到 `apps/api/libs/domain/services/loops-store/`：
  - `loops-persistence.token.ts`（`LOOPS_PERSISTENCE`）
  - `loops-persistence.service.ts`（DB index 双写，依赖 `@app/db` `LoopsDbService`）
  - `loops-file-store.service.ts`（~2960 行 `.loops` 文件真相源）
  - `loops-notification-sender.service.ts`（file-store 依赖项；最终归属 `loops-integrations` Step 7，此处暂置）+ 其 spec
  - `loops-runtime-config.util.ts`（Step 1 候选，1a 漏迁；file-store 依赖）
  - `loops-learning-memory.util.ts` + spec（learning-memory `.loops` 文件格式，file-store 依赖，store 邻接）
- 扩展 `LoopsStoreModule`：`imports: [HttpModule, LoopsDbModule]`；注册 `LoopsNotificationSender`、`LoopsFileStoreService`、`LoopsPersistenceService`、`{ provide: LOOPS_PERSISTENCE, useExisting: LoopsPersistenceService }`；export `LoopsFileStoreService` / `LoopsPersistenceService` / `LOOPS_PERSISTENCE`。
- 扩展 `loops-store/index.ts` barrel，导出上述 service / token / util。
- API `loops.module.ts` 删除 4 个 import + 4 行 provider 注册（file-store / persistence / token / notification-sender），更新 HttpModule 注释。
- 消费方 import 改 `@app/services/loops-store`：`loops.service.ts`（file-store + type persistence + token）、`loops.service.spec.ts`、`loops-trigger-scheduler.processor.ts`、`loops-cross-tenant-archive.service.ts`、`loops-cost-guard.spec.ts`、`loops-runner.service.ts`、`loops-second-opinion-worker.service.ts`、2 个 adapter（runtime-config）、e2e spec 动态 import。

#### 标注

- Step 1 状态：🚧（1a ✅ utils；1b ✅ locks；1c ✅ store/persistence；Step 1 主体完成，待 Loop 5 收敛校验）。
- 级联依赖（type-check 暴露）：file-store 还依赖 `loops-runtime-config.util` 与 `loops-learning-memory.util`，二者必须随迁，否则 domain→src 反向 import。已随迁并在 barrel 导出。
- `LoopsNotificationSender` 经 `@Optional() httpService` 可无参构造，但为保留「真实 HttpService 注入」行为，`LoopsStoreModule` 显式 import `HttpModule` 并注册之（避免 file-store 退化到 `new LoopsNotificationSender()` 无 http 的分支）。
- `LOOPS_PERSISTENCE` token 经 `LoopsStoreModule` export → `LoopsDomainModule` re-export → API 层 `LoopsService` 经 token 注入，语义不变（DB 双写仅 Nest graph 内生效）。
- ⚠️ spec 例外：`loops-persistence.db.spec.ts` 已**迁回** `src/modules/loops/`（更新其 store import 为 `@app/services/loops-store`）。原因：该 spec 构造 `DeterministicLoopsAgent/ClaudeAdapter`（属 Step 4 `loops-runners`，尚未下沉），强行随迁会产生 domain→src 反向引用。待 Step 4 adapter 下沉后再 re-home 到 loops-store。

#### 验证

- `pnpm --filter @repo/api type-check` → EXIT 0（注：`tsconfig.type-check.json` exclude `**/*.spec.ts`，故 spec 导入错误需靠 jest 发现）。
- `pnpm exec jest libs/domain/services/loops-store src/modules/loops/loops-persistence.db.spec.ts src/modules/loops/loops-cost-guard.spec.ts` → 3 suite pass / 9 test pass / 1 skip（DB 依赖）。
- 结构检查（含 spec 的 import/from 反向引用）→ 无输出（OK）。

#### 审查待实施项（决定下一循环）

- 下一循环 Loop 5 = Step 1 收敛：跑更宽 focused tests（`loops-runner`、`second-opinion`、`cross-tenant-archive`、`trigger-scheduler` 等 file-store/persistence 消费方 spec）+ 全量 `loops` test + 结构脚本固化；汇总 Step 1 完成态，给出 Step 2–10 精确待办。
- 残留技术债登记：
  - `LoopsNotificationSender` 待 Step 7 re-home 到 `loops-integrations`。
  - `loops-runtime-config.util` 待 Step 4 re-home 到 `loops-runtime`（或确认留在 store）。
  - `loops-learning-memory.util` 待 Step 5 评估是否随 learning governance 迁到 `loops-quality`。
  - `loops-persistence.db.spec.ts` 待 Step 4 后 re-home 到 loops-store。
- 仍未下沉的 Step 1 候选：无（Step 1 列表全部落地）。

### Loop 3 · 2026-06-26 · Step 1b 下沉 Locks 层

#### 实施

- `git mv` 迁移到 `apps/api/libs/domain/services/loops-locks/`：
  - `loops-lock-backend.interface.ts`（`LOOPS_LOCK_BACKEND` token + `LoopsLockBackend`）
  - `loops-work-lock.service.ts`（`LoopsWorkLockService`）
  - `in-memory-loops-lock.backend.ts`（默认 backend）
  - `redis-loops-lock.backend.ts`（多实例 backend，未注册）
  - `loops-work-lock.service.spec.ts`、`redis-loops-lock.backend.spec.ts`
- 新建 `loops-locks/loops-locks.module.ts`：注册 `InMemoryLoopsLockBackend`、`{ provide: LOOPS_LOCK_BACKEND, useExisting: InMemoryLoopsLockBackend }`、`LoopsWorkLockService`；export `LoopsWorkLockService`。
- 新建 `loops-locks/index.ts` barrel。
- 4 处消费方 import 改为 `@app/services/loops-locks`：`loops.service.ts`、`loops.service.spec.ts`、`loops-persistence.db.spec.ts`（静态）+ `loops-remote-runner.cli-e2e.spec.ts`（动态 `await import`）。
- `apps/api/src/modules/loops/loops.module.ts` 删除 3 个 lock import 与 3 行 provider 注册（含 `LOOPS_LOCK_BACKEND` 绑定）。
- `LoopsDomainModule` 改为 `imports + exports: [LoopsStoreModule, LoopsLocksModule]`（re-export 子域，保证 API 层 `LoopsService` 仍可注入 `LoopsWorkLockService`）。

#### 标注

- Step 1 状态：🚧（1a ✅ utils；1b ✅ locks；1c ⏳ store）。
- provider token 迁移关键点：`LOOPS_LOCK_BACKEND` 绑定从 API module 移到 `LoopsLocksModule`，经 `LoopsDomainModule` re-export 注入，未断裂。
- NestJS 可见性：子域 module 必须 re-export，否则 API 层 provider 注入不到 domain service（已落实）。
- `RedisLoopsLockBackend` 保持原状不注册（多实例启用时再 factory 绑定）。

#### 验证

- `pnpm --filter @repo/api type-check` → EXIT 0。
- `pnpm exec jest libs/domain/services/loops-locks` → 2 suite / 7 test 全过（确认 spec 跟随迁移且 jest `@app/services/*` moduleNameMapper 生效）。
- 结构检查（实际 import/from 反向引用）→ 无输出（OK）。

#### 审查待实施项（决定下一循环）

- 下一循环 Step 1c：下沉 persistence + file-store 到 `loops-store/`，建/扩 `LoopsStoreModule` 注册 `LoopsFileStoreService`、`LoopsPersistenceService`、`{ provide: LOOPS_PERSISTENCE, useExisting: LoopsPersistenceService }`，并 export `LoopsFileStoreService`。
- 重点风险：`loops-file-store.service.ts` ~2960 行、`loops-persistence.service.ts` 依赖 `@app/db`（Prisma），且 `LOOPS_PERSISTENCE` token 设计上要让 standalone ts-node 消费者「DB-free」。迁移前必须 grep `scripts/` 与 cli 入口对 file-store / persistence 的引用；若有 ts-node 消费者走相对路径，需保留其相对路径或单独评估。
- 待办登记：Step 1c 后跑 `loops` focused tests（`loops.service.spec.ts` 等）确认 file-store / persistence 行为无回归。

### Loop 2 · 2026-06-26 · Step 1a 下沉低耦合 utils

#### 实施

- `git mv` 迁移两个纯工具到 `apps/api/libs/domain/services/loops-store/`：
  - `loops-path-policy.util.ts`（`resolveAllowedTargetRepo` / `allowedRepoRoots`）
  - `loops-workspace-root.util.ts`（`findLoopsWorkspaceRoot` / `resolveLoopsRoot` / `resolveLoopsRuntimeDir` / `resolveLoopsRuntimeProfilePath`）
- 新建 `loops-store/loops-store.module.ts`（`LoopsStoreModule`，空装配，Step 1c 再注册 file-store/persistence）。
- 新建 `loops-store/index.ts` barrel，导出工具 + module。
- 8 处 import 改为 `@app/services/loops-store`（6 处 path-policy：service/runner/qa-worker/second-opinion-worker + 2 adapter；2 处 workspace-root：runtime-command-builder/workspace-profile）。
- `LoopsDomainModule` 接入 `LoopsStoreModule`。

#### 标注

- Step 1 状态：🚧 部分完成（1a ✅；1b locks / 1c store 待办）。
- 范围对齐文档「不做」：未改 `.loops` 文件格式，未动 DB persistence 双写语义，未迁 engine。
- 未创建 `loops-store.service.ts` 主 service：等 Step 1c 随 file-store 一起落地，保持「1 service」规则的最终态而非中途死代码。
- 「1 module + 1 service + n」是目录**最终态**目标；1a 中间态为「1 module + n util」，已在审查中记录。

#### 验证

- `pnpm --filter @repo/api type-check` → EXIT 0。
- 结构检查 `rg "^\s*(import|from|export).*src/modules/loops" apps/api/libs/domain/services` → 无输出（OK）。
  - 注：README 给的正则会命中 docstring 注释里的 `src/modules/loops` 字面量（如本 module 的依赖方向说明），属误报；实际 import/from 反向引用为 0。

#### 审查待实施项（决定下一循环）

- 下一循环 Step 1b：下沉 locks 层（`loops-lock-backend.interface.ts` + `LOOPS_LOCK_BACKEND` token、`loops-work-lock.service.ts`、`in-memory-loops-lock.backend.ts`、`redis-loops-lock.backend.ts` 及其 spec）到 `loops-locks/`，建 `LoopsLocksModule`，API module 改为从 domain 取 lock provider。
- 风险：`LOOPS_LOCK_BACKEND` token 当前在 API module 用 `{ provide, useExisting: InMemoryLoopsLockBackend }` 绑定；下沉后该绑定要迁到 `LoopsLocksModule`，避免 token 注入断裂（README 风险表「Nest provider token 迁移时注入断裂」）。
- 待办登记：Step 1c 前需确认 `scripts/loops-cli.ts` 等 ts-node standalone 消费者是否引用 file-store / persistence（若有，需保留相对路径或单独适配）。

### Loop 1 · 2026-06-26 · Step 0 Facade 骨架

#### 实施

- 新建 `apps/api/libs/domain/services/loops/loops.module.ts`（`LoopsDomainModule`，空装配入口，承载后续子域 import）。
- 新建 `apps/api/libs/domain/services/loops/index.ts`，导出 `LoopsDomainModule`。
- `apps/api/libs/domain/services/index.ts` 追加 `export * from './loops'`。
- `apps/api/src/modules/loops/loops.module.ts` 通过 `@app/services/loops` import 并接入 `LoopsDomainModule`。

#### 标注

- Step 0 状态：✅ 已完成。
- 范围对齐文档「不做」：未迁移 `loops.service.ts` 业务方法，未改 controller / contracts / DB schema。
- facade `loops.service.ts` 暂不创建：controller 仍调用原 `LoopsService`，等 Step 2 开始委托时再加 facade 并从此处导出（避免引入未使用的死代码）。

#### 验证

- `pnpm --filter @repo/api type-check` → EXIT 0（与基线一致）。

#### 审查待实施项（决定下一循环）

- 下一循环开始 Step 1，按耦合度从低到高分三批：1a 低耦合 utils、1b locks、1c persistence + file-store。
- 风险点：`loops-file-store.service.ts`（~2960 行）被 `loops.service.ts` 深度引用，迁移需同步更新所有 import；拟放在 1c 单独一批并跑 type-check gate。
- 结构防线：每批后跑 `rg "src/modules/loops" apps/api/libs/domain/services`，期望为空。

## Step 0 · 建立目标目录与兼容 Facade

> 状态：✅ 已完成（Loop 1, 2026-06-26）｜验证：`type-check` EXIT 0｜落地：`LoopsDomainModule` 骨架接入 API module；controller / contracts 不变。详见「循环执行日志 · Loop 1」。

### 目标

建立 loops domain services 的目标骨架，让后续迁移有稳定落点，同时保持 controller 当前调用方式不变。

### 范围

- 新建 `apps/api/libs/domain/services/loops`。
- 新建 `loops.module.ts`、`loops.service.ts`、`index.ts`。
- 在 `apps/api/libs/domain/services/index.ts` export loops 入口。
- 在 API `loops.module.ts` 中预留或接入 `LoopsDomainModule`。
- 兼容 facade 暂时保持与现有 `LoopsService` 同名或等价调用面。

### 不做

- 不迁移 `loops.service.ts` 的业务方法实现。
- 不改 `loops.controller.ts` 的 ts-rest handler 行为。
- 不改 `packages/contracts`。
- 不调整 DB schema、Prisma migration 或外部 API contract。

### 受益

- 后续迁移有明确 domain 入口。
- controller diff 最小，降低 API 行为回归风险。
- 可以先验证 Nest module graph，避免大规模搬迁时才发现 DI 问题。

## Step 1 · 下沉低耦合工具、Store 与 Lock

> 状态：✅ 已完成（Loop 2–5）｜1a ✅ utils → `loops-store`｜1b ✅ locks（+ specs, token 绑定）→ `loops-locks`｜1c ✅ persistence + file-store + notification-sender + runtime-config/learning-memory utils → `loops-store`（`LoopsStoreModule` owning HttpModule+LoopsDbModule）｜验证：每批 `type-check` EXIT 0；`loops.service.spec` 68 test 全过；Loop 5 `pnpm quality:gate` EXIT 0（含新「Loops domain reverse-import boundary」CI 检查）。详见「循环执行日志 · Loop 2/3/4/5」。

### 目标

优先迁移依赖少、行为稳定的基础能力，为 issue、engine、evidence 等上层服务提供共同底座。

### 范围

- 新建 `apps/api/libs/domain/services/loops-store`。
- 新建 `apps/api/libs/domain/services/loops-locks`。
- 迁移候选：
  - `loops-file-store.service.ts`
  - `loops-persistence.service.ts`
  - `loops-persistence.token.ts`
  - `loops-lock-backend.interface.ts`
  - `loops-work-lock.service.ts`
  - `in-memory-loops-lock.backend.ts`
  - `redis-loops-lock.backend.ts`
  - `loops-runtime-config.util.ts`
  - `loops-workspace-root.util.ts`
  - `loops-path-policy.util.ts`
- spec 跟随源文件迁移。
- API module 改为 import `LoopsStoreModule` / `LoopsLocksModule`，不再直接注册这些 provider。

### 不做

- 不改 `.loops` 文件格式。
- 不改 DB persistence 双写语义。
- 不引入新的 storage abstraction。
- 不把 raw Prisma 引入 domain service。
- 不迁移 engine 状态机。

### 受益

- 先切出最底层依赖，减少后续服务之间的横向 import。
- file store、persistence、lock 的职责更清晰。
- 为后续检测循环依赖提供稳定边界。

## Step 2 · 拆 Issue Intake 与查询能力

> 状态：🚧 intake 全部完成（Loop 6 + Loop 9）｜createIssueId/normalizeSubmitter/resolveTargetRepo/writeIssueRecord/captureRuleSnapshot/resolveSimpleTargetRepo 全部 → `loops-issues`，facade 委托｜`list`/`getIssue` 待 Step 5 enricher（withRequirementsCoverage/withDeliveryControlsList）｜验证：type-check EXIT 0 + `loops.service.spec`+simple-issue 73/73 + 边界 PASS。详见「循环执行日志 · Loop 6/9」。

### 目标

将 issue 创建、查询、简单需求归一化从主 `LoopsService` 中抽出，形成独立 intake/query 边界。

### 范围

- 新建 `apps/api/libs/domain/services/loops-issues`。
- 迁移或抽取：
  - `list`
  - `getIssue`
  - `createIssue`
  - `createSimpleIssue`
  - `listFromFile`
  - submitter 归一化
  - simple issue targetRepo 解析
  - issue id 生成
  - rule snapshot 捕获
- 保持 facade 的同名方法，内部委托给 `LoopsIssuesService`。
- 保持 `normaliseSimpleIssue` 和 `@repo/contracts` 类型来源不变。

### 不做

- 不改变 `POST /loops/issues` 和 `POST /loops/issues/simple` 的请求/响应。
- 不调整 Auth 派生 submitter 的策略。
- 不迁移 webhook trigger 的调度、重试、dead-letter 逻辑。
- 不把 UI 默认表单或前端 client 纳入本批。

### 受益

- issue intake 可以独立测试。
- `LoopsService` facade 开始变薄。
- 创建/查询路径与 engine 推进路径解耦，降低后续拆状态机的风险。

## Step 3 · 拆 Loop Engine 状态机

> 状态：🚧 部分完成（Loop 7）｜纯状态推导原语（nextResumePhase/nextSpecVersion/findRunnableShard/formatPhase + PHASE_LABELS）→ `loops-engine`，facade 委托｜推进方法（generateSpec/runLoop/advance/finalize…）待 Step 4 runner + Step 5 enricher 就位后单独高风险循环｜验证：type-check EXIT 0 + `loops.service.spec` 68/68。详见「循环执行日志 · Loop 7」。

### 目标

把核心状态推进、phase 转换、shard 调度和 finalize 逻辑从主 service 中独立出来，形成 `loops-engine`。

### 范围

- 新建 `apps/api/libs/domain/services/loops-engine`。
- 迁移或抽取：
  - `generateSpec`
  - `reviewSpec`
  - `decompose`
  - `runLoop`
  - `advance`
  - `reviewGlobal`
  - `reloop`
  - `finalize`
  - `recoverInterruptedShards`
  - `findRunnableShard`
  - `runRunnableShard`
  - `costGuardedState`
  - `nextResumePhase`
  - `nextSpecVersion`
- engine 依赖 store、locks、runners、quality、evidence 等下层服务。
- 保持 CLOSED 幂等、人工关卡、异常暂停等既有语义。

### 不做

- 不重写状态机规则。
- 不新增 phase。
- 不改变用户默认入口 `advance` 的产品语义。
- 不在 engine 中直接处理 HTTP request、audit log 或 controller permission。
- 不使用 `forwardRef` 作为循环依赖默认解法。

### 受益

- 核心执行逻辑从 API module 中解耦。
- 状态机可单独做 focused specs。
- 后续引入后台 scheduler 或远程 runner 时可以复用同一 engine。

## Step 4 · 拆 Runner、Runtime 与 Workspace

> 状态：🚧 部分完成（Loop 8）｜runtime 三件套（`LoopsDockerClient` + `LoopsWorkspaceProfileService` + runtime-images 常量）→ `loops-runtime`（整文件搬迁，API module 不再注册）｜adapters / runner.service / agent-runtime-detection / docker-sandbox / runtime-command-builder 待 loops-runners 后续批次｜验证：type-check EXIT 0 + 4 suite/85 test pass + 边界 PASS。详见「循环执行日志 · Loop 8」。

### 目标

将 agent/Claude/Git runner 编排、runtime detection、workspace profile、Docker fallback 独立成可治理的运行时边界。

### 范围

- 新建 `apps/api/libs/domain/services/loops-runners`。
- 新建 `apps/api/libs/domain/services/loops-runtime`。
- 迁移或抽取：
  - agent/claude/git adapter interface 与实现
  - `loops-runtime-command-builder.util.ts`
  - `loops-runner.service.ts`
  - `agent-runtime-detection.service.ts`
  - `loops-workspace-profile.service.ts`
  - `loops-docker.client.ts`
  - `loops-docker-sandbox.service.ts`
  - `loops-runtime-images.ts`
- 保持外部命令和 Docker 运行策略不变。
- 保持 secret 脱敏和 workspace allowlist 约束。

### 不做

- 不更换 CLI 或 Docker 镜像。
- 不托管用户 CLI 登录态。
- 不改变 Docker mount policy。
- 不把 runtime UI 操作放入后端 domain。
- 不让业务 service 直接绕过 adapter 执行外部命令。

### 受益

- runtime backend 能力独立，便于诊断、替换和治理。
- engine 不再知道具体 CLI/Docker 细节。
- workspace policy 与执行策略的安全边界更清楚。

## Step 5 · 拆 Evidence、Quality 与 Release Gates

> 状态：🚧 启动（Loop 10）｜纯 `inferWorkflowKind` → `loops-evidence`，facade 委托（入参用结构类型，避免反向依赖）｜evidence builder/gate/coverage/enricher 群（`withRequirementsCoverage`/`withDeliveryControlsList`）待后续大头循环；就位后解锁 Step 2 `list`/`getIssue`｜验证：type-check EXIT 0 + 8 suite/98 test + `quality:gate` EXIT 0。详见「循环执行日志 · Loop 10」。

### 目标

将交付证据、review/release gates、coverage、browser QA、second opinion、learning governance 从主 service 中拆出。

### 范围

- 新建 `apps/api/libs/domain/services/loops-evidence`。
- 新建 `apps/api/libs/domain/services/loops-quality`。
- 迁移或抽取：
  - `getDeliveryEvidence`
  - `buildDeliveryEvidence`
  - `buildDeliveryEvidenceMarkdown`
  - review gate / release gate builder
  - requirement coverage builder
  - evidence artifact builder
  - second opinion comparison util
  - browser QA worker
  - second opinion worker
  - learning governance / memory util
  - visual regression util

### 不做

- 不改变 delivery evidence markdown 的外部可见字段。
- 不改变 release gate 阻断策略。
- 不新增 QA provider。
- 不把 PR comment 发布逻辑混入 evidence builder。
- 不把 learning governance 与 issue intake 合并。

### 受益

- 交付证据成为独立能力，可被 detail API、PR 发布、archive 复用。
- engine 只消费 gate 结果，不维护证据构建细节。
- QA 与二审策略可独立演进。

## Step 6 · 拆 Eval 与 Bench 聚合

### 目标

将 Eval Suite、Eval Run、historical baseline、cross-tenant aggregation 和 bench trend 逻辑从主 service 中独立。

### 范围

- 新建 `apps/api/libs/domain/services/loops-eval`。
- 迁移或抽取：
  - `listEvalSuites`
  - `getEvalSuite`
  - `listEvalRuns`
  - `getEvalRun`
  - `runLoopBenchTrendWorker`
  - `runEvalTrendWorker`
  - `getCrossTenantEvalAggregation`
  - `runEvalAggregationWorker`
  - `getEvalAggregationCacheHealth`
  - Eval evidence collection/build/evaluate helpers
  - `loops-eval-aggregation-worker.service.ts`
- API processor 只保留 queue entry，调用 `LoopsEvalService` 或 jobs facade。

### 不做

- 不改 Eval suite/check 定义语义。
- 不调整 historical baseline 算法口径。
- 不改变 BullMQ queue name。
- 不把 dashboard 展示逻辑放入 domain。

### 受益

- Eval 运营面与核心 engine 解耦。
- queue worker 可以更清晰地复用 domain 服务。
- 后续跨租户聚合、长期归档、趋势分析可以独立迭代。

## Step 7 · 拆 Integrations、MCP、CI、PR 与通知

### 目标

将外部系统集成能力聚合到 client/adaptor 边界，避免业务 service 直接持有 HTTP/MCP/CI/PR 细节。

### 范围

- 新建 `apps/api/libs/domain/services/loops-integrations`。
- 迁移或抽取：
  - `loops-pr-provider.client.ts`
  - `loops-mcp-client.service.ts`
  - `loops-mcp-secret.service.ts`
  - `loops-notification-sender.service.ts`
  - MCP server list/connect/disconnect/test
  - CI checks list/connect/disconnect/test
  - CI publication history
  - PR comment / check-run 发布适配

### 不做

- 不新增第三方集成。
- 不更改 GitHub App/token exchange 策略。
- 不更改 MCP secret 存储策略。
- 不让 integration service 反向依赖 engine。
- 不把外部 HTTP 调用散落到其他 domain service。

### 受益

- 外部 API 调用集中在 client/adaptor 层。
- secret、脱敏、重试、错误映射更容易审计。
- engine/evidence 只依赖清晰端口，降低集成变更影响面。

## Step 8 · 拆 Trigger 与 Remote Runner Pool

### 目标

将 webhook/schedule trigger 和 remote runner lease/job 管理拆成独立运营域。

### 范围

- 新建 `apps/api/libs/domain/services/loops-triggers`。
- 新建 `apps/api/libs/domain/services/loops-remote-runners`。
- 迁移或抽取：
  - `webhookTrigger`
  - webhook payload size/rate limit/signature 校验
  - webhook source enrichment
  - schedule trigger CRUD/fire
  - trigger execution retry/replay
  - dead-letter list
  - remote runner list
  - lease acquire/release
  - remote job run/artifact upload
- API processors 继续只作为 queue entry。

### 不做

- 不新增 Linear/Jira/Slack/GitHub Issue 的深度集成。
- 不改变现有 webhook signature contract。
- 不改变 trigger retry/backoff 口径。
- 不改变 remote runner permission 门禁。
- 不把 trigger 创建行为与 issue intake 写死耦合。

### 受益

- trigger 生命周期独立，便于后续 replay、dead-letter、外部 intake 扩展。
- remote runner pool 与本地 runner/runtime 解耦。
- 队列任务、HTTP 手动触发、后台调度可复用同一 domain service。

## Step 9 · 拆 Admin、Archive、Tool 与 Blueprint

### 目标

将管理型能力从核心交付 loop 中拆出，减少主 service 的运营杂项。

### 范围

- 新建 `apps/api/libs/domain/services/loops-admin`。
- 迁移或抽取：
  - cross-tenant archive
  - archive list / refresh url
  - tool registry CRUD/test
  - blueprint CRUD/rollback
  - recipe admin action
  - capability registry
  - metrics/action queue/risk queue/resume summary 等 dashboard 派生能力

### 不做

- 不改变 archive 存储位置。
- 不改变 tool/blueprint contract。
- 不新增 marketplace 功能。
- 不把 admin 能力反向依赖 controller 权限 decorator。

### 受益

- 核心 loop engine 更聚焦交付状态机。
- 管理和 dashboard 派生能力可以独立优化。
- 后续权限、审计、租户治理更容易分层。

## Step 10 · 收敛 API Module 与删除旧聚合

### 目标

完成 API 层瘦身，清理旧 `apps/api/src/modules/loops` 中已经迁移的领域 provider 和业务实现。

### 范围

- `apps/api/src/modules/loops` 最终仅保留：
  - `loops.controller.ts`
  - `loops.module.ts`
  - `loops-rbac.decorator.ts`
  - `*.processor.ts`
  - API-only spec 或 e2e spec
- `loops.module.ts` import domain modules，不直接注册已迁移 provider。
- 删除或迁移旧 `loops.service.ts`、worker service、client、adapter、util 文件。
- 更新 import path 到 `@app/services/loops-*`。
- 补充结构检查脚本，禁止 domain 反向 import API modules。

### 不做

- 不改变用户可见 API path。
- 不改变 ts-rest contract。
- 不做 unrelated cleanup。
- 不同时推进 UI 重构。
- 不在未通过 focused tests 的情况下删除旧文件。

### 受益

- API module 回归薄装配层。
- domain services 边界稳定，循环依赖风险显著降低。
- 后续多人/多 agent 并行开发 loops 子域更容易。

## 每步通用验收

每一步完成后至少检查：

```bash
pnpm --filter @repo/api test -- loops
pnpm --filter @repo/api type-check
```

涉及架构收敛、engine、runner、DB persistence 或 release-facing 行为时，再跑：

```bash
pnpm quality:gate
```

结构检查：

```bash
rg "apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops" apps/api/libs/domain/services
```

期望无输出。
