# 产品优化建议

## P0 · 后端 Metrics API

建议新增 `GET /loops/metrics`：

- `health`：doctor ok/problems、issue/loop 数。
- `summary`：active、inLoop、paused、attention、closed、total。
- `phaseDistribution`：phase/count/label。
- `costSummary`：tripped、min calls/tokens remaining、total calls/tokens。
- `riskQueue`：paused、cost guard、global verdict、P0/P1。
- `actionQueue`：generate spec、review spec、decompose、run step、global review、reloop、finalize、resume。

收益：

- Web、CLI、通知、告警共享同一产品规则。
- 减少前端重复聚合和规则漂移。
- 更接近 CrewAI AMP / LangGraph 控制平面形态。

## P1 · Web 控制台使用 Metrics API

建议：

- 首页优先请求 `metrics`。
- list 仍用于 issue table，metrics 用于 KPI、risk queue、phase distribution。
- 失败时保留现有前端聚合 fallback。

## P1 · CLI smoke 与运营输出

建议：

- `pnpm loops:metrics` 输出 control plane JSON。
- 回归脚本加入 metrics smoke。
- 后续可被通知发送服务复用，用于 daily status digest。

## P2 · 模板化 Intake

参考 CrewAI CLI templates：

- Bugfix Loop
- Feature Loop
- Refactor Loop
- Docs Loop
- Integration Loop

模板预填 acceptance criteria、测试建议、风险清单。

## P2 · A2A / Checkpoint / Trace 下一阶段

当前维持 planned：

- A2A agent registry。
- checkpoint browser / resume points。
- trace timeline / span view。
- file attachments / evidence artifacts。
