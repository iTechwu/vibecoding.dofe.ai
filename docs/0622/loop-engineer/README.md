# Loop Engineering 体验重构方案

## 背景

Loops 的早期实现把内部执行细节直接暴露给用户：用户能看到并操作 shard，甚至需要在页面里执行“接管 / 记录实现 / 运行测试 / 记录审阅”等动作。这对研发调试有价值，但对真实用户并不友好。

用户真正想完成的是：

- 提交一个清晰意图；
- 审阅系统生成的 Spec，批准或要求修改；
- 看到引擎自动拆解、实现、测试、审阅、恢复和收敛；
- 在异常无法自动处理时收到明确的人工介入请求；
- 最终拿到可审计的交付证据。

因此，Loop Engineering 的产品方向是：**把 Loops 从“人工操作 shard 的控制台”重构为“用户批准关键决策、引擎自动推进交付”的 AI 工程工作流。**

## 文档结构

| 文档                                                         | 作用                                                       |
| ------------------------------------------------------------ | ---------------------------------------------------------- |
| [01-product-principles.md](01-product-principles.md)         | 产品原则、用户角色、人工边界、体验反模式                   |
| [02-user-journey.md](02-user-journey.md)                     | 目标用户旅程、页面信息架构、关键状态与文案                 |
| [03-engine-architecture.md](03-engine-architecture.md)       | Loop Engine、`advance`、shard 自动化、证据真相源和接口边界 |
| [04-implementation-roadmap.md](04-implementation-roadmap.md) | 已落地能力、下一阶段任务、验收指标和风险                   |

## 总决策

1. **用户不手动管理 shards。** Shard 是引擎内部的计划与执行单元，只在 UI 中作为进度和证据展示。
2. **默认只有 Spec 审阅需要人工批准。** 其他阶段由 Loop Engine 自动推进，除非发生预算、权限、运行环境、回环上限等异常。
3. **主操作是 `Continue Loop` / `继续推进 Loop`。** 用户不需要理解“生成 Spec / 拆解 / run step / global review / finalize”的内部阶段按钮。
4. **后端提供产品级推进接口 `POST /loops/issues/:issueId/advance`。** 前端优先使用它，保留细粒度端点给 CLI、管理员、调试和兼容调用方。
5. **证据自动采集，人工只做审阅和例外决策。** Implementation Record、Test Record、Review Record、Global Review、Convergence PR 都应由引擎写入 `.loops` 真相源。
6. **页面表达“引擎状态”，不表达“用户待填表单”。** 用户看到的是当前阶段、执行者、证据覆盖、恢复点、追踪事件和下一步建议。

## 当前落地状态（2026-06-22）

| 能力                   | 状态                      | 说明                                                                                               |
| ---------------------- | ------------------------- | -------------------------------------------------------------------------------------------------- |
| 简化 issue 创建        | 已落地                    | `/loops/new` 简单模式优先，用户只需描述需求并选择 workspace/repo                                   |
| Spec 人工审阅          | 已落地                    | Draft Spec 停住等待批准或要求修改                                                                  |
| Shard 手动表单移除     | 已落地                    | detail 页 shard 区域改为只读自动化进度与证据视图                                                   |
| 中断 shard 自动恢复    | 已落地                    | `runLoop` 会自动恢复 `IN_PROGRESS` / `TIMEOUT` shard                                               |
| 产品级推进接口         | 已落地                    | `advance` 按当前状态自动执行到下一人工关卡或终态，停在 Spec 审阅                                   |
| 页面主操作收敛         | 已落地                    | detail 页右侧从多阶段按钮收敛为“继续推进 Loop”                                                     |
| 运行时诊断             | 已落地                    | agent runtime / workspace / docker fallback 有统一诊断面板                                         |
| Spec 批准后自动推进    | 已落地                    | `reviewSpec(approve)` 会唤醒 Loop Engine，自动拆解、执行、全局审阅并 finalize 到下一人工关卡或终态 |
| 细粒度端点终态幂等保护 | 已落地                    | `decompose` / `runLoop` / `reviewGlobal` / `finalize` 在 CLOSED 后幂等返回，避免旧调用方把终态倒退 |
| 队列化后台 worker      | 后续 Epic，不阻断当前闭环 | 当前为同步自动推进；下一步应引入后台队列、worker 重启恢复和 SSE/polling 进度流                     |
| 异常升级体验           | 已实施 v2                 | 0623 UIUX 已把成本、暂停、全局审阅、runtime、doctor 异常统一成可操作卡片                           |
| 自然语言控制           | 已实施 v1                 | 0623 UIUX/API 已提供 deterministic command endpoint；UI 命令栏与 LLM intent 后续增强               |

## 本轮闭环审查结论（2026-06-22）

- 已按本文档完成当前阻断项：普通用户默认路径不再暴露 shard 手动表单和内部阶段按钮。
- 已按本文档完成当前阻断项：`advance` 与 `reviewSpec(approve)` 可同步推进到下一人工关卡或终态。
- 已按本文档完成当前阻断项：旧细粒度端点在 CLOSED 后幂等返回，不会破坏自动终态。
- 已按本文档完成当前阻断项（本轮新增）：Detail 页与 dashboard action queue 文案对齐「文案原则」（见 02-user-journey.md）——「接管 / 记录实现 / 运行测试 / 记录审阅 / Run Step / No runnable shard」等默认体验措辞，已全部改为「自动恢复 / 查看实现证据 / 查看测试证据 / 查看审阅证据 / 继续推进 / 解释为何暂停」等用户语义；Next-Action 与 action queue 标题不再向普通用户暴露「Decompose / Global review / Run step / Finalize」等内部 phase 词汇（decompose→规划工作、globalReview→最终审阅、runStep→继续推进、finalize→完成交付）。
- 已按本文档完成当前阻断项（本轮新增）：Spec 审阅四态全部落地（见 02-user-journey.md 的 Spec Review 表）——无 Spec 与 Revision requested 仅说明可用「Continue Loop」生成/重新生成草稿，推进统一走 `advance`；Draft 显示批准/请求修改；Approved 转为只读并提示引擎自动推进。
- 已按本文档完成当前阻断项（本轮新增）：Detail 页操作层进一步收敛，`use-loop-operations.ts` 不再为默认页面绑定 `generateSpec` / `decompose` / `runLoop` / `reviewGlobal` / `finalize` 细粒度 mutations，普通用户推进路径只保留 `advanceLoop`。
- 已按本文档完成当前阻断项（本轮新增）：暂停状态下仍只有 `Continue Loop` 作为 primary action，`Pause` / `Resume` 保持 secondary safety controls，避免出现两个主操作。
- 已补齐回归覆盖（本轮新增）：`advance` 决策表新增 CLOSED 幂等、REVISION_REQUESTED 重生成、paused 自动恢复、非 APPROVED 拒绝、PHASE_6_CONVERGE 全局审阅+finalize、非 PASS 停留、`LOOP_ADVANCE_LIMIT` 最大步数保护，以及 dashboard action queue 用户语义标签测试；前端新增 Spec 四态渲染、暂停态 secondary safety control 和 dashboard model 标签回归测试。
- 已知保留偏差（不阻断闭环）：前端仍保留 `getRunnableShard` / `getRecoverableShard` 等**纯展示用**调度谓词，用于「当前可运行 shard / 中断恢复」提示文案与 Resume Checkpoint 高亮；它们不驱动任何推进决策（主推进仍统一走 `advance`），属于展示层细节。若要彻底消除，应在 `LoopDetail` 上由后端 `resolveNextAction` 暴露 `nextAction` / `activeShardId` 字段供前端直接消费——这仍是后续 contract 增强。
- 已知保留偏差（不阻断闭环）：细粒度兼容端点的 contract summary、hook 名称/注释和后端内部异常仍保留 implementation evidence / scheduler endpoint / No runnable shard 等内部工程语义；这些入口明确用于 CLI、管理员、兼容调用方或错误诊断，不属于普通用户默认路径。
- 仍未实施但已准确标注为后续 Epic：队列化后台 worker。这需要独立设计和更大范围基础设施，不阻断当前 Loop Engineering 用户体验闭环。
- 已在 0623 UIUX 循环继续关闭：异常决策中心 v2、round-aware evidence view v2、Spec diff review v1、Natural-language control v1。

## 产品北极星

Loop Engineering 的成功不是用户能点更多按钮，而是：

- 用户能用一句话启动一个工程任务；
- 用户只在真正需要判断产品意图时介入；
- 引擎能自动生成、执行、验证和修复；
- 每一步都有证据；
- 失败时系统说明“为什么停下、谁需要做什么、做完后如何继续”。
