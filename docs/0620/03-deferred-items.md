# 后置项实施拆解

## v1.1 · 身份与权限

| 项                  | 当前状态 | 下一步                                                       |
| ------------------- | -------- | ------------------------------------------------------------ |
| Dofe SSO 登录       | done     | `docs/0619/sso` 为唯一真源；本地真实 SSO 浏览器 E2E 已通过   |
| 用户角色/权限       | done     | Loops 最小 RBAC 已实现并通过 round 2 回归                    |
| 真实 SSO 浏览器 E2E | done     | 本地 `sso.dofe.ai` + vibecoding 联调环境已通过 round 14 验收 |

### RBAC 最小方案

建议权限：

| 权限            | 范围                                                    |
| --------------- | ------------------------------------------------------- |
| `loops:read`    | 查看列表、详情、日志、通知、成本                        |
| `loops:create`  | 创建 issue                                              |
| `loops:operate` | generate/review/decompose/run/reloop/finalize/intervene |
| `loops:admin`   | doctor/resume/管理类操作                                |

端点分组：

- 只读：`list`、`getIssue`、`logs`、`notifications`、`cost`
- 创建：`createIssue`
- 操作：`generateSpec`、`reviewSpec`、`decompose`、`runShardTests`、`recordShardImplementation`、`reviewShard`、`runLoop`、`reviewGlobal`、`reloop`、`finalize`、`intervene`
- 管理：`doctor`、`resume`

验收：

- 无 token：401 或现有 AuthGuard 标准错误。
- 无权限：由全局 `PermissionGuard` 通过 SSO Internal API 判定，已由 `permission.guard.spec.ts` 覆盖。
- 有权限：管理员、非生产 `MODE_USER_ID`、allowlist 用户均已覆盖。
- CLI 直调不受 HTTP RBAC 影响，`LoopsService` smoke 继续通过。

实施文件：

- `apps/api/src/modules/loops/loops-rbac.decorator.ts`
- `apps/api/libs/domain/auth/src/sso-permission.client.ts`
- `apps/api/libs/domain/auth/src/permission.service.ts`
- `apps/api/libs/domain/auth/src/guards/permission.guard.ts`
- `apps/api/libs/domain/auth/src/guards/permission.guard.spec.ts`
- `apps/api/src/modules/loops/loops.controller.ts`
- `apps/api/src/modules/loops/loops.module.ts`

当前权限来源：

- `sso.dofe.ai` Internal API：`GET /internal/permissions/check`，权限字符串为 `vibecoding:loops:<action>`。
- `request.isAdmin` / `request.userInfo.isAdmin` 只作为 SSO 同步镜像的超级管理员短路。
- 本项目不再维护本地 Loops allowlist 权限源。

round 2 回归：

- `pnpm --filter @repo/api exec jest src/modules/loops --runInBand`
- `pnpm --filter @repo/api exec jest src/bootstrap/i18n.bootstrap.spec.ts --runInBand`
- `pnpm --filter @repo/api type-check`
- `pnpm quality:gate`
- `pnpm loops:doctor`
- `pnpm loops:db-doctor`

### 真实 SSO 浏览器 E2E 验收

round 14 已用真实本地联调环境完成：

- SSO API：`http://127.0.0.1:3100`
- SSO Web：`http://127.0.0.1:3000`
- vibecoding API：`http://127.0.0.1:13100`
- vibecoding Web：`http://127.0.0.1:3003`

执行结果：

- `SSO_E2E_ENABLED=1 E2E_SSO_MOBILE=<test-mobile> E2E_SSO_PASSWORD=<password> E2E_SSO_ORIGIN=http://127.0.0.1:3100 E2E_SSO_LOGIN_ORIGIN=http://127.0.0.1:3000 E2E_API_ORIGIN=http://127.0.0.1:13100 pnpm --filter @repo/web test:e2e:sso`：通过（Chromium，1 passed）。

覆盖：

- 登录页跳转 `sso.dofe.ai` OIDC。
- OIDC callback/exchange 后写入 access token。
- `/auth/oidc/token` refresh 不返回 refresh token。
- `/api/proxy/sso/api/uploader/token/private` 可从 SSO 返回上传 token、`fileId`、`key`、`bucket=dofe-public`、`cdnUrl`。
- logout + clear-session 后 refresh 失败。

边界：

- 生产域名、生产 SSO secret、生产测试账号策略仍需在对应环境重新验收。
- 本轮不校验对象存储预签名 PUT 与 CDN GET。

## v1.2 · 飞书与测试矩阵

| 项                  | 当前状态 | 下一步                                                                          |
| ------------------- | -------- | ------------------------------------------------------------------------------- |
| 飞书 Issue 入口     | blocked  | 缺 Feishu payload 样例、签名配置和应用凭据                                      |
| 飞书审批卡片        | blocked  | 缺审批按钮、状态机、幂等策略和用户映射决策                                      |
| 飞书反向通知        | partial  | webhook sender 已支持 Feishu URL/token；缺真实应用凭据、通知目标和重试/死信策略 |
| 完整 E2E/build 矩阵 | done     | 已新增 `pnpm regression:docs0620` 并接入 CI Loops 回归                          |

### 飞书入口拆解

1. 新增 Feishu webhook/controller，需签名校验。
2. payload 归一化到 Loops intake。
3. submitter 映射到 SSO 用户或外部用户标识。
4. 失败时写 intake raw payload，避免丢请求。

### 审批卡片拆解

1. 明确卡片按钮：approve / request changes / reject / intervene。
2. 映射 Loops 状态机。
3. 防重复点击，要求幂等。
4. 审批结果回写 `.loops/reviews` 与 DB index。

### 反向通知拆解

1. 先从 `.loops/notifications` 读取待发送记录。
2. 增加发送状态：pending / sent / failed / retrying。
3. 接入 Feishu client。
4. doctor 增加通知发送一致性检查。

### E2E/build 矩阵实施结果

round 3 已完成非真实 SSO 范围的矩阵固化：

- `scripts/docs0620-regression.sh`
- `package.json` 的 `regression:docs0620`
- `.github/workflows/ci.yml` 的 Loops Jest + doctor/db-doctor

真实 SSO 浏览器 E2E 已在 round 14 本地真实联调环境通过；生产/测试环境验收仍按各环境凭据另行执行。

解除 blocked 需要的外部输入统一见 [05-blockers.md](05-blockers.md)。

## v1.3 · 远端协作与执行能力

| 项                | 当前状态 | 下一步                                                             |
| ----------------- | -------- | ------------------------------------------------------------------ |
| 真实远端 PR 打开  | partial  | GitHub/GitLab/Gitea provider client 已落地；缺真实 token/仓库验收  |
| 多 Loop 并行队列  | partial  | 同进程 issue/repo 写锁已落地；缺跨进程队列、幂等和部署拓扑确认     |
| 独立 worker 池    | blocked  | 缺 worker 运行边界、队列协议和资源隔离方案                         |
| 生产级 agent 告警 | partial  | notification webhook sender 已落地；缺真实告警通道、SLO 和升级策略 |

### 真实 PR 能力

最小实现：

- provider client 层封装 GitHub/GitLab/Gitea：已完成，配置项为 `LOOPS_PR_PROVIDER`、`LOOPS_PR_API_BASE_URL`、`LOOPS_PR_REPOSITORY`、`LOOPS_PR_TOKEN`、`LOOPS_PR_REPOSITORY_ALLOWLIST`。
- `GitAdapter` 从 convergence PR record 真实创建 PR：已完成；push 后 provider 成功返回 `OPENED + provider + url`，失败时保留 `PUSHED/DRAFT` 本地 record。
- repo allowlist：已完成 `LOOPS_PR_REPOSITORY_ALLOWLIST`；branch sanitizer 仍沿用 `loops/<issue-id>` 受 issue id 生成规则约束。
- 失败时保留本地 record，不影响 CLOSED 判定：已完成。

### 多 Loop 并行

必须先解决：

- 同一 repo 的写锁：同进程已完成，`LoopsWorkLockService` 对 `repo:<targetRepo>` 加锁。
- 同一 issue 的幂等锁：同进程已完成，`LoopsWorkLockService` 对 `issue:<issueId>` 加锁。
- agent 资源限流。
- DB/file 双写一致性。

## 生产化额外项

| 项                               | 当前状态 | 下一步                                                                |
| -------------------------------- | -------- | --------------------------------------------------------------------- |
| 真实 Codex / Claude CLI 生产可用 | blocked  | 缺生产 CLI 版本、权限、超时、重试和沙箱策略                           |
| 真实 diff 自动回收               | blocked  | 缺真实 changedFiles 来源确认；PR provider 已支持真实远端打开          |
| 成本真实统计与外部告警           | partial  | webhook 告警发送已落地；缺真实 token 计量来源、成本口径和真实通道验收 |

### 最小验收

- 真实 CLI 在目标仓库跑通一个完整 Loop。
- changedFiles 不再依赖人工或 adapter 伪数据。
- token/call cap 触发时有清晰状态、日志和告警。
