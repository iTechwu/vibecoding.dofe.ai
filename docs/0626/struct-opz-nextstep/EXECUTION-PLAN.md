# Loops 结构优化下一步执行计划

## 执行记录

### Cycle 48 · Step N1 Archive Port 初始下沉

#### 实施

- `LoopsAdminService` 新增 archive control port：
  - `LoopsArchiveControlPort`
  - `LoopsArchiveCollectionPort`
  - `LOOPS_ARCHIVE_COLLECTION_PORT`
- `LoopsAdminService` 承接 `archiveTenant`、`listArchives`、`refreshArchiveUrl` 的控制面 wrapper。
- `LoopsService` 的 archive public methods 改为委托 `this.adminService.*`。
- `LoopsCrossTenantArchiveService` 不再注入 legacy `LoopsService` 类，改为注入 `LOOPS_ARCHIVE_COLLECTION_PORT`。
- `loops.module.ts` 用 `useExisting: LoopsService` 临时绑定 archive collection port，保持现有 artifact collection 行为。

#### 标注文档

- Step N1 进入部分完成：archive wrapper 已下沉，archive collection port 已定义。
- 标注：collection port 当前仍由 legacy facade 实现，后续需继续下沉到 domain read/eval ports。

#### 审查待实施项

- 待继续：
  - 将 `LOOPS_ARCHIVE_COLLECTION_PORT` 的实现从 `LoopsService` 迁到更窄的 domain port。
  - 将 `LoopsCrossTenantArchiveService` 后续迁入 `loops-admin` 或保持 API 装配但只依赖 domain ports。
  - Step N7 时清理 archive wrapper。

#### 再标注文档

- Cycle 48 完成，下一轮补 archive focused tests。

#### 验证

```bash
pnpm --filter @repo/api type-check
pnpm --filter @repo/api test -- loops-admin.service.spec.ts --runInBand
```

结果：均通过。

### Cycle 49 · Step N1 Archive Focused Tests

#### 实施

- `loops-admin.service.spec.ts` 增加 archive control port 测试。
- 覆盖：
  - archive tenant 委托与参数透传。
  - list archives 返回 `{ archives }` 包装。
  - refresh download URL 的 message 兼容。
  - archive port 未配置时的旧行为：list 返回空数组，archive/refresh 抛配置错误。

#### 标注文档

- Step N1 的 archive wrapper 行为已有 domain service focused tests 覆盖。

#### 审查待实施项

- 仍待覆盖 `LoopsCrossTenantArchiveService` 的 collection port 行为测试。
- 仍待将 archive collection port 实现从 legacy facade 继续下沉。

#### 再标注文档

- Cycle 49 完成，进入文档事实源校准与状态收敛。

#### 验证

```bash
pnpm --filter @repo/api test -- loops-admin.service.spec.ts --runInBand
pnpm --filter @repo/api type-check
rg "from ['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)|require\\(['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)" apps/api/libs/domain/services
```

结果：

- `loops-admin.service.spec.ts` 通过，4 个测试通过。
- API type-check 通过。
- domain 反向依赖扫描无命中。

### Cycle 50 · Step N0 文档事实源校准

#### 实施

- 同步 `docs/0626/struct-opz/EXECUTION.md` Step 9 总览。
- 同步 `docs/0626/struct-opz/IMPLEMENTATION-ANNOTATIONS.md` 顶部总体状态与当前剩余项。
- 同步 `docs/0626/struct-opz-nextstep/BACKLOG.md` 中 N5 状态。

#### 标注文档

- Step 9 从“Archive 仍未完整下沉”更新为“archive control wrapper 已下沉，collection port 已定义但仍由 facade 临时实现”。
- 标注 `IMPLEMENTATION-ANNOTATIONS.md` 顶部早期状态残留已校准。

#### 审查待实施项

- 仍待：collection port 实现继续下沉，减少 `loops.module.ts` 的 `useExisting: LoopsService` 临时绑定。
- 仍待：`LoopsCrossTenantArchiveService` 行为 focused tests。

#### 再标注文档

- Cycle 50 完成，进入结构审查。

#### 验证

- 文档校准随 Cycle 52 的最终验证一起收口。

### Cycle 51 · Step N1 结构审查与注释校准

#### 实施

- 扫描 `LoopsCrossTenantArchiveService`，确认已移除 `forwardRef` / lazy `require('./loops.service')` / direct `LoopsService` 注入。
- 扫描 domain services，确认无反向 import API loops。
- 更新 `loops-admin.module.ts` 注释，反映 archive wrapper 与 collection port 当前状态。
- 更新 nextstep README 的 Step 9 当前结论。

#### 标注文档

- 标注：当前剩余结构债是 API module 中 `LOOPS_ARCHIVE_COLLECTION_PORT -> useExisting: LoopsService` 的临时绑定。

#### 审查待实施项

- 下一步最短路径：
  - 给 `LoopsCrossTenantArchiveService` 补 collection port focused tests。
  - 把 collection port 的 list/getIssue/eval aggregation 分别拆到 domain read/eval ports。

#### 再标注文档

- Cycle 51 完成，进入最终验证。

#### 验证

```bash
pnpm --filter @repo/api type-check
rg "from ['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)|require\\(['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)" apps/api/libs/domain/services
```

结果：

- API type-check 通过。
- domain 反向依赖扫描无命中。

### Cycle 52 · 本批收敛验证与下一轮待办

#### 实施

- 执行 focused tests。
- 执行 API type-check。
- 执行 domain 反向依赖扫描。
- 汇总本批 Cycle 48-52。

#### 标注文档

- 本批已完成至少 5 次循环动作：
  - Cycle 48：archive port/control wrapper 实施。
  - Cycle 49：archive focused tests。
  - Cycle 50：文档事实源校准。
  - Cycle 51：结构审查与注释校准。
  - Cycle 52：最终验证与待办标注。

#### 审查待实施项

- 待实施：
  - N5：collection port 实现继续下沉。
  - N3：trigger fire issue creation port。
  - N2：eval / bench worker IO。
  - N6：integrations notification / CI publication。
  - N1：engine 主流程。
  - N7：facade/module 收敛。

#### 再标注文档

- Cycle 52 完成；本批准确标注 N1 archive 当前状态，未改变对外 API contract。

#### 验证

```bash
pnpm --filter @repo/api test -- loops-admin.service.spec.ts --runInBand
pnpm --filter @repo/api type-check
rg "from ['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)|require\\(['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)" apps/api/libs/domain/services
```

结果：

- focused tests 通过。
- API type-check 通过。
- domain 反向依赖扫描无命中。

### Cycle 53 · Step N1 Archive Collection Service 下沉

#### 实施

- 新增 `LoopsArchiveCollectionService` 到 `loops-admin`。
- `LoopsArchiveCollectionService` 实现 `LoopsArchiveCollectionPort`：
  - list 使用 `LoopsIssuesService.list`。
  - getIssue 使用 `LoopsIssuesService.getIssue` + `LoopsEvidenceService.withRequirementsCoverage/buildSecondOpinion`。
  - eval aggregation 使用可选 `LoopsArchiveEvalAggregationPort`，未配置时返回空 aggregation。
- `LoopsAdminModule` imports `LoopsIssuesModule` 与 `LoopsEvidenceModule`，providers/exports `LoopsArchiveCollectionService`。
- API `loops.module.ts` 将 `LOOPS_ARCHIVE_COLLECTION_PORT` 从 `useExisting: LoopsService` 改为 `useExisting: LoopsArchiveCollectionService`。

#### 标注文档

- N5 更新为：collection port 已由 domain collection service 实现，不再临时绑定 legacy facade。
- 标注：eval aggregation 仍是可选窄 port，待 Step N4 / Step 6 worker IO 下沉后接入。

#### 审查待实施项

- 待实施：
  - `LoopsCrossTenantArchiveService` 是否 re-home 到 `loops-admin` 的评估。
  - eval aggregation domain port 接入。
  - Step N7 时清理 legacy archive facade wrapper。

#### 再标注文档

- Cycle 53 完成，下一轮补 collection service focused tests。

#### 验证

```bash
pnpm --filter @repo/api type-check
```

结果：API type-check 通过。

### Cycle 54 · Archive Collection Focused Tests

#### 实施

- 新增 `loops-archive-collection.service.spec.ts`。
- 覆盖：
  - domain list/read pipeline 委托。
  - detail requirements coverage enrich。
  - eval aggregation port 存在时透传。
  - eval aggregation port 缺失时返回空 aggregation。

#### 标注文档

- N5 archive collection service 已有 focused tests。

#### 审查待实施项

- 仍待：archive service re-home 评估与 eval aggregation port 正式接入。

#### 再标注文档

- Cycle 54 完成，进入结构扫描。

#### 验证

```bash
pnpm --filter @repo/api test -- loops-admin.service.spec.ts loops-archive-collection.service.spec.ts --runInBand
pnpm --filter @repo/api type-check
```

结果：

- 2 个 test suite 通过，6 个测试通过。
- API type-check 通过。

### Cycle 55 · Archive Collection 结构扫描

#### 实施

- 执行 domain 反向依赖扫描。
- 扫描 `useExisting: LoopsService`，确认 archive collection token 不再绑定 facade。
- 扫描 `forwardRef` / lazy `require('./loops.service')`，确认 archive service 无 direct facade 类依赖。

#### 标注文档

- N5 状态更新：collection port 已从 facade 临时实现推进到 domain collection service。

#### 审查待实施项

- Step 9 剩余不再是 facade collection port，而是：
  - eval aggregation port 与 Step N4 的正式接入。
  - archive service re-home 是否值得做。
  - Step N7 facade wrapper 删除。

#### 再标注文档

- Cycle 55 完成，进入文档总览同步。

#### 验证

```bash
rg "from ['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)|require\\(['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)" apps/api/libs/domain/services
```

结果：无命中。

### Cycle 56 · 文档总览同步

#### 实施

- 更新 `struct-opz-nextstep/README.md`。
- 更新 `struct-opz-nextstep/BACKLOG.md`。
- 更新 `struct-opz/EXECUTION.md` Step 9 总览。
- 更新 `struct-opz/IMPLEMENTATION-ANNOTATIONS.md` 顶部状态。

#### 标注文档

- 明确 Step 9 当前已完成 archive control wrapper + archive collection service。
- 明确剩余：eval aggregation 接入待 Step N4，archive service re-home 待评估。

#### 审查待实施项

- 下一批优先级调整：
  - N3 trigger fire issue creation port。
  - N2 eval / bench worker IO。
  - N6 integrations 技术债。

#### 再标注文档

- Cycle 56 完成，进入最终验证。

#### 验证

- 文档变更随 Cycle 57 最终验证收口。

### Cycle 57 · 本批收敛验证与下一轮待办

#### 实施

- 执行 archive/admin focused tests。
- 执行 API type-check。
- 执行 domain 反向依赖扫描。

#### 标注文档

- 本批已完成至少 5 次循环动作：
  - Cycle 53：archive collection service 实施。
  - Cycle 54：focused tests。
  - Cycle 55：结构扫描。
  - Cycle 56：文档同步。
  - Cycle 57：最终验证与待办标注。

#### 审查待实施项

- 待实施：
  - N3：trigger fire issue creation port。
  - N2：eval / bench worker IO 与 archive eval aggregation port 接入。
  - N6：notification sender re-home / CI publication builder。
  - N5：archive service re-home 评估。
  - N1：engine 主流程。
  - N7：facade/module 收敛。

#### 再标注文档

- Cycle 57 完成；N5 的 facade 临时 collection port 已清偿。

#### 验证

```bash
pnpm --filter @repo/api test -- loops-admin.service.spec.ts loops-archive-collection.service.spec.ts --runInBand
pnpm --filter @repo/api type-check
rg "from ['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)|require\\(['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)" apps/api/libs/domain/services
```

结果：

- focused tests 通过。
- API type-check 通过。
- domain 反向依赖扫描无命中。

## Step N0 · 文档事实源校准

### 目标

将 `docs/0626/struct-opz` 的历史日志与最新状态对齐，避免后续执行者被早期“待实施”残留误导。

### 范围

- 以 `docs/0626/struct-opz/EXECUTION.md` 顶部总览作为事实源。
- 校准 `IMPLEMENTATION-ANNOTATIONS.md` 顶部总体状态和“当前剩余待实施项”。
- 标注历史 Cycle 中已经被后续 Cycle 清偿的旧待办。
- 保持本目录 `struct-opz-nextstep` 为后续计划入口。

### 不做

- 不改代码。
- 不重写历史 Cycle 内容。
- 不删除已经记录的验证结果。
- 不改变原 `struct-opz` 的设计目标。

### 受益

- 后续执行不会重复处理已下沉能力。
- 减少跨文档状态冲突。
- 让计划、实施日志、下一步任务形成清晰链路。

## Step N1 · Archive Port 与 Archive Service 下沉

### 目标

完成 Step 9 的剩余项，把 archive 控制面从 legacy `LoopsService` 中解耦，同时避免 `loops-admin` 反向依赖 facade。

### 范围

- 定义 archive 所需的窄 port：
  - loop detail/list 读取 port。
  - archive metadata/list/refresh URL port。
  - 必要的 tenant 上下文输入结构。
- 将 `archiveTenant`、`listTenantArchives`、`refreshArchiveDownloadUrl` 的业务 wrapper 下沉到 `LoopsAdminService` 或同目录附属 port。
- `LoopsService` 保留 public wrapper，委托 `LoopsAdminService`。
- 新增/迁移 focused tests 到 `loops-admin`。
- 更新 `struct-opz` 与本目录状态。

### 不做

- 不改变 archive 存储位置。
- 不改变 SSO / object storage 装配。
- 不改 controller 权限和审计。
- 不让 `loops-admin` import `apps/api/src/modules/loops/loops.service`。

### 受益

- Step 9 可进入接近完成状态。
- Archive 能复用已下沉的 evidence/detail 能力。
- 为 Step 10 删除 admin/archive wrapper 打基础。

## Step N2 · Trigger Fire Issue Creation Port

### 目标

将 `fireScheduleTrigger` 从 legacy facade 中拆出，让 schedule trigger CRUD、fire、processor 调度形成完整 `loops-triggers` 领域闭环。

### 范围

- 在 `loops-triggers` 定义 issue creation port，输入保持 trigger fire 所需最小字段。
- 将 `fireScheduleTrigger` 的 trigger 读取、execution 记录、issue creation 调用、成功/失败日志编排下沉。
- `LoopsTriggerSchedulerProcessor` 继续作为 API/BullMQ entry，只调用 domain service 或 thin facade。
- 保持 webhook/schedule trigger contract 不变。
- 增加 focused tests 覆盖成功 fire 和失败 execution 记录。

### 不做

- 不新增外部 intake 集成。
- 不改变 retry/backoff 口径。
- 不改变 trigger signature contract。
- 不把完整 issue intake 逻辑复制到 triggers。

### 受益

- Step 8 的 schedule trigger 生命周期更完整。
- Processor 对 legacy `LoopsService` 的依赖减少。
- 后续 webhook/manual/background fire 可复用同一 port。

## Step N3 · Remote Execution Pipeline 下沉

### 目标

将 remote runner shard execution 与 artifact IO 从 legacy facade 中拆到 `loops-remote-runners`，使 remote runner pool 具备完整执行闭环。

### 范围

- 识别并抽取 `executeRemoteShardJob` / remote shard job 相关逻辑。
- 定义 runner execution port、artifact upload/read port、loop state update port。
- 保持 remote runner list/lease/job 现有接口。
- API processor 保留 queue entry，业务编排委托 domain service。
- 增加 focused tests 覆盖 job 成功、失败、artifact 写入异常。

### 不做

- 不改变 remote runner permission 门禁。
- 不改变 artifact 存储格式。
- 不改变本地 runner adapter 行为。
- 不在 remote runners 中直接调用 controller 权限或审计服务。

### 受益

- Step 8 从“基础池管理”推进到“执行闭环”。
- Engine 可通过 port 使用 remote execution，而不耦合 worker entry。
- 远程执行失败与 artifact 诊断更容易独立测试。

## Step N4 · Eval / Bench Worker IO 编排下沉

### 目标

完成 Step 6 的剩余 IO 编排，让 `loops-eval` 不仅承接纯 builder，也承接 trend worker 与 aggregation orchestration 的 domain 逻辑。

### 范围

- 抽 `runEvalTrendWorker` 的 evidence/history 读取、runs 分组、baseline 聚合、store append port。
- 抽 `runLoopBenchTrendWorker` 的 metrics 读取、diff、snapshot append port。
- 评估 `getEvalAggregationCacheHealth` 与 `runEvalAggregationWorker` 的 DB/Redis 编排边界。
- Processor queue name 保持不变。
- focused tests 覆盖无历史、有历史、append 失败、cache miss 等核心路径。

### 不做

- 不改变 eval suite/check 定义。
- 不改变 baseline 统计口径。
- 不改变 BullMQ queue name。
- 不把 dashboard presentation 放进 domain service。

### 受益

- Eval worker 行为可脱离 API facade 测试。
- DB/Redis/store 多写路径有清晰 port。
- Step 10 可以清理 eval legacy wrappers。

## Step N5 · Integrations 技术债清偿

### 目标

完成 Step 7 的剩余技术债，把 notification sender 和 CI publication builder 放回 integrations 边界。

### 范围

- 将 `LoopsNotificationSender` 从 `loops-store` re-home 到 `loops-integrations`，或定义 notification port 后由 store 消费 port。
- 抽 CI checks registry / publication history builder 到 `LoopsIntegrationsService`。
- 保持 PR provider / MCP client / MCP secret 现有行为。
- 更新 module import，避免 store 与 integrations 循环依赖。
- 增加 focused tests 覆盖 notification 与 CI publication builder。

### 不做

- 不新增第三方集成。
- 不改变 GitHub/GitLab/Gitea provider contract。
- 不改变 MCP secret 存储策略。
- 不让 integrations 反向依赖 engine/facade。

### 受益

- 外部 API/client/adaptor 能力归位。
- `loops-store` 更聚焦文件真相源与 persistence。
- 降低后续 CI/PR/notification 迭代影响面。

## Step N6 · Engine 主流程推进方法拆分

### 目标

将 `generateSpec`、`runLoop`、`advance`、`finalize` 等核心状态机推进方法从 legacy `LoopsService` 下沉到 `loops-engine`。

### 范围

- 先定义 engine 所需 ports：
  - detail read/write。
  - evidence/gate builder。
  - runner execution。
  - lock/cost guard。
  - notification/log side-effect。
- 分批迁移：
  - spec/review/decompose 流。
  - shard runnable/execute 流。
  - advance/finalize/reloop 流。
  - interrupted recovery 流。
- 每批保留 facade wrapper。
- 每批运行 `loops.service.spec.ts` 与 engine focused specs。

### 不做

- 不重写状态机规则。
- 不新增 phase。
- 不改变 `Continue Loop` 产品默认路径。
- 不使用 `forwardRef` 绕过依赖设计。
- 不在 engine 中处理 HTTP request、permission、audit log。

### 受益

- loops 核心业务从 API module 中真正解耦。
- 状态机可独立测试和演进。
- Step 10 收敛的最大阻塞被移除。

## Step N7 · API Facade 与 Module 收敛

### 目标

完成 Step 10，让 `apps/api/src/modules/loops` 回到 controller/module/processor/API-only glue。

### 范围

- 删除已迁移方法的 legacy private helper 与 wrapper，或将 wrapper 降到最薄。
- `loops.module.ts` 只 import domain modules、queue modules、API-only providers。
- 迁移/删除 API 层中已归属 domain 的 spec。
- 加强 `check:architecture`：
  - domain 不 import API loops。
  - domain 不 import controller/processor/decorator。
  - API module 不直接注册已迁移 domain provider。
- 更新 docs 状态为完成/剩余风险。

### 不做

- 不改变 ts-rest contract。
- 不改变 controller route。
- 不做 unrelated cleanup。
- 不同时推进 UI 重构。
- 不在未通过 focused tests 的情况下删除旧文件。

### 受益

- `apps/api/src/modules/loops` 结构回到架构目标。
- 循环依赖和 provider 杂糅风险显著降低。
- 后续功能开发能在清晰 domain 边界内进行。
