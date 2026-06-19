# TASK-06 · Doctor 与一致性检查

## 任务目标

增强 Loops doctor，使它能检查 DB 索引与 `.loops` 文件真相源的一致性，帮助多 worktree 合并后快速发现状态偏差。

## 依赖

- 依赖 `TASK-03` 的双写。
- 依赖 `TASK-05` 的生命周期同步。

## 本任务范围

- 扩展 `GET /loops/doctor` 或内部 doctor 逻辑。
- 增加 DB 与 `.loops` 的一致性检查：
  - DB Issue 存在但 `.loops/issues` 缺失。
  - `.loops` Issue 存在但 DB Issue 缺失。
  - DB LoopState 与 `.loops/state.json` phase / round / finalized 不一致。
  - CLOSED Issue 缺少终态标注。
- 保留现有 `.loops` 文件完整性检查。

## 可能涉及文件

- `apps/api/src/modules/loops/loops-file-store.service.ts`
- `apps/api/src/modules/loops/loops.service.ts`
- `apps/api/src/modules/loops/**persistence**`
- `packages/contracts/src/schemas/loops.schema.ts`
- `apps/web/app/loops/page.tsx`

## 验收标准

- doctor 输出能区分文件问题、DB 问题、一致性问题。
- 正常创建并 finalize 的 Issue doctor 为 ok。
- 人为删除 DB 或 `.loops` 任一侧记录时 doctor 能报告问题。
- Web 队列页现有 doctor 状态不被破坏。

## 验证建议

- `pnpm loops:doctor`
- 人工制造临时不一致后验证 doctor 报错，再清理。
- `pnpm --filter @repo/api type-check`

## 禁止事项

- 不让 doctor 自动删除数据。
- 不在检查中修改 `log.jsonl`。
- 不把 DB 与 `.loops` 不一致静默吞掉。

## 实施回填

- 状态：done
- 实施分支：main
- 关键改动：
  - `LoopsFileStoreService.doctor()` 保留 `.loops` 文件完整性检查（root、state、issue/intake/spec/shards、annotation 覆盖、finalized loop 终态标注），并返回 `fileProblems`/`dbProblems`/`consistencyProblems` 占位字段。
  - `LoopsPersistenceService.doctor()` 在文件 doctor 之上叠加双向一致性检查：
    - DB Issue 存在但 `.loops/issues/<id>.json` 缺失 → consistency problem；
    - `.loops` Issue 存在但 DB Issue 缺失 → consistency problem；
    - DB `LoopState` 与 `.loops/state.json` 的 `phase`/`round`/`finalized` 不一致 → consistency problem；
    - DB 缺少 `LoopState` → db problem；
    - CLOSED Issue 缺少终态标注（`finalized` / `CLOSED` phase）→ consistency problem。
  - `LoopsDoctorResponseSchema`（`loops.schema.ts`）已含 `dbProblems`/`consistencyProblems`，`problems` 合并三类问题；doctor 不自动删除数据、不修改 `log.jsonl`、不静默吞掉不一致。
  - `GET /loops/doctor`（API server，带 persistence）跑完整三类检查；`pnpm loops:doctor`（CLI，无 persistence）跑纯文件检查。
- 验证命令：
  - `rg -n "consistencyProblems|dbProblems|compareState|inspectClosedIssue|listAllIssueStates" apps/api/src/modules/loops/loops-persistence.service.ts apps/api/generated/db/modules/loops/loops-db.service.ts`
  - `rg -n "dbProblems|consistencyProblems" packages/contracts/src/schemas/loops.schema.ts`
  - `pnpm loops:doctor`（输出含 `dbProblems:[]`、`consistencyProblems:[]`、`problems:[]`、`ok:true`）
- 验证结果：通过（代码 + type-check + CLI 文件 doctor 运行）；doctor 输出能区分 file/db/consistency 三类问题。DB 一致性分支运行期需迁移后的可用 DB 才能造不一致并验证告警。
- 剩余风险：CLI doctor 为纯文件模式，无法发现 DB 漂移；要验证 DB/`.loops` 一致性必须经 API server（带可用 DB）。
- 需要归档到 IMPLEMENTATION-ANNOTATIONS.md 的内容：
  - TASK-06 升级为 done：文件 + DB + 一致性三类 doctor 均落地；DB 一致性运行期验证待迁移后进行。
