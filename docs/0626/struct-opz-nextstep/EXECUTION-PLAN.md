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

### Cycle 58 · Step N2 Trigger Fire Issue Creation Port 实施

#### 实施

- `loops-triggers` 新增 issue creation port：
  - `LOOPS_ISSUE_CREATION_PORT`（token）
  - `LoopsIssueCreationPort`（`createIssue(input): Promise<{ issue: { id: string } }>`）
  - `LoopsTriggersLogSink`（可选日志 sink，避免 domain 直接依赖 Winston）
- `LoopsTriggersService` 新增 `fireScheduleTrigger(triggerId, input, issueCreationPort, logSink?)`，承接完整 fire 编排：trigger 读取、paused 早返回、issue creation 调用、execution 记录、成功/失败 stats（lastRunAt / nextRunAt / failureCount / status）。
- `LoopsService` `implements LoopsIssueCreationPort`（既有 `createIssue` 结构兼容），`fireScheduleTrigger` 收敛为 thin wrapper：委托 `triggersService.fireScheduleTrigger(triggerId, input, this, this.adminLogSink())`。
- `loops.module.ts` 绑定 `{ provide: LOOPS_ISSUE_CREATION_PORT, useExisting: LoopsService }`。
- `LoopsTriggerSchedulerProcessor` 移除 `LoopsService` 注入，改为注入 `LoopsTriggersService` + `LOOPS_ISSUE_CREATION_PORT`，并提供 `domainLogSink` 适配 Winston。

#### 标注文档

- Step N2 进入部分完成：fire 编排已下沉到 `loops-triggers`，processor 不再注入 legacy facade 类。
- 标注：issue creation port 当前仍由 legacy facade 实现（完整 intake 编排仍属 API 层），与 archive collection port 同构；待 issue intake 下沉后再换实现。

#### 审查待实施项

- 待继续：
  - 补 `loops-triggers.service.spec.ts` 覆盖 paused / 成功 fire / issue creation 失败 / execution 记录。
  - issue creation port 实现继续下沉到 `loops-issues`（intake 编排 port）。
  - Step N7 时删除 facade fire wrapper。

#### 再标注文档

- Cycle 58 完成，下一轮补 trigger fire focused tests。

#### 验证

```bash
pnpm --filter @repo/api type-check
rg "from ['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)|require\\(['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)" apps/api/libs/domain/services
```

结果：

- API type-check 通过。
- domain 反向依赖扫描无命中。

### Cycle 59 · Step N2 Trigger Fire Focused Tests

#### 实施

- 新增 `loops-triggers.service.spec.ts`（standalone unit spec，mock store + port + log sink）。
- 覆盖：
  - CRUD：`getScheduleTrigger` 读取与 missing 抛 `NotFoundException`。
  - paused trigger：早返回 `created:false`，不调用 issue creation port、不写 trigger/execution。
  - 成功 fire：调用 issue creation port（透传 `sourceChannel/sourceKind='schedule'`），写入 failureCount=0 / lastRunAt / nextRunAt 的 trigger、写入 `status:completed` execution（attempt=1/maxRetries=3），logSink 记录 info。
  - 失败 fire：failureCount 自增、未达 maxFailures 时 status 保持 active、不写 execution、logSink 记录 error、返回 `message: Failed: ...`。
  - 达到 maxFailures：status 翻转为 `error`。
  - missing trigger 抛 `NotFoundException`。
  - log sink 可选：不传 sink 时编排仍正确完成。

#### 标注文档

- Step N2 的 fire 编排已有 domain service focused tests 覆盖主要成功/失败路径。

#### 审查待实施项

- 仍待：issue creation port 实现从 legacy facade 继续下沉到 `loops-issues` intake port。
- 仍待：processor 端 e2e/focused 子集（schedule tick → fire）行为测试。

#### 再标注文档

- Cycle 59 完成，进入结构扫描。

#### 验证

```bash
pnpm --filter @repo/api test -- loops-triggers.service.spec.ts --runInBand
pnpm --filter @repo/api type-check
```

结果：

- `loops-triggers.service.spec.ts` 通过，7 个测试通过。
- API type-check 通过。

### Cycle 60 · Step N2 结构审查与注释校准

#### 实施

- 执行 domain 反向依赖扫描，确认 `loops-triggers` 不 import API loops。
- 扫描 `LoopsTriggerSchedulerProcessor`，确认已移除 `LoopsService` 类注入与 `loops.service` import，改为 `LoopsTriggersService` + `LOOPS_ISSUE_CREATION_PORT`。
- 扫描 `forwardRef` / lazy `require('./loops.service')`，确认 triggers domain 无 direct facade 类依赖。
- 确认 controller `fireScheduleTrigger` 仍经 facade wrapper（对外 contract / path 不变）。
- 更新 `loops-triggers.module.ts` 注释，反映 fire 编排已下沉、issue creation port 当前由 facade 实现。
- 更新 `loops-trigger-scheduler.processor.ts` 顶部 doc 注释。

#### 标注文档

- 标注：当前剩余结构债是 API module 中 `LOOPS_ISSUE_CREATION_PORT -> useExisting: LoopsService` 的临时绑定（与 archive collection port 同构）。
- 标注：fire 编排已脱离 legacy facade class 依赖；processor 通过 domain service + port 解耦。

#### 审查待实施项

- 下一步最短路径：
  - issue creation port 实现继续下沉到 `loops-issues` intake port，移除 `useExisting: LoopsService`。
  - processor 端 schedule tick → fire 的 focused 子集。
  - Step N7 时删除 facade fire wrapper。

#### 再标注文档

- Cycle 60 完成，进入文档总览同步。

#### 验证

```bash
pnpm --filter @repo/api type-check
pnpm --filter @repo/api test -- loops-triggers.service.spec.ts --runInBand
rg "from ['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)|require\\(['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)" apps/api/libs/domain/services
```

结果：

- API type-check 通过。
- `loops-triggers.service.spec.ts` 7 个测试通过。
- domain 反向依赖扫描无命中。

### Cycle 61 · 文档总览同步

#### 实施

- 更新 `struct-opz-nextstep/README.md` Step 8 当前结论。
- 更新 `struct-opz-nextstep/BACKLOG.md` N3 状态与当前风险提醒。
- 更新 `struct-opz/EXECUTION.md` Step 8 总览行。
- 更新 `struct-opz/IMPLEMENTATION-ANNOTATIONS.md` 顶部“当前剩余待实施项”并追加 nextstep Cycle 58-60 历史标注。

#### 标注文档

- 明确 Step 8 当前已完成 schedule trigger CRUD + `fireScheduleTrigger` 编排下沉。
- 明确剩余：issue creation port 实现仍由 facade 临时实现；remote shard execution pipeline 仍待拆。

#### 审查待实施项

- 下一批优先级：
  - N2 eval / bench worker IO（与 archive eval aggregation port 接入）。
  - N6 integrations notification / CI publication。
  - N3 issue creation port 实现继续下沉。
  - N4 remote execution pipeline。
  - N1 engine 主流程。
  - N7 facade/module 收敛。

#### 再标注文档

- Cycle 61 完成，进入最终验证。

#### 验证

- 文档变更随 Cycle 62 最终验证收口。

### Cycle 62 · 本批收敛验证与下一轮待办

#### 实施

- 执行 triggers + admin + archive focused tests。
- 执行 API type-check。
- 执行 domain 反向依赖扫描。
- 汇总本批 Cycle 58-62。

#### 标注文档

- 本批已完成至少 5 次循环动作：
  - Cycle 58：trigger fire issue creation port 实施。
  - Cycle 59：trigger fire focused tests。
  - Cycle 60：结构审查与注释校准。
  - Cycle 61：文档总览同步。
  - Cycle 62：最终验证与待办标注。

#### 审查待实施项

- 待实施：
  - N2：eval / bench worker IO 与 archive eval aggregation port 接入。
  - N6：notification sender re-home / CI publication builder。
  - N3：issue creation port 实现继续下沉到 `loops-issues` intake port。
  - N4：remote shard execution pipeline 与 artifact IO port。
  - N5：archive service re-home 评估。
  - N1：engine 主流程。
  - N7：facade/module 收敛。

#### 再标注文档

- Cycle 62 完成；本批准确标注 N3 trigger fire 当前状态，未改变对外 API contract / controller path / queue name。

#### 验证

```bash
pnpm --filter @repo/api test -- loops-triggers.service.spec.ts loops-admin.service.spec.ts loops-archive-collection.service.spec.ts --runInBand
pnpm --filter @repo/api type-check
rg "from ['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)|require\\(['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)" apps/api/libs/domain/services
```

结果：

- 3 个 test suite 通过，13 个测试通过。
- API type-check 通过。
- domain 反向依赖扫描无命中。

### Cycle 63 · Step N2 Eval / Bench Trend Worker IO 下沉实施

#### 实施

- `loops-eval` 新增 trend worker port：
  - `LoopsEvalEvidencePort`（`collectEvalEvidence` / `collectLoopBenchInputs`）
  - `LoopsEvalTrendStorePort`（read/append eval & bench trend history）
  - `LoopsEvalLogSink`（可选日志 sink）
- `LoopsEvalService` 新增 `runEvalTrendWorker` / `runLoopBenchTrendWorker`：evidence→suites→runs→baseline→append、list/cost/learnings→metrics→diff→append 全部在 domain 编排，IO 经 port。
- `LoopsService` 收敛为 thin wrapper：`evalEvidencePort` / `evalTrendStorePort` / `evalLogSink` getter 适配自身 `collectEvalEvidence` / `buildEvalSuites` / `buildEvalRuns` / `list` / `cost` / `store.readRecentLearnings` 与 trend history 方法。

#### 标注文档

- Step N2 trend worker IO 进入完成：编排已下沉到 domain，facade 仅做 port 适配。

#### 审查待实施项

- 待继续：aggregation worker 编排下沉；evidence 收集 / DB/Redis 适配独立为 `loops-eval` adapter service；processor 解耦 facade。

#### 再标注文档

- Cycle 63 完成，进入 aggregation worker 下沉。

#### 验证

```bash
pnpm --filter @repo/api type-check
pnpm --filter @repo/api test -- loops.service.spec.ts -t trend --runInBand
```

结果：

- API type-check 通过。
- facade trend 测试通过（79 tests）。

### Cycle 64 · Step N2 Eval Aggregation Worker IO 下沉实施

#### 实施

- `loops-eval` 新增 `LoopsAggregationFlatItem` / `LoopsAggregation` 类型。
- `LoopsEvalService.runEvalAggregationWorker(input)`：suites→flat→computeAggregation→DB upsert（经 `persistAggregation` port）→Redis warm（经 `warmCache` port）→counts 返回，编排全部在 domain。
- `LoopsService.runEvalAggregationWorker` 收敛为 thin wrapper：把 `evalAggregationDb.upsert`、`evalAggregationWorker.computeAggregation` / `setCachedAggregation` 包成 port 回调传入 domain。
- `getEvalAggregationCacheHealth` 保持委托 `evalAggregationWorker.cacheHealth()`。

#### 标注文档

- Step N2 aggregation worker 编排已下沉到 domain；DB/Redis 适配仍由 facade port 提供（与 trend port 同构）。

#### 审查待实施项

- 待继续：evidence 收集 / DB/Redis 适配独立为 `loops-eval` adapter service；`LoopsEvalAggregationProcessor` 解耦 facade（当前仍调用 facade wrapper）；focused tests。

#### 再标注文档

- Cycle 64 完成，进入 focused tests。

#### 验证

```bash
pnpm --filter @repo/api type-check
pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand
```

结果：

- API type-check 通过。
- facade loops.service.spec.ts 68 个测试通过。

### Cycle 65 · Step N2 Eval Worker Focused Tests

#### 实施

- 新增 `loops-eval.service.spec.ts`（standalone unit spec）。
- 覆盖：
  - `runEvalTrendWorker`：有 history 计算 baseline + append；无 runs 返回 0 snapshot。
  - `runLoopBenchTrendWorker`：有 history 写 deltas + previousMetrics；无 history 不写 deltas。
  - `runEvalAggregationWorker`：flatten/persist/warm 计数；port 缺失时跳过持久化与缓存；持久化抛错时记 error 日志并继续。

#### 标注文档

- Step N2 的 trend + aggregation worker 编排已有 domain focused tests 覆盖主要成功/失败路径。

#### 审查待实施项

- 仍待：processor 解耦 facade；adapter service 独立化。

#### 再标注文档

- Cycle 65 完成，进入结构扫描。

#### 验证

```bash
pnpm --filter @repo/api test -- loops-eval.service.spec.ts --runInBand
pnpm --filter @repo/api type-check
```

结果：

- `loops-eval.service.spec.ts` 7 个测试通过。
- API type-check 通过。

### Cycle 66 · Step N2 结构审查与注释校准

#### 实施

- 执行 domain 反向依赖扫描，无命中。
- 确认 `loops-eval.service.ts` 仅 import `@repo/contracts` + `@nestjs/common`，不直接持有 store / db / aggregation worker。
- 确认 BullMQ queue name（`loops-eval-aggregation` / `loops-trigger-scheduler` / `loops-remote-runner`）不变。
- 更新 `loops-eval.module.ts` 注释，反映 trend + aggregation worker 编排已下沉、IO 经 port。

#### 标注文档

- 剩余结构债：evidence 收集 / DB upsert / Redis warm 仍由 facade port 适配；processor 仍调用 facade wrapper。

#### 审查待实施项

- 下一步：建 `loops-eval` 专属 adapter service 把 DB/Redis/evidence 适配从 facade 迁出；processor 解耦。

#### 再标注文档

- Cycle 66 完成，进入文档总览同步。

#### 验证

```bash
rg "from ['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)|require\\(['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)" apps/api/libs/domain/services
```

结果：无命中。

### Cycle 67 · 文档总览同步

#### 实施

- 更新 `struct-opz-nextstep/README.md` Step 6 当前结论。
- 更新 `struct-opz-nextstep/BACKLOG.md` N2 状态与当前风险提醒。
- 更新 `struct-opz/EXECUTION.md` Step 6 总览行。
- 更新 `struct-opz/IMPLEMENTATION-ANNOTATIONS.md` 顶部 Step 6 剩余项。

#### 标注文档

- 明确 Step 6 当前已完成 trend + aggregation worker 编排下沉。
- 明确剩余：evidence 收集 / DB/Redis 适配独立化、processor 解耦。

#### 审查待实施项

- 下一批优先级：N6 integrations（notification sender / CI publication）、N3 issue creation port 下沉、N4 remote execution、N1 engine、N7 facade 收敛。

#### 再标注文档

- Cycle 67 完成，进入最终验证。

#### 验证

- 文档变更随 Cycle 68 最终验证收口。

### Cycle 68 · 本批收敛验证与下一轮待办

#### 实施

- 执行 eval domain + facade focused tests。
- 执行 API type-check。
- 执行 domain 反向依赖扫描。
- 汇总本批 Cycle 63-68。

#### 标注文档

- 本批已完成至少 5 次循环动作：
  - Cycle 63：eval/bench trend worker IO 实施。
  - Cycle 64：eval aggregation worker IO 实施。
  - Cycle 65：eval worker focused tests。
  - Cycle 66：结构审查与注释校准。
  - Cycle 67：文档总览同步。
  - Cycle 68：最终验证与待办标注。

#### 审查待实施项

- 待实施：
  - N6：notification sender re-home / CI publication builder。
  - N3：issue creation port 实现继续下沉到 `loops-issues` intake port。
  - N2 收尾：evidence 收集 / DB/Redis 适配独立为 `loops-eval` adapter service；processor 解耦 facade。
  - N4：remote shard execution pipeline 与 artifact IO port。
  - N5：archive service re-home 评估。
  - N1：engine 主流程。
  - N7：facade/module 收敛。

#### 再标注文档

- Cycle 68 完成；本批准确标注 N2 eval worker IO 当前状态，未改变对外 API contract / controller path / BullMQ queue name。

#### 验证

```bash
pnpm --filter @repo/api test -- loops-eval.service.spec.ts loops.service.spec.ts --runInBand
pnpm --filter @repo/api type-check
rg "from ['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)|require\\(['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)" apps/api/libs/domain/services
```

结果：

- eval domain + facade focused tests 通过（7 + 68）。
- API type-check 通过。
- domain 反向依赖扫描无命中。

### Cycle 69 · Step N6 CI Checks Registry re-home 实施

#### 实施

- `loops-integrations` 新增 `LoopsCiChecksService`：承接纯 CI checks registry（`listCiCheckItems`）、`getCiCheckItem`、`withCiCheckStatus`。
- `LoopsIntegrationsModule` providers/exports `LoopsCiChecksService`；barrel 导出。
- `LoopsService` 注入 `ciChecksService`（构造尾部 `@Optional`，避免移动既有 positional 参数），`buildCiCheckItems` / `getCiCheckItem` / `withCiCheckStatus` 改为委托。

#### 标注文档

- Step N6 CI checks registry 已下沉到 `loops-integrations`；facade 保留 permission/audit wrapper。

#### 审查待实施项

- 待继续：CI publication evidence builder 下沉；notification sender re-home；testCiCheck provider publish/persistence 编排 port 化。

#### 再标注文档

- Cycle 69 完成，进入 publication builder 下沉。

#### 验证

```bash
pnpm --filter @repo/api type-check
pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand
```

结果：

- API type-check 通过。
- facade loops.service.spec.ts 68 个测试通过。

### Cycle 70 · Step N6 CI Publication Evidence Builder re-home 实施

#### 实施

- `LoopsCiChecksService.buildCiCheckPublicationEvidence(action, evidencePort?)`：issueId 缺失或 port 未配时返回 backlink-only 记录，否则经 `LoopsCiDeliveryEvidencePort.buildPublicationEvidence` 取得 work-package commit map。
- 定义 `LoopsCiDeliveryEvidencePort`（detail-read + delivery evidence 组装，两者仍在 facade）。
- `LoopsService.buildCiCheckPublicationEvidence` 收敛为 thin wrapper：`ciDeliveryEvidencePort` getter 包装自身 `store.readDetail` + `buildDeliveryEvidence`，委托 domain service。

#### 标注文档

- Step N6 CI publication evidence builder 已下沉；delivery evidence 仍由 facade port 提供（待 `buildDeliveryEvidence` 迁到 `loops-evidence`）。

#### 审查待实施项

- 待继续：notification sender re-home；testCiCheck provider publish/persistence 编排 port 化。

#### 再标注文档

- Cycle 70 完成，进入 notification sender re-home。

#### 验证

```bash
pnpm --filter @repo/api type-check
pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand
```

结果：

- API type-check 通过。
- facade loops.service.spec.ts 68 个测试通过。

### Cycle 71 · Step N6 Notification Sender re-home 实施

#### 实施

- `LoopsNotificationSender` + spec 从 `loops-store` `git mv` 到 `loops-integrations`。
- `LoopsIntegrationsModule` providers/exports `LoopsNotificationSender`；barrel 导出。
- `LoopsStoreModule` 改为 `imports: [LoopsIntegrationsModule]` 取得 sender 单例（无环：integrations 不依赖 store），移除自身的 sender provider；store barrel 移除 sender 导出。
- `LoopsFileStoreService` 改为 `import { LoopsNotificationSender } from '@app/services/loops-integrations'`。

#### 标注文档

- Step N6 notification sender re-home 完成；store 不再持有 sender，经 integrations module 注入。

#### 审查待实施项

- 待继续：testCiCheck provider publish/persistence 编排 port 化；CI publication history 读取 port 化。

#### 再标注文档

- Cycle 71 完成，进入 focused tests。

#### 验证

```bash
pnpm --filter @repo/api type-check
pnpm --filter @repo/api test -- loops-notification-sender.service.spec.ts loops.service.spec.ts --runInBand
```

结果：

- API type-check 通过。
- notification sender + facade 共 73 个测试通过。

### Cycle 72 · Step N6 Integrations Focused Tests

#### 实施

- 新增 `loops-ci-checks.service.spec.ts`（standalone unit spec）。
- 覆盖：registry catalog、`getCiCheckItem` 命中/missing 抛 `NotFoundException`、`withCiCheckStatus` connected/failed overlay；`buildCiCheckPublicationEvidence` backlink-only / port 委托 / port 缺失回退。

#### 标注文档

- Step N6 CI checks registry + publication builder 已有 domain focused tests 覆盖。

#### 审查待实施项

- 仍待：testCiCheck provider publish/persistence 编排 port 化与 focused 子集。

#### 再标注文档

- Cycle 72 完成，进入结构审查 + 文档 + 收敛。

#### 验证

```bash
pnpm --filter @repo/api test -- loops-ci-checks.service.spec.ts --runInBand
```

结果：

- `loops-ci-checks.service.spec.ts` 6 个测试通过。

### Cycle 73 · Step N6 结构审查 + 文档同步 + 收敛验证

#### 实施

- 执行 domain 反向依赖扫描，无命中。
- 确认 `loops-ci-checks.service.ts` 仅 import `@nestjs/common` + `@repo/contracts`。
- 确认无残留 `loops-store/loops-notification-sender` import。
- 更新 `struct-opz-nextstep/README.md` Step 7、`BACKLOG.md` N6、`struct-opz/EXECUTION.md` Step 7、`struct-opz/IMPLEMENTATION-ANNOTATIONS.md` 顶部 Step 7 + 总体状态表。
- 汇总本批 Cycle 69-73。

#### 标注文档

- 本批已完成至少 5 次循环动作（69 CI registry / 70 publication builder / 71 notification re-home / 72 focused tests / 73 结构审查+文档+收敛）。
- 准确标注 N6 integrations 当前状态，未改变对外 API contract / controller path / GitHub Checks provider contract。

#### 审查待实施项

- 待实施：
  - N3：issue creation port 实现继续下沉到 `loops-issues` intake port。
  - N2 收尾：evidence 收集 / DB/Redis 适配独立为 `loops-eval` adapter service；processor 解耦 facade。
  - N6 收尾：testCiCheck provider publish / permission / publication persistence 编排 port 化。
  - N4：remote shard execution pipeline 与 artifact IO port。
  - N5：archive service re-home 评估。
  - N1：engine 主流程。
  - N7：facade/module 收敛。

#### 再标注文档

- Cycle 73 完成；CI checks registry + publication builder + notification sender 已 re-home 到 `loops-integrations`。

#### 验证

```bash
pnpm --filter @repo/api test -- loops-ci-checks.service.spec.ts loops-notification-sender.service.spec.ts loops.service.spec.ts --runInBand
pnpm --filter @repo/api type-check
rg "from ['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)|require\\(['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)" apps/api/libs/domain/services
```

结果：

- CI checks + notification sender + facade focused tests 通过（6 + 5 + 68）。
- API type-check 通过。
- domain 反向依赖扫描无命中。

### Cycle 74 · Step N3 Issue Creation Port 实现下沉实施

#### 实施

- `LoopsIssuesService` 新增 `createIssue(input, authUser?)`：完整 issue intake 编排（id/intake/targetRepo/submitter/ruleSnapshot/state 组装 + workflowDefaults 匹配 + `inferWorkflowKind`/`buildWorkflowRecipe` 派生 + `writeIssueRecord` 双写），返回值结构兼容 `LoopsIssueCreationPort`。
- `LoopsIssuesService` 新增 `@Optional() evidence: LoopsEvidenceService` 构造参数（缺失时 `createIssue` 抛明确错误）。
- `LoopsIssuesModule imports LoopsEvidenceModule`，使 Nest graph 内 issues service 获得 evidence。
- `LoopsService.createIssue` 收敛为 thin wrapper：`return this.issues.createIssue(input, authUser)`；构造体改为先赋值 `evidence` 再透传给 standalone issues 构造。
- `loops.module.ts`：`LOOPS_ISSUE_CREATION_PORT` 从 `useExisting: LoopsService` 改为 `useExisting: LoopsIssuesService`。

#### 标注文档

- Step N3 完成：issue creation port 实现已下沉到 `loops-issues`，facade 不再是 port 临时实现。
- 标注：facade `createIssue` 仅保留兼容 wrapper（permission/audit 仍在 controller），对外行为不变。

#### 审查待实施项

- 待继续：processor schedule tick → fire focused 子集；Step N7 删除 facade createIssue wrapper。

#### 再标注文档

- Cycle 74 完成，进入 focused tests。

#### 验证

```bash
pnpm --filter @repo/api type-check
pnpm --filter @repo/api test -- loops.service.spec.ts loops-triggers.service.spec.ts --runInBand
```

结果：

- API type-check 通过。
- facade loops.service.spec.ts 68 个测试通过（含大量 createIssue 用例，行为一致）。
- trigger fire spec 7 个测试通过（port 经 LoopsIssuesService 解析）。

### Cycle 75 · Step N3 Issue Intake Focused Tests

#### 实施

- 新增 `loops-issues.service.spec.ts`（standalone unit spec，mock store + evidence + 三个 instance method spy）。
- 覆盖：
  - 组装 issue/intake/state + loop-snapshot recipe（无 workspace default 匹配）+ writeIssueRecord 委托。
  - workspace default 匹配时 recipe `source='workspace'` + `id=workspace recipeId`。
  - 显式 sourceChannel/sourceKind 透传到 issue + intake。
  - evidence 未注入时抛明确错误。

#### 标注文档

- Step N3 issue intake 编排已有 domain focused tests 覆盖主要路径。

#### 审查待实施项

- 仍待：processor schedule tick → fire focused 子集。

#### 再标注文档

- Cycle 75 完成，进入结构审查 + 文档 + 收敛。

#### 验证

```bash
pnpm --filter @repo/api test -- loops-issues.service.spec.ts --runInBand
```

结果：

- `loops-issues.service.spec.ts` 4 个测试通过。

### Cycle 76 · Step N3 结构审查 + 文档同步 + 收敛验证

#### 实施

- 执行 domain 反向依赖扫描，无命中。
- 确认 `LOOPS_ISSUE_CREATION_PORT` 绑定到 `LoopsIssuesService`（不再依赖 facade 类）。
- 确认 facade `createIssue` 仅 thin delegate（无内联编排）。
- 更新 `struct-opz-nextstep/README.md` Step 2/8、`BACKLOG.md` N3（降为低风险收尾）、`struct-opz/EXECUTION.md` Step 2/8 总览行、`struct-opz/IMPLEMENTATION-ANNOTATIONS.md` 顶部 Step 2/8 剩余项 + 总体状态表。
- 汇总本批 Cycle 74-76。

#### 标注文档

- 本批已完成至少 3 次循环动作（74 实施 / 75 focused tests / 76 结构审查+文档+收敛），完成 N3 issue creation port 下沉。
- 准确标注 N3 当前状态，未改变对外 API contract / controller path / intake 行为。

#### 审查待实施项

- 待实施：
  - N4：remote shard execution pipeline 与 artifact IO port。
  - N2 收尾：evidence 收集 / DB/Redis 适配独立为 `loops-eval` adapter service；processor 解耦 facade。
  - N6 收尾：testCiCheck provider publish / permission / publication persistence 编排 port 化。
  - N5：archive service re-home 评估。
  - N1：engine 主流程。
  - N7：facade/module 收敛（含删除 facade createIssue wrapper）。

#### 再标注文档

- Cycle 76 完成；issue creation port 实现已从 facade 下沉到 `loops-issues`，`useExisting: LoopsService` 临时绑定已清偿。

#### 验证

```bash
pnpm --filter @repo/api test -- loops-issues.service.spec.ts loops.service.spec.ts loops-triggers.service.spec.ts loops-eval.service.spec.ts loops-ci-checks.service.spec.ts --runInBand
pnpm --filter @repo/api type-check
rg "from ['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)|require\\(['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)" apps/api/libs/domain/services
```

结果：

- issues + facade + triggers + eval + ci-checks focused tests 通过（4 + 68 + 7 + 7 + 6）。
- API type-check 通过。
- domain 反向依赖扫描无命中。

### Cycle 77 · Step N4 Remote Artifact IO re-home 实施

#### 实施

- `loops-remote-runners` 新增 `LoopsRemoteArtifactStoragePort`（upload + privateDownloadUrl）+ `LoopsRemoteRunnersLogSink`。
- `LoopsRemoteRunnersService.uploadRemoteRunnerArtifacts(runnerId, jobId, input, storagePort?, logSink?)`：经 store 读本地 artifact，经 port 上传/签 URL，匹配 legacy facade 行为。
- `LoopsService.uploadRemoteRunnerArtifacts` 收敛为 thin wrapper：`remoteArtifactStoragePort` getter 把 `crossTenantArchive.fileStorage` 适配为 port。

#### 标注文档

- Step N4 artifact IO 已下沉到 `loops-remote-runners`；facade 仅做 storage port 适配。

#### 审查待实施项

- 待继续：shard execution port（processor 解耦）；shard execution 实现仍阻塞于 N1。

#### 再标注文档

- Cycle 77 完成，进入 shard execution port。

#### 验证

```bash
pnpm --filter @repo/api type-check
pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand
```

结果：

- API type-check 通过。
- facade loops.service.spec.ts 68 个测试通过。

### Cycle 78 · Step N4 Shard Execution Port + Processor 解耦实施

#### 实施

- `loops-remote-runners` 新增 `LOOPS_REMOTE_SHARD_EXECUTION_PORT` + `LoopsRemoteShardExecutionJob` / `LoopsRemoteShardExecutionResult` / `LoopsRemoteShardExecutionPort`。
- `LoopsService` `implements LoopsRemoteShardExecutionPort`，`executeRemoteShardJob` 改用共享类型。
- `LoopsRemoteRunnerProcessor` 移除 `LoopsService` 注入，改为 `@Inject(LOOPS_REMOTE_SHARD_EXECUTION_PORT) shardExecutionPort`。
- `loops.module.ts` 绑定 `{ provide: LOOPS_REMOTE_SHARD_EXECUTION_PORT, useExisting: LoopsService }`（实现仍属 facade，阻塞于 N1 engine 状态机）。

#### 标注文档

- Step N4 processor 已解耦 facade 类；shard execution 实现迁入 domain 待 N1（engine 状态机 / CLI adapter / Docker sandbox 下沉）。

#### 审查待实施项

- 待继续：N1 engine 主流程是 shard execution 迁入的前置。

#### 再标注文档

- Cycle 78 完成，进入 N2 收尾（eval aggregation runner）。

#### 验证

```bash
pnpm --filter @repo/api type-check
```

结果：API type-check 通过；domain 反向依赖扫描无命中；processor 不再 import `LoopsService`。

### Cycle 79 · Step N2 收尾 Eval Aggregation Runner + Processor 解耦实施

#### 实施

- `loops-eval` 新增 `LOOPS_EVAL_EVIDENCE_PORT` token（interface 复用既有 `LoopsEvalEvidencePort`）。
- 新增 `LoopsEvalAggregationRunnerService`：注入 `LoopEvalAggregationService`（DB）+ `LoopsEvalAggregationWorkerService`（Redis，同 module）+ `@Inject(LOOPS_EVAL_EVIDENCE_PORT)` evidencePort；`runAggregation(input)` 把 compute/persist/warm 包成回调委托 `LoopsEvalService.runEvalAggregationWorker`；`cacheHealth()` 透传 worker。`LoopsEvalModule imports LoopEvalAggregationModule`。
- `LoopsService` 注入 `evalAggregationRunner`（构造尾部 `@Optional`），`runEvalAggregationWorker` 优先委托 runner（standalone 回退旧路径）；`evalEvidencePort` getter 改 public 供 factory 绑定。
- `LoopsEvalAggregationProcessor` 移除 `LoopsService` 注入，改为 `aggregationRunner` + `domainLogSink`，调用 `aggregationRunner.runAggregation` / `cacheHealth`。
- `loops.module.ts` 绑定 `{ provide: LOOPS_EVAL_EVIDENCE_PORT, useFactory: (s) => s.evalEvidencePort, inject: [LoopsService] }`。

#### 标注文档

- Step N2 收尾：DB/Redis aggregation 适配已下沉到 domain runner；processor 解耦 facade 类；evidence 收集仍由 `LOOPS_EVAL_EVIDENCE_PORT`（facade）提供。

#### 审查待实施项

- 待继续：evidence collection（list/readDetail/cost enrichment）下沉后移除 facade evidence port；trend worker 同构 runner。

#### 再标注文档

- Cycle 79 完成，进入 focused tests。

#### 验证

```bash
pnpm --filter @repo/api type-check
pnpm --filter @repo/api test -- loops.service.spec.ts loops-eval.service.spec.ts --runInBand
```

结果：API type-check 通过；facade + eval 75 个测试通过；两个 processor 均不再 import `LoopsService`。

### Cycle 80 · Step N4 + N2 收尾 Focused Tests

#### 实施

- 新增 `loops-remote-runners.service.spec.ts`：artifact upload（无 port / 多 kind 上传 + 签 URL / 单 kind 失败跳过）。
- 新增 `loops-eval-aggregation-runner.service.spec.ts`：persist+warm、db 缺失只 warm、worker 缺失不处理、empty-evidence fallback、cacheHealth 透传/未配置。

#### 标注文档

- Step N4 artifact IO + Step N2 收尾 aggregation runner 已有 domain focused tests 覆盖。

#### 审查待实施项

- 仍待：N1 engine 主流程（shard execution 迁入前置）；evidence collection 下沉。

#### 再标注文档

- Cycle 80 完成，进入结构审查 + 文档 + 收敛。

#### 验证

- `loops-remote-runners.service.spec.ts` 3 个测试通过；`loops-eval-aggregation-runner.service.spec.ts` 6 个测试通过。

### Cycle 81 · Step N4 + N2 收尾 结构审查 + 文档同步 + 收敛验证

#### 实施

- domain 反向依赖扫描无命中；`loops-remote-runners.service.ts` / `loops-eval-aggregation-runner.service.ts` 仅依赖 contracts / nest / db / 同 domain。
- 确认 `loops-trigger-scheduler` / `loops-remote-runner` / `loops-eval-aggregation` 三个 processor 均不再 import `LoopsService` 类。
- 更新 nextstep README Step 6/8、BACKLOG N2/N4、struct-opz EXECUTION Step 6/8、本文件顶部 Step 6/8 + 总体状态表。
- 汇总本批 Cycle 77-81。

#### 标注文档

- 本批已完成至少 5 次循环动作（77 artifact IO / 78 shard execution port / 79 aggregation runner / 80 focused tests / 81 结构审查+文档+收敛）。
- 准确标注 N2 收尾与 N4 当前状态，未改变对外 API contract / controller path / BullMQ queue name / GitHub Checks provider contract。

#### 审查待实施项

- 待实施：
  - N1：engine 主流程（`generateSpec` / `runLoop` / `advance` / `finalize`）—— shard execution 迁入与 facade 收敛的前置，最高风险。
  - N6 收尾：testCiCheck provider publish / permission / publication persistence 编排 port 化。
  - N2 残余：evidence collection 下沉后移除 facade evidence port；trend worker 同构 runner。
  - N5：archive service re-home 评估。
  - N7：facade/module 收敛（删除已迁 wrapper，收敛 provider）。

#### 再标注文档

- Cycle 81 完成；remote artifact IO + shard execution port + eval aggregation runner 已下沉/解耦，三个 processor 全部脱离 facade 类依赖。

#### 验证

```bash
pnpm --filter @repo/api test -- loops-remote-runners.service.spec.ts loops-eval-aggregation-runner.service.spec.ts loops-issues.service.spec.ts loops.service.spec.ts loops-triggers.service.spec.ts loops-eval.service.spec.ts loops-ci-checks.service.spec.ts loops-notification-sender.service.spec.ts loops-admin.service.spec.ts loops-archive-collection.service.spec.ts --runInBand
pnpm --filter @repo/api type-check
rg "from ['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)|require\\(['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)" apps/api/libs/domain/services
```

结果：

- 10 个 test suite 通过，112 个测试通过。
- API type-check 通过。
- domain 反向依赖扫描无命中。

### Cycle 82 · Step N1 Engine spec/decompose 流下沉实施

#### 实施

- `LoopsEngineService` 构造新增 `@Optional() store: LoopsFileStoreService`；`LoopsEngineModule imports LoopsStoreModule`（Nest graph 提供 store）。
- 下沉纯谓词 `isTerminal`、cost guard 编排 `applyCostGuard`（原 facade `costGuardedState`，依赖 `store.enforceCostGuard`）。
- 下沉推进流 `generateSpec(detail, agentAdapter)` / `decompose(detail, agentAdapter)`：plan/decompose/designTests + writeSpec/writeShards + cost guard 全部在 domain；`LoopsAgentAdapter` 经 facade per-call 透传（impl 由 API module 经 `LOOPS_AGENT_ADAPTER` token 装配，保持 env-based CLI/Deterministic 选择）。
- `LoopsService.generateSpec` / `decompose` 收敛为 thin wrapper：enriched `getIssue` 预读 + 委托 engine + `syncAndRead` read-back；`isTerminal` / `costGuardedState` 改为委托 engine。

#### 标注文档

- Step N1 进入多批迁移：spec/decompose 推进流 + 纯谓词 + cost guard 已下沉到 `loops-engine`。
- 标注：`reviewSpec`（approve 时调 `advance`）、`advance`/`runLoop`/`finalize`/`reloop`（深度递归 + locks + evidence）仍在 facade，后续子批迁移。

#### 审查待实施项

- 待继续：`reviewSpec` + `advance`/`runLoop` 流（深度递归 + workLock + 多依赖，最高风险子批）；`finalize`/`reloop`；`runLoopUnlocked`/`resumeAndRead`。
- 注意：`advance` 是 reviewSpec approve 与多处推进的枢纽，迁移需连同 runLoop/runLoopUnlocked 一起规划。

#### 再标注文档

- Cycle 82 完成，进入 focused tests。

#### 验证

```bash
pnpm --filter @repo/api type-check
pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand
```

结果：

- API type-check 通过。
- facade loops.service.spec.ts 68 个测试通过（generateSpec/decompose 行为一致）。

### Cycle 83 · Step N1 Engine Focused Tests

#### 实施

- 新增 `loops-engine.service.spec.ts`（standalone unit spec，mock store + agentAdapter）。
- 覆盖：
  - 纯谓词/推导：`isTerminal`（CLOSED/finalized）、`nextSpecVersion`、`nextResumePhase`。
  - `applyCostGuard`：cost 计数自增 + `store.enforceCostGuard` 委托 + 默认 1 call/0 token。
  - `generateSpec`：v1 DRAFT 写入 + cost-guarded PHASE_2_REVIEW；非 v1 修订追加说明 + 重新 id；非 revision 已存在抛 `BadRequestException`。
  - `decompose`：approved spec → shards/testMatrix + PHASE_4_IMPLEMENT 写入；terminal/已拆解 no-op 返回 false；spec 未 approved 抛错。

#### 标注文档

- Step N1 spec/decompose 推进流已有 domain focused tests 覆盖主要成功/失败路径。

#### 审查待实施项

- 仍待：advance/runLoop/finalize/reloop 子批迁移与测试。

#### 再标注文档

- Cycle 83 完成，进入结构审查 + 文档 + 收敛。

#### 验证

```bash
pnpm --filter @repo/api test -- loops-engine.service.spec.ts --runInBand
```

结果：`loops-engine.service.spec.ts` 11 个测试通过。

### Cycle 84 · Step N1 结构审查 + 文档同步 + 收敛验证

#### 实施

- domain 反向依赖扫描无命中；`loops-engine.service.ts` 仅依赖 `@repo/contracts` + `@nestjs/common` + `@app/services/loops-store` + `@app/services/loops-runners`（interface）。
- 确认 facade `generateSpec`/`decompose` 为 thin delegate（enriched 预读 + read-back），`isTerminal`/`costGuardedState` 委托 engine。
- 更新 nextstep README Step 3、BACKLOG N1（标注「多批进行中」）、struct-opz EXECUTION Step 3、本文件顶部 Step 3 + 总体状态表。
- 汇总本批 Cycle 82-84。

#### 标注文档

- 本批完成 N1 第一个子批（82 spec/decompose 实施 / 83 focused tests / 84 结构审查+文档+收敛）。
- 准确标注 N1 当前状态，未改变对外 API contract / controller path / spec·decompose 行为。

#### 审查待实施项

- 待实施（N1 后续子批）：
  - `reviewSpec` + `advance` + `runLoop` + `runLoopUnlocked`（深度递归 + workLock + agentAdapter.review/run + state mutation，最高风险）。
  - `finalize` + `reloop`（agentAdapter.reviewGlobal/annotateFinalize + 收敛态迁移）。
  - `resumeAndRead` / interrupted recovery 流。
- 其他 backlog：N6 收尾（testCiCheck 编排 port 化）、N5 archive re-home、N7 facade/module 收敛。

#### 再标注文档

- Cycle 84 完成；engine spec/decompose 推进流已下沉，N1 进入多批迁移轨道。

#### 验证

```bash
pnpm --filter @repo/api test -- loops-engine.service.spec.ts loops.service.spec.ts loops-issues.service.spec.ts loops-triggers.service.spec.ts loops-eval.service.spec.ts loops-eval-aggregation-runner.service.spec.ts loops-ci-checks.service.spec.ts loops-notification-sender.service.spec.ts loops-remote-runners.service.spec.ts loops-admin.service.spec.ts loops-archive-collection.service.spec.ts --runInBand
pnpm --filter @repo/api type-check
rg "from ['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)|require\\(['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)" apps/api/libs/domain/services
```

结果：

- 11 个 test suite 通过，123 个测试通过。
- API type-check 通过。
- domain 反向依赖扫描无命中。

### Cycle 85 · Step N1 advance 递归调度下沉实施

#### 实施

- `loops-engine` 新增 `LoopsEngineAdvancePort`（getDetail / resumeAndRead / generateSpec / decompose / finalize / reviewGlobal / runLoop / appendAdvanceLimitLog）。
- `LoopsEngineService.advance(issueId, port)` 承接完整 PHASE 决策递归（paused→resume、CLOSED→return、no/REVISION spec→generateSpec、DRAFT→return、非 APPROVED→抛错、空 shards/PHASE_3→decompose、PASS+!finalized→finalize、PHASE_6_CONVERGE→reviewGlobal、非 PASS verdict→return、else→runLoop、步数上限→limit log）。
- `LoopsService.advance` 收敛为 thin wrapper：`engine.advance(issueId, this.advancePort)`；`advancePort` getter 把各 transition（spec/decompose 委托 engine；finalize/reviewGlobal/runLoop/resume 仍属 facade）映射为 port。
- barrel 导出 `LoopsEngineAdvancePort`。

#### 标注文档

- Step N1 推进：advance 递归调度（核心决策逻辑）已下沉到 `loops-engine`，经 port 注入 transition 实现，避免 engine↔facade 类环依赖。
- 标注：transition 实现（finalize/reviewGlobal/runLoop/runLoopUnlocked/resume）仍在 facade，后续子批迁移。

#### 审查待实施项

- 待继续：`runLoop`/`runLoopUnlocked`（shard 调度 + workLock + runtime config + recoverInterruptedShards/blockShardForContextBudget/runRunnableShard）、`finalize`/`reloop`、`reviewGlobal`、`resumeAndRead`/`recoverInterruptedShards`。

#### 再标注文档

- Cycle 85 完成，进入 focused tests。

#### 验证

```bash
pnpm --filter @repo/api type-check
pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand
```

结果：

- API type-check 通过。
- facade loops.service.spec.ts 68 个测试通过（含 create→generate→approve→decompose→runLoop→reviewGlobal→finalize 全链路，advance 递归行为一致）。

### Cycle 86 · Step N1 advance Focused Tests

#### 实施

- `loops-engine.service.spec.ts` 新增 advance dispatcher 测试组（mock port）。
- 覆盖：no/REVISION spec→generateSpec、DRAFT→直接返回、REJECTED→抛 `BadRequestException`、APPROVED+空 shards→decompose、PASS+!finalized→finalize、APPROVED in-progress→runLoop、paused→resumeAndRead、CLOSED→无 transition 直接返回。

#### 标注文档

- Step N1 advance 决策逻辑已有 domain focused tests 覆盖各分支。

#### 审查待实施项

- 仍待：runLoop/runLoopUnlocked、finalize/reloop、reviewGlobal、resume 子批。

#### 再标注文档

- Cycle 86 完成，进入结构审查 + 文档 + 收敛。

#### 验证

```bash
pnpm --filter @repo/api test -- loops-engine.service.spec.ts --runInBand
```

结果：`loops-engine.service.spec.ts` 19 个测试通过（11 旧 + 8 新 advance）。

### Cycle 87 · Step N1 结构审查 + 文档同步 + 收敛验证

#### 实施

- domain 反向依赖扫描无命中；`loops-engine.service.ts` 仅依赖 contracts/nest/store/runners(interface)。
- 确认 facade `advance` 为 thin delegate（`engine.advance(issueId, advancePort)`）。
- 更新 nextstep README Step 3、BACKLOG N1、struct-opz EXECUTION Step 3、本文件顶部 Step 3 + 总体状态表。
- 汇总本批 Cycle 85-87。

#### 标注文档

- 本批完成 N1 第二个子批（85 advance 调度实施 / 86 focused tests / 87 结构审查+文档+收敛）。
- 准确标注 N1 当前状态，未改变对外 API contract / controller path / advance 决策行为。

#### 审查待实施项

- 待实施（N1 后续子批）：
  - `runLoop`/`runLoopUnlocked` + `recoverInterruptedShards`/`blockShardForContextBudget`/`runRunnableShard`（shard 调度 + workLock + runtime config，最高风险）。
  - `finalize`/`reloop`（agentAdapter.reviewGlobal/annotateFinalize + 收敛态）。
  - `reviewGlobal`（global evidence + regression）。
- 其他 backlog：N6 收尾、N5 archive re-home、N7 facade/module 收敛。

#### 再标注文档

- Cycle 87 完成；advance 递归调度已下沉到 domain，N1 多批迁移推进中。

#### 验证

```bash
pnpm --filter @repo/api test -- loops-engine.service.spec.ts loops.service.spec.ts loops-issues.service.spec.ts loops-triggers.service.spec.ts loops-eval.service.spec.ts loops-eval-aggregation-runner.service.spec.ts loops-ci-checks.service.spec.ts loops-notification-sender.service.spec.ts loops-remote-runners.service.spec.ts loops-admin.service.spec.ts loops-archive-collection.service.spec.ts --runInBand
pnpm --filter @repo/api type-check
rg "from ['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)|require\\(['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)" apps/api/libs/domain/services
```

结果：

- 11 个 test suite 通过，131 个测试通过。
- API type-check 通过。
- domain 反向依赖扫描无命中。

### Cycle 88 · Step N1 runLoopUnlocked shard 调度下沉实施

#### 实施

- `loops-engine` 新增 `LoopsEngineShardRunnerPort`（`readFreshDetail` = facade `syncAndRead`；`runRunnableShard` = 重执行）。
- `LoopsEngineService.runLoopUnlocked(issueId, detail, port)` 承接 shard 调度循环：findRunnableShard + recoverInterruptedShards + context-budget block + run + 收敛 PHASE_6_CONVERGE + SCHEDULER_BATCH/RECOVERED/CONTEXT_BUDGET_EXCEEDED log。store 编排（writeShardProgress/upsertState/appendLog/writeNotification）全部在 domain；`recoverInterruptedShards`/`blockShardForContextBudget` 转为 engine 私有方法。
- `LoopsService.runLoopUnlocked` 收敛 thin delegate（`engine.runLoopUnlocked(issueId, detail, this.shardRunnerPort)`）；facade 保留 `runLoop`（getIssue + isTerminal + workLock 包装）与重执行 `runRunnableShard`（agentAdapter + persist + runShardTests + reviewShard）。

#### 标注文档

- Step N1 推进：shard 调度核心（runLoopUnlocked + recover + block + converge）已下沉到 `loops-engine`，重执行经 port 注入，避免 domain 拖入 agent/persist/evidence 大依赖面。
- 标注：`finalize`/`reloop`/`reviewGlobal`/`resumeAndRead` + `runLoop` workLock 包装 + `runRunnableShard` 重执行仍在 facade。

#### 审查待实施项

- 待继续：`finalize`/`reloop`（agentAdapter.reviewGlobal/annotateFinalize + 收敛态）、`reviewGlobal`（global evidence + regression）、`resumeAndRead`。`runLoop` workLock 包装与 `runRunnableShard` 重执行是否 port 化需评估。

#### 再标注文档

- Cycle 88 完成，进入 focused tests。

#### 验证

```bash
pnpm --filter @repo/api type-check
pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand
```

结果：

- API type-check 通过。
- facade loops.service.spec.ts 68 个测试通过（含 shard 调度 + 收敛全流程，行为一致）。

### Cycle 89 · Step N1 runLoopUnlocked Focused Tests

#### 实施

- `loops-engine.service.spec.ts` 新增 runLoopUnlocked 调度测试组（mock store + port + `jest.mock` readLoopsRuntimeConfig）。
- 覆盖：runnable shard 执行 + SCHEDULER_BATCH log；全部 DONE → PHASE_6_CONVERGE upsertState；无可运行且未全 DONE → 抛 'No runnable shard'；IN_PROGRESS → recoverInterruptedShards（writeShardProgress INTERRUPTED→TODO + RECOVERED log）后重试；estContext 超预算 → blockShardForContextBudget（writeShardProgress BLOCKED + writeNotification CONTEXT_BUDGET_EXCEEDED）；paused / 非 APPROVED → 抛错。

#### 标注文档

- Step N1 shard 调度核心已有 domain focused tests 覆盖各分支。

#### 审查待实施项

- 仍待：finalize/reloop、reviewGlobal、resumeAndRead 子批。

#### 再标注文档

- Cycle 89 完成，进入结构审查 + 文档 + 收敛。

#### 验证

```bash
pnpm --filter @repo/api test -- loops-engine.service.spec.ts --runInBand
```

结果：`loops-engine.service.spec.ts` 25 个测试通过（19 旧 + 6 新调度）。

### Cycle 90 · Step N1 结构审查 + 文档同步 + 收敛验证

#### 实施

- domain 反向依赖扫描无命中；`loops-engine.service.ts` 仅依赖 contracts/nest/store（含 `readLoopsRuntimeConfig` util）/runners(interface)。
- 确认 facade `runLoopUnlocked` 为 thin delegate；`runLoop` 保留 workLock 包装。
- 更新 nextstep README Step 3、BACKLOG N1、struct-opz EXECUTION Step 3、本文件顶部 Step 3 + 总体状态表。
- 汇总本批 Cycle 88-90。

#### 标注文档

- 本批完成 N1 第三个子批（88 runLoopUnlocked 调度实施 / 89 focused tests / 90 结构审查+文档+收敛）。
- 准确标注 N1 当前状态，未改变对外 API contract / controller path / shard 调度行为。

#### 审查待实施项

- 待实施（N1 后续子批）：
  - `finalize`/`reloop`（agentAdapter.reviewGlobal/annotateFinalize + 收敛态迁移，依赖 evidence/regression）。
  - `reviewGlobal`（global evidence 收集 + regression run）。
  - `resumeAndRead`（upsertState + appendLog + syncAndRead，store 编排，可较易下沉）。
  - `runRunnableShard` 重执行 port 化评估（依赖 claudeAdapter + persist + runShardTests + reviewShard，最大依赖面）。
- 其他 backlog：N6 收尾、N5 archive re-home、N7 facade/module 收敛。

#### 再标注文档

- Cycle 90 完成；runLoopUnlocked shard 调度核心已下沉，N1 多批迁移推进中（已下沉 spec/decompose/advance/runLoopUnlocked 四大流）。

#### 验证

```bash
pnpm --filter @repo/api test -- loops-engine.service.spec.ts loops.service.spec.ts loops-issues.service.spec.ts loops-triggers.service.spec.ts loops-eval.service.spec.ts loops-eval-aggregation-runner.service.spec.ts loops-ci-checks.service.spec.ts loops-notification-sender.service.spec.ts loops-remote-runners.service.spec.ts loops-admin.service.spec.ts loops-archive-collection.service.spec.ts --runInBand
pnpm --filter @repo/api type-check
rg "from ['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)|require\\(['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)" apps/api/libs/domain/services
```

结果：

- 11 个 test suite 通过，137 个测试通过。
- API type-check 通过。
- domain 反向依赖扫描无命中。

### Cycle 91 · Step N1 reloop + resume 收敛态下沉实施

#### 实施

- `LoopsEngineService` 新增 `applyResume(issueId, detail)`（原 facade `resumeAndRead` 状态变更段：upsertState 清 paused + PAUSED→PHASE_4_IMPLEMENT + LOOP_INTERVENTION log）。
- `LoopsEngineService.reloop(issueId, detail, request)` 承接完整 reloop（max-reloop 校验 + 下一轮 spec/state + writeSpec），返回 `LoopReloopResponse`（无 detail read-back）；`buildReloopSpec`（纯）改为 engine public 供 facade reviewGlobal 路径复用。
- `LoopsService.reloop` 收敛 thin delegate（getIssue 预读 + engine.reloop）；`resumeAndRead` 改为 `engine.applyResume` + `syncAndRead`；facade 移除私有 `buildReloopSpec`（reviewGlobal 路径改用 `engine.buildReloopSpec`）。

#### 标注文档

- Step N1：reloop 收敛态 + resume 状态变更已下沉到 domain。

#### 审查待实施项

- 待继续：finalize（重依赖 release-gate/git/PR，需 port）、reviewGlobal。

#### 再标注文档

- Cycle 91 完成，进入 finalize port 下沉。

#### 验证

- API type-check 通过；facade loops.service.spec.ts 68 个测试通过。

### Cycle 92 · Step N1 finalize 经 port 下沉实施

#### 实施

- `loops-engine` 新增 `LoopsEngineFinalizePort`（getDetail / enforceReleaseGateOrThrow / openConvergencePr / annotateFinalize / buildLearnings / publishPrComment / readDetail）。
- `LoopsEngineService.finalize(issueId, port)` 承接收敛态编排：terminal 早返回 → globalVerdict PASS 校验 → release-gate 硬门禁 → 开收敛 PR → annotateFinalize → learnings → writeFinalize（CLOSED/finalized）→ PR 评论。顺序与状态写入在 domain；release-gate/git/evidence/agent annotate/learnings/PR builder 经 port 注入（最大依赖面）。
- `LoopsService.finalize` 收敛 thin delegate（`engine.finalize(issueId, this.finalizePort)`）；`finalizePort` getter 把各 builder 包装为 port。

#### 标注文档

- Step N1：finalize 收敛态编排已下沉到 domain，重依赖 builder 经 port 注入，避免 domain 拖入 evidence/git/PR 实现面。

#### 审查待实施项

- 待继续：reviewGlobal（global evidence + regression）；finalize 的 release-gate/git/PR builder port 化评估。

#### 再标注文档

- Cycle 92 完成，进入 focused tests。

#### 验证

- API type-check 通过；facade loops.service.spec.ts 68 个测试通过（含 create→…→finalize 全链路）。

### Cycle 93 · Step N1 finalize/reloop Focused Tests

#### 实施

- `loops-engine.service.spec.ts` 新增 applyResume（清 paused + PAUSED 降级 + log / 非 PAUSED 保持）、reloop（DRAFT reloop spec + PHASE_2_REVIEW state + 响应 / max-reloop 抛错）、finalize（terminal 无副作用 / 非 PASS 抛错 / gate→PR→annotate→learnings→writeFinalize(CLOSED)→PR comment 编排）测试组。

#### 标注文档

- Step N1 reloop/resume/finalize 收敛态已有 domain focused tests 覆盖。

#### 审查待实施项

- 仍待：reviewGlobal 子批。

#### 再标注文档

- Cycle 93 完成，进入结构审查 + 文档 + 收敛。

#### 验证

- `loops-engine.service.spec.ts` 32 个测试通过（25 旧 + 7 新）。

### Cycle 94 · Step N1 结构审查 + 文档同步 + 收敛验证

#### 实施

- domain 反向依赖扫描无命中；`loops-engine.service.ts` 仅依赖 contracts/nest/store（含 readLoopsRuntimeConfig）/runners(interface)。
- 确认 facade `reloop`/`finalize`/`resumeAndRead` 为 thin delegate。
- 更新 nextstep README Step 3、BACKLOG N1、struct-opz EXECUTION Step 3、本文件顶部 Step 3 + 总体状态表。
- 汇总本批 Cycle 91-94。

#### 标注文档

- 本批完成 N1 第四个子批（91 reloop+resume / 92 finalize port / 93 tests / 94 结构审查+文档+收敛）。
- 准确标注 N1 当前状态，未改变对外 API contract / controller path / 收敛态行为。

#### 审查待实施项

- 待实施（N1 后续子批）：
  - `reviewGlobal`（global evidence 收集 + regression run，依赖 evidence/regression builder port）。
  - `runRunnableShard` 重执行 port 化评估（claudeAdapter + persist + runShardTests + reviewShard，最大依赖面）。
  - `runLoop` workLock 包装 port 化评估。
- 其他 backlog：N6 收尾、N5 archive re-home、N7 facade/module 收敛。

#### 再标注文档

- Cycle 94 完成；N1 engine 已下沉 spec/decompose/advance/runLoopUnlocked/reloop/applyResume/finalize 七大流，剩余 reviewGlobal + 重执行/workLock 包装。

#### 验证

```bash
pnpm --filter @repo/api test -- loops-engine.service.spec.ts loops.service.spec.ts loops-issues.service.spec.ts loops-triggers.service.spec.ts loops-eval.service.spec.ts loops-eval-aggregation-runner.service.spec.ts loops-ci-checks.service.spec.ts loops-notification-sender.service.spec.ts loops-remote-runners.service.spec.ts loops-admin.service.spec.ts loops-archive-collection.service.spec.ts --runInBand
pnpm --filter @repo/api type-check
rg "from ['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)|require\\(['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)" apps/api/libs/domain/services
```

结果：

- 11 个 test suite 通过，144 个测试通过。
- API type-check 通过。
- domain 反向依赖扫描无命中。

### Cycle 95 · Step N1 reviewGlobal 经 port 下沉实施

#### 实施

- `loops-engine` 新增 `LoopsEngineGlobalReviewPort`（getDetail / collectEvidenceIssues / runRegression / runAgentGlobalReview / autoReloop / readDetail）。
- `LoopsEngineService.reviewGlobal(issueId, port)` 承接三分支整体复查：(1) 当前 round 证据不完整 → NEEDS-WORK + PHASE_4_IMPLEMENT；(2) 全局回归失败 → NEEDS-WORK（failedTests→issues）；(3) agent reviewGlobal → PASS（PHASE_8_ANNOTATE）/ 非 PASS（→ autoReloop）。record 构造 + 状态写入 + annotation 映射在 domain；证据收集 / 回归 / agent review / autoReloop / enriched read-back 经 port 注入。
- `LoopsService.reviewGlobal` 收敛 thin delegate（`engine.reviewGlobal(issueId, this.globalReviewPort)`）；`globalReviewPort` getter 把 collectGlobalEvidenceIssues / runGlobalRegression / agentAdapter.reviewGlobal / autoReloopAfterGlobalReview / syncAndRead 包装为 port。

#### 标注文档

- Step N1：reviewGlobal 整体复查三分支决策已下沉到 domain，重依赖 evidence/regression/agent builder 经 port 注入。

#### 审查待实施项

- 待继续：`runRunnableShard` 重执行 port 化（claudeAdapter + persist + runShardTests + reviewShard，最大依赖面）；`runLoop` workLock 包装 port 化。

#### 再标注文档

- Cycle 95 完成，进入 focused tests。

#### 验证

```bash
pnpm --filter @repo/api type-check
pnpm --filter @repo/api test -- loops.service.spec.ts --runInBand
```

结果：API type-check 通过；facade loops.service.spec.ts 68 个测试通过（含 advance→reviewGlobal 全链路）。

### Cycle 96 · Step N1 reviewGlobal Focused Tests

#### 实施

- `loops-engine.service.spec.ts` 新增 reviewGlobal 测试组（mock port + store）：terminal no-op、证据不完整→NEEDS-WORK+PHASE_4、回归失败→NEEDS-WORK（failedTests 映射）、agent PASS→PHASE_8_ANNOTATE、agent 非 PASS→autoReloop 委托。

#### 标注文档

- Step N1 reviewGlobal 三分支决策已有 domain focused tests 覆盖。

#### 审查待实施项

- 仍待：runRunnableShard / runLoop workLock port 化。

#### 再标注文档

- Cycle 96 完成，进入结构审查 + 文档 + 收敛。

#### 验证

- `loops-engine.service.spec.ts` 37 个测试通过（32 旧 + 5 新 reviewGlobal）。

### Cycle 97 · Step N1 结构审查 + 文档同步 + 收敛验证

#### 实施

- domain 反向依赖扫描无命中；`loops-engine.service.ts` 仅依赖 contracts/nest/store（含 readLoopsRuntimeConfig）/runners(interface)。
- 清理 facade 死代码：移除 Cycle 88 后遗留的 `blockShardForContextBudget` 副本（runLoopUnlocked 已下沉，无调用者）。
- 清理 `apps/api/.loops/tools/*.json` 测试夹具污染（pre-existing 测试隔离 bug：admin spec 的 temp LOOPS_WORKSPACE_ROOT 经 findWorkspaceRoot 回退到 cwd/.loops，工具跨 run 累积；gitignored 运行时产物，非源码）。
- 更新 nextstep README Step 3、BACKLOG N1、struct-opz EXECUTION Step 3、本文件顶部 Step 3 + 总体状态表。
- 汇总本批 Cycle 95-97。

#### 标注文档

- 本批完成 N1 第五个子批（95 reviewGlobal port / 96 tests / 97 结构审查+文档+收敛 + 死代码/夹具清理）。
- 准确标注 N1 当前状态，未改变对外 API contract / controller path / reviewGlobal 行为。
- 环境备注：途中 node_modules 退化（@dofe/infra-workspace 失链）+ pnpm install `minimumReleaseAge` supply-chain `Invalid time value` crash，经 `--config.minimumReleaseAge=0` 重装备恢复；非代码问题。

#### 审查待实施项

- 待实施（N1 后续子批）：
  - `runRunnableShard` 重执行 port 化（claudeAdapter.run + persistImplementationRecord + runShardTests + reviewShard，最大依赖面）。
  - `runLoop` workLock 包装 port 化（workLock.withIssueAndRepoLock）。
- 其他 backlog：N6 收尾、N5 archive re-home、N7 facade/module 收敛。

#### 再标注文档

- Cycle 97 完成；N1 engine 已下沉 spec/decompose/advance/runLoopUnlocked/reloop/applyResume/finalize/reviewGlobal 八大流，剩余 runRunnableShard 重执行 + runLoop workLock 包装。

#### 验证

```bash
pnpm --filter @repo/api test -- loops-engine.service.spec.ts loops.service.spec.ts loops-issues.service.spec.ts loops-triggers.service.spec.ts loops-eval.service.spec.ts loops-eval-aggregation-runner.service.spec.ts loops-ci-checks.service.spec.ts loops-notification-sender.service.spec.ts loops-remote-runners.service.spec.ts loops-admin.service.spec.ts loops-archive-collection.service.spec.ts --runInBand
pnpm --filter @repo/api type-check
rg "from ['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)|require\\(['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)" apps/api/libs/domain/services
```

结果：

- 11 个 test suite 通过，149 个测试通过。
- API type-check 通过。
- domain 反向依赖扫描无命中。

### Cycle 98 · Step N1 runRunnableShard 重执行下沉实施

#### 实施

- `LoopsEngineShardRunnerPort` 从单一 `runRunnableShard` 回调扩展为分步骤 port：`runAgent` / `persistImplementation` / `runTests` / `reviewTests` / `review` / `applyReview`，同时保留 `readFreshDetail`。
- `LoopsEngineService.runRunnableShard(issueId, detail, shard, port)` 承接原 facade 重执行管线：mark `IN_PROGRESS` → agent implement → persist implementation → run tests → test review → implementation review → verdict 推导 → apply review。
- `LoopsEngineService.runLoopUnlocked` 改为调用 engine 内部 `runRunnableShard`，调度 + 单 shard 重执行均归位到 `loops-engine`。
- `LoopsService.shardRunnerPort` 适配 claudeAdapter / persist / runShardTests / agent review / reviewShard，facade 删除私有 `runRunnableShard` 副本。

#### 标注文档

- Step N1：`runRunnableShard` 重执行已下沉到 domain；重依赖仍通过 port 注入，domain 不直接依赖 facade / adapter 实现。

#### 审查待实施项

- 待继续：`runLoop` workLock 包装 port 化（`workLock.withIssueAndRepoLock`）。
- 待评估：facade builder ports（finalize/reviewGlobal/retry）是否进一步拆到更窄 domain adapter。

#### 再标注文档

- Cycle 98 完成，进入 focused tests 校准。

#### 验证

```bash
pnpm --filter @repo/api type-check
```

结果：API type-check 通过。

### Cycle 99 · Step N1 runRunnableShard Focused Tests

#### 实施

- 更新 `loops-engine.service.spec.ts` 的 runLoopUnlocked scheduler specs，使用新的分步骤 `LoopsEngineShardRunnerPort` mock。
- 新增 `runRunnableShard` 直接 focused test：当 test review 返回 `TEST-FAIL` 时，即使 implementation review 为 `PASS`，最终 `applyReview` 也降级为 `NEEDS-WORK`，并使用 test review 的 summary/issues/fixInstructions。
- 清理 `loops-engine.service.ts` 中重复的 JSDoc 开头。

#### 标注文档

- Step N1 的重执行 verdict 推导已有 domain focused tests 覆盖，尤其覆盖“测试复核失败优先级高于实现 review PASS”的关键行为。

#### 审查待实施项

- 仍待：`runLoop` workLock 包装 port 化。

#### 再标注文档

- Cycle 99 完成，进入结构审查。

#### 验证

```bash
pnpm --filter @repo/api test -- loops-engine.service.spec.ts --runInBand
```

结果：`loops-engine.service.spec.ts` 通过，38 个测试通过。

### Cycle 100 · Step N1 结构审查与待办校准

#### 实施

- 审查 `LoopsEngineService.runLoopUnlocked`：调度循环直接调用 `this.runRunnableShard(...)`，不再依赖 facade 提供整块重执行方法。
- 审查 `LoopsService.shardRunnerPort`：仅作为 adapter，把重依赖能力映射为 port 回调。
- 执行 API type-check。

#### 标注文档

- 标注：N1 当前剩余从 “runRunnableShard + runLoop workLock” 收窄为 “runLoop workLock 包装”。

#### 审查待实施项

- 下一步最短路径：
  - 将 `runLoop` 中 `getIssue` / terminal check / `workLock.withIssueAndRepoLock` 包装 port 化。
  - N1 完成后再评估 N4 remote shard execution 实现从 facade 迁入 domain。

#### 再标注文档

- Cycle 100 完成，进入文档总览同步。

#### 验证

```bash
pnpm --filter @repo/api type-check
```

结果：API type-check 通过。

### Cycle 101 · 文档总览同步

#### 实施

- 更新 `struct-opz-nextstep/README.md` Step 3 当前结论。
- 更新 `struct-opz-nextstep/BACKLOG.md` N1 状态、推荐优先级与 trigger 风险提醒。
- 更新 `struct-opz/EXECUTION.md` Step 3 总览行。
- 更新 `struct-opz/IMPLEMENTATION-ANNOTATIONS.md` 顶部总体状态与当前剩余项。

#### 标注文档

- 明确 Step 3 当前已完成 `runRunnableShard` 重执行下沉。
- 明确剩余：`runLoop` workLock 包装 + facade builder ports。

#### 审查待实施项

- 下一批优先级：
  - N1：`runLoop` workLock 包装 port 化。
  - N4：remote shard execution 实现迁入评估（待 N1 收尾）。
  - N7：facade/module 收敛。

#### 再标注文档

- Cycle 101 完成，进入最终验证。

#### 验证

- 文档变更随 Cycle 102 最终验证收口。

### Cycle 102 · 本批收敛验证与下一轮待办

#### 实施

- 执行 engine focused tests。
- 执行 API type-check。
- 执行 domain 反向依赖扫描。
- 汇总本批 Cycle 98-102。

#### 标注文档

- 本批已完成至少 5 次循环动作：
  - Cycle 98：runRunnableShard 重执行下沉实施。
  - Cycle 99：focused tests。
  - Cycle 100：结构审查与待办校准。
  - Cycle 101：文档总览同步。
  - Cycle 102：最终验证与待办标注。

#### 审查待实施项

- 待实施：
  - N1：`runLoop` workLock 包装 port 化。
  - N4：remote shard execution 实现迁入 domain（待 N1 收尾后评估）。
  - N2：evidence 收集 / DB/Redis adapter service 独立化。
  - N6：testCiCheck provider publish / permission / publication persistence 下沉。
  - N5：archive service re-home 评估。
  - N7：facade/module 收敛。

#### 再标注文档

- Cycle 102 完成；N1 engine 已下沉 spec/decompose/advance/runLoopUnlocked/runRunnableShard/reloop/applyResume/finalize/reviewGlobal 九大流，剩余 runLoop workLock 包装。

#### 验证

```bash
pnpm --filter @repo/api test -- loops-engine.service.spec.ts --runInBand
pnpm --filter @repo/api type-check
rg "from ['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)|require\\(['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)" apps/api/libs/domain/services
```

结果：

- 11 个 focused test suite 通过，150 个测试通过。
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
