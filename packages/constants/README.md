# @repo/constants - 共享常量

> Migration note (2026-06-26): this package is a legacy local package. Shared
> infrastructure constants should be imported directly from
> `@dofe/infra-contracts`; SSO token/OIDC constants should be imported directly
> from the published `@dofe/sso-contracts/token` subpath. Do not add
> new cross-project constants here.

前后端共享的常量定义（legacy/local-only）。

## 安装

```json
{
  "dependencies": {
    "@repo/constants": "workspace:*"
  }
}
```

## 使用

```typescript
import { PAGINATION, CURRENT_TENANT_HEADER } from '@dofe/infra-contracts';
```

## 实际导出

| 常量                    | 说明             |
| ----------------------- | ---------------- |
| `HTTP_STATUS`           | HTTP 状态码      |
| `API_CODE`              | API 业务状态码   |
| `PAGINATION`            | 分页默认值       |
| `FILE_LIMITS`           | 文件上传限制     |
| `AUTH_KEYS`             | 认证相关 key     |
| `DATE_FORMAT`           | 日期格式         |
| `API_VERSION`           | API 版本相关常量 |
| `API_GENERATION`        | 当前 API 代际号  |
| `MIN_CLIENT_GENERATION` | 最低客户端代际号 |

## 使用规范

- 使用 `as const` 确保类型推断为字面量类型
- 常量名使用 UPPER_SNAKE_CASE
- 导出对应的 TypeScript 类型

```typescript
export const STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const;

export type Status = (typeof STATUS)[keyof typeof STATUS];
```
