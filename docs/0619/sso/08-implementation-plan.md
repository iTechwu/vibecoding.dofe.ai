# 08 · 分阶段实施计划与里程碑

> 按「先 sso 侧、再 api 基础、再认证、再前端、最后文件与 scaffold」的顺序推进。每阶段独立可验证、可回滚。

## 阶段总览

| 阶段 | 主题                                     | 依赖 | 详见     | 里程碑 |
| ---- | ---------------------------------------- | ---- | -------- | ------ |
| 0    | sso 侧 client 注册                       | —    | 06       | M0     |
| 1    | api schema + env 基础                    | 0    | 07 / 03  | M1a    |
| 2    | 审计日志 + 修 FileCdn bug                | 1    | 03 / 04  | M1     |
| 3    | api SSO 认证（OIDC + guard + user-sync） | 0,1  | 05(后端) | M2     |
| 4    | web SSO 前端闭环                         | 3    | 05(前端) | M3     |
| 5    | file-sdk 接入                            | 2    | 04       | M4     |
| 6    | scaffold 同步                            | 0–5  | 全部     | M5     |

---

## 阶段 0 · sso 侧 client 注册（在 sso.dofe.ai）

- **改动**：`apps/api/scripts/oauth-clients.config.ts` 增 `vibecoding-dofe-ai`（`SECRET_ENV_MAP` + `INITIAL_OAUTH_CLIENTS`）；颁发 `SSO_CLIENT_SECRET_VIBECODING` 与 `INTERNAL_API_SECRET`。
- **执行**：`pnpm db:seed`（或 `dotenv -e .env -- npx ts-node scripts/seed-oauth-clients.ts`）。
- **验证**：`t_oauth_client` 命中 vibecoding 记录；redirect_uris 含 `127.0.0.1:13100/auth/oidc/callback` 与 `vibecoding.test.dofe.ai`。
- **回滚**：从 `INITIAL_OAUTH_CLIENTS` 移除该条 + DB 删除记录。

## 阶段 1 · api schema + env 基础（在 vibecoding）

- **改动**：
  - `schema.prisma`：新增 `model AuditLog` + `enum AuditLogAction`（03 §3）；`UserInfo` 加 `ssoSub` + 索引（05 §3.3）。
  - migration：`pnpm db:migrate:dev --name add_audit_log_and_sso_sub` → `pnpm db:generate`。
  - `apps/api/.env`：补 SSO 相关 key（07 §1）。
  - `apps/web/.env`：补前端 SSO key（07 §2）。
- **验证**：`@app/db` 产出 `AuditLogModule/Service`；`pnpm type-check` 不因 schema 报错。
- **回滚**：prisma migrate reset / 回退 migration；删除新增 env。

## 阶段 2 · 审计日志 + 修 FileCdn bug（在 vibecoding）

- **改动**：
  - 复制 sso `libs/domain/services/src/audit/{operate-log-adapter.service,audit.service,audit.module}.ts` → vibecoding 同路径；更新 `libs/domain/services/src/index.ts` 导出（03 §2）。
  - 修 `auth.module.ts:12` / `auth.service.ts:12` 的 `FileCdnModule/FileCdnClient` 导入源 → `@dofe/infra-shared-services`（04 §2）。
  - 装配：`bootstrap/app-module-imports.bootstrap.ts` 加 `AuditModule`；`app.module.ts` providers 加 `OPERATE_LOG_SERVICE_TOKEN` + `APP_INTERCEPTOR→AuditLogInterceptor`（03 §4）。
- **验证**：`pnpm type-check` 通过（既有 FileCdn 错误消除）；访问写接口 → `t_audit_log` 有记录。
- **回滚**：移除装配行 + 删除 audit 目录 + 还原 import。

## 阶段 3 · api SSO 认证（在 vibecoding）

- **改动**：
  - 复制 models `oidc-client-api/`（改默认端口 13100）；复制 `auth lib`（guard/service/user-sync/auth/auth.module）；复制 `@app/sso-client`（05 §1）。
  - `main.ts` 注册 `@fastify/cookie`。
  - 新增 `@repo/contracts` 的 `oidcAuthContract` + `@repo/constants` 的 OIDC 常量（05 §3）。
  - `bootstrap/app-module-imports.bootstrap.ts` 加 `OidcClientApiModule`；`AuthModule` `@Global()` + `APP_GUARD` 链（按 RBAC 裁剪）。
  - api `package.json` 新增依赖：`@dofe/sso-node`、`@dofe/sso-contracts`、`openid-client`、`@fastify/cookie`。
- **验证**：`GET /auth/oidc/authorize` 返回 sso 授权 URL；callback 能换 token + 远程 `verify-token` 通过 + 本地建用户；受保护 API 注入 `request.userId`；`dofe_rf` cookie 写入。
- **回滚**：从 bootstrap 移除 `OidcClientApiModule`、移除 `APP_GUARD`、还原 auth lib。

## 阶段 4 · web SSO 前端闭环（在 vibecoding）

- **改动**：
  - 新建 `app/[locale]/login`、`app/[locale]/auth/oidc/{callback,success}`、`app/api/auth/oidc/authorize`（05 §2.1）。
  - 复制 `lib/{token-manager,sso-session,sso-session-errors,storage/index}.ts`（05 §2.2）。
  - 改造 `lib/api/contracts/client.ts` 的 `baseFetch`（`credentials:include` + 401 刷新重试）（05 §2.3）。
  - web `package.json` 新增依赖：`@dofe/sso-browser`、`@dofe/sso-contracts`。
- **验证**：端到端登录闭环（login→sso→callback→success→token 入库）；access 过期自动 refresh；logout 回 `/login`。
- **回滚**：删除新增路由/lib；还原 `baseFetch`。

## 阶段 5 · file-sdk 接入（在 vibecoding）

- **改动**：
  - 5a：`UploaderModule` 内部 Service 改调 `FileSdkClient`（转发 sso），入口不变（04 §3.3）。
  - 5b（可选）：前端 `@dofe/file-sdk-web` 直连 sso，下线自有 uploader。
  - 新增 `@dofe/file-sdk` 依赖与 Client 层封装（04 §3）。
- **验证**：上传文件落 sso 存储 + CDN URL 可访问 + 本地 `FileSource` 缓存一致。
- **回滚**：还原 UploaderService 直接存储逻辑。

## 阶段 6 · scaffold 同步

- 对 `scaffold.dofe.ai` 重复阶段 0–5（client_id=`scaffold-dofe-ai`，secret=`SSO_CLIENT_SECRET_SCAFFOLD`）。
- 实施前补一次 scaffold 现状核对（01 §4），差异点就地修订。

---

## 里程碑

- **M0**（阶段 0）：sso 注册完成，vibecoding 可发起 `/auth/oidc/authorize` 且 sso 接受 redirect_uri。
- **M1a**（阶段 1）：schema/env 就绪，`@app/db` 含 `AuditLog`/`ssoSub`。
- **M1**（阶段 2）：审计日志上线，`pnpm type-check` 全绿（含 FileCdn bug 修复）。
- **M2**（阶段 3）：api 端 SSO 认证可用（远程校验 + user-sync + cookie）。
- **M3**（阶段 4）：全栈 SSO 登录端到端闭环。
- **M4**（阶段 5）：文件能力以 sso 为唯一源。
- **M5**（阶段 6）：scaffold 同步完成。

## 全局验证清单

- [ ] `pnpm type-check`（api）全绿
- [ ] `pnpm test`（bootstrap + audit + user-sync + token-manager 单测）通过
- [ ] `pnpm dev:api` + `pnpm dev:web` + sso 三端联动，登录/刷新/登出闭环
- [ ] sso `t_oauth_client` 含 vibecoding；vibecoding `t_audit_log` 记录正常
- [ ] 文件上传经 sso，CDN 可访问
