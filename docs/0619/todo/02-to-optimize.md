# 待优化项（to-optimize）

> Loops v1 已可用且经验证，以下为健壮性、可维护性、可移植性、可观测性的改进空间。round 13 实施 `OPT-3`（SSO 迁移 `generated/db` 落定后裁剪冗余 per-model 生成 service）。

## 本轮（round 13 / 2026-06-20）进度

round 13 实施 `OPT-3`：`docs/0619/sso` 迁移已提交（`1637408` / `d981a90`），工作树 clean、`generated/db` 落定，OPT-3 的阻断前提消除。已将 `LoopIssue` / `LoopIssueIntake` / `LoopState` 加入 `apps/api/scripts/generate-db-crud.js` 的 `EXCLUDE_MODELS`，删除 `generated/db/modules/loop-issue`、`loop-issue-intake`、`loop-state` 三个孤儿生成目录，并由 `ensureExportsInIndex` 自动收敛 `generated/db/index.ts`（顺带补回此前缺失的 `user-info` / `audit-log` barrel 导出）。回归全绿：`check:architecture`、`quality:gate`（6/6）、`loops:doctor`、Loops Jest、API type-check 均通过。`OPT-5` 维持 accepted。

| 项                                    | 状态          | 说明                                                                                               |
| ------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------- |
| OPT-1 CLI 可选 DB 模式                | ✅ done       | 新增 `LOOPS_DB_CLI=1` DB 模式与 `loops:db-status` / `loops:db-doctor`；默认 CLI 仍文件模式         |
| OPT-2 DB 写失败补偿/标记              | ✅ documented | 采用 v1「`.loops` 真相源 + doctor 暴露 + 人工/定时补偿」口径；runbook 已写入 `08-数据存储设计.md`  |
| OPT-3 裁剪冗余 per-model 生成 service | ✅ done       | round 13 加入 `EXCLUDE_MODELS` 并删除 3 个孤儿目录；生成器不再重建死代码                           |
| OPT-4 Web `targetRepo` 默认值可移植化 | ✅ done       | 改为服务端解析仓库根 `path.resolve(process.cwd(),'../..')` + `NEXT_PUBLIC_LOOPS_DEFAULT_REPO` 覆盖 |
| OPT-5 jest `process.cwd()` 依赖收敛   | 🟡 accepted   | round 10 复核 `jest --showConfig` 正常；维持 `process.cwd()` 写法与注释约束                        |
| OPT-6 统一 persistence 可选分支       | ✅ done       | `LoopsService` 新增 `readDetail` / `writeIssueRecord` helper，收束 DB/file 分支                    |
| OPT-7 `listLegacy` 路由               | ✅ done       | `listLegacy` 已标 `deprecated: true` 并写明迁移到 `GET /loops/issues`                              |
| OPT-8 task list query/response 标准化 | ✅ done       | `TaskListResponseSchema` + `TaskListQuerySchema` + Web 默认分页调用已闭环，list-contract gate 通过 |
| OPT-9 contracts 测试历史快照收敛      | ✅ done       | 测试改为校验当前公共导出面；contracts test/typecheck 均通过                                        |
| OPT-10 architecture `any` 收敛        | ✅ done       | Loops CLI adapter 与 API bootstrap 的 `as any` 已清除；round 12 确认 auth/SSO 残留命中也已修复     |
| OPT-11 utils hygiene 历史基线清理     | ✅ done       | `packages/utils` 生产代码 `console.*` / `any` 清零，utils typecheck/test/hygiene 均通过            |

round 13 复审结论：`OPT-3` 已实施为 done；`OPT-5` 继续维持 accepted，非阻断；`OPT-1/2/4/6/7/8/9/10/11` 均已 done/documented。`check:architecture` / `quality:gate` 全绿。当前本目录仅剩 `OPT-5`（accepted）一项非阻断优化。

## OPT-1 · CLI 增加「可选 DB 模式」【✅ done】

- 实施：根 `package.json` 的 Loops CLI 命令增加 `-r tsconfig-paths/register`；新增 `loops:db-status`、`loops:db-doctor`。
- 实施：`scripts/loops-cli.ts` 默认仍构造无 persistence 的文件模式；仅当 `LOOPS_DB_CLI=1` 时运行期加载 `dotenv`、`pg`、`@prisma/adapter-pg`、`@prisma/client`、`@app/db` 与 `LoopsPersistenceService`。
- 设计：DB 依赖使用运行期 `require` 懒加载，避免普通 CLI 命令被 Prisma / `@app/db` 静态加载拖住。
- 验证：`pnpm loops:doctor` 与 `pnpm loops:db-doctor` 均返回 `ok: true`。

## OPT-2 · 明确 DB 写失败的补偿/标记策略【✅ documented】

- 决策：v1 不新增 `dbSyncState` schema 字段。
- 决策：维持「先 `.loops` 再 DB；`.loops` 是真相源；DB 是可重建索引」。
- 文档：`docs/0619/loops设计/08-数据存储设计.md` 已补「DB 双写失败补偿 Runbook」，覆盖 `.loops` 有 DB 无、DB 有 `.loops` 无、phase/round/finalized 漂移等场景。

## OPT-3 · 裁剪未被使用的 per-model 生成 DB Service【✅ done · round 13】

- 背景：`generated/db/modules/loop-issue*`、`loop-state*`、`loop-issue-intake*` 原为生成器产物，实际 Loops DB 访问集中在手写 `generated/db/modules/loops/loops-db.service.ts`（`LoopsDbService` 直接用 `@prisma/client` 类型访问三张表，不依赖 per-model service）。
- 阻断前提消除：round 12 及之前维持 accepted，因 `apps/api/generated/db/**` 处于 SSO/file 并行迁移脏工作树；round 13 确认 `docs/0619/sso` 迁移已提交（`1637408` / `d981a90`）、工作树 clean，可安全裁剪。
- 实施（round 13）：
  - `apps/api/scripts/generate-db-crud.js`：将 `LoopIssue` / `LoopIssueIntake` / `LoopState` 加入 `EXCLUDE_MODELS`，并补注释说明 Loops DB 访问统一走 `LoopsDbService`。
  - 删除 `generated/db/modules/loop-issue`、`loop-issue-intake`、`loop-state` 三个孤儿目录。
  - 运行 `node scripts/generate-db-crud.js`：`ensureExportsInIndex` 自动重写 `generated/db/index.ts`，移除三条 loop 导出（顺带补回此前缺失的 `user-info` / `audit-log` barrel 导出，使其与磁盘模块一致）。
- 安全验证：`rg "LoopIssueService|LoopStateService|LoopIssueIntakeService|LoopIssueModule|LoopStateModule|LoopIssueIntakeModule|modules/loop-issue|modules/loop-state" apps/api/src apps/api/libs apps/web packages scripts`（排除三个待删目录自身）零命中，确认无业务消费。
- 回归（round 13）：`pnpm --filter @repo/api type-check` 通过；`pnpm check:architecture` 四边界全绿；`pnpm quality:gate` 6/6 通过；`pnpm loops:doctor` `ok: true`；Loops Jest 1 passed / 3 skipped；`generated/db/modules/` 下 loop 相关仅剩手写 `loops`。

## OPT-4 · Web 表单 `targetRepo` 默认值可移植化【✅ done】

- 实施：Web 表单默认仓库根由服务端解析；可用 `NEXT_PUBLIC_LOOPS_DEFAULT_REPO` 覆盖。

## OPT-5 · 收敛 `jest.config.ts` 对 `process.cwd()` 的依赖【🟡 accepted】

- 决策：维持当前 `process.cwd()` 写法；Jest 30 `.ts` 配置 ESM 求值下比 `__dirname` 更稳定。
- 约束：API Jest 从 `apps/api` 工作目录启动（`pnpm test:api` / `pnpm --filter @repo/api exec jest` 满足）。
- 审查结论：直接改为 `import.meta.url` 会与 API CommonJS tsconfig / Jest 30 `.ts` 配置求值方式产生额外兼容风险，当前注释约束更稳。
- round 10 复核：`pnpm --filter @repo/api exec jest --showConfig --runInBand` 正常输出，`cwd` 与 `rootDir` 均为 `apps/api`，`moduleNameMapper` 也按 `apps/api/tsconfig.json` 正确展开。

## OPT-6 · 统一 persistence 可选分支写法【✅ done】

- 实施：`LoopsService` 新增 `readDetail` 与 `writeIssueRecord` helper。
- 保留：`syncAndRead` 仍先读 `.loops` 最新文档，再在存在 persistence 时同步 DB，符合 v1 真相源原则。
- 验证：`pnpm --filter @repo/api type-check`、Loops Jest、`loops:doctor`、`loops:db-doctor` 通过。

## OPT-7 · `listLegacy` 路由语义【✅ done】

- 实施：`packages/contracts/src/api/loops.contract.ts` 的 `listLegacy` 已设置 `deprecated: true`，description 明确新客户端使用 `GET /loops/issues`。
- 决策：保留 legacy route 以兼容潜在外部调用，后续版本再移除。

## OPT-8 · task list query/response 标准化【✅ done】

- 发现：`pnpm check:list-contracts` 报 `packages/contracts/src/schemas/task.schema.ts:40: TaskListResponseSchema must use PaginatedResponseSchema(...)`。
- 实施：`TaskListResponseSchema` 从 `z.array(SystemTaskSchema)` 改为 `PaginatedResponseSchema(SystemTaskSchema)`。
- 复查：`taskContract.getTaskList` 当时只有分页响应、缺分页查询 schema；已新增 `TaskListQuerySchema = PaginationQuerySchema`，并在 contract 中挂载 `query`。
- 实施：Web `useTaskList()` 已传默认 `{ page: 1, limit: 20 }`，保持调用与新契约一致。
- 边界：API 侧当前未检索到 `taskContract` 对应 controller，故本轮无后端旧数组返回需要迁移；若后续恢复 `/tasks/list` 实现，必须返回 `{ list, total, page, limit }`。
- 验证：`pnpm check:list-contracts`、`pnpm --filter @repo/web type-check`、`pnpm --filter @repo/api type-check` 通过。

## OPT-9 · contracts 测试历史快照收敛【✅ done】

- 发现：`pnpm --filter @repo/contracts test` 失败并非代码运行问题，而是测试仍硬编码期待已不在当前公共面中的 team、space、file、recycle-bin 等 contracts/schemas/errors 导出。
- 实施：`contracts.test.ts` 改为校验当前 `api/index.ts` 暴露的 contract 集合与 router 对象形态。
- 实施：`schemas.test.ts` 改为校验当前 Prisma enum、User、Task、Loop、Message schema，并补 task 标准分页响应结构验证。
- 实施：`errors.test.ts` 改为校验当前 `UserErrorCode` / `CommonErrorCode` 字符串错误码、i18n key 与 HTTP status 映射。
- 实施：`packages/contracts/tsconfig.json` 增加 `types: ["jest"]`，使包内测试文件在 `tsc --noEmit` 下具备 Jest globals 类型。
- 验证：`pnpm --filter @repo/contracts test` 与 `pnpm --filter @repo/contracts typecheck` 均通过。

## OPT-10 · architecture `any` 收敛【✅ done】

- 发现：`pnpm check:architecture` 额外命中 Loops adapter 与 API bootstrap 的 `as any`。
- 实施：`CliLoopsAgentAdapter.asSpec` 入参由 `any` 改为 `unknown`，通过对象窄化读取 `body` / `contextBudget` 后再交给 Zod schema 校验。
- 实施：`apps/api/src/main.ts` 将 Fastify plugin 注册、rate-limit request/context 与 CORS 配置改为明确类型/`unknown` 桥接，清除 bootstrap 中的 `as any` 与 `req: any`。
- 验证：`pnpm --filter @repo/api type-check` 通过；`apps/api/src/modules/loops` 与 `apps/api/src/main.ts` 已无 architecture `any` 命中。
- 边界：round 12 复核确认此前 `apps/api/libs/domain/auth` 下 SSO/auth guard 的 Nest Logger 与 `as any` 命中已被 `docs/0619/sso` 迁移（第十二轮）修复；`pnpm check:architecture` 现全绿，OPT-10 无残留边界。

## OPT-11 · utils hygiene 历史基线清理【✅ done】

- 发现：`pnpm check:utils-hygiene` 原命中 `packages/utils` 历史 `console.*` / `any` 基线 64 条，导致 `quality:gate` 除 auth/SSO architecture 外仍有独立阻断。
- 实施：`array.util.ts`、`object.util.ts`、`mask.util.ts` 等改为 `unknown`、明确 record 类型与运行时窄化，避免用 `any` 掩盖非数组、非对象、非数值输入。
- 实施：`encrypt.ts` 与 `fetch.ts` 移除生产 `console.*`；`fetch` 泛型默认值改为 `unknown`，请求 body 明确为 `BodyInit | Record<string, unknown> | unknown[] | null`。
- 实施：`headers.ts` 用 legacy browser 字段类型替代 `window as any`；`bigint.util.ts`、`json.util.ts`、`validate.util.ts`、`string.util.ts` 收敛参数/返回类型。
- 实施：`string.util.ts` 补回测试覆盖的 `escapeMongoRegexSpecialChars`，并用本地 UUID 校验/生成 fallback 替代 `uuid@14` ESM 运行时导入，避免 utils Jest CJS 环境解析 ESM 依赖失败。
- 实施：`packages/utils/tsconfig.json` 增加 `rootDir: "."` 与 `types: ["jest"]`，使包内测试在 typecheck 下具备稳定根目录与 Jest globals 类型。
- 验证：`pnpm --filter @repo/utils typecheck`、`pnpm --filter @repo/utils test`、`pnpm check:utils-hygiene` 均通过。
- 边界：round 12 复核确认 `pnpm quality:gate` 已全绿（auth/SSO architecture 命中已被 `docs/0619/sso` 迁移修复，不再短路）；utils hygiene 已不再是质量门禁阻断项。
