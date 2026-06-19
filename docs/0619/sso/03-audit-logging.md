# 03 · 审计日志集成方案

> 引入 sso.dofe.ai 同款审计日志能力：基于 `@dofe/infra-common` 的拦截器 + token，复制 sso 的业务适配层并建表。

## 1. 分层架构

| 层                             | 来源                                        | 角色                                                                     |
| ------------------------------ | ------------------------------------------- | ------------------------------------------------------------------------ |
| 拦截器 + DI Token + 接口       | `@dofe/infra-common`（已依赖，import 即可） | `AuditLogInterceptor`、`OPERATE_LOG_SERVICE_TOKEN`、`IOperateLogService` |
| 业务适配 + AuditService + 落库 | 复制 sso 私有源码                           | 把拦截器输出翻译成 vibecoding 的 `AuditLog` 表                           |

`AuditLogInterceptor` 构造时 `@Inject(OPERATE_LOG_SERVICE_TOKEN)`；通过 `{ provide: OPERATE_LOG_SERVICE_TOKEN, useExisting: OperateLogAdapterService }` 指向 vibecoding 的适配实现。

## 2. 复制源文件清单（sso → vibecoding）

从 sso 复制到 vibecoding `apps/api/libs/domain/services/src/audit/`：

| sso 源文件                                                      | vibecoding 目标 | 说明                                                                                  |
| --------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------- |
| `libs/domain/services/src/audit/operate-log-adapter.service.ts` | 同名            | 翻译拦截器 payload → `AuditLogCreateInput`                                            |
| `libs/domain/services/src/audit/audit.service.ts`               | 同名            | 业务便捷封装（`logAuthEvent` 等）                                                     |
| `libs/domain/services/src/audit/audit.module.ts`                | 同名            | imports `AuditLogModule`（`@app/db`），导出 `AuditService`+`OperateLogAdapterService` |

并在 `apps/api/libs/domain/services/src/index.ts` 增加导出：

```ts
export * from './audit/audit.module';
export * from './audit/audit.service';
export * from './audit/operate-log-adapter.service';
```

> `OperateLogAdapterService` 依赖 `AuditLogService`（来自 `@app/db`，由下方 schema 经 prisma generate 产生）与 `WINSTON_MODULE_PROVIDER`。

## 3. Prisma schema（新增表）

将 sso `apps/api/prisma/schema.prisma` 中的 `model AuditLog`（表 `t_audit_log`）与 `enum AuditLogAction`（`@@map("audit_log_action")`）复制到 vibecoding `schema.prisma`。字段（来自 sso）：

| 字段        | 类型                                   | 映射                 |
| ----------- | -------------------------------------- | -------------------- |
| `id`        | String @id Uuid                        | `uuid_generate_v4()` |
| `action`    | AuditLogAction                         | 枚举                 |
| `actorId`   | String? Uuid                           | `actor_id`           |
| `targetId`  | String? Uuid                           | `target_id`          |
| `tenantId`  | String? Uuid                           | `tenant_id`          |
| `clientId`  | String? Varchar(255)                   | `client_id`          |
| `ipAddress` | String? Varchar(45)                    | `ip_address`         |
| `userAgent` | String? Text                           | `user_agent`         |
| `metadata`  | Json?                                  | `metadata`           |
| `status`    | String Varchar(20) default `'success'` | `status`             |
| `message`   | String? Text                           | `message`            |
| `createdAt` | DateTime Timestamptz default now()     | `created_at`         |

> 实施：`pnpm db:migrate:dev --name add_audit_log` → `pnpm db:generate`（产生 `@app/db` 的 `AuditLogModule`/`AuditLogService`）。`AuditLogAction` 枚举值与 sso 保持一致。

## 4. 装配

### 4.1 bootstrap（`apps/api/src/bootstrap/app-module-imports.bootstrap.ts`）

`createAppModuleImports()` 的 imports 数组中，在 `BullModule` 之后、`IpInfoServiceModule` 之前加入 `AuditModule`（与 sso 顺序一致）：

```ts
import { AuditModule } from '@app/services';
// ...
BullModule.forRootAsync({...}),
AuditModule,          // ← 新增
IpInfoServiceModule,
```

### 4.2 app.module.ts providers

```ts
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditLogInterceptor, OPERATE_LOG_SERVICE_TOKEN } from '@dofe/infra-common';
import { OperateLogAdapterService } from '@app/services';

providers: [
  { provide: APP_FILTER, useClass: HttpExceptionFilter },
  { provide: OPERATE_LOG_SERVICE_TOKEN, useExisting: OperateLogAdapterService }, // ← 新增
  { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },                   // ← 新增
],
```

## 5. 验证

- `pnpm type-check`（应消除既有 `FileCdnModule` 相关错误，且不引入新错误）。
- `pnpm dev:api` 启动，访问任一受保护写接口 → 检查 `t_audit_log` 是否产生记录（action/actorId/ipAddress/metadata 齐全）。
- 单测：对 `OperateLogAdapterService.create` 写转换逻辑测试（mock `AuditLogService`）。
