# 待实施项（to-implement）

> 有明确代码改动、阻断质量门禁或功能闭环的具体任务。**以下全部为既有非 Loops 问题**，非本轮 Loops 工作引入，但它们使 `pnpm quality:gate` / `pnpm --filter @repo/api type-check` 无法全绿（当前 17 条错误），是唯一的 P0 阻断。

验证基线：`pnpm --filter @repo/api type-check`（`apps/api` 内 `tsc -p tsconfig.type-check.json`）。Loops 相关文件已 0 错误。

## IMP-1 · 修复 5 条生成 DB Service 的 createMany 类型错误【P0】

- 现象：
  - `generated/db/modules/discord-auth/discord-auth.service.ts(117,59)`
  - `generated/db/modules/email-auth/email-auth.service.ts(117,57)`
  - `generated/db/modules/google-auth/google-auth.service.ts(117,58)`
  - `generated/db/modules/mobile-auth/mobile-auth.service.ts(117,58)`
  - `generated/db/modules/wechat-auth/wechat-auth.service.ts(117,58)`
- 报错：`Type 'XxxAuthCreateInput[]' is not assignable to type 'XxxAuthCreateManyInput | XxxAuthCreateManyInput[]'`（缺少 `discordId`/`email`/`sub`/`mobile`/`openid`）。
- 根因：生成器模板把 `createMany(data[])` 的形参类型写成 `CreateInput[]`，而 Prisma 的 `createMany` 需要 `CreateManyInput[]`（二者对必填主键/唯一字段约束不同）。
- 建议修法：改 `apps/api/scripts/generate-db-crud.js` 中 `createMany` 的生成模板，使用 `Prisma.<Model>CreateManyInput[]`（或 `createMany.{data}` 内层用 `CreateManyInput`），然后 `pnpm db:generate` 重新生成并复核。
- 验证：`pnpm --filter @repo/api type-check` 中上述 5 行消失。

## IMP-2 · 修复 `@app/db` / `@dofe/infra-clients` 导出漂移（auth / ip-info）【P0】

- 现象：
  - `libs/domain/auth/src/auth.module.ts(8,10)`：`@app/db` 无导出 `UserInfoModule`
  - `libs/domain/auth/src/auth.module.ts(9,10)`：`@dofe/infra-clients` 无导出 `FileCdnModule`
  - `libs/domain/auth/src/auth.service.ts(7,10)`：`@app/db` 无导出 `UserInfoService`
  - `libs/domain/auth/src/auth.service.ts(12,10)`：`@dofe/infra-clients` 无 `FileCdnClient`（提示 `FileGcsClient`）
  - `libs/domain/services/ip-info/ip-info.module.ts(12,10)`：`@app/db` 无导出 `CountryCodeModule`
  - `libs/domain/services/ip-info/ip-info.service.ts(19,10)`：`@app/db` 无导出 `CountryCodeService`
- 背景：`CountryCodeModule/Service` 实际由 `@dofe/infra-shared-db` 导出（见其 `dist/index.d.ts`）；`UserInfo*`/`FileCdn*` 可能已迁移或改名（`FileCdnClient` → `FileGcsClient`）。
- 建议修法：二选一并保持一致——
  1. 重新生成 `@app/db`（`generated/db`）使其包含 `UserInfo*`/`CountryCode*` 的导出（若这些表仍在 schema 中）；或
  2. 将上述 import 来源改为实际提供方（`@dofe/infra-shared-db` 取 `CountryCode*`；`@dofe/infra-clients` 用 `FileGcsClient`，并确认 `FileCdnModule` 是否仍存在或已合并）。
- 验证：`rg -n "UserInfoModule|UserInfoService|FileCdnModule|FileCdnClient|CountryCodeModule|CountryCodeService" libs/domain apps/api/generated/db` 与 type-check 双向核对。

## IMP-3 · 对齐 `ApiErrorCode` 注册表（streaming-asr guard）【P0】

- 现象：`libs/domain/auth/src/guards/streaming-asr-session.guard.ts(118/128/138,24)`，`ApiErrorCode '"926404"'` 不能赋给 `@dofe/infra-contracts` 的 `ApiErrorCode`（提示 `'906404'`）。
- 根因：`packages/contracts/src/errors/codes` 与 `@dofe/infra-contracts/dist/error-codes` 的错误码枚举不一致（926404 仅在一方注册）。
- 建议修法：在 `@dofe/infra-contracts` 注册 `926404`（或统一改用 `906404`），并同步 `@repo/contracts` 的 `errors/codes`，确保两份枚举一致；升级后需要 bump `@dofe/infra-contracts` 依赖。
- 验证：guard 三处 type-check 通过。

## IMP-4 · 移除 uploader 多余 `@ts-expect-error`【P0】

- 现象：`src/modules/uploader/uploader.controller.ts(97,5)`、`(184,5)`，`TS2578: Unused '@ts-expect-error' directive.`
- 建议修法：删除这两处 `@ts-expect-error`（其下已无被抑制的错误），或确认是否应改为 `@ts-ignore`/修正被抑制行。
- 验证：两行错误消失。

## IMP-5 · 修复 `generated/db/index.ts` 重复导出【P1】

- 现象：`apps/api/generated/db/index.ts` 末尾重复 `export * from './modules/loop-issue'`、`'./loop-issue-intake'`、`'./loop-state'`（与上方重复一次）。
- 影响：当前未触发 TS 报错（重复 re-export 同一模块被去重），但属生成物卫生问题，未来若模块导出同名符号会变成 `Duplicate identifier`。
- 建议修法：定位 `generate-db-crud.js` 写 `index.ts` 的逻辑，去重后再写；或在追加新生成模块时做存在性判断。修后 `pnpm db:generate` 重新生成。
- 验证：`grep -c "loop-issue'" apps/api/generated/db/index.ts` 每个模块仅出现一次。

## IMP-6 · `app.module.ts` 缺少 `path` 绑定（进行中重构）【P0】

- 现象：`src/app.module.ts(95,19): error TS2304: Cannot find name 'path'.`
- 根因（工作区未提交改动）：`import * as path from 'path'` 被替换为 `import { i18nLoaderPath } from '@dofe/infra-i18n'`，但第 95 行 `loaderOptions.path = path.join(projectRoot, 'node_modules', '@dofe', 'infra-i18n', 'dist')` 仍在使用 `path`。这是一个**进行中的 i18n loader 路径重构**（非 Loops、非本轮引入）。
- 注意：此条为本轮 DB 验证期间新出现（之前的 16 条基线不含它），疑似环境/并行编辑导致的工作区漂移；归属与意图需由该重构作者确认。
- 建议修法（二选一，取决于 `i18nLoaderPath` 的设计意图）：
  1. 若 `i18nLoaderPath` 即为该 dist 路径，则把第 95 行改为直接使用 `i18nLoaderPath`（或其与 `projectRoot` 的组合）；
  2. 否则补回 `import * as path from 'path'`（与 `i18nLoaderPath` 并存）。
     不建议盲改——需先确认 `@dofe/infra-i18n` 导出的 `i18nLoaderPath` 语义。
- 验证：`pnpm --filter @repo/api type-check` 中该行消失。

## 验收

完成 IMP-1..IMP-4 + IMP-6 后：`pnpm --filter @repo/api type-check` 应为 0 错误；`pnpm quality:gate`（含 `check:architecture` / `check:list-contracts` / `check:sensitive-logs` / `check:utils-hygiene` / `type-check`）全绿。完成 IMP-5 后生成物无重复导出。
