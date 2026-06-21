# crewAI 架构剖析（竞品参照）

> 源码：`../crewAI`（uv 管理的 Python monorepo，`pyproject.toml` pin `1.14.8a2`、`pydantic>=2.11.9,<2.13`、`python>=3.10,<3.14`）。引用以 `path:line` 形式给出，路径相对 `../crewAI`。
>
> 目的：为 Loops（TS/NestJS）提供可借鉴的抽象与执行模型参照，**聚焦工程语义而非营销**。

## 1. 包结构与依赖图

六个子包位于 `lib/`，均以 Hatchling 构建、从 `src/<pkg>/__init__.py` 动态读版本，版本**锁步发布**（`lib/devtools/src/crewai_devtools/cli.py:release`）。

```
crewai-core (无内部依赖)            ← 共享基础设施叶子
    ^                  ^
    |                  |
crewai-cli          crewai-files     ← CLI 运行时不 import crewai（shell out 到 uv run）
    ^    (extra)         ^
    |      |             |
crewai  <---------------+             ← 框架本体
    ^
    |
crewai-tools                          ← 依赖 crewai（仅为类型）

devtools (private, 开发用)            ← 不发布（Private :: Do Not Upload）
```

- **`crewai-core`**（`lib/crewai-core/src/crewai_core/`）：跨包共享基建 —— `auth/`（OAuth2 + auth0/entra_id/keycloak/okta/workos）、`telemetry.py`（OTLP，`SafeOTLPSpanExporter` 永不崩溃主进程）、`plus_api.py`、`token_manager.py`、`lock_store.py`、`paths.py`、`printer.py`、`settings.py`。**对应本项目的 `@dofe/infra-common`**。
- **`crewai`**（`lib/crewai/src/crewai/`）：框架本体，30+ 子模块：`agent/`、`agents/`、`crews/`、`tasks/`、`flow/`、`tools/`、`memory/`、`knowledge/`、`llms/`、`events/`、`state/`、`mcp/`、`a2a/`、`security/`、`skills/`、`rag/`、`experimental/`。
- **`crewai-cli`**：脚手架 + 运行时封装；`templates/{crew,flow,tool}/` 提供 `config/agents.yaml` + `config/tasks.yaml`（YAML 驱动定义）。
- **`crewai-tools`**：~90 个第三方集成（tavily、firecrawl、qdrant、snowflake、github、selenium、mcp 适配器等）。
- **`crewai-files`**：文件类型检测 + 多模态处理（Pillow/pypdf/python-magic/av/tinytag）。
- **`devtools`**：发布工程（bump/tag/release/docs-check）。

## 2. 核心领域抽象

**一切皆为 Pydantic v2 模型** —— 这是 crewAI 的中枢设计：运行时校验、JSON 序列化、判别联合、`model_validator(mode="after")` 钩子作为组合机制（对应本项目的 Zod-first）。

### 2.1 Agent — `lib/crewai/src/crewai/agent/core.py:171`

继承 `BaseAgent`（`agents/agent_builder/base_agent.py:200`，抽象 Pydantic 模型 + `AgentMeta` 元类）。

- 身份：`id: UUID4`（frozen）、`role/goal/backstory: str`、`tools: list[BaseTool]`、`cache=True`、`max_iter=25`（`:286`）。
- **LLM 字段多态且与 Crew/Task 共享**：`llm: str | BaseLLM | None` + `BeforeValidator` + `PlainSerializer`（`base_agent.py:305`），经 `_LLM_TYPE_REGISTRY` 解析（`:71`）。
- 执行旋钮：`max_execution_time`、`step_callback`、`use_system_prompt=True`、`respect_context_window=True`（`:243`）、`max_retry_limit=2`（`:247`）、`planning`/`planning_config`、`guardrail`（`:307`）、`guardrail_max_retries=3`（`:318`）、`a2a`（`:321`）、`mcps: list[str|MCPServerConfig]`（`:370`）、`memory`（`:374`）、`security_config`（`:344`）、`checkpoint`（`:348`）。
- 抽象契约（`base_agent.py:657`）：`execute_task`/`aexecute_task`/`create_agent_executor`/`get_delegation_tools`/`get_platform_tools`/`get_mcp_tools`。

### 2.2 Task — `lib/crewai/src/crewai/task.py:114`

`description`/`expected_output`（必填）、`agent`、`context: list[Task]`（`NOT_SPECIFIED` 哨兵区分"未提供"与"显式 None"）、`async_execution`、**输出三元组互斥**（`output_json`/`output_pydantic`/`response_model`，`:548`，均序列化为 JSON Schema 并 hydrate）、`output_file`（路径穿越校验 `:487`）、`human_input`、`guardrail`/`guardrail_max_retries: int=3`、`callback`。
执行：`execute_sync`（`:572`）→ `_execute_core`（`:762`）发 `TaskStartedEvent` → 调 agent → 输出 → 跑 guardrail 重试环（`:1246`）→ callback → 写 `output_file` → 发 `TaskCompletedEvent`。

### 2.3 ConditionalTask — `tasks/conditional_task.py:14`

`condition: Callable[[Any], bool]`；`should_execute` 依据前序输出判定，跳过的任务得空 `TaskOutput`。不可作为唯一/首任务。**这是 Loops 当前缺失的"条件分支"原语。**

### 2.4 Crew — `lib/crewai/src/crewai/crew.py`（2374 行）

`Crew(FlowTrackable, BaseModel)`（`:241`）。`FlowTrackable` mixin 在 Flow 内实例化 Crew 时捕获 `current_flow_id`/`current_flow_request_id` ContextVar，把嵌套 Crew 关联回父 Flow。

- 字段：`tasks`、`agents`、`process: Process=sequential`、`memory`（判别联合 + validator `create_crew_memory:640`）、`manager_llm`、`manager_agent`、`knowledge`、`planning`、`step_callback`、`task_callback`、before/after kickoff callbacks、`checkpoint`、`tracing`、`stream`。
- **`memory=True` 快捷方式**（`:640-676`）：自动构造 `Memory(root_scope=f"/crew/{name}")` + embedder + 推导 LLM。
- 工厂：`from_checkpoint(config)`（`:329`，从 JSON/SQLite 恢复）、`fork(config, branch)`（`:363`，从检查点分支）。

### 2.5 Process — `lib/crewai/src/crewai/process.py`

`class Process(str, Enum): sequential; hierarchical; # TODO: consensual`。**`consensual` 未实现**，无自定义 process；路由硬编码在 `kickoff`（`crew.py:1035-1044`）。

### 2.6 层级 Manager Agent — `crew.py:1494`

给定 `manager_agent` 则复用（**必须无 tools**，否则抛错 `:1500`）；否则合成一个带 `DelegateWorkTool`+`AskQuestionTool` 的 manager。层级模式下每个 task 的执行 agent 都是 manager，由 manager 扇出到真实 agent。**扁平单 manager 扇出，非树状。**

### 2.7 Flow & 状态编排

三分关注：`flow/dsl/`（装饰器）+ `flow/flow_definition.py`（可序列化 `FlowDefinition`，schema `"crewai.flow/v1"`）+ `flow/runtime/__init__.py`（3867 行引擎）。`Flow(BaseModel, Generic[T], metaclass=FlowMeta)`（`runtime/__init__.py:719`）。

- **DSL**：`@start(condition=None)`、`@listen(condition)`、`@router(condition, *, emit=None)`（返回值即下一个事件名；事件名从 `Literal[...]`/`Enum` 返回注解推断）。装饰器把 `FlowMethodDefinition` 挂到方法上（含 `do/start/listen/router/emit/human_feedback/persist`）。
- **状态**：`FlowState(BaseModel)`（`:353`，仅加 `id: str`）；`StateProxy`（`:600`）用 `threading.Lock` 包裹，嵌套 list/dict 用 `LockedListProxy`/`LockedDictProxy` 包裹防并发竞态。
- **`FlowMeta` 元类**（`:666`）：分离 Pydantic 字段与 `FlowMethod`，重写注解使非字段可调用成为 `ClassVar`。
- **`kickoff`/`kickoff_async`**（`:2110`/`:2209`）：处理检查点恢复、流式、`restore_from_state_id` 分叉（重分配 `state.id`）。async kickoff 设 OTel baggage + ContextVars + 进入事件总线 runtime scope。
- **方法执行 `_execute_method`（`:2789`）**：发开始事件 → 跑方法（sync 方法 `asyncio.to_thread` 隔离 + 拷贝 ContextVar）→ 自动 await 返回的协程 → 应用 `human_feedback` → `_persist_method_completion`（`:2859`）→ 发完成事件。
- **监听器按事件名分发**；router 同时在方法名与返回值名上触发监听。

### 2.8 Tool / BaseTool

`tools/base_tool.py:103`：`BaseTool(BaseModel, ABC)`，字段 `name/description/env_vars/args_schema/result_schema/cache_function/result_as_answer/max_usage_count`（原子计数）。唯一抽象方法 `_run`。`args_schema` 未提供时从 `_run` 签名自动生成。`CrewStructuredTool`（`tools/structured_tool.py:115`）是 LangChain `StructuredTool` 的自包含替代。

### 2.9 Knowledge — `knowledge/knowledge.py:88`

`Knowledge(sources, storage, embedder, collection_name)`。来源 `knowledge/source/`：String/TextFile/PDF/CSV/JSON/Excel + `CrewDoclingSource`（唯一语义分块）。其余用**朴素 char-offset 滑窗**（`chunk_size=4000, overlap=200`，`base_knowledge_source.py:43`）。**查询是 prompt 前置注入，agent 无 knowledge 工具**（`agent/utils.py:119` `handle_knowledge_retrieval`）。

### 2.10 Memory — 统一模型（新架构）

**重要**：crewAI 已废弃旧 `short/long/entity/user/external` 分裂，改为单一 **`Memory` 门面**（`memory/unified_memory.py:76`）+ 可插拔存储后端。方法：`remember/remember_many/recall(query, depth="shallow"|"deep")/forget/update/scope/slice/list_scopes/info/tree/reset/extract_memories/drain_writes/close`。

- 后端：`LanceDBStorage`（默认，向量维 3072）、`QdrantEdgeStorage`（写本地/同步中心）、`KickoffTaskOutputsSQLiteStorage`（重放用，非向量）。
- **编码流水线**（`memory/encoding_flow.py:75`，本身是一个 `Flow`）：`batch_embed → intra_batch_dedup → parallel_find_similar → parallel_analyze（LLM 分类为 insert/consolidate/field-resolve/both）→ execute_plans`，单 worker `_save_pool` 串行化写。
- **召回流水线**（`memory/recall_flow.py:58`）：`analyze_query → filter_and_chunk → search_chunks → decide_depth → synthesize`，复合评分 `w_sem*semantic + w_rec*decay + w_imp*importance`，`decay = 0.5 ** (age_days/30)`。

## 3. 执行引擎（一次 kickoff 的真实数据流）

```
Crew.kickoff(inputs)                                    # crew.py:980
  ├─ apply_checkpoint(restore)
  ├─ prepare_kickoff(self, inputs, input_files)         # crews/utils.py:260
  ├─ _run_{sequential|hierarchical}_process
  │     └─ _execute_tasks(self.tasks)                   # crew.py:1529
  │          for task:
  │            ├─ ConditionalTask.should_execute?
  │            ├─ if async_execution: task.execute_async → Future（daemon 线程，延后归并）
  │            ├─ else: context=_get_context(task, prior) → task.execute_sync
  │            │           └─ agent.execute_task          # core.py:786
  │            │                ├─ _prepare_task_execution（注入日期、memory.recall、schema prompt、knowledge 检索）
  │            │                ├─ _finalize_task_prompt（tools + training data）
  │            │                └─ AgentExecutor.invoke({...})   # experimental/agent_executor.py:2717
  │            └─ _process_task_result / _store_execution_log
  ├─ _create_crew_output(task_outputs)                  # crew.py:1858
  └─ calculate_usage_metrics()                          # crew.py:2088
```

**`AgentExecutor` 本身是一个 `Flow`**（crewAI 用自己的 Flow 框架实现 agent 内循环）。双模式：

- **Plan-and-Execute**（planning 开启）：`generate_plan` → `get_ready_todos`（依赖满足）→ `execute_todo_sequential|parallel` → `StepExecutor.execute`（**只做一次 LLM 调用 + ≤1 工具，无内循环**，`agents/step_executor.py:126`）→ `observe_step_result` router（按 reasoning_effort 低/中/高分流）→ 受 `max_replans=3` 约束的重规划。**最终答案仅在 todo 综合时应用 `response_model`。**
- **ReAct（文本/旧）**：`initialize_reasoning → check_max_iterations → call_llm_and_parse → route_by_answer_type`。

**LLM 调用统一入口** `get_llm_response`（`utilities/agent_utils.py:461`）包装 `llm.call(messages, tools=, callbacks=, available_functions=, from_task=, from_agent=, response_model=)`。**关键**：`response_model` 在 ReAct 模式有 tools 时被抑制（`:1390`）。工具结果注入：文本路径追加 `\nObservation: {result}`；native 路径追加 `{"role":"tool","tool_call_id","name","content"}` 消息。

**上下文窗口尊重**：`recover_from_context_length` router（`:2701`）→ `summarize_messages`（`utilities/agent_utils.py:920`）保留 system 消息、按消息边界分块、并行摘要、原地替换。

**Token 记账（双轨）**：`TokenCalcHandler`（litellm callback）+ `BaseLLM._token_usage`（per-LLM dict）；`UsageMetrics`（`types/usage_metrics.py:32`）跨 provider 归一化。

## 4. Flow 深度

- **事件总线** `CrewAIEventsBus`（`events/event_bus.py`）单例：sync handler 入线程池，async handler 入专用 daemon 事件循环；`RWLock`；`_enter_runtime_scope`/`_exit_runtime_scope`（ContextVar 深度计数，限定单次 kickoff）；`is_replaying()` ContextVar（重放时检查点监听器早返回）。
- **持久化** `FlowPersistence(BaseModel, ABC)`（`persistence/base.py`）：`init_db/save_state/load_state` + 异步反馈钩子 `save_pending_feedback`/`load_pending_feedback`。默认 `SQLiteFlowPersistence`（`persistence/sqlite.py:24`，表 `flow_states` + `pending_feedback`）。`set_flow_persistence_factory(Callable)` 进程级覆盖（镜像 `crewai_core.lock_store.set_lock_backend`）。
- **Guardrail/门禁**：Task 级 `GuardrailResult(success, result, error)`（`utilities/guardrail.py:60`）；`LLMGuardrail`（`tasks/llm_guardrail.py:49`）把字符串描述包成临时 agent；`HallucinationGuardrail`（`tasks/hallucination_guardrail.py:20`）**在 OSS 是 no-op stub**（付费）。Flow 级 `human_feedback`（`flow/human_feedback.py`）raise `HumanFeedbackPending` 暂停，经 `save_pending_feedback` 持久化，`kickoff(inputs={"id":..., "feedback":...})` 恢复。
- **可重放/分叉**：Crew `replay(task_id)`（`crew.py:1918`，用 SQLite 存的 task outputs 重建上下文）；Flow `kickoff(inputs={"id":uuid})` 恢复（跳过已完成方法）；Flow fork `restore_from_state_id` 重分配 `state.id`。
- **完整程序检查点**（`state/`）：`CheckpointConfig`、`RuntimeState` RootModel（`state/runtime.py`，整图序列化为 JSON，`_migrate()` 前向兼容，支持 branching）、`SqliteProvider`（`state/provider/sqlite_provider.py:17`，表 `checkpoints(id, created_at, parent_id, branch, data JSONB)`）。

## 5. 可观测与可靠性

- **Telemetry**：OTel + `SafeOTLPSpanExporter`（`crewai-core/telemetry.py:54`，失败静默）。默认发往 `telemetry.crewai.com:4319`，**不收集 prompt/任务描述/agent backstory/响应**（`:7` docstring），env 可关。
- **Events**：20 个事件类型模块（`events/types/`），最大 `a2a_events.py`（32 类）。`TraceCollectionListener`（`events/listeners/tracing/trace_listener.py:137`）订阅几乎所有事件类型。
- **三种 hook 机制**：transport 级 `BaseInterceptor`（httpx 包裹）+ 事件总线订阅 + LLM 调用前后 hook（`base_llm.py:913`）。**关注点重叠，难推理顺序**（技术债）。
- **重试**：LLM 级仅"stop 参数不支持→丢弃重试一次"（`llm.py:1875`）；agent 级 `max_retry_limit=2`（`core.py:247`）；task guardrail 级 `guardrail_max_retries=3`（`task.py:273`）；MCP 级 `_retry_operation` 指数退避 `2**attempt`（`mcp/client.py:663`）。
- **评测**：`TaskEvaluator`（产出 `TaskEvaluation(suggestions, quality: 0–10, entities)`）、`CrewEvaluator`（迭代打分）。

## 6. 持久化与重放总表

| 关注点                  | 后端                | schema/位置                                                                              |
| ----------------------- | ------------------- | ---------------------------------------------------------------------------------------- |
| Crew 任务输出（重放）   | SQLite WAL          | `KickoffTaskOutputsSQLiteStorage`（`memory/storage/kickoff_task_outputs_storage.py:19`） |
| Flow 状态（`@persist`） | SQLite              | `SQLiteFlowPersistence`（`flow/persistence/sqlite.py:24`）                               |
| 向量记忆                | LanceDB/Qdrant Edge | `LanceDBStorage`（`memory/storage/lancedb_storage.py:42`）                               |
| Knowledge               | ChromaDB/Qdrant     | `KnowledgeStorage`（`knowledge/storage/knowledge_storage.py:22`）                        |
| 检查点（整程序）        | SQLite/JSON         | `SqliteProvider`（`state/provider/sqlite_provider.py:17`）/ `JsonProvider`               |

**可恢复模型**：Crew 按 task 重放；Flow 按 UUID 恢复；Flow 按 UUID 分叉；整程序检查点支持 branching + 前向迁移。

## 7. CLI & UX — `lib/cli/src/crewai_cli/cli.py`

Click-based。顶层命令：`create/version/train/replay/log-tasks-outputs/reset-memories/memory/test/install/run/update/login/logout/chat`。组：`deploy/tool/template/flow/triggers/org`。**关键**：多数命令 shell out 到 `uv run <task>`（`train_crew.py:21`、`kickoff_flow.py:9`），用户项目在 `pyproject.toml` 定义 `[tool.crewai]` 任务表，CLI 不 import 框架 → **CLI 版本与运行时版本可独立漂移**。脚手架 `templates/crew/` 提供 YAML 驱动定义。TUI 基于 **Textual**。

## 8. 测试策略

- 207 个测试文件 + **241 个 VCR cassettes**（`lib/crewai/tests/cassettes/`）——每次真实 LLM 调用录制一次后回放。
- 工具：`pytest==9.0.3`、`pytest-asyncio`、`pytest-subprocess`、`vcrpy==7.0.0`、`pytest-recording`、`pytest-randomly`（随机顺序）、`pytest-xdist`（并行）、`pytest-split`（CI 分片）。
- 顶层 `conftest.py`（1042 行）：`_patch_vcrpy_aiohttp_compat()`（为 aiohttp 3.14 兼容打补丁）、autouse `setup_test_environment`（重定向 `CREWAI_STORAGE_DIR` 到 tmpdir、关 telemetry）、`cleanup_event_handlers`+`reset_event_state`（**事件总线是单例，测试间必须注销 handler 否则泄漏**）。
- 强项：Flow 持久化/可恢复、多模态多 provider、guardrail、human feedback、检查点 CLI。

## 9. 值得借鉴 / 明确规避

### ✅ 值得借鉴（Steal）

1. **Pydantic/Zod 全量校验 + 判别联合**（`memory: bool | Memory | MemoryScope | MemorySlice` 按 `memory_kind` 判别）—— 与本项目 Zod-first 同构。
2. **LLM 作为工厂而非类层级**（`LLM.__new__` 路由到 native SDK，回退 LiteLLM）→ TS 侧 `createLLM(config)` 工厂，provider 实现为 `clients/` 层 Nest 模块（契合 `@dofe/infra-clients`）。
3. **provider 无关的结构化输出** `call(messages, tools=, response_model=)` 单入口——框架决定 native-tools-vs-prompt-injection。
4. **`@start/@listen/@router` 装饰器 DSL + 可序列化 `FlowDefinition`**（`crewai.flow/v1`）——可可视化、可校验、可不依赖 TS 执行。**对 Loops 最可复用的想法。**
5. **CEL 表达式跨步骤引用**（`flow/expressions.py`，`${state.field}`/`${outputs.step}`，定义期校验 `allowed_roots`）。
6. **`StepExecutor` 自带消息列表、只做一次 LLM 调用 + ≤1 工具**——分离干净、可测。
7. **`GuardrailResult` + `tuple[bool, Any]` 可调用契约**——TS 侧映射到 Zod schema。
8. **复合记忆评分** `w_sem*semantic + w_rec*decay + w_imp*importance`，`decay=0.5**(age/30)`——简单、可解释、可调。
9. **事件总线：sync handler 入线程池 + async handler 入专用循环** + `is_replaying()` ContextVar。
10. **可插拔存储：Protocol + 工厂钩子**（`set_memory_storage_factory`/`set_flow_persistence_factory`）——镜像 `@dofe/infra-prisma`。
11. **RPM 控制器**（daemon 线程每 60s 重置 + 锁）。
12. **CLI `uv run` 解耦**——CLI 二进制不 import 框架。

### ❌ 明确规避（Reject）

1. **单 worker `_save_pool` 串行化记忆写**（`unified_memory.py:297`）——吞吐瓶颈；Loops 用 Postgres + Prisma 事务批写。
2. **`HallucinationGuardrail` OSS no-op stub**——要么实现要么移除，不发布桩。
3. **`max_iter * 10` 硬上限魔法数**（`agent_executor.py:229`）——改显式 per-phase 预算。
4. **循环分发依赖 `crewai-tools → crewai`**（仅为类型）——Loops 把工具类型放 `@repo/contracts` 断环。
5. **`Memory` 吞所有异常返回 `[]`**（`knowledge_storage.py:59`）——静默失败掩盖问题；改结构化错误事件。
6. **朴素 char-offset 分块**（4000/200）——2026 产品应 token/sentence 感知。
7. **层级 process = 扁平单 manager 扇出**——若 Loops 要真层级委派需改进。
8. **God class**（`crew.py` 2374 行、`flow/runtime` 3867 行）——Loops 从一开始就分离**定义（Zod）/ 编排（decorator）/ 引擎（Nest service）**。

## 10. 弱点 / 技术债

1. God classes（crew/flow runtime/agent core/agent_executor 均 2000–3867 行）。
2. 三套并行 hook 机制（transport 拦截器/事件总线/LLM 调用前后），关注点重叠。
3. `consensual` process 是 TODO；`CrewAgentExecutor` 已废弃但仍存在。
4. 测试大量 `MagicMock` 而非领域 fake，脆弱；241 cassettes 维护成本高（`conftest.py` 还携带 vcrpy/aiohttp 兼容垫片）。
5. `crewai` 惰性 import `Memory`（`crewai/__init__.py:42` `_LAZY_IMPORTS`）因 LanceDB 太重。
6. 大量 deprecated-but-present 字段（`function_calling_llm`、`reasoning`、`max_retries`）——API 面膨胀。
7. 并发原语混杂（`asyncio.to_thread` + `ThreadPoolExecutor` + `_execution_lock` 三套）。
8. **默认开遥测**（发往 `telemetry.crewai.com:4319`）——企业向竞品应**默认关**。
9. **Crew 多步执行无事务边界**——task 3/5 失败时 task 1-2 已副作用（记忆写、输出文件），仅检查点系统提供可恢复且需 opt-in。

## 11. Loops 团队优先研读文件

- `lib/crewai/src/crewai/flow/runtime/__init__.py` — Flow 引擎
- `lib/crewai/src/crewai/flow/flow_definition.py` — 可序列化契约（Zod schema 目标）
- `lib/crewai/src/crewai/experimental/agent_executor.py` — Plan-and-Execute vs ReAct 双模
- `lib/crewai/src/crewai/agents/step_executor.py` — "一次 LLM 调用 + ≤1 工具"原语
- `lib/crewai/src/crewai/memory/{unified_memory,encoding_flow,recall_flow}.py` — 记忆架构
- `lib/crewai/src/crewai/utilities/guardrail.py` + `tasks/llm_guardrail.py` — guardrail 契约
- `lib/crewai/src/crewai/llm.py` + `llms/base_llm.py` — provider 无关 LLM 抽象
- `lib/crewai/src/crewai/state/runtime.py` + `state/checkpoint_config.py` — 整程序检查点/恢复
