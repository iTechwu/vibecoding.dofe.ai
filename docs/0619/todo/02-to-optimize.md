# 待优化项（to-optimize）

> Loops v1 已可用且经验证，以下为健壮性、可维护性、可移植性、可观测性的改进空间。均为非阻断项，可在 v1 收尾后按价值/成本推进。

## OPT-1 · CLI 增加「可选 DB 模式」【价值：中，成本：中】

- 现状：`scripts/loops-cli.ts` 以 5 参构造 `LoopsService`（不注入 persistence），`loops:doctor`/`loops:status` 走纯文件模式，无法发现 DB 与 `.loops` 的漂移；DB 一致性只能靠起 API server 或 `loops:db-smoke` 验证。
- 背景：`LoopsService.persistence` 已设计为可选（`@Optional() @Inject(LOOPS_PERSISTENCE)` + type-only import），CLI 缺省走文件回退是有意为之（避免 CLI 拖入 `@app/db`/Prisma）。
- 建议：当 `LOOPS_DB_CLI=1` 且存在 `DATABASE_URL` 时，CLI 用 pg adapter 构造 `PrismaClient` → 假 `PrismaService` → `LoopsDbService` → `LoopsPersistenceService`（参照 `loops-persistence.db.spec.ts` 的构造方式），注入 `LoopsService`，使 `loops:doctor`/`loops:status` 直接反映 DB。
- 影响：`scripts/loops-cli.ts`、根 `package.json`（可加 `loops:db-doctor` 等）。

## OPT-2 · 明确 DB 写失败的补偿/标记策略【价值：中，成本：低】

- 现状：`LoopsPersistenceService.writeIssue` 顺序写 `.loops` 再写 DB；若 DB 写失败（`.loops` 已成功），会留下「文件有、DB 无」状态，目前仅由 `doctor` 事后报告 `db issue X missing` / `.loops issue X missing db issue`，无自动回滚或显式「半失败」标记。
- 建议（任选其一并写入 `08-数据存储设计.md`）：
  1. 维持 v1「`.loops` 为真相源 + doctor 报告 + 人工/定时任务补偿」的口径（当前实现），仅补充文档说明处置 runbook；
  2. 在 `LoopIssue`/`LoopState` 增加一个 `dbSyncState`（`SYNCED`/`PENDING`/`FAILED`）轻量标记，doctor 据此区分「从未同步」与「漂移」。
- 影响文件：`loops-persistence.service.ts`、`loops-db.service.ts`、schema（仅方案 2）、`08-数据存储设计.md`。

## OPT-3 · 裁剪未被使用的 per-model 生成 DB Service【价值：低，成本：低】

- 现状：`generated/db/modules/loop-issue/loop-issue.service.ts`、`loop-state/loop-state.service.ts`、`loop-issue-intake/loop-issue-intake.service.ts` 为生成器产出的通用 CRUD（`list`/`getById`/`upsert`/`update`），但实际 Loops 的所有 DB 访问都集中在手写的 `loops/loops-db.service.ts`（`LoopsDbService`），上述三个 service 未被任何模块 import 使用。
- 风险：每次 `pnpm db:generate` 仍会重新生成它们；若后续误用，会绕过 `LoopsDbService` 的统一封装（违反「DB 访问只在 DB Service 层」的口径精神）。
- 建议：确认无引用后，从 `generated/db/modules/loops` 之外移除这三个模块，或在生成器对 Loops 相关 model 跳过通用 CRUD 生成；并在 `LoopsDbModule` 集中导出。
- 验证：`rg -n "LoopIssueService|LoopStateService|LoopIssueIntakeService" apps/api/src apps/api/libs`（排除生成目录）应为空。

## OPT-4 · Web 表单 `targetRepo` 默认值可移植化【价值：低，成本：低】

- 现状：`apps/web/app/loops/new/page.tsx` 的 Target Repository 输入框 `defaultValue` 硬编码为当前仓库绝对路径 `/Users/techwu/.../vibecoding.dofe.ai`，换机器/部署环境即失效。
- 建议：改为相对路径（如 `.` 或空 + placeholder），或从 `NEXT_PUBLIC_*` 环境变量读取默认 repo 根。

## OPT-5 · 收敛 `jest.config.ts` 对 `process.cwd()` 的依赖【价值：低，成本：低】

- 现状：本轮把 `jest.config.ts` 的 `__dirname`（jest 30 下 `.ts` 配置按 ESM 求值，`__dirname` 未定义）改为 `process.cwd()`，前提是 jest 必须从 `apps/api` 启动（`pnpm test:api` / `pnpm --filter @repo/api exec jest` 均满足）。
- 建议：在 `apps/api/README` 或 `CLAUDE.md` 注明「api jest 必须从 `apps/api` 运行」；或改用 `import.meta.url` + `fileURLToPath` 的 ESM 安全写法（需确认 jest 30 对 `.ts` 配置的 `import.meta.url` 支持）。

## OPT-6 · 统一 persistence 可选分支写法【价值：低，成本：低】

- 现状：`LoopsService` 对可选 persistence 的回退写法不统一——`list()`/`getIssue()`/`createIssue()`/`doctor()`/`syncAndRead()` 各自有 `if (this.persistence)` 分支。
- 建议：抽一个 `private p()` 或在构造期决定 `mode: 'db' | 'file'`，集中分支判断，减少散落；非紧急，可在下次重构时顺带。

## OPT-7 · `listLegacy` 路由语义【价值：低，成本：低】

- 现状：`loops.contract.ts` 的 `list`（`GET /issues`）与 `listLegacy`（`GET /`）均调用同一 `LoopsService.list`。
- 建议：确认 `GET /loops/`（legacy）是否仍有外部消费方；若无，标记 deprecated 并在下一版本移除，避免双路由长期并存。
