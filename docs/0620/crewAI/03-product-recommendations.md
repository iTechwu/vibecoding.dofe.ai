# 基于当前实现的产品优化建议

## P0 · 让 `/loops` 成为控制平面

现状：页面展示 doctor、cost、notifications、logs、issue table，但信息结构仍是“列表 + 几个卡片”。

建议：

- 新增运行健康摘要：Open、In Loop、Paused、Needs Attention、Closed。
- 新增阶段漏斗：按 Phase 分布展示所有 issue 的推进位置。
- 新增风险队列：paused、cost tripped、doctor problem、P0/P1、global non-pass 优先。
- 新增成本余量：calls/tokens remaining 的最小值和触发项。
- 事件与通知合并为运营视图，突出人工介入和收敛准备。

验收：

- 用户打开首页 5 秒内能判断：是否健康、哪里卡住、下一步看哪个 issue。
- 不新增后端接口，完全复用现有 hooks。

## P1 · 强化 Issue 详情页证据链

建议：

- 顶部增加“Next Action”提示：generate spec / approve / decompose / run step / global review / finalize / reloop。
- Shard 卡片显示 implementation / test / review / annotation 覆盖度。
- Test Matrix 与 failed tests 单独成区，作为能否收敛的依据。
- Global Review 和 Convergence PR 独立展示，减少交付前的不确定性。

验收：

- 人工 reviewer 不读原始日志也能知道当前 issue 为什么未完成。
- 每个 Shard 的“实现、测试、审查、风险”状态可扫。

## P1 · 把 CrewAI 概念迁移为 Loops 模板

建议：

- 新建 intake 模板：Bugfix Loop、Feature Loop、Refactor Loop、Docs Loop、Integration Loop。
- 模板预填 acceptance criteria、test requirements、risk checklist。
- 后续支持导入 CrewAI Flow 思路：事件触发、HITL gate、resume point。

## P2 · 后端聚合 metrics API

建议：

- 新增 `GET /loops/metrics`，返回 control plane 所需聚合数据。
- Contract 使用 Zod-first，response 包含 `health`, `phaseDistribution`, `riskItems`, `costSummary`, `actionQueue`。
- Service 层不直连 DB，继续走 persistence/store。

## P2 · 集成路线

建议维持 blocked 标注，直到输入齐备：

- Feishu intake / approval / notifications。
- Git provider PR / diff evidence。
- Worker queue / repo lock / concurrency limit。
- Real CLI token/cost telemetry。
