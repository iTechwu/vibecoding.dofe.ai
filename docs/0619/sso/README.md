# SSO 统一化方案（vibecoding / scaffold → sso.dofe.ai）

> 本目录是「以 **sso.dofe.ai** 作为**用户管理 + 文件管理唯一源**」的整体优化方案。
> 全面参考 `models.dofe.ai` 的接入实现，适用于 `vibecoding.dofe.ai`，并供 `scaffold.dofe.ai` 同步复用。
>
> 本目录为**方案蓝图**（不含实现代码）；代码按 [08-implementation-plan.md](./08-implementation-plan.md) 分阶段落地。

## 1. 背景与目标

`vibecoding.dofe.ai` 与 `scaffold.dofe.ai` 当前各自维护用户系统与文件能力：

- vibecoding 的认证库 `apps/api/libs/domain/auth` 基于 **Redis session + 自签 JWT** 的旧模型，且为**半成品**——未挂载到任何 controller，请求实际不经过它。
- vibecoding 存在 `FileCdnClient / FileCdnModule` 导入包名错误（误从 `@dofe/infra-clients` 导入，实际位于 `@dofe/infra-shared-services`），直接导致 `pnpm type-check` 失败。
- 各项目重复实现用户/文件能力，形成数据孤岛、维护成本高。

**目标**：统一以 **sso.dofe.ai** 作为用户与文件的唯一权威源；vibecoding（及 scaffold）作为被 sso 保护的客户端，通过 **OIDC 单点登录**接入，文件能力通过 **`@dofe/file-sdk`** 消费 sso。

sso.dofe.ai 已提供一整套 SDK：`@dofe/infra-clients/sso`、`@dofe/sso-node`、`@dofe/sso-browser`、`@dofe/sso-contracts`、`@dofe/file-sdk`。

## 2. 设计原则

1. **唯一源**：用户与文件的权威数据驻留 sso；客户端本地表（如 `UserInfo`）仅作映射缓存（`ssoSub → 本地 id`）。
2. **全面参考 models.dofe.ai**：OIDC Authorization Code Flow + PKCE；token 远程验证；refresh_token 走 HttpOnly cookie。
3. **双项目同构同方案**：vibecoding 先行实施，scaffold 复用本方案。
4. **优先复用 SDK，不复制业务模块**：能用 npm 包解决的，不复制 sso 私有源码（审计日志适配层是少数例外）。

## 3. 架构总览

```mermaid
flowchart LR
    U["浏览器<br/>vibecoding web :3003"]
    W["vibecoding api<br/>NestJS :13100"]
    S[("sso.dofe.ai<br/>:3100")]
    U -->|1. /login → authorize| W
    W -->|2. 构造 OIDC auth url<br/>+ state/nonce/PKCE| S
    S -->|3. 用户登录/授权| U
    U -->|4. callback (code)| W
    W -->|5. authorizationCodeGrant<br/>+ verify-token| S
    W -->|6. 302 success<br/>+ dofe_rf HttpOnly cookie| U
    U -->|7. 受保护请求<br/>Bearer + credentials:include| W
    W -->|8. verify-token<br/>/ @dofe/file-sdk| S
```

- 登录态：access_token 存浏览器 localStorage（+ presence cookie）；refresh_token **仅存** `dofe_rf` HttpOnly cookie（域 `.dofe.ai`），前端永不接触。
- 受保护 API：每个请求由 `AuthGuard` 调 `SsoAuthClient.verifyToken()` 远程校验（带 `INTERNAL_API_SECRET` 服务间认证）。

详见 [02-architecture.md](./02-architecture.md)。

## 4. 文档索引

| 文档                                                                 | 内容                                               | 受众        |
| -------------------------------------------------------------------- | -------------------------------------------------- | ----------- |
| [01-gap-analysis.md](./01-gap-analysis.md)                           | vibecoding/scaffold 现状与差距 Checklist           | 全员        |
| [02-architecture.md](./02-architecture.md)                           | OIDC flow / token 验证策略 / 唯一源原则 / 技术栈   | 架构 / 后端 |
| [03-audit-logging.md](./03-audit-logging.md)                         | 审计日志集成（infra-common + sso 适配层）          | 后端        |
| [04-file-management.md](./04-file-management.md)                     | 文件管理（`@dofe/file-sdk` 消费 + 修 FileCdn bug） | 后端        |
| [05-sso-auth.md](./05-sso-auth.md)                                   | SSO 单点登录（后端 OIDC + 前端流程）               | 全栈        |
| [06-oauth-client-registration.md](./06-oauth-client-registration.md) | sso 侧 OAuth client 注册 + seed 更新               | sso 维护者  |
| [07-configuration.md](./07-configuration.md)                         | 前后端环境变量与配置清单                           | 运维 / 全栈 |
| [08-implementation-plan.md](./08-implementation-plan.md)             | 分阶段实施计划与里程碑                             | 全员        |

## 5. 实施阶段总览

| 阶段 | 主题                | 关键产出                                                                 | 详见 |
| ---- | ------------------- | ------------------------------------------------------------------------ | ---- |
| 0    | sso 侧注册          | `vibecoding-dofe-ai` client + seed + `INTERNAL_API_SECRET`               | 06   |
| 1    | vibecoding api 基础 | env + schema migration（`AuditLog`、`UserInfo.ssoSub`）+ prisma generate | 08   |
| 2    | 审计日志            | 复制 sso 适配层 + `t_audit_log` + 装配（含修 FileCdn bug）               | 03   |
| 3    | vibecoding api 认证 | oidc-client-api 模块 + AuthGuard + user-sync                             | 05   |
| 4    | vibecoding web      | login/callback/success + token-manager + sso-session                     | 05   |
| 5    | file-sdk 接入       | `@dofe/file-sdk` 消费 + uploader 取舍                                    | 04   |
| 6    | scaffold 同步       | 复用本方案                                                               | 08   |

## 6. 关键决策摘要

1. **Token 验证**：沿用 models 的**远程 `verify-token`**（对齐既有实现，降低偏差）；本地 JWKS 缓存验签列为未来优化项。
2. **文件能力**：采用 **`@dofe/file-sdk` 消费模式**，不复制 sso 的 `FileDomainModule`/`file-api`/`cdn-proxy`（避免引入 tenant/team 多租户耦合）。
3. **审计日志**：复制 sso 业务适配层（`OperateLogAdapterService`/`AuditModule`）+ 新建 `t_audit_log` 表；拦截器/token/接口来自 `@dofe/infra-common`。
4. **前端 token**：access 存 localStorage（+ presence cookie），refresh 存 `dofe_rf` HttpOnly。
5. **命名约定**：`clientId = vibecoding-dofe-ai`，`SSO_CLIENT_SECRET_VIBECODING`，`SSO_SERVICE_NAME = vibecoding.dofe.ai`。

> 端口约定：vibecoding **web = 3003**、**api = 13100**；sso 本地服务 = 3100。OIDC callback 实际由 **api** 处理（`/auth/oidc/callback`），故 seed 中 api 端口回调为 `http://127.0.0.1:13100/auth/oidc/callback`。
