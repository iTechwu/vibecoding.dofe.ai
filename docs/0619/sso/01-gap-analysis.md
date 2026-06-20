# 01 · 现状与差距分析

> **历史现状记录**：本文记录实施前差距。2026-06-19 已完成落地，准确状态见 [09-implementation-status.md](./09-implementation-status.md)。

## 1. vibecoding 后端（apps/api）现状

### 1.1 认证库（半成品）

`apps/api/libs/domain/auth/` 是从旧项目（agents/models 同源）拷来的骨架：

| 文件              | 作用                                                                                                                          | 状态                        |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `auth.module.ts`  | import `RedisModule`、`JwtModule`、`UserInfoModule`/`FileSourceModule`（`@app/db`）、`FileCdnModule`（`@dofe/infra-clients`） | **包名错误**（见 §3）       |
| `auth.service.ts` | Redis session + 自签 JWT 的传统认证                                                                                           | 旧模型，非 OIDC             |
| `auth.guard.ts`   | 全局 `AuthGuard`，读白名单配置，校验 Bearer                                                                                   | **未挂载到任何 controller** |
| `auth.ts`         | `@Auth()` 装饰器（已 @deprecated）                                                                                            | 半成品                      |

- 结论：`AuthModule` 未被任何业务模块 import，仅 `@app/auth` 的类型 `AuthenticatedRequest` 被引用（`src/types/fastify.d.ts`、`src/modules/uploader/uploader.controller.ts`）。**当前 API 请求实际不经过这套 guard**。

### 1.2 OIDC / SSO 能力

- **无** `oidc-client-api` 模块（models 有 4 文件）。
- **无** `user-sync` 服务（sso→本地用户映射）。
- **无** `@app/sso-client`（`@dofe/sso-node` 包装）。
- `app.module.ts` / `bootstrap/app-module-imports.bootstrap.ts` 未加载任何 SSO/auth 模块。

### 1.3 Prisma schema

`apps/api/prisma/schema.prisma`：

- 有自建用户系统：`UserInfo`（表 `u_user_info`）、`WechatAuth/GoogleAuth/DiscordAuth/MobileAuth/EmailAuth`。
- `UserInfo` 登录标识：`deviceId / wechatOpenid / wechatUnionId / googleSub / discordId / mobile / email`。
- **缺 `ssoSub`**（SSO subject 映射字段，`user-sync` 依赖）。
- **无 `AuditLog` model / `AuditLogAction` 枚举**。
- **无 `OAuthClient` / `Session` / `Team` 表**（sso client 注册表与 vibecoding DB 完全分离）。

### 1.4 环境变量

`apps/api/.env` 现有 key：`DATABASE_URL / READ_DATABASE_URL / REDIS_URL / RABBITMQ_URL / RABBITMQ_OPTIONAL / BASE_HOST / NODE_ENV`。

- **无任何 SSO/OIDC 相关变量**（`SSO_* / JWKS_* / CLIENT_ID / CLIENT_SECRET / REDIRECT_URI / INTERNAL_API_SECRET / SSO_BASE_URL` 均缺失）。

## 2. vibecoding 前端（apps/web）现状

- 有 `providers/auth-provider.tsx`（`AuthProvider` + `useAuth()`），基于 localStorage 存 `UserInfo` + access/refresh token，属**传统自家 token 模型**，非 OIDC。
- `lib/actions/auth.ts` 仅含第三方 OAuth（TikTok/Instagram），**与 dofe SSO 无关**。
- `lib/api/contracts/client.ts`：401 → `window.location.href = '/login'`。
- `proxy.ts`（Next middleware）：仅国际化 + public route 标记，未真正拦截。
- **`/login` 页面不存在**：`apps/web/app/` 下无 login/callback/register 页面文件（代码引用 `/login`，但路由缺失）。
- **无任何 sso.dofe.ai 跳转逻辑**（grep `sso`/`oidc`/`redirect_uri`/`client_id` 零命中）。

端口：`apps/web/package.json` → `next dev -p 3003`、`next start -p 3003`。

## 3. 实施前已知问题（已通过最终方案消除）

**FileCdn 导入包名错误**（直接导致 `pnpm type-check` 失败）：

- `apps/api/libs/domain/auth/src/auth.service.ts:12` → `import { FileCdnClient } from '@dofe/infra-clients';` ❌
- `apps/api/libs/domain/auth/src/auth.module.ts:12` → `import { FileCdnModule } from '@dofe/infra-clients';` ❌
- 正确来源：`@dofe/infra-shared-services`（`@dofe/infra-clients` 下无此二者导出，仅有 `FileGcsClient` 等 storage client）。
- 最终处理：本地 FileCdn/Uploader 链路已整体下线，文件能力改为通过 `@dofe/file-sdk` / `@dofe/file-sdk-web` 消费 SSO。详见 [04-file-management.md](./04-file-management.md) 与 [09-implementation-status.md](./09-implementation-status.md)。

## 4. scaffold.dofe.ai 现状

> ⚠️ 本项目与 vibecoding 同构（同为 monorepo scaffold/template）。实施前需对 scaffold 补一次与本文 §1–§3 等价的状态核对（是否已有 auth lib、schema 现状、env 现状、前端路由现状）。本方案所有步骤对 scaffold 同样适用，差异点在核对后补充。

## 5. 差距 Checklist

| 维度              | 当前状态                               | 目标状态                                    | 对应文档 |
| ----------------- | -------------------------------------- | ------------------------------------------- | -------- |
| **sso 注册表**    | 无 vibecoding client                   | 新增 `vibecoding-dofe-ai` + seed            | 06       |
| **api env**       | 无 SSO 变量                            | 补齐 `SSO_*`/`JWKS_*`/`INTERNAL_API_SECRET` | 07       |
| **api schema**    | 无 `AuditLog`、`UserInfo` 无 `ssoSub`  | migration + prisma generate                 | 03 / 08  |
| **api 审计日志**  | 无                                     | models 风格 `AuditLogService`，业务主动调用 | 03       |
| **api OIDC**      | 无 oidc-client-api / guard / user-sync | 复制 models 并裁剪 RBAC                     | 05       |
| **api file**      | FileCdn import 错误                    | 下线本地文件源，接 `@dofe/file-sdk`         | 04       |
| **web 登录页**    | `/login` 路由缺失                      | 新建 login/callback/success                 | 05       |
| **web token**     | localStorage 自家模型                  | OIDC token-manager + `dofe_rf` cookie       | 05       |
| **web apiClient** | 无 `credentials:include` / 401 刷新    | 改造 baseFetch                              | 05       |
| **scaffold**      | 待核对                                 | 复用本方案                                  | 08       |
