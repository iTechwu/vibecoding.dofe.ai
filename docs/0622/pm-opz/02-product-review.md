# 02 · 产品深度审查

## 审查对象

本轮重点审查：

- `docs/0622/loop-engineer/*`
- `docs/0622/agent-run-time/*`
- `apps/api/src/modules/loops/*`
- `apps/web/app/loops/*`
- `apps/web/locales/{en,zh-CN}/loops.json`
- `packages/contracts/src/schemas/loops.schema.ts`

## 当前产品判断

Loops 已经完成从“手动 shard 控制台”到“产品级 Loop Engine”的关键转向：

- `/loops/new` 简单 issue intake 已降低创建门槛；
- `advance` 后端接口已承接状态机判断；
- Detail 页主操作已收敛到 `Continue Loop`；
- Spec Review 成为默认人工 gate；
- shard 手动表单已从默认体验移除；
- runtime diagnostics 已产品化展示。

这说明当前方向是健康的。剩余问题主要不是“缺少功能”，而是默认体验仍有部分内部调度语义外溢。

## P0/P1 问题

### P0 · Dashboard 人工收件箱混入自动动作

状态：已实施。

问题：

- 后端 `metrics.actionQueue` 曾把 paused loop 解析为 `resume / Resume loop`；
- 前端 `buildReviewInbox` 曾把 `resume` 和 `finalize` 视作人工动作；
- dashboard 文案是 “human review and takeover items”，与 Loop Engineering 原则冲突。

影响：

- 用户会误以为暂停恢复和 finalize 需要人工接管；
- 与 detail 页“一主操作 Continue Loop”的体验不一致；
- dashboard 和 detail 页形成两个心智模型。

优化：

- 自动恢复、global review、finalize 统一展示为 `Continue loop`；
- Review Inbox 只显示真正需要人工判断的事项；
- summary 文案从 takeover 改为 decision。

### P1 · Action Queue 仍保留内部 action code

状态：部分接受，暂不实施 contract 变更。

说明：

- contract 仍允许 `generate-spec` / `decompose` / `run-step` / `global-review` / `finalize`；
- 本轮已把 label 统一成用户语义；
- action code 仍保留给前端 styling、兼容和调试使用。

后续建议：

- 在 `LoopMetricsActionItem` 增加 `userActionKind` 或 `nextActionCategory`；
- 前端默认只读 `label/category`，管理员视图才显示 internal action。

### P1 · 异常决策中心缺失

状态：后续 Epic。

问题：

- cost guard、runtime unavailable、permission、test failure、re-loop limit 分散在 risk queue、notifications、logs；
- 用户看得到“有问题”，但不总能知道“谁做什么、做完如何继续”。

建议：

- 新增 exception card contract；
- 每个 blocking exception 包含 reason、impact、owner、recommended action、retry action、evidence links；
- Dashboard 以 exception cards 替代散落的 risk text。

### P1 · Spec 二次审阅缺少 diff

状态：后续 Epic。

问题：

- re-loop 后用户需要重新读整份 Spec；
- 很难判断本轮变化是否正好回应上轮问题。

建议：

- 后端保存上一版 spec snapshot；
- 前端展示新增/删除/变更 acceptance criteria；
- approve 记录 spec version 与 reviewer。

### P1 · Evidence 缺少 current round 默认过滤

状态：后续 Epic。

问题：

- re-loop 后旧轮 DONE / PASS 证据可能误导用户；
- 当前 round 的缺口不够醒目。

建议：

- evidence artifacts 增加 round 字段；
- detail 页默认 current round；
- all rounds 作为审计折叠视图。

## 产品指标建议

| 指标                         | 目标                                         |
| ---------------------------- | -------------------------------------------- |
| 正常 happy path 人工动作数   | 1 次 Spec 审阅                               |
| Dashboard Review Inbox 噪音  | 自动恢复 / finalize 不进入 inbox             |
| Detail 页内部 phase 按钮曝光 | 默认用户路径 0                               |
| 停止原因可理解度             | 每个 blocking 状态都有原因、责任人、恢复动作 |
| Evidence 完整率              | finalize 前关键 artifact present             |
