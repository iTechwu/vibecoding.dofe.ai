# PM Optimization Review

日期：2026-06-22

## 结论

本轮 PM 审查聚焦 DofeAI Loops / Loop Engineering：它不是普通聊天式 coding assistant，而是面向团队的 AI 工程交付工作流。产品北极星应从“让用户操作 agent”收敛为“让用户提交意图、批准关键判断、获得可审计交付证据”。

本轮已完成一轮闭环：

1. 检索并分析相关开源项目；
2. 对本项目现有 Loops 产品与代码进行审查；
3. 形成优化建议；
4. 实施当前可安全落地的 P0/P1 项；
5. 回写实施状态；
6. 完成相关回归检测。

## 文档结构

| 文档                                                       | 作用                                              | 状态           |
| ---------------------------------------------------------- | ------------------------------------------------- | -------------- |
| [01-open-source-benchmark.md](01-open-source-benchmark.md) | OpenHands / Open SWE / SWE-agent / Aider 对标分析 | 已完成         |
| [02-product-review.md](02-product-review.md)               | 本项目产品深审、问题分级、优化建议                | 已完成         |
| [03-implementation-loop.md](03-implementation-loop.md)     | 本轮实施项、代码落点、验证结果、后续 Epic         | 已完成并已标注 |

## 本轮已实施

- Dashboard Action Queue 默认展示统一的 `Continue loop` 产品语义，不再把 `resume` / `finalize` / `global-review` 的内部调度动作作为用户需要理解的主动作。
- Review Inbox 只保留真正需要人工判断的事项：Spec 审阅、re-loop 决策和异常通知；自动恢复与自动 finalize 不再算作“人工接管”。
- 中英文 i18n 文案已从“调度器动作 / 人工接管”调整为“Loop 可继续推进 / 人工决策项”。
- 后端 Loops metrics 与前端 dashboard model 测试已同步覆盖新语义。

## 本轮不继续实施的事项

以下事项仍有产品价值，但需要更大范围的 contract、worker 或工作流设计，已标注为后续 Epic，不阻断当前闭环：

- 队列化后台 worker 与 SSE/polling 进度流；
- GitHub / Linear / Slack 深集成触发；
- 沙箱权限策略与工具白名单产品化。

已在 0623 UIUX 循环继续关闭：

- 异常决策中心 v2；
- Spec diff review v1；
- round-aware evidence view v2。
- Natural-language control v1。
