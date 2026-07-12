# SSO scope 契约审查（Cycle 12）

直接审查已消费 SDK 得出的结论，替代早期 Cycle 1 对"SSO 阻塞"的推断。

**审查对象**：`@dofe/sso-nestjs@0.1.67`、`@dofe/sso-node`、`@dofe/sso-contracts/token`
（位于 `apps/api/node_modules/@dofe/sso-*`）。

## 1. AuthGuard 注入的 request 字段

`DofeSsoAuthGuardBase`（SDK base，本项目 `AuthGuard` 继承它）在 `canActivate` 末尾只设置：

- `req.ssoSub` — SSO subject（token 验签后的 userId）
- `req.userId` — 本地解析的用户 id
- `req.isAdmin` — **SSO super admin 标记**（来自 `hooks.resolveIsAdmin(localUser, claims)`）
- `req.authClaims` — 解码后的 JWT claims
- `req.userInfo` — `{ id, nickname, code, headerImg, sex, isAdmin, isAnonymity }`

**不注入** `req.tenantId` / `req.teamId`（`fastify.d.ts` 中它们是 optional，当前没有任何
middleware/guard 设置它们）。因此 tenant/team 不能从 request 直接取，必须由服务端用 SSO API 解析。

## 2. SsoClientService / SsoInternalClient 能力

`SsoClientService`（`@dofe/sso-nestjs`）封装 `client: SsoInternalClient`，关键能力：

| 能力                 | API                                                             | 说明                          |
| -------------------- | --------------------------------------------------------------- | ----------------------------- |
| 用户所有 tenant      | `client.users.getTenants(id)` → `UserTenant[]`                  | 成员 tenant 列表              |
| 用户所有 team        | `client.users.getTeams(id)` → `UserTeam[]`                      | 成员 team 列表                |
| **当前 tenant 偏好** | `client.users.getTenantPreference(id)` → `UserTenantPreference` | SSO 维护的权威 current tenant |
| 更新 tenant 偏好     | `client.users.updateTenantPreference(id, body)`                 | 切换 tenant 后写入            |
| 按团队权限           | `getUserPermissions(userId, teamId?)` / `checkPermission(...)`  | 模块/资源权限                 |
| tenant 成员校验      | `isTenantMember(tenantId, userId)` / `getUserTenantRole(...)`   | 归属断言                      |
| team 成员校验        | `isTeamMember(teamId, userId)` / `getUserTeamRole(...)`         | 归属断言                      |

`UserTenantPreference = { userId, lastTenantId: string | null, tenantOrder?: string[], updatedAt }`
—— **只含 tenant，不含 team**。

## 3. 结论：剩余项的真实阻塞状态

| 原判断（Final Review Cycle 11）                                | 实际状态（Cycle 12 审查）                                                                        |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 跨 tenant 显式管理员能力「受 SSO global-admin scope 契约阻塞」 | **阻塞已解除**：`req.isAdmin` 即 SSO super admin，已由 guard 注入                                |
| current-tenant 需 SSO 发布契约                                 | **已具备**：`getTenantPreference(userId).lastTenantId` 是权威 current tenant，比客户端候选更可信 |
| current-team 选择受 SSO 契约阻塞                               | **确认阻塞**：SSO 无 team preference / token claim，只有 team 列表；Loop 只能用 tenant scope     |

## 4. 对后续实施的影响

- **current-TENANT 解析升级**：`SsoScopeService` 优先用 `getTenantPreference`（唯一源），
  客户端候选仅在 SSO 无 preference 时 fallback，并始终用 `getTenants` 验证成员关系。
- **current-TEAM**：保持 `teamId` NULL（Cycle 6-10 已如此）。team 投影/过滤需等 SSO 增加
  team preference 契约；在此之前不依赖 team 做授权。
- **跨 tenant 管理端点（Cycle 14）**：用 `req.isAdmin` 保护，配合目标 tenant 校验与审计。
- **历史 NULL 回填（Cycle 13）**：用 issue 创建者（`submitterId` → SSO `getTenants` /
  `getTenantPreference`）映射出归属 tenant；无法映射的行标记为待处理，不归入任何 tenant。
