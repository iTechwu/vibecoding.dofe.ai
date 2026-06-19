# Loops v1 后续待办（2026-06-19）

> 本目录在 Loops v1 主链路**代码完成且经文件侧 + live-DB 冒烟验证**之后，整理出后续的待实施项、待优化项与未落实（后置）项。
> 权威实现状态见 [`docs/0619/loops设计/IMPLEMENTATION-ANNOTATIONS.md`](../loops设计/IMPLEMENTATION-ANNOTATIONS.md) 的「最终归档（TASK-08 · round 2）」。

## 当前已验证结论（round 2）

- v1 主链路（无登录 Web 提交 → DB 三表入库 → `.loops` 真相源 → Loop 开发闭环 → 整体复查/终态标注 → CLOSED）代码全部落地。
- `pnpm loops:db-smoke`（连真实 DB）3/3 通过：三表写入、生命周期 CLOSED/finalized、doctor 一致性告警。
- `(cd apps/api && npx jest src/modules/loops)`：文件侧 1 passed、DB 侧默认 skip（`LOOPS_DB_SMOKE=1` 启用）。
- `@repo/web` / `@repo/contracts` type-check 通过；`@repo/api` type-check 仅 Loops 文件 0 错误（余 16 条既有非 Loops 阻断，见 [01-to-implement.md](01-to-implement.md)）。

## 分类口径

| 分类     | 含义                                             | 文件                                                   |
| -------- | ------------------------------------------------ | ------------------------------------------------------ |
| 待实施项 | 有明确代码改动、阻断质量门禁或功能闭环的具体任务 | [01-to-implement.md](01-to-implement.md)               |
| 待优化项 | 已可用但有健壮性/可维护性/可移植性改进空间       | [02-to-optimize.md](02-to-optimize.md)                 |
| 未落实项 | 明确不在 v1 范围、按路线图后置到 v1.1+ 的能力    | [03-not-yet-implemented.md](03-not-yet-implemented.md) |

## 优先级总览（建议执行顺序）

| #   | 项                                                     | 分类   | 优先级 | 理由                                                                    |
| --- | ------------------------------------------------------ | ------ | ------ | ----------------------------------------------------------------------- |
| 1   | 修复 17 条既有非 Loops type-check 阻断                 | 待实施 | P0     | 让 `pnpm quality:gate` / `pnpm type-check` 全绿，否则 CI 不可信         |
| 2   | `generated/db/index.ts` 去重导出 + 生成器去重          | 待实施 | P1     | 生成物卫生，避免重复标识符隐患                                          |
| 3   | CLI 可选 DB 模式（doctor/status 能查 DB）              | 待优化 | P2     | 让 `loops:doctor` 也能发现 DB 漂移，不依赖起 API                        |
| 4   | DB 写失败补偿/标记策略明确化                           | 待优化 | P2     | 双写半失败时 `.loops` 与 DB 漂移的运维处置                              |
| 5   | 移除/裁剪未被使用的 per-model 生成 DB Service          | 待优化 | P3     | `LoopIssueService`/`LoopStateService`/`LoopIssueIntakeService` 疑似冗余 |
| 6   | Web 表单 `targetRepo` 默认值可移植化                   | 待优化 | P3     | 当前硬编码绝对路径                                                      |
| 7   | `jest.config.ts` `process.cwd()` 依赖收敛              | 待优化 | P3     | 文档化 jest 必须从 `apps/api` 启动                                      |
| 8   | Dofe SSO / 角色权限                                    | 未落实 | v1.1   | TASK-09 后置                                                            |
| 9   | 飞书入口/审批/反向通知                                 | 未落实 | v1.2   | TASK-09 后置                                                            |
| 10  | 真实远端 PR / 多 Loop 并行 / 独立 worker 池 / 生产告警 | 未落实 | v1.3   | TASK-09 后置                                                            |

> 注：#1 是唯一的 P0（阻断质量门禁）；其余可在 v1 收尾后按阶段推进。完整明细见各分类文件。
