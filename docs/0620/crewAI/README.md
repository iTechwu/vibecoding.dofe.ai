# CrewAI 项目分析与 Loops 产品迭代闭环

日期：2026-06-20

## 当前结论

`../crewAI` 是 Python 多 agent 框架与企业 AMP 控制平面组合：开源侧强调 Crews、Flows、CLI、Tools、Files、Skills；企业侧强调 Control Plane、Tracing、RBAC、SSO、HITL、部署与集成。当前 DofeAI / Loops 已有相近的“Issue → Spec → Shard → Implement → Review → Re-loop → Finalize”闭环，但 Web 控制台还停留在队列视图，缺少竞品控制平面里最关键的运行态聚合、风险优先级、可观测性和下一步行动指引。

## 文件索引

| 文件                                                           | 目的                                        | 状态 |
| -------------------------------------------------------------- | ------------------------------------------- | ---- |
| [01-project-analysis.md](01-project-analysis.md)               | `../crewAI` 实现与本项目 Loops 能力映射     | done |
| [02-competitive-analysis.md](02-competitive-analysis.md)       | CrewAI / LangGraph / AutoGen / n8n 竞品分析 | done |
| [03-product-recommendations.md](03-product-recommendations.md) | 基于当前实现的产品优化建议                  | done |
| [04-iteration-plan.md](04-iteration-plan.md)                   | 循环实施计划、状态标注与回归记录            | done |

## 本轮实施状态

| 批次 | 内容                                                                          | 状态    | 标注                                                                          |
| ---- | ----------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------- |
| R1   | Loops 首页控制台化：运行健康、阶段漏斗、成本余量、风险队列、最近事件/通知优化 | done    | 见 [04-iteration-plan.md](04-iteration-plan.md#r1-control-plane-dashboard)    |
| R2   | 细化 issue detail 的执行证据视图、测试矩阵与标注状态                          | done    | 见 [04-iteration-plan.md](04-iteration-plan.md#r2-issue-detail-evidence-view) |
| R3   | 新增控制台前端单测与视觉回归路径                                              | done    | 聚合模型已抽出并补单测；视觉 smoke 未作为本轮硬门槛                           |
| R4   | 后端聚合 metrics API，减少前端拼装                                            | planned | 需新增 ts-rest contract 与服务实现                                            |
| R5   | CrewAI 兼容/导入策略：把 Crew/Flow 概念映射为 Loops templates                 | planned | 需产品决策                                                                    |

## 回归口径

每轮实施后必须更新 [04-iteration-plan.md](04-iteration-plan.md)，并至少执行：

```bash
pnpm --filter @repo/web type-check
pnpm --filter @repo/web test
pnpm regression:docs0620
```

若改动 API contract / backend，追加：

```bash
pnpm --filter @repo/api exec jest src/modules/loops --runInBand
pnpm quality:gate
```
