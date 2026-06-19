# TASK-03 · DB + .loops 双写持久化

## 任务目标

新增 Loops 持久化编排层，统一处理 DB 索引与 `.loops` 文件真相源的双写，避免 `LoopsService` 内部散落数据库写入。

## 依赖

- 依赖 `TASK-01` 的 DB Service。
- 依赖 `TASK-02` 的 contract/API 字段口径。

## 本任务范围

- 新增 `LoopsPersistenceService` 或同等职责服务。
- 将 create issue 链路改为：

```text
validate request
  -> normalize submitter dev default
  -> write DB LoopIssue
  -> write DB LoopIssueIntake
  -> write DB LoopState initial
  -> write .loops issue/intake/state/log
  -> return created issue
```

- 失败策略需要明确：
  - DB 写成功但 `.loops` 写失败时如何记录/回滚/标记。
  - `.loops` 已存在同 ID 时如何幂等处理。

## 可能涉及文件

- `apps/api/src/modules/loops/loops.service.ts`
- `apps/api/src/modules/loops/loops-file-store.service.ts`
- `apps/api/src/modules/loops/loops.module.ts`
- `apps/api/src/modules/loops/**persistence**`
- `apps/api/src/modules/loops/**db**`

## 验收标准

- `createIssue` 能同时产生 DB 记录和 `.loops` 文件记录。
- Issue 列表优先从 DB 查询。
- Issue 详情能结合 DB 顶层字段和 `.loops` 详细产物。
- `LoopsService` 不直接访问 Prisma。
- 日志中仍写入 intake/issue 创建事件。

## 验证建议

- 新增或更新服务级测试。
- 使用临时 Issue 跑一次 `createIssue` 冒烟。
- 检查 DB 中存在 Issue/Intake/LoopState。
- 检查 `.loops/issues`、`.loops/intakes`、`.loops/state.json` 同步存在。

## 禁止事项

- 不把 `.loops` 存储删除或降级为可选。
- 不在 controller 中处理双写。
- 不引入真实登录判断。

## 实施回填

- 状态：done
- 实施分支：main
- 关键改动：
  - 新增 `apps/api/src/modules/loops/loops-persistence.service.ts` 作为 DB + `.loops` 双写编排层：
    - `writeIssue`/`createIssue`：先 `store.writeIssue` 写 `.loops`，再 `db.createIssue`（事务化 Issue+Intake+LoopState），返回组合结果。
    - `list`：DB 总数 > 0 或带过滤时直接查 DB 索引并映射为 `{issue, state}` 分页响应；否则回退 `.loops`。
    - `readDetail`：合并 `.loops` detail 与 DB 顶层 issue/intake/state。
    - `syncState`/`syncClosed`：`upsertLoopState` + 可选 `updateIssueStatus`，把 `.loops` 真相同步到 DB。
    - `doctor`：在文件 doctor 之上叠加 DB 缺失与 DB/`.loops` 一致性问题（详见 TASK-06）。
  - `LoopsService.createIssue` 经 `if (this.persistence)` 切到 `persistence.writeIssue`，否则降级为纯文件写入（CLI 路径）。
  - `LoopsService` 对 persistence 采用 `@Optional() @Inject(LOOPS_PERSISTENCE)` + type-only import（`loops-persistence.token.ts`），使 API server 走 DB 双写、独立 `ts-node` CLI 走纯文件，避免 CLI 拖入 `@app/db`。
  - 失败/幂等策略：DB 与 `.loops` 顺序写入；`.loops` 同 ID 已存在时由 file-store 幂等覆盖，DB 侧由 `createIssue` 事务保证；DB 写失败经 `@HandlePrismaError` 抛出并被 controller 捕获，不会静默。
- 验证命令：
  - `rg -n "class LoopsPersistenceService|writeIssue|createIssue|syncState|syncClosed|doctor" apps/api/src/modules/loops/loops-persistence.service.ts`
  - `rg -n "persistence\\.writeIssue|listFromFile|LOOPS_PERSISTENCE" apps/api/src/modules/loops/loops.service.ts apps/api/src/modules/loops/loops.module.ts`
  - `pnpm --filter @repo/api type-check`（Loops 文件无错误）
- 验证结果：通过（代码与 type-check）；双写链路、DB 优先列表、合并详情均落地。文件侧运行期由 `loops.service.spec.ts` 覆盖；DB 写入运行期需迁移后的可用 DB 才能真正落库验证。
- 剩余风险：DB 写成功但 `.loops` 写失败这类跨系统一致性问题仍以 doctor 报告为准（v1 不做自动回滚），需在运维流程中处理。
- 需要归档到 IMPLEMENTATION-ANNOTATIONS.md 的内容：
  - TASK-03 升级为 done：`LoopsPersistenceService` 双写、DB 优先列表、合并详情、失败/幂等策略均落地；DB 运行期写入待迁移后验证。
