# 07 · 环境变量与配置清单

> vibecoding（及 scaffold）接入 SSO 所需的前后端环境变量。本地 / 预发 / 生产取值不同，此处给出 **key 名与本地默认值**；生产值由运维注入。

## 1. 后端 `apps/api/.env`

### 1.1 新增 SSO 相关 key

```bash
# sso 地址（本地服务 :3100）
SSO_API_URL=http://127.0.0.1:3100
SSO_INTERNAL_API_URL=http://127.0.0.1:3100
SSO_ISSUER=http://127.0.0.1:3100

# vibecoding 的 OIDC 凭证（由 sso 颁发，见 06）
SSO_CLIENT_ID=vibecoding-dofe-ai
SSO_CLIENT_SECRET=<SSO_CLIENT_SECRET_VIBECODING 的值>
SSO_SERVICE_NAME=vibecoding.dofe.ai

# 服务间鉴权（verify-token 的 Bearer）
INTERNAL_API_SECRET=<sso 颁发>

# JWKS（远程验证暂不依赖，供未来本地验签优化）
JWKS_PATH=.well-known/jwks.json
JWKS_URI=${SSO_ISSUER}/${JWKS_PATH}
INTERNAL_JWKS_URI=${SSO_INTERNAL_API_URL}/${JWKS_PATH}

# 仅 dev：跳过 AuthGuard，用固定 userId（生产必须为空）
MODE_USER_ID=
```

### 1.2 `getConfig()` 注入的应用配置

`app.baseUrl` / `app.domain` / `app.subDomain` / `app.port` 由 `@dofe/infra-common` 的 `getConfig()` 读取（通常来自 `keys/config.json` 或更高层 env）。`oidc-client-api.service.ts` 用其拼 redirectUri：

- dev：`http://127.0.0.1:{app.port=13100}`
- prod：`https://{app.subDomain}.{app.domain}`（如 `https://vibecoding.dofe.ai`）

> 需确认 vibecoding 的 `getConfig`/`keys/config.json` 已含 `app.port=13100` 与 prod 域名配置；缺则补齐。

## 2. 前端 `apps/web/.env`

```bash
# sso 前端基址（跨子域 session 探测 / iframe）
NEXT_PUBLIC_SSO_BASE_URL=http://127.0.0.1:3100
NEXT_PUBLIC_SSO_TIMEOUT=10000

# vibecoding api（ts-rest baseUrl + OIDC API base）
NEXT_PUBLIC_SERVER_BASE_URL=http://127.0.0.1:13100

# 可选：覆盖 OIDC API base（默认同 NEXT_PUBLIC_SERVER_BASE_URL）
VIBECODING_INTERNAL_API_URL=http://127.0.0.1:13100
```

> 现状：`NEXT_PUBLIC_SERVER_BASE_URL=http://localhost:13100`（CLAUDE.md）。接入后保持 13100。

## 3. client_id / secret 约定表（sso 侧）

| 产品             | clientId             | secret 环境变量                | SSO_SERVICE_NAME   |
| ---------------- | -------------------- | ------------------------------ | ------------------ |
| Agents           | `agents-dofe-ai`     | `SSO_CLIENT_SECRET_AGENTS`     | agents.dofe.ai     |
| Models           | `models-dofe-ai`     | `SSO_CLIENT_SECRET_MODELS`     | models.dofe.ai     |
| **Vibecoding**   | `vibecoding-dofe-ai` | `SSO_CLIENT_SECRET_VIBECODING` | vibecoding.dofe.ai |
| Scaffold（后续） | `scaffold-dofe-ai`   | `SSO_CLIENT_SECRET_SCAFFOLD`   | scaffold.dofe.ai   |

## 4. 本地开发的跨域 Cookie 注意

`dofe_rf` cookie 域为 `.dofe.ai`，跨子域生效。本地若用 `http://127.0.0.1:3003` + `http://127.0.0.1:3100`，**不同源**且非 `.dofe.ai` 子域，cookie 无法跨站携带。两种本地调试方案：

1. **推荐**：用 `vibecoding.test.dofe.ai` / `sso.test.dofe.ai`（hosts 解析到 127.0.0.1），cookie 域 `.test.dofe.ai` 或 `.dofe.ai` 可跨子域；sso 侧 redirect_uri 已含 `vibecoding.test.dofe.ai`。
2. 临时：本地关闭 cookie 的 Secure/Domain 限制（仅 dev），或将 sso 与 vibecoding 同源部署。

> 生产无此问题（均在 `*.dofe.ai`）。

## 5. 验证

- api 启动时 `SsoAuthClient.onModuleInit` 不抛「缺 SSO\_\*」校验错误（4 个必填：`SSO_INTERNAL_API_URL`/`SSO_API_URL`/`INTERNAL_API_SECRET`/`SSO_SERVICE_NAME`）。
- 前端 `checkSsoSession` 能访问 `NEXT_PUBLIC_SSO_BASE_URL/auth/session`。
- 生产/预发配置由 CI/运维注入对应域名与凭证。
