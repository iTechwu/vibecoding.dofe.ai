# crewAI 竞品对标 → Loops 优化建议（2026-06-21）

> 本目录以竞品 **crewAI**（源码 `../crewAI`，Python uv monorepo，版本 `1.14.8a2`）为参照系，**完整重审**其架构与执行模型，并对照本项目 **Loops**（`apps/api/src/modules/loops` + `apps/web/app/loops` + `packages/contracts`）的当前实现，输出可执行的优化建议与分批实施循环。
>
> 本目录**不重复** `docs/0619/sso`、`docs/0620` 已收敛的 SSO/file/Loops v1 收尾事项；聚焦：竞品对标下 Loops 的架构差距、规则一致性、正确性缺陷、可生产化能力。

## 目录索引

| 文件                                                                     | 目的                                                                                                           |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| [01-crewai-architecture-analysis.md](01-crewai-architecture-analysis.md) | crewAI 完整架构剖析（包结构、Agent/Task/Crew/Flow/Memory/Tool/Knowledge、执行引擎、持久化、可观测、CLI、测试） |
| [02-loops-current-state-analysis.md](02-loops-current-state-analysis.md) | 本项目 Loops 现状剖析（领域模型、执行流、适配器、持久化、RBAC、前端、测试、规则一致性、缺陷）                  |
| [03-gap-analysis.md](03-gap-analysis.md)                                 | crewAI ↔ Loops 能力差距矩阵 + 值得借鉴 / 明确规避的设计                                                        |
| [04-optimization-recommendations.md](04-optimization-recommendations.md) | **优化项总表 R1–R16**（含优先级、状态、验证方式）—— 实施循环的唯一追踪源                                       |
| [05-implementation-plan.md](05-implementation-plan.md)                   | 分批实施顺序、每批退出条件、循环与文档标注节奏                                                                 |
| [06-regression-checklist.md](06-regression-checklist.md)                 | 每轮实施后的回归命令、文档标注规则、回归矩阵                                                                   |

## 核心结论（TL;DR）

1. **crewAI 的核心抽象高度可复用**：`Agent/Task/Crew/Flow` 四元模型 + Pydantic/Zod 全量校验 + 可序列化 `FlowDefinition` + 统一 `Memory` + 结构化工具契约。这些与本项目已有的 **Zod-first + ts-rest + DB Service 分层** 高度同构，可在 TS 侧以低成本移植。
2. **Loops 当前是一条线性 9-Phase 流水线**，缺少 crewAI 的：条件分支/子流（Flow DSL）、跨任务记忆、结构化输出强约束、检查点/重放、多智能体、并行执行。其中**并行执行 + 分布式锁**是最大生产化缺口。
3. **存在若干确凿的正确性缺陷与规则违规**（详见 [02](02-loops-current-state-analysis.md) §8/§9）：`Math.random()` 生成 ID、`finalize` 重复 `commitShard`、`runLoop` 用陈旧快照判收敛、`state.json` 整文件覆写导致并发丢更新、`NotificationSender`/`PrProviderClient` 直接用 `fetch` 违反 Rule 3、多个 Service 层无任何日志（静默失败）。
4. **本批优化优先级**：先做 **P0 正确性 + 规则一致性**（R1–R6，低风险高价值），再做 **P1 架构/前端**（R7–R12），最后 **P2 测试覆盖 + 拆分**（R13–R16）。依赖外部凭据/真实环境的项维持 `blocked`（沿用 `docs/0620` 口径，不伪装 done）。

## 执行原则

1. **每轮只推进一个批次**，批次内变更必须保持 `pnpm quality:gate` 全绿，不得让既有测试转红。
2. **代码实施前确认边界**：本目录（Loops 架构/正确性/规则） vs `docs/0620`（生产化后置/阻塞） vs `docs/0619/sso`（SSO/file）。
3. **每轮实施完成立即同步标注** [04-optimization-recommendations.md](04-optimization-recommendations.md) 中对应项的状态，并运行 [06-regression-checklist.md](06-regression-checklist.md) 回归集。
4. **诚实标注**：缺外部凭据/真实环境/产品决策的项标 `blocked`，不得标 `done`；大重构（god object 拆分）以"设计 + 安全切片"方式推进，未完成不冒充完成。

## 状态口径

| 状态          | 含义                                                 |
| ------------- | ---------------------------------------------------- |
| `open`        | 尚未开始，需实现或进一步设计                         |
| `ready`       | 依赖已满足，可开始实施                               |
| `in-progress` | 正在实施                                             |
| `done`        | 已实施并通过回归                                     |
| `accepted`    | 已复核，维持现状，不作为阻断                         |
| `blocked`     | 需外部凭据/环境/产品决策/跨仓变更                    |
| `designed`    | 已出设计方案与接口，未落地代码（等待排期或外部条件） |

## 与既有文档的关系

- **`docs/0620`**：Loops v1 收尾已完成；本目录承接其"v1.1+ / 生产化后置"定位，但视角从"内部执行清单"升级为"竞品对标驱动"。
- **`docs/0619/sso`**：SSO/file 唯一真源；本目录仅引用其鉴权结论（`dofe-sso` submitter 已由 AuthGuard 派生）。
- 真实 PR provider 验收、真实 CLI token 计量、跨进程 worker 池仍依赖外部输入，沿用 `docs/0620/05-blockers.md` 口径。

## 实施轮次记录

- **round 1（批次 1 / P0）**：完成 R1（Rule 3：notification + PR client → `@nestjs/axios` `HttpService`）、R2（4 个 service 注入 Winston + 关键静默路径结构化日志）、R3（`createIssueId` 改 `crypto.randomUUID`）、R4（`commitShard` adapter 级幂等：`git diff --cached --quiet` 判空跳过）、R5（`runLoopUnlocked` 收敛判据改用 `currentDetail`）、R6（抽 `costGuardedState` helper + reviewShard 新增 cost 记账）。R6b（reviewGlobal/reloop + token estimated 标记）转 `designed`（依赖 schema 迁移）。回归：Loops Jest 18 passed / 3 skipped（DB smoke）+ API `tsc` 0 错 + `check:architecture`/`check:sensitive-logs`/`check:sso-boundaries` 全 PASS。详见 [04](04-optimization-recommendations.md)。

- **round 2（批次 2 / P1 架构）**：完成 R7（原子状态：`upsertState` 改 per-issue `state/<id>.json` + `atomicWriteJson`(temp+rename) + `readState` 聚合 + legacy 惰性迁移，消除整文件覆写丢更新竞态）、R8（`extractJson` 重写为 `parseJsonLoose`：剥 markdown 围栏 + 深度感知括号扫描 + 尾随逗号修复，+12 单测）、R9（`LoopsLockBackend` 接口 + `InMemoryLoopsLockBackend`(默认,行为等价) + `RedisLoopsLockBackend`(SET NX PX + 所有权 release + partial 回滚, +4 mock 单测)；`LoopsWorkLockService` 经 `LOOPS_LOCK_BACKEND` 注入，默认行为不变）。回归：Loops Jest 34 passed / 3 skipped + `tsc` 0 错。Redis 生产启用=配置级（factory 一行 + env），多实例验收仍属 B3 blocked。

- **round 3（批次 3 / P1 前端）**：完成 R10（`new-loop-issue-form` 接入契约 `CreateLoopIssueRequestSchema`，`handleSubmit` 内 `safeParse`，失败渲染字段级 `.text-destructive` 错误；+1 vitest 用例验证 2 字符 title 被拒）、R11（`useLoopIssue` 加 `liveLoopRefetchInterval` 谓词：活体态 `IN_LOOP`/`PHASE_4-7`→4000ms 轮询，`paused`/终态 status→停，详情页零改动自动生效）、R12（仪表盘派生 `dataLoadFailed`，header 下渲染 `role="alert"` 错误 banner，en/zh locale 各加 `loadError` key；乐观更新/onError 回滚转 R12b designed）。回归：web vitest loops 13 passed + web `tsc` 0 错。

- **round 4（批次 4 / P2 测试覆盖）**：完成 R13（覆盖**两个最大生产风险**——cost cap 绕过 + 并发竞态：新增 `loops-cost-guard.spec.ts` 3 用例 call/token cap trip + 低于 cap 不触发；work-lock `Promise.all` 5 并发竞态 1 用例→恰好 1 成功 4 ConflictException）。R13b（reloop/autoReloop/context-budget/CLI-fallback/RBAC 等服务全链路）转 designed（需更重 fixture 或外部 harness）。回归：Loops Jest 38 passed / 3 skipped。

- **round 5（批次 5 / P2 重构）**：完成 R14（抽 `LoopsCapabilityRegistry`：`capabilities()` 原 ~294 行纯静态能力/工具注册表原样迁出为 `@Injectable().build()`，`LoopsService` 改委托 + `@Optional()` 注入 + 模块注册，移除未用 `LoopCapabilityItem` 导入；行为零变更）。R15（抽 `LoopsCoverageService`）转 designed（集群 7 方法已定位，但 `aggregateCoverageSummaries`/`emptyCoverageSummary` 与 `metrics()` 共享，干净抽取需一并迁移共享 helper + 改接 2 处外部调用，跨方法耦合风险高于 R14，留独立 PR）。R16（拆 `[issueId]/page.tsx` 1124 行）转 designed（大型 UI 重构需人工验证）。**最终全量回归全绿**：`pnpm quality:gate` exit 0（含 architecture/sensitive-logs/sso-boundaries/type-check）+ API Jest 57 passed/3 skipped + web vitest 18 passed + `pnpm build`(web+api) exit 0。
