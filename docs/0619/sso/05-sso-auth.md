# 05 · SSO 单点登录方案（全栈）

> 全面复制 `models.dofe.ai` 的接入实现，按 vibecoding 端口/业务裁剪。
> 端口：vibecoding **api = 13100**、**web = 3003**；models api=3101、web=3001（复制时改默认值）。

## 1. 后端（apps/api）

### 1.1 复制 oidc-client-api 模块

从 models `apps/api/src/modules/oidc-client-api/`（4 文件）复制到 vibecoding 同路径：

| models 文件                     | 职责                                                                                               | 复制后调整                                                |
| ------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `oidc-client-api.module.ts`     | imports `JwtModule`/`RedisModule`/`UserInfoModule`（`@app/db`）                                    | 基本不变                                                  |
| `oidc-client-api.service.ts`    | `openid-client` discovery、`getAuthorizationUrl`、`handleCallback`、`refreshToken`、`getLogoutUrl` | **默认 dev 端口 3101 → 13100**；redirect baseUrl 指向 api |
| `oidc-client-api.controller.ts` | 7 端点（`GET /auth/oidc/callback` 纯 `@Get`；其余走 `oidcAuthContract`）                           | 依赖 `@repo/contracts` 的 `oidcAuthContract`（见 §3）     |
| （dto/types 如有）              |                                                                                                    | 一并复制                                                  |

关键逻辑（对齐 models，勿改语义）：

- `onModuleInit`：`discovery(SSO_ISSUER, SSO_CLIENT_ID, SSO_CLIENT_SECRET, redirectUri)`；http issuer 走 `allowInsecureRequests`。
- `getAuthorizationUrl`：生成 state/nonce/PKCE verifier，存 Redis（`dofe:oidc:params:{state}`，TTL 600s），返回 sso `/authorize` URL。
- `handleCallback(code, state)`：`authorizationCodeGrant` 换 token → 取 id_token `sub` → `findOrCreateUserFromSso(claims)` → 生成一次性 exchange code 存 Redis（`dofe:oidc:exchange:{code}`，TTL 300s）→ 302 到 `web /auth/oidc/success?code={exchangeCode}`，并 `Set-Cookie: dofe_rf`。
- `refreshToken`：POST sso `token_endpoint`（带 client_secret）；`invalid_grant`/`invalid_token` → 抛 session 过期。
- `dofe_rf` cookie：`HttpOnly; Secure(prod); SameSite=Lax; Path=/; Max-Age=30d; Domain=.dofe.ai`。

### 1.2 改造 auth lib（`apps/api/libs/domain/auth/`）

替换现有「Redis session + 自签 JWT」半成品为 OIDC 模型。从 models 复制：

| models 文件            | 职责                                                                                                                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth.guard.ts`        | 全局 `AuthGuard`：取 Bearer → `SsoAuthClient.verifyToken()` → `UserSyncService.ensureLocalUserExists(ssoSub)` → 注入 `request.userId/isAdmin/userInfo`；`@Public()` 跳过；dev bypass `MODE_USER_ID` |
| `auth.service.ts`      | 仅保留 `extractTokenFromHeader` + `formatLoginResponse`（删除旧 Redis session 逻辑）                                                                                                                |
| `user-sync.service.ts` | sso `sub` → 本地 `UserInfo`（按 ssoSub / id / email 三级匹配，必要时调 sso `getUser` 回填）                                                                                                         |
| `auth.ts`              | `@Public()` / `@CurrentUser()` 装饰器                                                                                                                                                               |
| `auth.module.ts`       | 装配：imports `SsoClientModule`（`@dofe/infra-clients/sso`）、`UserInfoModule`、`RedisModule`、`JwtModule`；注册 `APP_GUARD` 链（未采用 `LocalSsoClientModule` / `@app/sso-client`）                |

### 1.3 SSO 客户端（实施口径，以 [09](./09-implementation-status.md) 为准）

> **实施修正**：本仓库**未采用** models 的本地 `@app/sso-client` 包装（`@dofe/sso-node` 的 `createSsoLegacyClient`）。

实际实现：

- SSO 远程校验/用户信息直接使用 `@dofe/infra-clients/sso` 的 `SsoAuthClient`（`verifyToken` / `getUser`）。
- OIDC token 交换（discovery / authorizationCodeGrant / PKCE / refresh）直接使用 `openid-client`。
- 本仓库不引入多租户 RBAC（`PermissionGuard` / `TeamContextGuard`），故不需要 `@dofe/sso-node` 的 legacy internal API 包装。
- 配置读 `SSO_INTERNAL_API_URL` / `SSO_API_URL` / `INTERNAL_API_SECRET` / `SSO_SERVICE_NAME`（由 `@dofe/infra-clients/sso` 消费）。

> 因此 `@dofe/sso-node`、`@dofe/sso-contracts` 不作为运行依赖（已于 2026-06-20 第十四轮从 vibecoding/scaffold 的 `package.json` 移除）。下方 §1.2 装配表与 §4 复制清单中提及的 `LocalSsoClientModule` / `@app/sso-client` 复制项不再适用，保留仅为方案过程记录。

### 1.4 AuthGuard 链裁剪

models 链：`AuthGuard → TeamContextGuard → PermissionGuard → IpWhitelistGuard`。vibecoding 按实际 RBAC 需求裁剪：

- **最小集**：仅 `AuthGuard`（保证登录态 + 注入 userId）。
- **如需权限**：另行设计本项目权限模型；当前不引入 `@dofe/sso-node` 的 RBAC legacy 包装。
- tenant/team 相关 guard 视 vibecoding 是否引入多租户再定。

### 1.5 main.ts

注册 `@fastify/cookie`（不校验签名）：

```ts
import fastifyCookie from '@fastify/cookie';
await app.register(fastifyCookie);
```

### 1.6 装配到 AppModule

`bootstrap/app-module-imports.bootstrap.ts` 的 imports 加入 `OidcClientApiModule`；`AuthModule` 设为 `@Global()` 并通过 `APP_GUARD` 注册 guard 链。

## 2. 前端（apps/web）

### 2.1 新建路由

| 路由                                       | 来源（models） | 职责                                                                                                                                     |
| ------------------------------------------ | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `app/[locale]/login/page.tsx`              | models 同名    | 无 token → `checkSsoSession()`（跨子域探测）失败则 `replace('/api/auth/oidc/authorize?redirect_uri=...')`                                |
| `app/api/auth/oidc/authorize/route.ts`     | models 同名    | fetch api `${OIDC_API_BASE}/auth/oidc/authorize` → `NextResponse.redirect(authorizeUrl)`                                                 |
| `app/api/auth/oidc/internal.ts`            | models 同名    | `getOidcApiBaseUrl()`：`VIBECODING_INTERNAL_API_URL` → `NEXT_PUBLIC_SERVER_BASE_URL` → `http://localhost:13100`                          |
| `app/[locale]/auth/oidc/callback/route.ts` | models 同名    | 一行 re-export `handleOidcCallback as GET`（转发到 api `/auth/oidc/callback`，透传 `Location`，`redirect:'manual'`）                     |
| `app/[locale]/auth/oidc/success/page.tsx`  | models 同名    | 拿 exchange code → `oidcAuthClient.exchangeCode` → `setTokens/setIdToken/setUser` → 跳回业务页（open-redirect 防护 `isSafeCallbackUrl`） |

### 2.2 复制 lib 工具

从 models `apps/web/lib/` 复制：

- `token-manager.ts` — `createTokenManager`（`@dofe/sso-browser/token-manager`）：`getToken/ensureValidToken/refreshToken/clearToken/isTokenExpired`；session 过期码 `['305410','929410']`。
- `sso-session.ts` + `sso-session-errors.ts` — `checkSsoSession`（Layer 1 fetch `/auth/session`）+ `checkSsoSessionViaIframe`（Layer 2 iframe+postMessage）。
- `storage/index.ts` — access_token + expire → `localStorage['tokens']`；presence cookie `tokenPresence=1` / `tokenExpire`；id_token → `localStorage['idToken']`；user → `localStorage['user']`；**refresh 不存**。

### 2.3 apiClient 改造

`apps/web/lib/api/contracts/client.ts` 的 `baseFetch(args, requireAuth)`：

- `requireAuth` → `ensureValidToken()` → `getToken()` → `Authorization: Bearer ${token}` + `x-current-tenant` 头。
- `fetch(..., { credentials: 'include' })`（带 `dofe_rf`）。
- 401/410 或 session 过期 → `refreshToken()` 重试一次；仍失败 → `clearToken()` + `replace(getLocaleLoginPath())`。
- `oidcAuthClient` 用 `publicClientOptions`（无 token），业务 client 用 `clientOptions`（需 token）。

### 2.4 Next proxy / middleware

当前 `apps/web/proxy.ts` 只保留国际化与 public route 流程，不做旧 `auth-token` cookie 认证。presence cookie（`tokenPresence` / `tokenExpire`）仅作为未来服务端路由保护的轻量信号；若后续启用服务端拦截，应读取 presence cookie 并仍以 API/SSO 校验为准。

## 3. 本仓库新增的共享产物

### 3.1 `@repo/contracts`：`oidcAuthContract`

`packages/contracts/src/api/oidc-auth.contract.ts`，端点：`exchange` / `token`(refresh) / `logout` / `clear-session` / `authorize`（与 controller 对齐）。前端 `oidcAuthClient` 与后端 `@TsRestHandler` 共用。

### 3.2 `@repo/constants`：OIDC 常量

`packages/constants/src/auth.ts`：`OIDC_PARAMS_KEY_PREFIX`、`OIDC_EXCHANGE_CODE_PREFIX`、`OIDC_EXCHANGE_CODE_TTL_S`、`TOKEN_BLACKLIST_PREFIX`、`ACCESS_TOKEN_DEFAULT_EXPIRY_S`、`REFRESH_TOKEN_DEFAULT_EXPIRY_MS`、`isSsoRefreshTokenExpired`。

### 3.3 schema：`UserInfo.ssoSub`

`apps/api/prisma/schema.prisma` 的 `model UserInfo` 新增：

```prisma
ssoSub String? @unique @map("sso_sub") @db.VarChar(255)
// 并在索引区追加
@@index([ssoSub])
```

migration：`pnpm db:migrate:dev --name add_user_sso_sub`。

### 3.4 `@repo/contracts`：`UserInfo` schema 补 `ssoSub`

## 4. 复制文件清单（models → vibecoding）

后端：

- `apps/api/src/modules/oidc-client-api/`（整目录，改端口 13100）
- `apps/api/libs/domain/auth/{auth.guard,auth.service,user-sync.service,auth,auth.module}.ts`
- `main.ts` 追加 `@fastify/cookie` 注册

未采用/不复制：

- `apps/api/libs/infra/clients/internal/sso-client/`（`@app/sso-client`）：本仓库直接使用 `@dofe/infra-clients/sso` + `openid-client`。

前端：

- `apps/web/app/api/auth/oidc/`（authorize route + internal.ts + callback handler）
- `apps/web/app/[locale]/auth/oidc/{callback,success}/`
- `apps/web/app/[locale]/login/page.tsx`
- `apps/web/lib/{token-manager,sso-session,sso-session-errors,storage/index}.ts`

## 5. 验证

1. 启动 sso（:3100）、vibecoding api（:13100）、web（:3003）。
2. 访问 `http://127.0.0.1:3003/login` → 跳转 sso 登录 → 授权 → 回到 `success` → access_token 入 localStorage、`dofe_rf` cookie 写入。
3. 访问受保护 API → 带 Bearer + cookie → `AuthGuard` 远程校验通过、`request.userId` 注入。
4. 等 access_token 过期 → 自动 refresh（cookie）→ 续期成功。
5. logout → sso `post_logout_redirect_uri` 回 `/login`。
6. 单测：`user-sync` 三级匹配、`AuthGuard` 校验/注入、`token-manager` 过期/刷新。
