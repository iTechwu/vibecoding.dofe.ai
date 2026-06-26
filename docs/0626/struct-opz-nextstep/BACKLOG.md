# Loops 结构优化剩余 Backlog

## 尚未完成项

| 编号 | 领域                          | 当前状态                                                                                                                                             | 后续动作                                                                                                                    | 风险 |
| ---- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---- |
| N1   | Step 3 Engine 主流程          | 仅纯状态推导原语下沉                                                                                                                                 | 抽 `generateSpec` / `runLoop` / `advance` / `finalize` 等推进方法                                                           | 高   |
| N2   | Step 6 Eval / Bench Worker IO | 纯 builder + eval/bench trend worker IO 编排 + eval aggregation worker 编排已下沉到 `loops-eval`；evidence 收集与 DB/Redis 适配仍由 facade port 实现 | 将 evidence collection / DB upsert / Redis warm 适配从 facade 迁到 `loops-eval` 专属 adapter service；processor 解耦 facade | 中高 |
| N3   | Step 8 Trigger Fire           | CRUD + `fireScheduleTrigger` 编排已下沉；issue creation port 已定义（`LOOPS_ISSUE_CREATION_PORT`），当前由 legacy facade 实现                        | 将 issue creation port 实现从 facade 迁到 `loops-issues` intake port；补 processor schedule tick → fire focused 子集        | 中   |
| N4   | Step 8 Remote Execution       | list/lease/job 基础能力已下沉                                                                                                                        | 抽 remote shard execution pipeline 与 artifact IO port                                                                      | 中高 |
| N5   | Step 9 Archive                | wrapper 已下沉到 `loops-admin`，collection port 已由 `LoopsArchiveCollectionService` 实现；eval aggregation 仍是可选窄 port                          | 评估 archive service re-home，并在 Step N4 后接入 eval aggregation domain port                                              | 中   |
| N6   | Step 7 Integrations           | PR/MCP/secret 已下沉                                                                                                                                 | re-home notification sender，抽 CI publication builder                                                                      | 中   |
| N7   | Step 10 Facade 收敛           | facade 仍大量 wrapper/private helper                                                                                                                 | 删除已迁 wrapper，收敛 API module providers                                                                                 | 中高 |
| N8   | 文档一致性                    | `IMPLEMENTATION-ANNOTATIONS.md` 顶部仍有早期状态残留                                                                                                 | 以 `EXECUTION.md` 总览为准，校准顶部状态与历史待办措辞                                                                      | 低   |

## 进一步优化项

| 编号 | 优化项                                | 说明                                                                                                                |
| ---- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| O1   | 建立 ports 命名规范                   | 对 issue creation、loop detail read、archive IO、remote artifact IO 统一命名，避免 service 之间直接互相知道实现细节 |
| O2   | 收敛 `@Optional + new Service()` 兜底 | 当前为兼容 standalone specs 保留；Step 10 后评估是否改为更明确的 test module wiring                                 |
| O3   | 建立 wrapper 删除清单                 | 每个 domain service 下沉后，在 Step 10 文档中登记 facade wrapper 删除条件                                           |
| O4   | 加强 architecture check               | 现有 reverse-import check 已有，后续可增加“domain service 不 import controller/processor/decorator”更细规则         |
| O5   | 补齐 focused specs 归属               | 已迁 domain 的行为测试应尽量迁到同目录，API spec 只保留 controller/contract/e2e                                     |
| O6   | 文档事实源收敛                        | `EXECUTION.md` 作为状态事实源；`IMPLEMENTATION-ANNOTATIONS.md` 作为历史日志，不再承载顶部决策事实                   |

## 推荐优先级

1. N3 Trigger fire issue creation port：能解锁 schedule processor 从 legacy facade 解耦。
2. N2 Eval / bench worker IO：纯 builder 已就位，适合继续拆 worker 编排，也可补齐 archive eval aggregation port。
3. N6 Integrations re-home：清偿 store/integration 技术债。
4. N5 Archive service re-home 评估：collection port 已稳定后可做。
5. N1 Engine 主流程：价值最高，但依赖最多，应在 ports 稳定后执行。
6. N7 Step 10 facade 收敛：应在前面高价值拆分完成后集中做。

## 当前风险提醒

- Engine 主流程是最高风险项：依赖 store、runner、evidence、locks、cost guard、state mutation，必须单独循环。
- Archive service 已不再直接注入 legacy `LoopsService` 类；collection port 已由 domain collection service 实现，剩余风险是 eval aggregation 仍需在 Step N4 后接入更完整 domain port。
- Trigger fire 编排已下沉到 `loops-triggers`，processor 不再注入 legacy facade 类；issue creation port 当前仍由 `useExisting: LoopsService` 临时实现，待 intake 下沉后换实现。
- Eval worker IO 编排（trend + aggregation）已下沉到 `loops-eval`；evidence 收集 / DB upsert / Redis warm 仍由 facade port 适配，后续可建 `loops-eval` 专属 adapter service 解耦 processor；processor queue name 保持不变。
- Step 10 删除 wrapper 前必须确认 controller、processor、spec 不再依赖 legacy method body。
