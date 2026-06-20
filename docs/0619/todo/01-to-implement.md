# 待实施项（to-implement）

> 有明确代码改动、阻断质量门禁或功能闭环的具体任务。本文件只覆盖 Loops v1 收尾与仓库质量门禁中已经纳入本轮处理的事项。
>
> SSO 与 file 唯一真源迁移由另一个进程在 `docs/0619/sso` 范围推进；本文件不重复标注该方向的业务实施项。

## 本轮（round 12 / 2026-06-20）进度

round 12 复审结论：本目录在 Loops v1 收尾范围内**无新增代码待实施项**。本轮关键变化是回归复核发现 `docs/0619/sso` 迁移进程已修复此前阻断 `check:architecture` 的 auth/SSO 命中（`resource-owner.guard.ts` 改用 Winston Logger、`streaming-asr-session.guard.ts` 移除 `as any`），因此 `pnpm check:architecture` 与 `pnpm quality:gate` 现已**全绿**——round 11 记录的「quality:gate 被 auth/SSO 短路」阻断已失效。`api/web/contracts/utils/validators` type-check、contracts/utils/validators/web tests、Loops Jest、`loops:doctor`、`loops:db-doctor`、四项质量门禁在本轮均实测通过。OPT-3 / OPT-5 维持 accepted/deferred（`generated/db` 仍处 SSO/file 并行迁移脏工作树，34 个文件未提交，不裁剪 per-model 生成产物以免覆盖另一进程状态）。

| 项                                     | 状态        | 说明                                                                              |
| -------------------------------------- | ----------- | --------------------------------------------------------------------------------- |
| IMP-1 生成 DB Service createMany 类型  | ✅ done     | 生成器模板已使用 `Prisma.*CreateManyInput[]`；相关 `TS2322` 已消除                |
| IMP-2 `@app/db` / infra 导出漂移       | ✅ done     | 当前 API type-check 已通过；SSO/file 真源方向不在本文件重复推进                   |
| IMP-3 `ApiErrorCode` 注册表对齐        | ✅ done     | `streaming-asr-session.guard.ts` 当前可通过 type-check                            |
| IMP-4 uploader 多余 `@ts-expect-error` | ✅ done     | 相关 unused `@ts-expect-error` 阻断已消除                                         |
| IMP-5 `generated/db/index.ts` 重复导出 | ✅ done     | 生成器 `ensureExportsInIndex` 已去重；`generated/db/index.ts` 无重复 Loops 导出   |
| IMP-6 `app.module.ts` 缺 `path` 绑定   | ✅ resolved | 原 i18n loader 路径重构问题已不再复现                                             |
| IMP-7 audit-log domain service 缺失    | ✅ done     | 已补 `libs/domain/audit-log/audit-log.service.ts` 包装 generated DB service       |
| IMP-8 list contract 标准化门禁         | ✅ done     | `TaskListResponseSchema` 已改为 `PaginatedResponseSchema(SystemTaskSchema)`       |
| IMP-9 task list query 标准化闭环       | ✅ done     | `taskContract.getTaskList` 已补 `TaskListQuerySchema` 并同步 Web 默认分页参数     |
| IMP-10 contracts 测试历史快照          | ✅ done     | contracts 测试已改为校验当前导出的 API/schema/error 公共面，测试与 typecheck 通过 |
| IMP-11 Loops/API architecture any 命中 | ✅ done     | `CliLoopsAgentAdapter.asSpec` 与 API `main.ts` bootstrap 已移除 `as any`          |
| IMP-12 utils hygiene 历史基线          | ✅ done     | `packages/utils` 生产代码 `console.*` / `any` 命中清零，utils typecheck/test 通过 |

## 验收（round 12）

- `pnpm --filter @repo/api type-check`：通过。
- `pnpm --filter @repo/web type-check`：通过。
- `pnpm --filter @repo/contracts typecheck`：通过。
- `pnpm --filter @repo/contracts test`：通过，3 test suites / 43 tests passed。
- `pnpm --filter @repo/utils typecheck`：通过。
- `pnpm --filter @repo/utils test`：通过，2 test suites / 60 tests passed。
- `pnpm type-check`：通过，6 turbo tasks successful。
- `pnpm loops:doctor`：通过，`ok: true`。
- `pnpm loops:db-doctor`：通过，`ok: true`。
- `pnpm --filter @repo/api exec jest src/modules/loops --runInBand`：1 passed、DB smoke 3 skipped（需 `LOOPS_DB_SMOKE=1` 才启用）。
- `pnpm check:list-contracts`：通过。
- `pnpm check:sensitive-logs`：通过。
- `pnpm check:utils-hygiene`：通过。
- `pnpm check:architecture`：通过（round 12）；auth/SSO 范围的 `resource-owner.guard.ts` Nest Logger 与 `streaming-asr-session.guard.ts` `as any` 已被 `docs/0619/sso` 迁移修复，四项 DB client / Logger / Console / Any 边界全绿。
- `pnpm quality:gate`：通过（round 12）；`check:architecture` → `check:list-contracts` → `check:sensitive-logs` → `check:utils-hygiene` → `type-check` 五步串行全部通过，无短路。
- `rg "LoopIssueService|LoopStateService|LoopIssueIntakeService" apps/api/src apps/api/libs packages scripts -g'*.ts' -g'*.js'`：无业务引用命中；确认 Loops DB 访问集中在 `LoopsDbService`。
- `pnpm --filter @repo/api exec jest --showConfig --runInBand`：通过；确认 API Jest cwd/rootDir 均解析到 `apps/api`。
- `pnpm --filter @repo/api exec jest --runInBand`：通过，4 test suites / 12 tests passed、3 skipped（`loops-persistence.db.spec.ts` 需 `LOOPS_DB_SMOKE=1`）。
- `pnpm --filter @repo/validators test`：通过，1 suite / 40 tests passed。
- `pnpm --filter @repo/web test`：通过，1 file / 2 tests passed。
- **环境竞态备注（round 12）**：本轮复核期间，`docs/0619/sso` 并发迁移进程修改了 `apps/api/src/bootstrap/app-module-imports.bootstrap.ts`（08:42，引入 `@dofe/infra-clients/verify`、`@dofe/infra-shared-services/system-health` 子路径导入）并一度使 `node_modules/@dofe/*` 处于未链接状态，导致 `quality:gate` 瞬时报 `TS2307: Cannot find module '@dofe/infra-clients/verify'`。已确认 published `0.1.56` 含 `dist/internal/verify`、`dist/internal/sso`、`dist/system-health` 子路径，`apps/api/tsconfig.json` 亦有对应 path 映射；执行 `pnpm install`（仅重链接，lockfile 未变）后 `node_modules` 恢复，`pnpm --filter @repo/api type-check` 与 `pnpm quality:gate` 复测通过。该瞬态属并发进程导致的环境态，非 Loops v1 / 非 SSO 代码回归。

## 后续口径

- 本文件当前无 Loops v1 P0/P1 待实施项；round 12 未引入代码改动，仅基于最新回归结果修正 round 11 残留的「quality:gate 被 auth/SSO 短路」失效结论。
- round 12 关键结论：`pnpm check:architecture` 与 `pnpm quality:gate` 已全绿（auth/SSO 命中已被 `docs/0619/sso` 迁移至第十二轮时修复）。
- 若 SSO/file 唯一真源迁移后续引入新的全仓 type-check/architecture 阻断，应在 `docs/0619/sso` 相关文档或迁移任务中标注，避免与 Loops v1 收尾混写。
