# 03 · 实施闭环记录

## 循环 1

### 输入

根据 [02-product-review.md](02-product-review.md) 的 P0 问题，优先处理 dashboard 人工收件箱混入自动动作。

### 实施状态

状态：已实施。

代码落点：

- `apps/api/src/modules/loops/loops.service.ts`
  - `resolveNextAction` 对 paused、generate spec、decompose、global review、finalize 等可自动推进状态返回 `Continue loop` label；
  - 保留内部 action code 以兼容现有 contract 与 styling。
- `apps/web/app/loops/loops-dashboard-model.ts`
  - `HUMAN_ACTIONS` 移除 `resume` 和 `finalize`；
  - Review Inbox 只保留 `review-spec` / `reloop` 和异常通知。
- `apps/web/locales/en/loops.json`
  - Action Queue summary 改为“loops can be advanced or need a decision”；
  - Review Inbox summary 改为“human decision items”。
- `apps/web/locales/zh-CN/loops.json`
  - Action Queue summary 改为“Loop 可继续推进或需要决策”；
  - Review Inbox summary 改为“人工决策项”。
- `apps/api/src/modules/loops/loops.service.spec.ts`
  - 更新 metrics action label 断言；
  - 覆盖新 `Continue loop` 语义。
- `apps/web/app/loops/loops-dashboard-model.test.ts`
  - 增加 `finalize` / `resume` 不进入 Review Inbox 的回归断言。
- `apps/web/app/loops/page.test.tsx`
  - 更新 dashboard 文案和 mock action queue。

### 验收

已通过：

```bash
pnpm --filter @repo/api exec jest src/modules/loops/loops.service.spec.ts --runInBand
pnpm --filter @repo/web exec vitest run app/loops/loops-dashboard-model.test.ts app/loops/page.test.tsx 'app/loops/[issueId]/page.test.tsx'
```

结果：

- API Loops service：20 passed；
- Web Loops tests：16 passed。

### 再审查

本轮 P0 已闭合：

- dashboard 不再把自动恢复和自动 finalize 当作人工接管；
- review inbox 与 detail 页 Spec gate 心智一致；
- 自动推进仍可通过 action queue 进入 issue detail；
- contract 兼容入口仍保留。

## 循环 2

### 再审查结果

仍存在有价值但不适合本轮继续实施的后续项：

| 项目                                              | 状态      | 不在本轮实施原因                                                                   |
| ------------------------------------------------- | --------- | ---------------------------------------------------------------------------------- |
| `LoopMetricsActionItem` 增加 user-facing category | 已实施 v1 | 0623 UIUX 已增加 `nextActionCategory` 并前端优先使用                               |
| 队列化后台 worker                                 | 后续 Epic | 涉及 BullMQ/锁/worker 重启恢复/SSE，范围较大                                       |
| 异常决策中心                                      | 已实施 v2 | 0623 UIUX 已补齐 reason/owner/action/impact/retry/evidence                         |
| Spec diff review                                  | 已实施 v1 | 0623 UIUX 已基于 spec snapshot 暴露轻量 diff 摘要                                  |
| Round-aware evidence view                         | 已实施 v2 | 0623 UIUX 已补齐 artifact round 并默认过滤当前轮                                   |
| 自然语言控制                                      | 已实施 v1 | 0623 UIUX/API 已新增 deterministic command endpoint、audit 和安全 unknown fallback |
| GitHub/Linear/Slack 触发                          | 后续 Epic | 需要外部 OAuth/webhook/权限设计                                                    |

结论：当前仍保留的后续 Epic 为队列化后台 worker 与 GitHub/Linear/Slack 外部触发；`LoopMetricsActionItem` category、异常决策中心、Spec diff review、Round-aware evidence view、自然语言控制已在 0623 UIUX 循环闭合到 v1/v2。

## 回归检测记录

本轮专项回归已完成。最终回归命令与结果以会话最终回复为准。
