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

- 状态：not-started
- 实施分支：main
- 关键改动：
  - 未发现 `LoopsPersistenceService` 或等价 DB + `.loops` 双写编排层。
  - `LoopsService.createIssue` 当前只调用 `LoopsFileStoreService.writeIssue()` 写 `.loops`。
- 验证命令：
  - `sed -n '45,115p' apps/api/src/modules/loops/loops.service.ts`
  - `rg -n "Persistence|writeIssue\\(|loopIssue|loopState|LoopIssueIntake" apps/api/src/modules/loops apps/api/src -g '!**/*.map'`
- 验证结果：未通过任务验收；未实现 DB 记录创建，也没有双写失败补偿/幂等策略。
- 剩余风险：v1 主链路目前无法证明 Issue / Intake / LoopState 真实入库。
- 需要归档到 IMPLEMENTATION-ANNOTATIONS.md 的内容：
  - TASK-03 最终状态为 not-started：`.loops` 写入可用，但 DB + `.loops` 双写未落地。
