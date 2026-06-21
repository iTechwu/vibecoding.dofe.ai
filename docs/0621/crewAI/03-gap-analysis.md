# crewAI ↔ Loops 能力差距分析

> 基于 [01-crewai-architecture-analysis.md](01-crewai-architecture-analysis.md) 与 [02-loops-current-state-analysis.md](02-loops-current-state-analysis.md)。把差距映射到 [04-optimization-recommendations.md](04-optimization-recommendations.md) 的具体项（R#）。

## 1. 能力差距矩阵

| 能力                  | crewAI                                                                       | Loops 现状                                                                              | 差距 / 优化项                                                                                          |
| --------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **流程编排**          | DAG/阶段化 `Flow` + 条件路由（`@router`）+ `ConditionalTask`                 | 线性 9-Phase，分支仅靠 reloop/pause                                                     | 无条件分支、无子流、无扇出。R-D1（Flow DSL，design-only）                                              |
| **状态机**            | `FlowState` + 线程安全 proxy + 可序列化 `FlowDefinition`                     | `LoopPhaseSchema` 仅信息性，转移散落 20 方法                                            | 无中央转移表/守卫。R-D2（state machine formalization，design-only）                                    |
| **记忆**              | 统一 `Memory`（LanceDB/Qdrant）+ 编码/召回 Flow + 复合评分                   | 无 —— 每 shard 上下文隔离（`cli-loops-claude.adapter.ts:136` 显式"不要引用其它 Shard"） | 有意为之但限跨 shard 学习。R-D3（memory/knowledge，design-only）                                       |
| **重试 / guardrail**  | LLM/agent/task guardrail/MCP 多级重试 + `GuardrailResult` + 指数退避         | `maxRetry`（CLI 解析）+ `maxShardRedo` + `maxReloop` + cost cap                         | 无测试 runner 失败重试、无指数退避、无 per-shard 断路器。R6、R-D4                                      |
| **可恢复 / 重放**     | 检查点（SQLite/JSON，branching）+ Crew 按 task 重放 + Flow 按 UUID 恢复/分叉 | `resume()` 复位 `IN_PROGRESS`/`TIMEOUT`→`TODO`；`doctor()` 检测不修复；无重放           | 无不可变检查点、无回滚、无重放（能力注册表 `planned`）。R7（原子状态）、R-D5（checkpoint/replay）      |
| **结构化输出**        | provider 无关 `response_model`（pydantic/instructor）                        | `extractJson` 正则 + Zod safeParse + 回退 deterministic                                 | 启发式解析；应 tool-use 或 `--output-format json` schema 绑定。R8                                      |
| **成本 / token 记账** | `UsageMetrics` 双轨（litellm callback + per-LLM dict）跨 provider 归一化     | `costTokens`/`costCalls` 带上限，但 token 常为 `chars/4` 猜测                           | 不准；无 per-model 定价；per-shard 成本归因持久不可靠。R6                                              |
| **多智能体**          | 原生 Agent/层级 manager/delegate/a2a                                         | 单 Codex 大脑 + 单 Claude 双手；第三方 agent slot `planned`                             | 无 agent 委派、无 A2A。R-D6（design-only）                                                             |
| **并行**              | 原生 task 并行 + `asyncio.gather` + RPM 控制                                 | `maxParallel` 存在但环内顺序；内存锁                                                    | 无 worker 队列（RabbitMQ/BullMQ 在栈但未用）。**R9（分布式锁）+ R-D7（async exec）** —— 最大生产化缺口 |
| **知识 / RAG**        | `Knowledge` + 多 source + 存储后端 + 注入式检索                              | trace-evidence-reader 工具 `planned`                                                    | 无仓库索引、无语义检索。R-D3                                                                           |
| **流式 UI**           | `stream` + 事件总线                                                          | 整体捕获，无客户端流                                                                    | 长跑看似卡住（前端也无轮询）。R11、R-D8（SSE/stream）                                                  |
| **可观测**            | OTel + 安全 exporter + 事件总线 + trace listener                             | `cost()`/`metrics()` 同步读文件；service 层零日志                                       | 无 span、无结构化日志。R2（Winston）、R-D9（OTel）                                                     |
| **CLI / 工具**        | `crewai` CLI（run/train/test/replay/chat/flow）+ 模板                        | 无独立 CLI（HTTP 为主）                                                                 | 不属本批；保持 HTTP。accepted                                                                          |
| **测试**              | 207 文件 + 241 VCR cassettes + 并行/随机/分片                                | 5 spec / 14 测试；高风险路径未覆盖                                                      | R13（补 cost guard/reloop/CLI fallback/并发/finalize git/RBAC）                                        |
| **包结构**            | 6 子包锁步，core 独立                                                        | 单模块 `loops/` + adapters                                                              | R14/R15（拆 god object，本地化）                                                                       |

## 2. 值得借鉴的设计 → 落到 Loops（TS）

| 借鉴点                               | TS 落地形态                                                            | 关联项   |
| ------------------------------------ | ---------------------------------------------------------------------- | -------- |
| Pydantic 全量校验                    | Zod-first（已具备）+ 文件读回也走 Zod（修 Rule 2 缺口）                | R8、R13  |
| LLM 工厂 + provider 无关             | `createLLM(config)` + `clients/` 层 Nest 模块（`@dofe/infra-clients`） | R-D6     |
| 可序列化 `FlowDefinition`            | Zod schema `loops.flow/v1` 存 Postgres，可可视化/校验/重放             | R-D1     |
| `GuardrailResult` 契约               | Zod `GuardrailResultSchema` + 可调用校验器                             | R6、R-D4 |
| `StepExecutor`（一次 LLM + ≤1 工具） | 把 shard 执行拆为可测原语                                              | R-D7     |
| 复合记忆评分                         | `w_sem*sem + w_rec*decay + w_imp*imp`，`decay=0.5**(age/30)`           | R-D3     |
| 可插拔存储 + 工厂钩子                | 抽象 `LoopsLockBackend`（in-memory/Redis/DB），env 切换                | R9       |
| 事件总线 + `is_replaying`            | Nest `@EventEmitter2`；重放时跳副作用                                  | R-D5     |

## 3. 明确规避 → 不照搬 crewAI 的坑

| 规避点                                    | 理由       | 对 Loops 的约束                          |
| ----------------------------------------- | ---------- | ---------------------------------------- |
| 单 worker 串行写池                        | 吞吐瓶颈   | 用 Postgres + Prisma 事务批写            |
| no-op stub（如 `HallucinationGuardrail`） | 误导       | 要么实现要么移除                         |
| `max_iter*10` 魔法数                      | 脆弱       | 显式 per-phase 预算                      |
| 循环分发依赖                              | 难维护     | 工具类型放 `@repo/contracts`             |
| 异常吞 `[]`                               | 隐瞒问题   | 结构化错误事件 + Winston                 |
| 朴素 char 分块                            | 低质       | token/sentence 感知（若做 RAG）          |
| God class                                 | 难维护     | 从一开始分 定义/编排/引擎 —— R14/R15/R16 |
| 默认开遥测                                | 企业向差异 | Loops 默认关，env 开                     |

## 4. 优化项映射速查

- **P0（正确性 + 规则）**：R1（Rule 3 fetch→axios）、R2（Winston）、R3（crypto.randomUUID）、R4（去重 commitShard）、R5（收敛快照修复）、R6（cost guard 覆盖 + token 准确性）
- **P1（架构/前端）**：R7（原子状态）、R8（结构化 JSON 解析）、R9（分布式锁，接口+Redis backend）、R10（前端 Zod）、R11（前端轮询）、R12（前端错误态/乐观更新）
- **P2（测试/重构）**：R13（补测）、R14（拆 CapabilityRegistry）、R15（拆 CoverageService）、R16（拆 issue page）
- **Deferred / Blocked（D）**：Flow DSL、状态机形式化、memory/knowledge、guardrail 体系、checkpoint/replay、多智能体、async exec via BullMQ、SSE、OTel —— 多为重大特性或依赖外部输入

## 5. 一句话定位

Loops 当前是一个**功能完备但生产化未完成**的线性 agent 流水线：领域模型与契约扎实，但**执行脱离 HTTP、分布式并发、原子持久化、结构化 I/O、可观测、测试覆盖**六项是迈向 crewAI 级产品的关键路径。本批优化聚焦前六项中**本仓可安全落地**的子集，其余进入 designed/blocked。
