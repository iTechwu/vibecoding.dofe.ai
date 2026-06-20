# CrewAI 二次产品分析与 Loops 迭代闭环

日期：2026-06-20

## 二次结论

这次复盘 `../crewAI` 后，重点从“CrewAI 是多 agent 框架”推进到“CrewAI 已经是框架 + CLI + 文件处理 + A2A + checkpoint + telemetry + AMP 控制平面”的组合。它的产品化重点不只是 agent 能跑，而是运行态能被部署、监控、恢复、审计和治理。

本产品 Loops 已在上一轮完成控制台首页与详情页证据链优化；本轮应把这些 dashboard 规则下沉到后端契约，形成可复用的 `metrics` 聚合能力，支撑 Web、CLI、通知和后续告警。

## 文件索引

| 文件                                                           | 目的                             | 状态        |
| -------------------------------------------------------------- | -------------------------------- | ----------- |
| [01-source-analysis.md](01-source-analysis.md)                 | `../crewAI` 二次源码/架构分析    | done        |
| [02-competitive-analysis.md](02-competitive-analysis.md)       | 二次竞品分析与差异化定位         | done        |
| [03-product-recommendations.md](03-product-recommendations.md) | 基于当前 Loops 实现的优化建议    | done        |
| [04-iteration-plan.md](04-iteration-plan.md)                   | 循环实施计划、状态标注、回归记录 | in-progress |

## 本轮实施状态

| 批次 | 内容                                          | 状态        | 标注                                                                   |
| ---- | --------------------------------------------- | ----------- | ---------------------------------------------------------------------- |
| R1   | 新增 `GET /loops/metrics` 后端聚合 API 与契约 | in-progress | 见 [04-iteration-plan.md](04-iteration-plan.md#r1-backend-metrics-api) |
| R2   | Web 控制台切换为使用 metrics API              | ready       | R1 回归后实施                                                          |
| R3   | CLI / 回归脚本补 metrics smoke                | ready       | R2 后实施                                                              |
| R4   | CrewAI/Flow 模板化 intake                     | planned     | 需产品确认模板范围                                                     |
| R5   | A2A / checkpoint / trace 深度能力             | planned     | 需运行环境和产品决策                                                   |

## 回归要求

每轮至少执行：

```bash
pnpm --filter @repo/contracts typecheck
pnpm --filter @repo/contracts test
pnpm --filter @repo/api exec jest src/modules/loops --runInBand
pnpm --filter @repo/web type-check
pnpm --filter @repo/web test
pnpm regression:docs0620
```

若只改文档，可在文档中明确跳过代码回归原因；本轮会改契约/API/Web，必须跑全量。
