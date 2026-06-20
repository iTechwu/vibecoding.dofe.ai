# 迭代计划与实施标注

## 状态口径

| 状态          | 含义                               |
| ------------- | ---------------------------------- |
| `planned`     | 已列入路线但不立即实施             |
| `ready`       | 当前可实施                         |
| `in-progress` | 正在实施                           |
| `done`        | 已实施并回归通过                   |
| `accepted`    | 复核后暂不继续实现                 |
| `blocked`     | 需要外部输入、凭据、环境或产品决策 |

## R1 Backend Metrics API

状态：in-progress

目标：

- 新增 `GET /loops/metrics`。
- Contract / schema / service / controller / tests 全链路。
- 不新增 DB 直连；复用 `list`、`doctor`、`cost`。

任务：

- [in-progress] 新增 `LoopMetricsResponseSchema`。
- [in-progress] 新增 contract route。
- [in-progress] `LoopsService.metrics()` 聚合 control plane 数据。
- [in-progress] `LoopsController.metrics()` 使用 READ 权限。
- [in-progress] Jest 覆盖 metrics aggregation。

验收命令：

```bash
pnpm --filter @repo/contracts typecheck
pnpm --filter @repo/contracts test
pnpm --filter @repo/api exec jest src/modules/loops --runInBand
pnpm regression:docs0620
```

## R2 Web Uses Metrics API

状态：ready

目标：

- 新增前端 hook。
- `/loops` KPI、phase、risk 使用 metrics。
- 保留 list 用于表格。

## R3 CLI Metrics Smoke

状态：ready

目标：

- 增加 `loops:metrics` script。
- `scripts/loops-cli.ts metrics` 输出 JSON。
- 回归脚本加入 smoke。

## R4 Templates

状态：planned

需要产品确认模板字段、默认文案和是否需要后端存储。

## R5 A2A / Checkpoint / Trace

状态：planned

需要明确运行环境、agent registry、trace 数据结构和展示范围。
