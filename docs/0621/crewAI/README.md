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
