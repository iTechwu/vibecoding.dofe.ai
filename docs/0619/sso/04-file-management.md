# 04 · 文件管理方案（以 sso 为唯一真源）

> **已实施修正**：本地 `FileSource` 与 `UploaderModule` 已删除；文件元数据和上传均以 `sso.dofe.ai` 为唯一真源，通过 `@dofe/file-sdk` / `@dofe/file-sdk-web` 消费。准确状态见 [09-implementation-status.md](./09-implementation-status.md)。

> 原则：文件能力权威源 = sso.dofe.ai。vibecoding 作为**消费方**，通过 `@dofe/file-sdk` 调用 sso，不复制 sso 的文件业务模块。

## 1. 方案选择：`@dofe/file-sdk` 消费模式

| 选项                                                  | 取舍                                                      | 结论      |
| ----------------------------------------------------- | --------------------------------------------------------- | --------- |
| **A. `@dofe/file-sdk` 消费**（推荐）                  | HTTP 调用 sso 文件服务（上传/CDN URL/元数据），零业务耦合 | ✅ 采用   |
| B. 复制 sso `FileDomainModule`/`file-api`/`cdn-proxy` | 引入 tenant/team 多租户耦合，重复维护                     | ❌ 不采用 |

`@dofe/file-sdk`（源码 `sso.dofe.ai/packages/file-sdk-node`，npm `@dofe/file-sdk`）通过 HTTP 调用 sso：获取 CDN URL、查询文件元数据等。前端上传使用对应 `@dofe/file-sdk-web`。

> 实施结论：不保留 vibecoding/scaffold 本地 `FileSource` 作为缓存源；`avatarFileId` 仅保存 SSO file id 引用。文件元数据、上传、存储与 CDN 均以 `sso.dofe.ai` 为唯一真源。

## 2. 已废弃的本地文件入口

实施后已删除：

- `apps/api/src/modules/uploader/`
- `FileSource` / `FileBucketVendor` / `FileEnvType`
- generated DB 中的 `file-source` 模块
- `packages/contracts` 中旧本地 `/uploader` contract/schema
- API 限流白名单中的 `/uploader/token/*` 历史路径
- 旧 `FileCdnModule` / `FileCdnClient` 依赖路径

早期方案中“短期保留 `UploaderModule` 并内部转发”的 5a 路线已不再采用；最终状态直接对齐 `models.dofe.ai` 与用户要求：客户端项目只消费 SSO 文件能力，不承载文件源。

## 3. `@dofe/file-sdk` 接入要点

### 3.1 依赖

```jsonc
// apps/api/package.json
"@dofe/file-sdk": "^0.1.7"
// apps/web/package.json（前端上传，按需）
"@dofe/file-sdk-web": "^0.1.7"
```

### 3.2 后端消费方式

后端只在需要展示/解析文件时消费 `@dofe/file-sdk`，典型场景是通过 SSO file id 获取头像/CDN URL。服务层不直接访问外部 HTTP，遵循项目“外部服务调用通过 Client/SDK 层”的约束。

### 3.3 前端上传方式

前端使用 `@dofe/file-sdk-web`：

```ts
new FileUploader({ apiBase: '/api/proxy/sso' });
```

`apps/web/next.config.ts` 提供统一 rewrite：

```ts
{
  source: '/api/proxy/sso/:path*',
  destination: `${process.env.NEXT_PUBLIC_SSO_BASE_URL || 'https://sso.dofe.ai'}/:path*`,
}
```

`@dofe/file-sdk-web` 会自行拼接 `/api/uploader/*`，因此 rewrite 不应额外追加 `/api`。同一修正已同步到 `scaffold.dofe.ai`。Next 图片白名单也已补充 `*.dofe.ai`，以支持 SSO/CDN 返回的图片地址。

## 4. 验证

- `pnpm --filter @repo/api type-check` 通过。
- `pnpm --filter @repo/web type-check` 通过。
- 深审修复后需确认 `/api/proxy/sso/:path*` 可转发到 `${NEXT_PUBLIC_SSO_BASE_URL}/:path*`，并由 SDK 命中 SSO `/api/uploader/*`。
- 端到端上传验证需要可用的 SSO 服务、client secret、`INTERNAL_API_SECRET`、Redis 与数据库；未在本轮本地执行。
