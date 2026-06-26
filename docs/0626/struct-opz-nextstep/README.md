# Loops 结构优化下一步收紧计划

## 背景

本目录承接 `docs/0626/struct-opz` 的实施结果，用于收紧后续未完成项和进一步优化项。

审查基准：

- `docs/0626/struct-opz/EXECUTION.md` 顶部执行进度总览。
- `docs/0626/struct-opz/IMPLEMENTATION-ANNOTATIONS.md` 最新 Cycle 43-47。
- 当前架构原则：`apps/api/src/modules/loops -> apps/api/libs/domain/services/loops-* -> store/db/client/infra`，domain 不反向 import API loops。

## 当前结论

已完成或基本完成：

- Step 0：`LoopsDomainModule` 骨架。
- Step 1：store / locks / 基础 util。
- Step 2：issue intake 与 query/read pipeline 已下沉，API facade 保留兼容 wrapper。
- Step 4：runner/runtime 主体已下沉，adapter provider wiring 仍属于 API 装配。
- Step 5：evidence/quality 主要 builder、gate、enricher 已下沉，API 保留兼容 wrapper。
- Step 9：capability registry、tool registry、delivery blueprint marketplace 已下沉。

仍需收紧：

- Step 3：engine 主流程推进方法仍在 legacy `LoopsService`。
- Step 6：Eval suite/run/bench builder + eval/bench trend worker IO + eval aggregation worker 编排已下沉到 `loops-eval`；evidence 收集与 DB/Redis 适配仍由 facade port 实现。
- Step 7：CI publication builder 与 notification sender re-home 仍待处理。
- Step 8：schedule trigger CRUD + `fireScheduleTrigger` 编排已下沉到 `loops-triggers`；remote execution pipeline 仍待拆；issue creation port 当前由 facade 临时实现。
- Step 9：Archive control wrapper 与 collection port 已下沉到 `loops-admin`；eval aggregation 接入仍待 Step N4 收口。
- Step 10：API module / facade wrapper 最终收敛仍未开始。

## 文档说明

- [BACKLOG.md](./BACKLOG.md)：未完成项、进一步优化项、风险与依赖。
- [EXECUTION-PLAN.md](./EXECUTION-PLAN.md)：下一步执行计划。每一步均包含“目标、范围、不做、受益”。
- [CHECKPOINTS.md](./CHECKPOINTS.md)：执行时的验证门禁和文档标注规则。

## 执行原则

- 继续采用小循环：实施 -> 标注文档 -> 审查待实施项 -> 再标注文档。
- 每批只动一个清晰边界。
- 不为迁移引入 `forwardRef` 作为默认解法。
- 不让 domain service import `apps/api/src/modules/loops`。
- 不改变 ts-rest contract、controller API path、用户默认入口语义。
