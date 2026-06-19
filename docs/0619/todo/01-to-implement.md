# 待实施项（to-implement）

> 有明确代码改动、阻断质量门禁或功能闭环的具体任务。以下为既有非 Loops 问题，使 `pnpm quality:gate` / `pnpm --filter @repo/api type-check` 无法全绿。
>
> 验证基线：`pnpm --filter @repo/api type-check`（`apps/api` 内 `tsc -p tsconfig.type-check.json`）。Loops 相关文件已 0 错误。

## 本轮（round 3 / 2026-06-19）进度

type-check 错误数 **16 → 7**。已完成：IMP-1、IMP-4、IMP-5、IMP-2 的 CountryCode 部分；IMP-6 由作者回退 i18n 重构后自动消除。剩余 7 条全部集中在 `libs/domain/auth`（infra 迁移进行中、作者在改），见 IMP-2 余项 / IMP-3。

| 项                                             | 状态         | 说明                                                                                      |
| ---------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------- |
| IMP-1 生成 DB Service createMany 类型          | ✅ done      | 修生成器模板 + 补 5 个 auth service，5 条错误消除                                         |
| IMP-2 `@app/db`/`@dofe/infra-clients` 导出漂移 | 🟡 partial   | CountryCode 已重定向到 `@dofe/infra-shared-db`（2 条消除）；UserInfo/FileCdn 仍存（4 条） |
| IMP-3 `ApiErrorCode` 注册表对齐                | ⏳ remaining | 3 条，依赖 infra-contracts 版本/类型同一性，迁移中                                        |
| IMP-4 uploader 多余 `@ts-expect-error`         | ✅ done      | 删 2 处，2 条消除                                                                         |
| IMP-5 `generated/db/index.ts` 重复导出         | ✅ done      | 生成器 `ensureExportsInIndex` 去重 + 重写，index 已无重复                                 |
| IMP-6 `app.module.ts` 缺 `path` 绑定           | ✅ resolved  | 作者已回退该 i18n 重构，错误消失（不再适用）                                              |

---

## IMP-1 · 修复生成 DB Service 的 createMany 类型错误【P0 · ✅ done】

- 修复：`apps/api/scripts/generate-db-crud.js` 新增 `createManyInput = Prisma.${name}CreateManyInput` 并在 `createMany` 模板使用；现有 5 个 auth service（discord/email/google/mobile/wechat）的 `createMany(data: ...CreateInput[])` 已改为 `...CreateManyInput[]`。
- 验证：`pnpm --filter @repo/api type-check` 中 5 条 `TS2322` 消失（16→11）。

## IMP-2 · 修复 `@app/db` / `@dofe/infra-clients` 导出漂移【P0 · 🟡 partial】

- ✅ CountryCode（2 条已修）：`libs/domain/services/ip-info/ip-info.{module,service}.ts` 的 `CountryCodeModule/Service` 来源由 `@app/db` 改为 `@dofe/infra-shared-db`（该包确有导出且 API 一致：`findByCode`/`findByContinent` 等；原 `@app/db` 因 `CountryCode` 在 `EXCLUDE_MODELS` 不生成）。
- ⏳ UserInfo（2 条未修）：`libs/domain/auth/src/auth.{module,service}.ts` 从 `@app/db` 取 `UserInfoModule/Service`，但 `UserInfo` 在生成器 `EXCLUDE_MODELS`（注释称保留手写），而手写模块在迁移后缺失。`auth.service` 仅使用 `this.user.get({ id })`，理论上「从 EXCLUDE 移除 + `pnpm db:generate`」即可生成通用 CRUD 解决；但 EXCLUDE 是迁移意图，未擅自改动，留待迁移作者确认（恢复手写 / 改为生成 / 迁到 infra）。
- ⏳ FileCdn（2 条未修）：`auth.{module,service}.ts` 用 `FileCdnModule/Client`，`@dofe/infra-clients` 已无该导出（提示 `FileGcsClient`）。疑似 `FileCdn → FileGcs` 改名，需确认 `FileGcsModule` 是否存在且为正式替换后再统一改名（未在运行期确认，避免误改）。
- 验证：CountryCode 两条消除（11→9）；UserInfo/FileCdn 四条仍存。

## IMP-3 · 对齐 `ApiErrorCode` 注册表（streaming-asr guard）【P0 · ⏳ remaining】

- 现象：`libs/domain/auth/src/guards/streaming-asr-session.guard.ts(118/128/138)` 三处 `apiError(CommonErrorCode.SessionExpired as ApiErrorCode, ...)`，`@repo/contracts` 的 `ApiErrorCode` 与 `@dofe/infra-contracts@0.1.56` 的 `ApiErrorCode` 为不同类型实例（名义不兼容），即便两边都含 `926404/InvalidToken`。
- 背景：工作区存在 `@dofe/infra-contracts@0.1.55` 与 `0.1.56` 两版本（依赖未去重）；这是 infra 契约迁移期产物。
- 建议修法（择一，属 infra 契约层）：① pnpm `overrides` 把 `@dofe/infra-contracts` 收敛到单版本；② 让 `@repo/contracts` 的 `ApiErrorCode` 直接 re-export `@dofe/infra-contracts` 的同名类型（统一类型同一性）；③ guard 处改为 `as unknown as <目标 ApiErrorCode>` 临时绕过（不推荐长期）。
- 未自行实施原因：触及 infra 契约/依赖策略，且作者正迁移该域，需统一决策。

## IMP-4 · 移除 uploader 多余 `@ts-expect-error`【P0 · ✅ done】

- 修复：删除 `src/modules/uploader/uploader.controller.ts` 第 97、184 行两处 `// @ts-expect-error ...`（TS 报 `TS2578 Unused`，其下已无被抑制错误）。
- 验证：两行错误消失。

## IMP-5 · 修复 `generated/db/index.ts` 重复导出【P1 · ✅ done】

- 修复：`generate-db-crud.js` 的 `ensureExportsInIndex` 改为「解析既有 module 导出（含手写 `loops`）→ 合并新生成 → Set 去重 → 整体重写」，幂等且防重复；已运行一次，当前 `index.ts` 10 个模块各导出一次（`loop-issue`/`loop-state` 等各 1 次）。
- 验证：`grep -c "loop-issue'" apps/api/generated/db/index.ts` = 1。

## IMP-6 · `app.module.ts` 缺 `path` 绑定【✅ resolved】

- round 2 末出现的 `src/app.module.ts(95): Cannot find name 'path'`（i18n loader 路径重构把 `import * as path` 换成 `i18nLoaderPath` 但未改第 95 行）已被作者回退，文件现 43 行、无该错误。本条不再适用。

## 验收

剩余 7 条（UserInfo×2、FileCdn×2、ApiErrorCode×3）均在 `libs/domain/auth`、属 infra 迁移进行中项；解决后 `pnpm --filter @repo/api type-check` 将为 0 错误，`pnpm quality:gate` 全绿。
