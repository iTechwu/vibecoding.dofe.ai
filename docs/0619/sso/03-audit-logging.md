# 03 · 审计日志集成方案

> **已实施**：vibecoding 与 scaffold 均采用本篇修正后的 models 模式，即本地 `audit_logs` + `AuditLogService` 业务主动调用，不挂全局拦截器。验证记录见 [09-implementation-status.md](./09-implementation-status.md)。

> ⚠️ **方向修正（重要）**：初版误用 sso.dofe.ai 的全局拦截器方案（`AuditLogInterceptor` + `OPERATE_LOG_SERVICE_TOKEN`）。
> 经核实 `models.dofe.ai`（用户指定的参考样板），**models 采用「业务主动调用」模式**：本地 `audit_logs` 表 + `AuditLogService` 便捷方法，业务代码按需调用，**不挂全局拦截器**。本篇以 models 为准。

## 1. 对齐 models 的设计

| 维度            | models（采用）                                                                      | sso（不采用）                                            |
| --------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 表名            | `audit_logs`                                                                        | `t_audit_log`                                            |
| 枚举            | `AuditActionType`（CREATE/UPDATE/DELETE/LOGIN/LOGOUT/ACCESS/EXPORT/IMPORT，8 值）   | `AuditLogAction`（50+ 细粒度）                           |
| 触发机制        | **业务主动调用** `AuditLogService.logCreate/logUpdate/logDelete/logLogin/logExport` | 全局 `AuditLogInterceptor` + `OPERATE_LOG_SERVICE_TOKEN` |
| app.module 装配 | 不注册审计 provider；业务模块按需 `import AuditLogModule`                           | 注册 `APP_INTERCEPTOR` + token                           |
| 位置            | `libs/domain/audit-log/`                                                            | `libs/domain/services/src/audit/`                        |

> models 的 `AuditLogService` 只依赖 generated `@app/db/audit-log` 的 `create/list`（无 `groupByAction`），与本项目 generate 模板完全兼容。

## 2. Prisma schema（已落地）

vibecoding 与 scaffold 的 `apps/api/prisma/schema.prisma` 末尾已新增（取自 models）：

- `model AuditLog`（表 `audit_logs`）：`id / action(AuditActionType) / resource / resourceId / actorType / actorId / teamId / changes(Json) / metadata(Json) / status / errorMsg / ipAddress / userAgent / createdAt` + 索引。
- `enum AuditActionType`（`@@map("audit_action_type")`）：CREATE/UPDATE/DELETE/LOGIN/LOGOUT/ACCESS/EXPORT/IMPORT。

> 实施：`pnpm db:migrate:dev --name add_audit_log_and_sso_sub` → `pnpm db:generate`（产生 `@app/db` 的 `AuditLogModule`/`AuditLogService`，含 `create/list`）。

## 3. 复制审计层（models → 本项目）

从 models 复制到本项目 `apps/api/libs/domain/audit-log/`（与 models 同路径，便于后续对齐）：

| models 源文件                                | 目标 | 说明                                                                         |
| -------------------------------------------- | ---- | ---------------------------------------------------------------------------- |
| `libs/domain/audit-log/audit-log.module.ts`  | 同名 | imports `AuditLogDbModule`（`@app/db`），providers/exports `AuditLogService` |
| `libs/domain/audit-log/audit-log.service.ts` | 同名 | `create/query/logCreate/logUpdate/logDelete/logLogin/logExport`              |
| `libs/domain/audit-log/index.ts`             | 同名 | barrel 导出                                                                  |

**import 路径适配**：models 用 `@app/db/audit-log` 子路径；本项目 generated/db 为 barrel，改用 `@app/db`：

```ts
// audit-log.module.ts / audit-log.service.ts
import { AuditLogModule as AuditLogDbModule } from '@app/db';
import { AuditLogService as AuditLogDbService } from '@app/db';
```

## 4. 装配与使用（业务主动调用）

- **不**在 `app.module.ts` 注册任何审计 provider（无 `APP_INTERCEPTOR`、无 `OPERATE_LOG_SERVICE_TOKEN`）。
- 需要审计的业务模块 `imports: [AuditLogModule]`，注入 `AuditLogService`，在关键操作处主动记录：

```ts
// 示例：业务模块内
constructor(private readonly audit: AuditLogService) {}

async createApiKey(actorId: string, req: FastifyRequest) {
  const apiKey = await this.repo.create(...);
  await this.audit.logCreate('api_key', apiKey.id, 'user', actorId, undefined, apiKey, undefined, req.ip);
  return apiKey;
}
```

> 登录事件（`logLogin`）由 SSO 登录回调（阶段 3 `oidc-client-api`）触发时记录。

## 5. 验证

- `pnpm db:generate` 产出 `AuditLogModule/AuditLogService`（`@app/db`）。
- `pnpm type-check`：审计层无错误（仅依赖 `create/list`，与 generate 模板兼容）。
- 在一个业务写操作中调用 `audit.logCreate(...)` → `audit_logs` 表产生记录（action/resource/actorId/changes 齐全）。
- 单测：`AuditLogService.create` 的 DTO→PrismaInput 转换（mock `AuditLogDbService`）。
