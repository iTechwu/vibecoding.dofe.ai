# 04 · 文件管理方案（以 sso 为唯一源）

> 原则：文件能力权威源 = sso.dofe.ai。vibecoding 作为**消费方**，通过 `@dofe/file-sdk` 调用 sso，不复制 sso 的文件业务模块。

## 1. 方案选择：`@dofe/file-sdk` 消费模式

| 选项                                                  | 取舍                                                      | 结论      |
| ----------------------------------------------------- | --------------------------------------------------------- | --------- |
| **A. `@dofe/file-sdk` 消费**（推荐）                  | HTTP 调用 sso 文件服务（上传/CDN URL/元数据），零业务耦合 | ✅ 采用   |
| B. 复制 sso `FileDomainModule`/`file-api`/`cdn-proxy` | 引入 tenant/team 多租户耦合，重复维护                     | ❌ 不采用 |

`@dofe/file-sdk`（源码 `sso.dofe.ai/packages/file-sdk-node`，npm `@dofe/file-sdk`）通过 HTTP 调用 sso：上传、获取 CDN URL、查询文件元数据。前端可用对应 `@dofe/file-sdk-web`。

> 注：vibecoding 已有 `FileSource` 表与 `@app/db` 的 `FileSourceModule`，作为**本地文件元数据缓存**可保留；但上传/存储/CDN 的权威在 sso。

## 2. 修复既有 Bug：FileCdn 导入包名

`pnpm type-check` 失败的直接原因。纯改 import，零复制：

| 文件                                               | 当前（错误）                                           | 修正                                 |
| -------------------------------------------------- | ------------------------------------------------------ | ------------------------------------ |
| `apps/api/libs/domain/auth/src/auth.module.ts:12`  | `import { FileCdnModule } from '@dofe/infra-clients';` | `from '@dofe/infra-shared-services'` |
| `apps/api/libs/domain/auth/src/auth.service.ts:12` | `import { FileCdnClient } from '@dofe/infra-clients';` | `from '@dofe/infra-shared-services'` |

> `@dofe/infra-clients` 仅导出 storage client（`FileGcsClient`/`FileS3Client`/`DoFeUploader` 等）；`FileCdnModule`/`FileCdnClient` 位于 `@dofe/infra-shared-services`。

## 3. `@dofe/file-sdk` 接入要点

### 3.1 依赖

```jsonc
// apps/api/package.json
"@dofe/file-sdk": "^0.1.7"
// apps/web/package.json（前端上传，按需）
"@dofe/file-sdk-web": "^0.1.7"
```

### 3.2 后端 Client 封装（建议）

在 `apps/api/libs/infra/clients/internal/file-client/`（或 `libs/domain/services/src/file/`）封装一层 `FileSdkClient`，注入 sso base url 与服务间凭证，提供：

- `upload(file, meta)` → 调用 sso 上传，返回 `fileId` + CDN URL。
- `getCdnUrl(fileId)` / `getMeta(fileId)`。
- 遵循 CLAUDE.md「Rule 3：外部服务调用必须在 Client 层、用 `@nestjs/axios`」（若 file-sdk 内部已封装 HTTP，则 Client 层仅做注入与转发）。

### 3.3 与现有 `UploaderModule` 的取舍

vibecoding 现有 `apps/api/src/modules/uploader/`（已在 `app.module.ts` 加载）。两条路径，按阶段选：

- **短期（阶段 5a）**：保留 `UploaderModule` 作为本地直传入口，但其 Service 内部改为调用 `FileSdkClient`（转发到 sso），实现「入口不变、后端切到 sso」。
- **长期（阶段 5b）**：前端改用 `@dofe/file-sdk-web` 直连 sso（带临时凭证），下线 vibecoding 自有 uploader controller。

> 推荐：先 5a（最小破坏），验证 sso 文件链路稳定后再评估 5b。

## 4. 验证

- 修复 import bug 后：`pnpm type-check` 通过（`FileCdnModule/FileCdnClient` 错误消失）。
- 接入 file-sdk 后：上传一个文件 → 确认文件落在 sso 存储、返回的 CDN URL 可访问、vibecoding `FileSource` 缓存记录一致。
- 单测：`FileSdkClient` 的 HTTP 转发逻辑（mock sso 响应）。
