# 06 · sso 侧 OAuth Client 注册与 Seed 更新

> 本篇描述**在 sso.dofe.ai 项目**中的改动（非 vibecoding）。将 vibecoding 注册为 sso 的 OIDC client，使 vibecoding 能发起单点登录。

## 1. 数据模型：`OAuthClient`

sso `apps/api/prisma/schema.prisma` 中 `model OAuthClient`（表 `t_oauth_client`）关键字段：

| 字段                              | 类型                        | 说明                                         |
| --------------------------------- | --------------------------- | -------------------------------------------- |
| `clientId`                        | String @unique Varchar(255) | 公开 client 标识（`client_id`）              |
| `clientSecret`                    | String Text                 | bcrypt 哈希（cost 12）                       |
| `clientName`                      | String Varchar(255)         | 展示名                                       |
| `redirectUris`                    | String[]                    | **多回调白名单**（`redirect_uris`）          |
| `grantTypes`                      | String[]                    | `authorization_code` / `refresh_token`       |
| `scopes`                          | String[]                    | `openid profile email tenant offline_access` |
| `isConfidential`                  | Boolean default true        | confidential vs public                       |
| `isActive` / `isDeleted` / 时间戳 | —                           | 启用/软删                                    |

> 注：`OAuthClient` **无** `post_logout_redirect_uri` 字段；RP-initiated logout 走 `post_logout_redirect_uri` 查询参数 + 白名单匹配（由 vibecoding 登出 URL `/login` 在 `redirectUris` 中体现）。

## 2. 真值源与消费方

- **配置真值源**：`apps/api/scripts/oauth-clients.config.ts`
  - `INITIAL_OAUTH_CLIENTS: OAuthClientDef[]`（client 定义数组）
  - `SECRET_ENV_MAP: Record<string,string>`（clientId → secret 环境变量名）
- **消费方**（幂等 upsert：`findFirst` by clientId → 有差异 `update`，否则 `create`；clientId 不变不覆盖 secret）：
  - `apps/api/prisma/seed.ts`（`seedOAuthClients()`，在 `main()` 调用）
  - `apps/api/scripts/seed-oauth-clients.ts`（独立可执行 seed）

现有 client：`agents-dofe-ai`、`models-dofe-ai`。命名约定：`<product-slug>-dofe-ai`；secret 环境变量 `SSO_CLIENT_SECRET_<UPPER_SLUG>`。

## 3. 改动：新增 `vibecoding-dofe-ai`

### 3.1 `SECRET_ENV_MAP` 增加映射

```ts
// apps/api/scripts/oauth-clients.config.ts
export const SECRET_ENV_MAP: Record<string, string> = {
  'agents-dofe-ai': 'SSO_CLIENT_SECRET_AGENTS',
  'models-dofe-ai': 'SSO_CLIENT_SECRET_MODELS',
  'vibecoding-dofe-ai': 'SSO_CLIENT_SECRET_VIBECODING', // ← 新增
};
```

### 3.2 `INITIAL_OAUTH_CLIENTS` 增加记录

```ts
{
  clientId: 'vibecoding-dofe-ai',
  clientName: 'Vibecoding 平台',
  redirectUris: [
    // 生产
    'https://vibecoding.dofe.ai/auth/callback',
    'https://vibecoding.dofe.ai/auth/oidc/callback',
    'https://vibecoding.dofe.ai/login',
    // 预发 / test（用户指定）
    'https://vibecoding.test.dofe.ai/auth/callback',
    'https://vibecoding.test.dofe.ai/auth/oidc/callback',
    'https://vibecoding.test.dofe.ai/login',
    // 本地 web :3003（用户指定）
    'http://127.0.0.1:3003/auth/callback',
    'http://127.0.0.1:3003/auth/oidc/callback',
    'http://127.0.0.1:3003/login',
    // 本地 api :13100（OIDC callback 实际由 api 处理）
    'http://127.0.0.1:13100/auth/oidc/callback',
  ],
  grantTypes: ['authorization_code', 'refresh_token'],
  scopes: ['openid', 'profile', 'email', 'tenant', 'offline_access'],
  isConfidential: true,
  // 可选：仅当 vibecoding 实现 /internal/sso/outbox-alerts 端点时启用
  opsConfig: {
    outboxAlertWebhook: {
      enabled: true,
      url: 'http://127.0.0.1:13100/internal/sso/outbox-alerts',
      minIntervalSeconds: 300,
    },
  },
},
```

> 说明：
>
> - OIDC callback 由 **api** 处理（`/auth/oidc/callback`），故必须含 api 端口 `13100` 的回调；web 端口 `3003` 的各回调用于前端转发路由与 login 页。
> - `outboxAlertWebhook.url` 用 vibecoding api 端口 13100（对齐 models=3101/agents=3102）。若 vibecoding 暂未实现该端点，置 `enabled: false` 或移除 `opsConfig`。

### 3.3 颁发凭证

- 生成 `SSO_CLIENT_SECRET_VIBECODING` 强随机值，写入 sso 运行环境（与 `SSO_CLIENT_SECRET_AGENTS/MODELS` 同处保管），并同步给 vibecoding `apps/api/.env` 的 `SSO_CLIENT_SECRET`。
- 生成/确认 `INTERNAL_API_SECRET`（服务间 `verify-token` 鉴权），同步给 vibecoding `apps/api/.env`。

### 3.4 执行 seed

```bash
# 方式 A：独立 seed 脚本
cd apps/api
dotenv -e .env -- npx ts-node scripts/seed-oauth-clients.ts

# 方式 B：主 prisma seed（会一并跑其他 seed）
pnpm db:seed
```

## 4. 验证

- seed 后查询：`SELECT client_id, redirect_uris FROM t_oauth_client WHERE client_id='vibecoding-dofe-ai';` 命中且字段正确。
- 在 vibecoding 发起 `/auth/oidc/authorize` → 跳转 sso 不报 `invalid redirect_uri`。
- 回调 `http://127.0.0.1:13100/auth/oidc/callback` 被 sso 接受。
