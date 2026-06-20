# 08 · 分阶段实施计划与里程碑

> **实施状态**：本计划已在 2026-06-19 完成主要代码落地，并在 2026-06-20 深审修复 SSO 文件代理与默认前端回调端口；真实 Chromium E2E 已验证 vibecoding login → callback → refresh → logout 与 SSO 上传凭证/CDN 元数据返回。准确完成项、废弃项与本轮不验收项见 [09-implementation-status.md](./09-implementation-status.md)。

> 按「先 sso 侧、再 api 基础、再认证、再前端、最后文件与 scaffold」的顺序推进。每阶段独立可验证、可回滚。

## 阶段总览

| 阶段 | 主题                                     | 依赖 | 详见     | 里程碑 |
| ---- | ---------------------------------------- | ---- | -------- | ------ |
| 0    | sso 侧 client 注册                       | —    | 06       | M0     |
| 1    | api schema + env 基础                    | 0    | 07 / 03  | M1a    |
| 2    | 审计日志与文件链路收敛                   | 1    | 03 / 04  | M1     |
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

## 阶段 2 · 审计日志与文件链路收敛（在 vibecoding）

- **改动**：
  - 采用 `models.dofe.ai` 的业务主动调用模式：`apps/api/libs/domain/audit-log/` + 本地 `audit_logs` 表（03）。
  - 不注册 `AuditLogInterceptor` / `OPERATE_LOG_SERVICE_TOKEN`。
  - 文件能力改为 file-sdk 消费后，旧 `FileCdnModule/FileCdnClient` 路径不再作为运行依赖。
- **验证**：`pnpm --filter @repo/api type-check` 通过；业务写接口按需主动调用 `AuditLogService` 后写入 `audit_logs`。
- **回滚**：移除业务侧审计调用 + 删除 audit-log domain 与 schema。

## 阶段 3 · api SSO 认证（在 vibecoding）

- **改动**：
  - 复制 models `oidc-client-api/`（改默认端口 13100）；复制 `auth lib`（guard/service/user-sync/auth/auth.module）。
  - 不复制 `@app/sso-client`；SSO 远程校验/用户信息直接使用 `@dofe/infra-clients/sso`，OIDC token 交换直接使用 `openid-client`。
  - `main.ts` 注册 `@fastify/cookie`。
  - 新增 `@repo/contracts` 的 `oidcAuthContract` + `@repo/constants` 的 OIDC 常量（05 §3）。
  - `bootstrap/app-module-imports.bootstrap.ts` 加 `OidcClientApiModule`；`AuthModule` `@Global()` + `APP_GUARD` 链（按 RBAC 裁剪）。
  - api `package.json` 新增依赖：`openid-client`、`@fastify/cookie`；不保留零引用的 `@dofe/sso-node`、`@dofe/sso-contracts`。
- **验证**：`GET /auth/oidc/authorize` 返回 sso 授权 URL；callback 能换 token + 远程 `verify-token` 通过 + 本地建用户；受保护 API 注入 `request.userId`；`dofe_rf` cookie 写入。
- **回滚**：从 bootstrap 移除 `OidcClientApiModule`、移除 `APP_GUARD`、还原 auth lib。

## 阶段 4 · web SSO 前端闭环（在 vibecoding）

- **改动**：
  - 新建 `app/[locale]/login`、`app/[locale]/auth/oidc/{callback,success}`、`app/api/auth/oidc/authorize`（05 §2.1）。
  - 复制 `lib/{token-manager,sso-session,sso-session-errors,storage/index}.ts`（05 §2.2）。
  - 改造 `lib/api/contracts/client.ts` 的 `baseFetch`（`credentials:include` + 401 刷新重试）（05 §2.3）。
  - 改造 `AuthProvider` 与 `lib/api.ts` 兼容层：刷新统一走 `tokenManager` + `/auth/oidc/token`，登出统一走 `oidcAuthClient.logout/clearSession`。
  - 删除未被引用的旧 `lib/api/auth-server.ts`，避免继续暴露本地 refresh token 模式。
  - 删除旧本地 `/sign` ts-rest contract、前端 `signClient` 与未使用的 `/sign/*` 配置；认证入口只保留 OIDC contract/client。
  - web `package.json` 新增依赖：`@dofe/sso-browser`；OIDC contract 使用本仓库 `@repo/contracts`，不依赖 `@dofe/sso-contracts`。
- **验证**：端到端登录闭环（login→sso→callback→success→token 入库）；access 过期自动 refresh；logout 回 `/login`。
- **回滚**：删除新增路由/lib；还原 `baseFetch`。

## 阶段 5 · file-sdk 接入（在 vibecoding）

- **改动**：
  - 删除本地 `UploaderModule`，不保留本地上传入口。
  - 删除本地 `FileSource` 与 bucket/env 枚举；`avatarFileId` 仅保存 SSO file id。
  - 删除旧本地 `/uploader` ts-rest contract/schema 暴露，并移除 `/uploader/token/*` 限流白名单。
  - 后端使用 `@dofe/file-sdk` 解析/消费 SSO 文件。
  - 前端使用 `@dofe/file-sdk-web`，`apiBase='/api/proxy/sso'`。
  - `apps/web/next.config.ts` 增加 `/api/proxy/sso/:path*` → `${NEXT_PUBLIC_SSO_BASE_URL}/:path*` rewrite，并允许 `*.dofe.ai` 图片域名（`@dofe/file-sdk-web` 自行拼接 `/api/uploader/*`）。
- **验证**：type-check 通过；真实 Chromium E2E 已验证 SSO 上传凭证与 CDN 元数据返回。预签名 URL PUT 与 CDN GET 等物理 bucket 验证等待 `dofe-public/private/system` 存储侧后续处理。
- **回滚**：恢复本地 uploader 与 file schema 会违反“SSO 为唯一真源”，不作为推荐回滚路径；如需临时降级，应仅回滚前端入口并保留 SSO 文件源。

## 阶段 6 · scaffold 同步

- 对 `scaffold.dofe.ai` 重复阶段 0–5（client_id=`scaffold-dofe-ai`，secret=`SSO_CLIENT_SECRET_SCAFFOLD`）。
- 实施前补一次 scaffold 现状核对（01 §4），差异点就地修订。
- 当前验收口径：scaffold 只要求保持代码同步基线，不要求必须完成 `sso.dofe.ai` 真实登录链路验证；真实 SSO E2E 验收对象为 vibecoding。

---

## 里程碑

- **M0**（阶段 0）：sso 注册完成，vibecoding 可发起 `/auth/oidc/authorize` 且 sso 接受 redirect_uri。
- **M1a**（阶段 1）：schema/env 就绪，`@app/db` 含 `AuditLog`/`ssoSub`。
- **M1**（阶段 2）：审计日志上线，`pnpm type-check` 全绿，本地 FileCdn/Uploader 链路不再作为运行依赖。
- **M2**（阶段 3）：api 端 SSO 认证可用（远程校验 + user-sync + cookie）。
- **M3**（阶段 4）：全栈 SSO 登录端到端闭环。
- **M4**（阶段 5）：文件能力以 sso 为唯一源。
- **M5**（阶段 6）：scaffold 同步完成。

## 全局验证清单（截至 2026-06-20）

- [x] vibecoding `pnpm --filter @repo/api type-check` 全绿
- [x] vibecoding `pnpm --filter @repo/web type-check` 全绿
- [x] scaffold `pnpm --filter @repo/api type-check` 全绿
- [x] scaffold `pnpm --filter @repo/web type-check` 全绿
- [x] logout 本地 blacklist 写入后，`AuthGuard` 已增加 `jti` blacklist 检查（SSO 远程 verify 仍为权威校验）
- [x] `/auth/oidc/token` 仅从 `dofe_rf` HttpOnly cookie 读取 refresh token，不接受请求体回退
- [x] web proxy 已移除旧 `auth-token` cookie 伪认证分支
- [x] vibecoding api/contracts/web 本地单测通过（api: 4 passed, 1 skipped；contracts: 43 passed；web: 2 passed）
- [x] scaffold contracts/web 本地单测通过（contracts: 41 passed；web: 2 passed）
- [x] scaffold api Jest 配置可解析；当前无 `.spec.ts` 文件（`--passWithNoTests`）
- [x] vibecoding 质量门禁通过：`check:architecture`、`check:list-contracts`、`check:sensitive-logs`、`check:utils-hygiene`
- [x] scaffold 质量门禁通过：`check:architecture`、`check:list-contracts`、`check:sensitive-logs`、`check:utils-hygiene`
- [x] scaffold 已同步 vibecoding 的 utils 类型/日志收敛、Fastify 注册类型化写法、标准分页 task list schema
- [x] vibecoding/scaffold `API_CONFIG.endpoints.refreshToken` 已改为真实 OIDC 端点 `/auth/oidc/token`
- [x] vibecoding/scaffold 已删除 TikTok OAuth action 中的硬编码 token 示例注释
- [x] vibecoding/scaffold OIDC controller 已移除显式 `Promise<any>`，由 ts-rest contract 推断返回类型
- [x] vibecoding/scaffold 已删除本地 Email/手机号登录、注册、refresh 请求 schema
- [x] vibecoding/scaffold 已删除 SMS 登录/注册 contract 入口，验证码接口不再作为本地认证入口
- [x] vibecoding/scaffold 资料绑定 contract 返回 `UserInfoSchema`，不再返回登录态
- [x] vibecoding/scaffold 已删除 `@repo/validators` 的本地 `loginSchema/registerSchema`
- [x] vibecoding/scaffold 已删除 `/settings/password` contract 与 `useSetPassword` hook
- [x] vibecoding/scaffold 已删除共享 `UserMobileAccount/UserEmailAccount/WechatAccount/GoogleAccount/DiscordAccount` schema 暴露
- [x] vibecoding/scaffold web 已移除 `/register` public route / analytics mapping，并将 auth locale 收敛为 SSO 页面文案
- [x] scaffold web ts-rest client 已同步 vibecoding 的 401/410 自动 refresh retry 逻辑，刷新只走 `/auth/oidc/token` + `dofe_rf` HttpOnly cookie
- [x] vibecoding/scaffold 前端 public client 注释已去除 login/register 表述，认证公共入口仅描述为 OIDC 相关端点
- [x] vibecoding API dev 端口配置已改为 `13100`，web 前端端口配置为 `3003`，对齐 sso client seed
- [x] vibecoding 登录成功默认回跳已改为存在的 `/`，避免 `/dashboard` 缺页导致回调后 404
- [x] vibecoding/scaffold SSO 文件代理 rewrite 已修正为 `${NEXT_PUBLIC_SSO_BASE_URL}/:path*`
- [x] vibecoding 已新增真实 SSO E2E 入口：`pnpm --filter @repo/web test:e2e:sso`
- [x] vibecoding SSO 联动 E2E 测试通过（Chromium）
- [ ] vibecoding `pnpm dev:api` + `pnpm dev:web` + sso 三端联动，登录/刷新/登出闭环
- [x] vibecoding Loops HTTP 写操作已主动调用 `AuditLogService`（best-effort，不阻断业务），业务写接口审计不再停留在登录事件
- [ ] sso `t_oauth_client` 含 vibecoding；需在目标 sso 环境查询确认 seed 结果
- [x] vibecoding 文件上传经 sso 返回上传凭证与 CDN 元数据；物理 bucket PUT/CDN GET 不纳入本轮验收
- [x] 第十四轮：OIDC 登录回调接入 `AuditLogService.logLogin`（vibecoding/scaffold），新增 `@app/audit-log` 别名，兑现审计"业务主动调用"
- [x] 第十四轮：`@repo/contracts` 重新生成 Prisma enum（`pnpm generate:enums`），移除 `FileBucketVendor/FileEnvType`、新增 `AuditActionType`，同步 `schemas.test.ts`
- [x] 第十四轮：移除死依赖 `@dofe/sso-node`/`@dofe/sso-contracts`（api+web），两仓 lockfile 更新；`@dofe/sso-browser` 保留
- [x] 第十四轮：补齐 scaffold `.env.example`（api+web）SSO 变量；修订 05 §1.3 / 02 技术栈 sso-client 描述为"未采用"
- [x] 第十四轮：vibecoding/scaffold 四项质量门禁全绿，type-check/contracts/web/validators/api jest 全通过
- [x] 第十五轮：vibecoding LoopsModule 引入 `AuditLogModule`，LoopsController 对 create/generate/review/decompose/run/finalize/intervene/resume 等 HTTP 成功写操作记录 `CREATE`/`UPDATE` 审计；`pnpm --filter @repo/api type-check`、API Jest、四项质量门禁通过
