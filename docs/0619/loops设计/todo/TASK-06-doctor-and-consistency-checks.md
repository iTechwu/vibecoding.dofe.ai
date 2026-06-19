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

- 状态：partial
- 实施分支：main
- 关键改动：
  - `LoopsFileStoreService.doctor()` 可检查 `.loops` root、state、issue/intake/spec/shards、annotation 覆盖与 finalized loop 终态标注完整性。
  - `GET /loops/doctor` 与 `pnpm loops:doctor` 可调用文件侧 doctor。
  - 未实现 DB 与 `.loops` 的双向一致性检查。
- 验证命令：
  - `pnpm loops:doctor`
  - `sed -n '184,250p' apps/api/src/modules/loops/loops-file-store.service.ts`
  - `sed -n '829,925p' apps/api/src/modules/loops/loops-file-store.service.ts`
- 验证结果：partial；当前 `pnpm loops:doctor` 输出 `ok=true`、`loops=0`、`issues=0`、`problems=[]`，但无法发现 DB 缺失/偏差。
- 剩余风险：DB 双写落地后若不扩展 doctor，会出现 DB 与 `.loops` 漂移但检查仍通过。
- 需要归档到 IMPLEMENTATION-ANNOTATIONS.md 的内容：
  - TASK-06 最终状态为 partial：文件 doctor 可用，DB 一致性 doctor 未完成。
