# 分批实施计划 & 循环节奏

> 配合 [04-optimization-recommendations.md](04-optimization-recommendations.md)。每批 = 一次"实施 → 标注 → 回归"循环。批次内严格保持 `pnpm quality:gate` 全绿。

## 循环节奏（每批）

```
1. 读相关源码（确认证据行号仍准确）
2. 实施该批所有项（最小、可测、不破坏既有行为）
3. 新增/更新对应 spec
4. 跑 [06-regression-checklist.md] 的批次级回归集
5. 回填 04 表的「状态」与「实施标注」
6. 提交（commit）—— 仅在用户要求时
```

## 批次 1 — P0 正确性 & 规则一致性（R1–R6）

**目标**：清零确凿缺陷 + Rule 3 违规 + 静默失败。

| 项             | 关键改动文件                                                                                                                        | 风险                           | 验证                                                          |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------- |
| R1 Rule 3      | `loops-notification-sender.service.{ts,spec.ts}`、`loops-pr-provider.client.{ts,spec.ts}`、`loops.module.ts`（import `HttpModule`） | 低 —— 行为不变，仅换 HTTP 实现 | 两个 spec 全绿；webhook 语义（`RECORDED/SKIPPED/FAILED`）保持 |
| R2 Winston     | 4 个 service 构造注入 + 关键路径日志                                                                                                | 低 —— 仅加日志，不改控制流     | Loops 全套 spec 绿；无 `console.*`                            |
| R3 crypto ID   | `loops.service.ts:createIssueId`                                                                                                    | 低                             | 新增 ID 唯一性/格式 spec                                      |
| R4 去重 commit | `loops.service.ts:finalize`、`cli-loops-git.adapter.ts:commitShard`                                                                 | 中 —— 需保证幂等不丢提交       | 新增 finalize 幂等 spec                                       |
| R5 收敛快照    | `loops.service.ts:runLoopUnlocked`                                                                                                  | 中 —— 核心调度                 | 主链冒烟 + 新增收敛判据 spec                                  |
| R6 cost guard  | `loops.service.ts`（抽 `recordCost`）+ token 字段                                                                                   | 中 —— 成本路径多               | cost guard trip+resume spec                                   |

**退出条件**：`pnpm test:api`（Loops 子集）全绿；[02] §8 的 Rule 3 违规清零；[02] §9.2 的 6 个缺陷均有 spec 覆盖。

## 批次 2 — P1 架构（R7–R9）

| 项            | 关键改动                                                                                           | 风险                                      | 验证                                         |
| ------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------- | -------------------------------------------- |
| R7 原子状态   | `loops-file-store.service.ts`：`state/<issueId>.json` 拆分 + `readState` 聚合                      | 中 —— 改存储布局，需迁移既有 `state.json` | 并发写不丢更新 spec；`doctor` 一致性 spec    |
| R8 结构化解析 | `loops-process.util.ts:extractJson` → `parseJsonLoose`                                             | 低                                        | 新增畸形 JSON 解析 spec                      |
| R9 分布式锁   | 新 `loops-lock-backend.interface.ts` + `in-memory`/`redis` 实现；`loops-work-lock.service.ts` 注入 | 中 —— 抽象 + 可选 Redis                   | in-memory 等价 spec；Redis backend mock spec |

**退出条件**：并发安全 spec 绿；解析鲁棒性 spec 绿；锁可切换且默认行为不变。

## 批次 3 — P1 前端（R10–R12）

| 项              | 关键改动                                                                    | 风险 | 验证                                      |
| --------------- | --------------------------------------------------------------------------- | ---- | ----------------------------------------- |
| R10 前端 Zod    | `new/new-loop-issue-form.tsx` + spec                                        | 低   | `new-loop-issue-form.test.tsx` 加校验用例 |
| R11 轮询        | `apps/web/lib/api/contracts/hooks/loops.ts:useLoopIssue` + `[issueId]` page | 低   | 详情页测试加轮询断言                      |
| R12 错误态/乐观 | `page.tsx` + `use-loop-operations.ts`                                       | 中   | `page.test.tsx` 加错误态用例              |

**退出条件**：`pnpm test:web` Loops 页面测试绿；`pnpm build:web` 通过。

## 批次 4 — P2 测试覆盖（R13）

补：cost guard trip+resume、reloop 上限抛错、`autoReloopAfterGlobalReview` 暂停、context-budget block、`LOOPS_AGENT_MODE=cli` fake、work-lock `Promise.all` 竞态、RBAC 权限串。
**退出条件**：每个高风险路径至少 1 个 spec；CI 测试数显著增加且全绿。

## 批次 5 — P2 重构（R14–R16）

R14（拆 CapabilityRegistry，纯数据）/ R15（拆 CoverageService）/ R16（拆 issue page 子组件）。**严格行为零变更**，逐项迁移 + 既有 spec 护栏。
**退出条件**：god object 行数下降；既有 spec 全绿；无 lint/type 新错。

## 不在本循环内（维持 designed/blocked）

D1–D9（重大特性，需设计/排期）、B1–B3（外部输入）。每轮循环结束在 [04] 表确认其状态不变，并记录任何解除条件的变化。

## 总退出条件（整个实施循环）

1. R1–R16 全部 `done` 或 `accepted`（不得 `open`/`in-progress` 残留）。
2. D1–D9 至少 `designed`（有接口/方案）；B1–B3 仍 `blocked` 且解除条件已记录。
3. `pnpm quality:gate` 全绿（含 `pnpm build`、`pnpm test`、lint、type-check）。
4. [04] 表「实施标注」列逐项有结论 + 提交引用。
