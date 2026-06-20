# 09 · 实施状态与回归记录

> 更新日期：2026-06-20  
> 权威状态：本文件记录本轮实际落地结果。`sso.dofe.ai` 是用户、认证、会话与文件的唯一真源；`models.dofe.ai` 是实现参照。

## 1. 已完成范围

### vibecoding.dofe.ai

- 后端接入 SSO OIDC：
  - 新增 `apps/api/src/modules/oidc-client-api/`。
  - `AuthGuard` 改为通过 `@dofe/infra-clients/sso` 远程 `verifyToken()` 校验 access token。
  - 新增 `UserSyncService`，以 `ssoSub` 同步/创建本地 `UserInfo` 映射缓存。
  - `AuthModule` 全局挂载，并提供 `@Public()`、`@CurrentUser()`、兼容 `@Auth()`。
- Prisma schema 收敛：
  - `UserInfo` 仅保留本地业务映射/展示字段：`ssoSub`、`avatarFileId`、`nickname`、`code`、`email`、`mobile` 等。
  - 删除本地 `WechatAuth`、`GoogleAuth`、`DiscordAuth`、`MobileAuth`、`EmailAuth`。
  - 删除本地 `FileSource` / 文件 bucket/env 枚举；`avatarFileId` 仅引用 SSO 文件 ID。
  - 新增 `AuditLog` + `AuditActionType`，审计采用 models 的业务主动调用模式。
- 文件能力收敛：
  - 删除本地 `UploaderModule`。
  - 后端头像/CDN URL 解析使用 `@dofe/file-sdk`。
  - 前端上传使用 `@dofe/file-sdk-web`，`apps/web/lib/upload/api.ts` 仅保留废弃提示。
  - `apps/web/next.config.ts` 新增 `/api/proxy/sso/:path*` rewrite，转发到 `${NEXT_PUBLIC_SSO_BASE_URL || 'https://sso.dofe.ai'}/:path*`；`@dofe/file-sdk-web` 会自行拼接 `/api/uploader/*`。
  - Next 图片白名单新增 `*.dofe.ai`，支持 SSO/CDN 图片资源。
- 前端 SSO 闭环：
  - 新增 `/login`、`/auth/oidc/callback`、`/auth/oidc/success` 相关路由。
  - 新增 `token-manager`、`sso-session`、`sso-session-errors`。
  - refresh token 只在后端 `dofe_rf` HttpOnly cookie 中保存，前端只保存 access token 与 session 过期信息。
  - `AuthProvider`、`apps/web/lib/api.ts` 兼容层已切到 OIDC/token-manager；不再调用旧 `signClient.refreshToken` 或本地密码登录。
  - 删除未被引用的旧 `apps/web/lib/api/auth-server.ts`，避免继续暴露本地 refresh token 兼容路径。
- 共享包：
  - 新增 `oidcAuthContract`。
  - 新增 OIDC/SSO 常量。
  - `LoginSuccessSchema.refresh` 改为可选，`UserInfoSchema` 增加可选 `ssoSub`。
  - 删除旧本地 `/uploader` contract/schema 暴露；文件上传只走 `@dofe/file-sdk-web` + SSO proxy。

### scaffold.dofe.ai

- 同步 vibecoding 的 SSO/OIDC、UserSync、file-sdk 前后端实现；但当前验收不要求 scaffold 一定可以使用 `sso.dofe.ai` 完成真实 SSO 登录。
- 删除本地 auth/file schema 与 generated DB 模块。
- 删除本地 `UploaderModule`。
- `apps/web/next.config.ts` 同步新增 `/api/proxy/sso/:path*` rewrite 与 `*.dofe.ai` 图片白名单。
- 同步前端 AuthProvider、`lib/api.ts`、旧 uploader contract/schema 清理。
- 保留 scaffold 自身需要的 `CountryCode`，并在 CRUD 生成器中保留 `loadRelations()`。
- `SSO_CLIENT_ID` 默认值为 `scaffold-dofe-ai`。
- 前端内部 API 覆盖变量为 `SCAFFOLD_INTERNAL_API_URL`。

### sso.dofe.ai

- `apps/api/scripts/oauth-clients.config.ts` 已新增：
  - `vibecoding-dofe-ai` → `SSO_CLIENT_SECRET_VIBECODING`
  - `scaffold-dofe-ai` → `SSO_CLIENT_SECRET_SCAFFOLD`
- 两个 client 均配置生产、测试、本地 web 与本地 API callback redirect URI。
- 因两个项目尚未实现 `/internal/sso/outbox-alerts`，`opsConfig.outboxAlertWebhook.enabled` 暂为 `false`。

## 2. 2026-06-20 深度审查修复

本轮复查重点对齐 `models.dofe.ai` 与用户要求的“SSO 为唯一真源”：

- 发现 `@dofe/file-sdk-web` 上传端使用 `FileUploader({ apiBase: '/api/proxy/sso' })`，但 vibecoding/scaffold 缺少 Next rewrite；已补齐到两个项目。
- 发现 OIDC 登录成功后前端回调默认端口曾回落到 `3000`，与 vibecoding/scaffold web 端口 `3003` 及 SSO seed 不一致；已将 `OidcClientApiService.resolveFrontendBaseUrl()` 的默认 `app.frontendPort` 调整为 `3003`。
- 发现文档仍保留“本地 `FileSource` 缓存可保留”“短期保留 `UploaderModule`”等旧方案描述；已修订 `02` / `04` / `08` / `README`，以本文件为权威状态。
- 复查确认未重新引入 `WechatAuth`、`GoogleAuth`、`DiscordAuth`、`MobileAuth`、`EmailAuth`、`FileSource`、`UploaderModule`。
- 第二轮复查发现前端 `AuthProvider` 与 `apps/web/lib/api.ts` 仍保留旧本地 refresh token 调用路径；已改为 OIDC `oidcAuthClient` + `tokenManager`，refresh_token 继续只由 `dofe_rf` HttpOnly cookie 承载。
- 第二轮复查发现共享包仍保留旧本地 `/uploader` contract/schema；已删除导出与文件，并移除 API 限流白名单中的 `/uploader/token/*` 历史路径。
- 第二轮复查删除未被引用的 `apps/web/lib/api/auth-server.ts`，避免服务端工具继续误用旧 `signClient.refreshToken({ query: { refresh } })` 模式。
- 第三轮复查发现共享包仍暴露旧本地 `/sign` contract 入口；已在 vibecoding/scaffold 同步删除 `sign.contract.ts`、`signContract` 导出与前端 `signClient` 创建逻辑，认证 contract 只保留 OIDC 路径。
- 第三轮复查发现 `apps/web/config.ts` 仍保留未使用的 `/sign/in/mobile/password` 与 `/sign/refresh/token` 配置；已改为 OIDC authorize/refresh 端点，避免后续误接本地登录。
- 第三轮复查发现 Prisma 注释和生成产物中仍有旧文件源模型表述；已改为“本地不定义 auth/file source tables，认证与文件元数据仅归属 sso.dofe.ai”，并对 vibecoding/scaffold 重新执行 `pnpm --filter @repo/api db:generate`。
- 第三轮复查期间修复 vibecoding `packages/utils` 在当前 TypeScript 类型检查下暴露的泛型/unknown 收敛问题，保证本轮 SSO 调整后的 API/Web 类型回归可完整通过。
- 第三轮残留扫描确认 vibecoding/scaffold 代码层无 `signContract`、`signClient`、`/sign/in/mobile/password`、`/sign/refresh/token`、`WechatAuth`、`MobileAuth`、`EmailAuth`、`GoogleAuth`、`DiscordAuth` 残留。
- 第四轮复查发现 logout 会写入本地 `TOKEN_BLACKLIST_PREFIX`，但 `AuthGuard` 未读取该 blacklist；已在 vibecoding/scaffold 的 `AuthGuard` 中增加 access token `jti` blacklist 检查。该检查只作为本项目登出后的防御层，最终 token 有效性仍由 `sso.dofe.ai` 远程 `verify-token` 判定。
- 第五轮复查发现 `/auth/oidc/token` contract/controller 仍允许通过请求体传递 `refresh_token` 作为回退；已在 vibecoding/scaffold 同步收紧为仅从 `dofe_rf` HttpOnly cookie 读取，前端永不接触 refresh token。
- 第五轮复查发现 `apps/web/proxy.ts` 仍读取旧 `auth-token` cookie 且不产生实际拦截；已在 vibecoding/scaffold 删除该伪认证分支，当前 proxy 只负责 i18n/public-route 流程，不再暗示本地 token cookie 认证。
- 第六轮复查确认 SSO 核心实现（OIDC controller/service、AuthGuard、OIDC contract）在 vibecoding/scaffold 仅保留预期 client id 差异；文件上传链路只通过 `@dofe/file-sdk-web` + `/api/proxy/sso`，后端仅通过 `@dofe/file-sdk` 消费 SSO 文件。
- 第六轮复查修复 scaffold contracts 测试仍期待旧 team/space/rbac/file 等契约/schema 的问题，使其对齐当前 scaffold 实际导出的精简契约。
- 第六轮复查修复 vibecoding api bootstrap 单测误加载真实 Auth/OIDC/DB 依赖的问题；该测试现在只验证启动模块顺序，不再触发外部 DB/infra-shared-db 初始化。
- 第六轮复查修复 scaffold api Jest 配置在 Jest 30 ESM 作用域中使用 `__dirname` 的问题；当前 scaffold api 无 `.spec.ts` 文件，已用 `--passWithNoTests` 验证配置可解析。
- 第七轮复查补充执行 scaffold 质量门禁，发现 scaffold 尚未完全同步 vibecoding 的质量基线：`apps/api/src/main.ts` / `app.module.ts` 仍有生产 `any`，`TaskListResponseSchema` 仍为数组响应，`packages/utils` 仍有宽泛 `any` 与调试日志残留。
- 第七轮已按 vibecoding 当前通过版本同步 scaffold 的 Fastify 插件类型化注册、utils 类型/日志收敛，并将 scaffold `TaskListResponseSchema` 改为 `PaginatedResponseSchema(SystemTaskSchema)`；同步更新 schema 单测为标准 `{ list,total,page,limit }` 形态。
- 第七轮复查确认 vibecoding/scaffold 均无旧本地认证与文件入口残留：无 `signContract`、`signClient`、旧 `/sign/*` 配置、`auth-token` cookie 认证、请求体 `refresh_token` 回退、`WechatAuth`/`MobileAuth`/`EmailAuth`/`GoogleAuth`/`DiscordAuth`、本地 uploader contract/schema。
- 第七轮质量门禁确认：vibecoding 已通过 `check:architecture`、`check:list-contracts`、`check:sensitive-logs`、`check:utils-hygiene`；scaffold 本轮补齐后同样四项全绿。
- 第八轮复查发现 `apps/web/config.ts` 仍保留旧 `refreshToken: '/api/oidc-auth/refresh-token'` 字符串；已在 vibecoding/scaffold 同步改为真实 OIDC contract 端点 `/auth/oidc/token`，避免后续误接不存在的旧刷新路径。
- 第八轮复查发现 `apps/web/lib/actions/auth.ts` 的 TikTok server action 注释中保留真实形态 access/refresh token 示例；已在 vibecoding/scaffold 删除该敏感样例。该文件属于 TikTok 第三方 OAuth server action，不是 SSO 用户真源；本轮仅做敏感信息与命名边界收敛。
- 第八轮复查对齐 `models.dofe.ai` 后确认：vibecoding/scaffold 当前 `/auth/oidc/token` 已比 models 更严格，不再接受请求体 `refresh_token` 回退，仅读取 `dofe_rf` HttpOnly cookie；该差异符合本项目“前端永不接触 SSO refresh token”的实施要求。
- 第八轮复查进一步收敛 OIDC controller 返回类型：移除 ts-rest handler 方法上的显式 `Promise<any>`，交由 contract/ts-rest 推断，保持 Zod/contract-first 边界。
- 第九轮复查发现 `packages/contracts/src/schemas/sign.schema.ts` 仍导出本地 Email/手机号登录、注册、refresh 请求 schema，`smsContract` 仍暴露 `/sms/login/verify`、`/sms/register/verify` 等本地 SMS 登录/注册契约；已在 vibecoding/scaffold 删除这些 schema/contract 入口。
- 第九轮将 `settingContract` 的邮箱/手机号绑定响应从 `LoginSuccessSchema` 收敛为 `UserInfoSchema`，避免资料绑定接口继续暗示会签发本地登录态；SSO 登录态仍只由 OIDC exchange/refresh 产生。
- 第九轮保留 `LoginSuccessSchema` 仅作为 OIDC token-manager 与前端兼容响应结构，并在 schema 注释中标明 local sign-in/register/refresh request schemas 已删除，`refresh` 字段废弃且 SSO refresh token 只允许存在于 `dofe_rf` HttpOnly cookie。
- 第十轮复查发现 `@repo/validators` 仍导出通用 `loginSchema/registerSchema`，并在 README/测试中继续示例本地密码登录/注册；已在 vibecoding/scaffold 删除这些 schema、类型、测试与 README 示例，保留 password strength 等非认证入口通用校验。
- 第十轮复查发现 `settingContract` 仍暴露 `/settings/password` 和 `useSetPassword` hook；已在 vibecoding/scaffold 删除设密 contract、request schema 与前端 hook，避免本项目继续承载本地密码体系。
- 第十轮复查发现 `user.schema.ts` 仍暴露 `UserMobileAccount`、`UserEmailAccount`、`WechatAccount`、`GoogleAccount`、`DiscordAccount` 等本地/第三方账号结构；已收敛为轻量 `UserAccountBaseSchema` / `UserContactResponseSchema`，仅保留本地业务展示字段、`mobile/email` 展示值与 `ssoSub` 映射字段。
- 第十轮复查发现 web proxy / analytics / locale 仍把 `/register`、手机号/邮箱密码登录注册文案作为前端公共入口；已删除 `/register` public route 与 analytics page mapping，并将 `auth.json` 收敛为当前 SSO redirect/login success 页面实际使用的文案。
- 第十一轮复查发现 scaffold 的 `apps/web/lib/api/contracts/client.ts` 尚未同步 vibecoding 的 401/410 自动 refresh 恢复逻辑；已补齐 `tokenManager.refreshToken()` 一次重试、防止 `/auth/oidc/token` 递归刷新、网络错误包装与 201 业务码兼容。
- 第十一轮复查发现 vibecoding/scaffold 前端 ts-rest public client 注释仍描述为 “login/register public endpoints”；已改为 OIDC exchange/refresh 与 SMS code 等公共端点，避免后续误恢复本地登录/注册入口。
- 第十二轮按最新验收口径收窄：scaffold 继续保持代码同步基线，但不作为必须打通 `sso.dofe.ai` 登录链路的验收对象；真实登录、刷新、登出、上传/CDN 全链路只要求 vibecoding 在可用 SSO/Redis/DB/密钥环境下验证通过。
- 第十二轮发现 vibecoding `apps/api/config.local.yaml` 仍使用 `app.port=3101`，会导致 OIDC redirect_uri 与 sso seed 的 `http://127.0.0.1:13100/auth/oidc/callback` 不一致；已改为 `app.port=13100` 并补 `frontendPort=3003`。
- 第十二轮发现登录成功默认跳转 `/dashboard`，但当前 vibecoding web 没有 dashboard 页面；已将默认 callbackUrl / success fallback / authorize fallback 调整为实际存在的 `/`，避免真实回调后落到 404。
- 第十二轮发现 `@dofe/file-sdk-web` 会请求 `${apiBase}/api/uploader/*`，因此 `/api/proxy/sso/:path*` rewrite 不能再额外追加 `/api`；已将 vibecoding/scaffold 的 rewrite 修正为 `${NEXT_PUBLIC_SSO_BASE_URL}/:path*`，确保文件上传真实转发到 SSO `/api/uploader/*`。
- 第十二轮新增 vibecoding 专用真实 E2E：`apps/web/e2e/sso-real.spec.ts` + `apps/web/playwright.config.ts` + `pnpm --filter @repo/web test:e2e:sso`，覆盖 login → callback → refresh → logout 与 `FileUploader({ apiBase: '/api/proxy/sso' })` 上传/CDN URL 可访问性；默认未设置 `SSO_E2E_ENABLED=1` 时跳过，不影响普通回归。

## 3. 明确废弃/不再采用

- 不保留本地复杂 `UserInfo` 认证体系。
- 不保留本地 `WechatAuth`、`GoogleAuth`、`DiscordAuth`、`MobileAuth`、`EmailAuth`。
- 不保留本地 `FileSource` 作为文件元数据源。
- 不保留本地 uploader API 作为文件上传入口。
- 不保留本地 `/uploader` ts-rest contract/schema 作为对外契约。
- 不保留本地 `/sign` ts-rest contract 或前端 `signClient` 作为认证入口。
- 不保留前端可读 refresh token 或旧 `signClient.refreshToken` 刷新路径。
- 不接受请求体传递 refresh token；刷新只读取 `dofe_rf` HttpOnly cookie。
- 不读取旧 `auth-token` cookie 作为 web proxy 认证依据。
- 不采用 sso 的全局 `AuditLogInterceptor` / `OPERATE_LOG_SERVICE_TOKEN` 方案；审计与 `models.dofe.ai` 一致，使用业务主动调用。

## 4. 回归验证

已通过：

- `vibecoding.dofe.ai`: `pnpm --filter @repo/api type-check`
- `vibecoding.dofe.ai`: `pnpm --filter @repo/web type-check`
- `scaffold.dofe.ai`: `pnpm --filter @repo/api type-check`
- `scaffold.dofe.ai`: `pnpm --filter @repo/web type-check`
- `vibecoding.dofe.ai`: `pnpm --filter @repo/api exec jest --runInBand`（4 passed, 1 skipped）
- `vibecoding.dofe.ai`: `pnpm --filter @repo/contracts test`
- `vibecoding.dofe.ai`: `pnpm --filter @repo/web test`
- `scaffold.dofe.ai`: `pnpm --filter @repo/contracts test`
- `scaffold.dofe.ai`: `pnpm --filter @repo/web test`
- `scaffold.dofe.ai`: `pnpm --filter @repo/api exec jest --runInBand --passWithNoTests`（当前无 api spec，验证 Jest 配置可解析）
- `vibecoding.dofe.ai`: `pnpm check:architecture`
- `vibecoding.dofe.ai`: `pnpm check:list-contracts`
- `vibecoding.dofe.ai`: `pnpm check:sensitive-logs`
- `vibecoding.dofe.ai`: `pnpm check:utils-hygiene`
- `scaffold.dofe.ai`: `pnpm check:architecture`
- `scaffold.dofe.ai`: `pnpm check:list-contracts`
- `scaffold.dofe.ai`: `pnpm check:sensitive-logs`
- `scaffold.dofe.ai`: `pnpm check:utils-hygiene`
- `vibecoding.dofe.ai`: 第八轮后 `pnpm --filter @repo/api type-check`
- `vibecoding.dofe.ai`: 第八轮后 `pnpm --filter @repo/web type-check`
- `scaffold.dofe.ai`: 第八轮后 `pnpm --filter @repo/api type-check`
- `scaffold.dofe.ai`: 第八轮后 `pnpm --filter @repo/web type-check`
- `vibecoding.dofe.ai` / `scaffold.dofe.ai`: 第八轮敏感/旧路径扫描确认无旧 `/api/oidc-auth/refresh-token`、硬编码 token 示例、请求体 `refresh_token` 回退、旧 `/sign/*`、旧本地 auth model、旧 uploader/file-source contract 残留。
- `vibecoding.dofe.ai`: 第九轮后 `pnpm --filter @repo/contracts test`（43 passed）
- `scaffold.dofe.ai`: 第九轮后 `pnpm --filter @repo/contracts test`（41 passed）
- `vibecoding.dofe.ai`: 第九轮后 `pnpm --filter @repo/api type-check`
- `vibecoding.dofe.ai`: 第九轮后 `pnpm --filter @repo/web type-check`
- `scaffold.dofe.ai`: 第九轮后 `pnpm --filter @repo/api type-check`
- `scaffold.dofe.ai`: 第九轮后 `pnpm --filter @repo/web type-check`
- `vibecoding.dofe.ai` / `scaffold.dofe.ai`: 第九轮扫描确认无本地登录/注册/refresh 请求 schema、无 SMS 登录/注册 contract 入口；仅保留 OIDC 兼容 `LoginSuccessSchema`。
- `vibecoding.dofe.ai`: 第十轮后 `pnpm --filter @repo/api type-check`
- `vibecoding.dofe.ai`: 第十轮后 `pnpm --filter @repo/web type-check`
- `scaffold.dofe.ai`: 第十轮后 `pnpm --filter @repo/api type-check`
- `scaffold.dofe.ai`: 第十轮后 `pnpm --filter @repo/web type-check`
- `vibecoding.dofe.ai`: 第十轮后 `pnpm --filter @repo/contracts test`（43 passed）+ `pnpm --filter @repo/validators test`（40 passed）
- `scaffold.dofe.ai`: 第十轮后 `pnpm --filter @repo/contracts test`（41 passed）+ `pnpm --filter @repo/validators test`（40 passed）
- `vibecoding.dofe.ai`: 第十轮后 `pnpm --filter @repo/web test`（2 passed）+ `pnpm --filter @repo/api exec jest --runInBand`（4 passed, 1 skipped）
- `scaffold.dofe.ai`: 第十轮后 `pnpm --filter @repo/web test`（2 passed）+ `pnpm --filter @repo/api exec jest --runInBand --passWithNoTests`
- `vibecoding.dofe.ai` / `scaffold.dofe.ai`: 第十轮四项质量门禁继续通过：`check:architecture`、`check:list-contracts`、`check:sensitive-logs`、`check:utils-hygiene`。
- `vibecoding.dofe.ai` / `scaffold.dofe.ai`: 第十轮扫描确认无 validators 本地登录/注册 schema、无 `/register` 前端入口映射、无 set-password contract/hook、无本地 provider account schema。
- `vibecoding.dofe.ai`: 第十一轮后 `pnpm --filter @repo/web type-check`
- `scaffold.dofe.ai`: 第十一轮后 `pnpm --filter @repo/web type-check`
- `vibecoding.dofe.ai`: 第十一轮后 `pnpm --filter @repo/web test`（2 passed）
- `scaffold.dofe.ai`: 第十一轮后 `pnpm --filter @repo/web test`（2 passed）
- `vibecoding.dofe.ai` / `scaffold.dofe.ai`: 第十一轮后 `pnpm check:sensitive-logs`、`pnpm check:utils-hygiene` 通过。
- `vibecoding.dofe.ai` / `scaffold.dofe.ai`: 第十一轮扫描确认无误导性 `login, register` public client 注释、无旧 `/register`/`signClient`/`signContract`/`auth-token`/`oidc-auth/refresh-token` 入口残留；剩余 `login/register` 命中均为“已移除/不暴露”的说明性注释或历史脚本字符串。
- `vibecoding.dofe.ai`: 第十二轮后 `pnpm --filter @repo/web type-check`
- `vibecoding.dofe.ai`: 第十二轮后 `pnpm --filter @repo/api type-check`
- `vibecoding.dofe.ai`: 第十二轮后 `pnpm --filter @repo/web test`（2 passed）
- `vibecoding.dofe.ai`: 第十二轮后 `pnpm --filter @repo/web exec playwright test e2e/sso-real.spec.ts --reporter=line`（未启用真实 SSO 时 1 skipped，验证测试资产可加载）
- `scaffold.dofe.ai`: 第十二轮后 `pnpm --filter @repo/web type-check`（仅因同步修正 SSO file proxy rewrite 执行；不代表 scaffold 已完成真实 SSO 登录验收）

未执行 / 待真实环境执行：

- vibecoding 端到端浏览器登录流程，需要可用的本地/测试 SSO client secret、`INTERNAL_API_SECRET`、Redis、数据库与 sso 服务。当前机器检查到 `sso.dofe.ai` API `:3100` 有响应，但 vibecoding API `:13100` / Web `:3003` 未启动，且 vibecoding `apps/api/.env` 尚未配置 `SSO_CLIENT_SECRET` / `INTERNAL_API_SECRET`，因此不能标记真实 E2E 已通过。
- `pnpm test` 全量 monorepo 测试未作为单条命令执行；本轮已执行可本地隔离验证的 api/contracts/web 测试，E2E 仍依赖真实 SSO 环境。

已知待真实环境验证：

- `/api/proxy/sso/:path*` 真实上传转发与 SSO 返回 CDN URL 可访问性。
- 完整 login → sso → callback → exchange → refresh → logout 浏览器闭环。
- token blacklist guard 检查已实现；仍需在真实登出后验证黑名单 key 与 access token `jti` 的实际命中。

真实 E2E 命令（仅 vibecoding）：

```bash
# 前置：sso API :3100、vibecoding API :13100、vibecoding Web :3003 已启动；
# apps/api/.env 已配置 SSO_CLIENT_SECRET / INTERNAL_API_SECRET；
# sso.dofe.ai 已 seed vibecoding-dofe-ai client，且测试账号可登录。
SSO_E2E_ENABLED=1 \
E2E_SSO_EMAIL=<test-user@example.com> \
E2E_SSO_PASSWORD=<password> \
E2E_SSO_ORIGIN=http://127.0.0.1:3100 \
pnpm --filter @repo/web test:e2e:sso
```

## 5. 后续运行前配置

vibecoding API：

```bash
SSO_API_URL=http://127.0.0.1:3100
SSO_INTERNAL_API_URL=http://127.0.0.1:3100
SSO_ISSUER=http://127.0.0.1:3100
SSO_CLIENT_ID=vibecoding-dofe-ai
SSO_CLIENT_SECRET=<from sso.dofe.ai>
SSO_SERVICE_NAME=vibecoding.dofe.ai
INTERNAL_API_SECRET=<from sso.dofe.ai>
```

scaffold API（代码同步基线；当前不作为必须真实登录验收对象）：

```bash
SSO_API_URL=http://127.0.0.1:3100
SSO_INTERNAL_API_URL=http://127.0.0.1:3100
SSO_ISSUER=http://127.0.0.1:3100
SSO_CLIENT_ID=scaffold-dofe-ai
SSO_CLIENT_SECRET=<from sso.dofe.ai>
SSO_SERVICE_NAME=scaffold.dofe.ai
INTERNAL_API_SECRET=<from sso.dofe.ai>
```

Web：

```bash
NEXT_PUBLIC_SSO_BASE_URL=http://127.0.0.1:3100
NEXT_PUBLIC_SERVER_BASE_URL=http://127.0.0.1:13100
VIBECODING_INTERNAL_API_URL=http://127.0.0.1:13100
SCAFFOLD_INTERNAL_API_URL=http://127.0.0.1:13100
```
