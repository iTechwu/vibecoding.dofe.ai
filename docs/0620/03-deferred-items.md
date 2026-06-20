# 后置项实施拆解

## v1.1 · 身份与权限

| 项                  | 当前状态 | 下一步                                                        |
| ------------------- | -------- | ------------------------------------------------------------- |
| Dofe SSO 登录       | blocked  | `docs/0619/sso` 为唯一真源；本目录仅等待真实 SSO E2E 环境输入 |
| 用户角色/权限       | done     | Loops 最小 RBAC 已实现并通过 round 2 回归                     |
| 真实 SSO 浏览器 E2E | blocked  | 缺真实 SSO client secret、测试账号和可启动联调环境            |

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
- 无权限：403，已由 `loops-rbac.guard.spec.ts` 覆盖。
- 有权限：管理员、非生产 `MODE_USER_ID`、allowlist 用户均已覆盖。
- CLI 直调不受 HTTP RBAC 影响，`LoopsService` smoke 继续通过。

实施文件：

- `apps/api/src/modules/loops/loops-rbac.decorator.ts`
- `apps/api/src/modules/loops/loops-rbac.guard.ts`
- `apps/api/src/modules/loops/loops-rbac.guard.spec.ts`
- `apps/api/src/modules/loops/loops.controller.ts`
- `apps/api/src/modules/loops/loops.module.ts`

当前权限来源：

- `request.userInfo.isAdmin`：全部 Loops 权限。
- 非生产 `MODE_USER_ID`：本地开发 bypass，生产环境不得使用。
- `LOOPS_RBAC_READ_USER_IDS` / `LOOPS_RBAC_CREATE_USER_IDS` / `LOOPS_RBAC_OPERATE_USER_IDS` / `LOOPS_RBAC_ADMIN_USER_IDS`：逗号分隔用户 ID allowlist。

round 2 回归：

- `pnpm --filter @repo/api exec jest src/modules/loops --runInBand`
- `pnpm --filter @repo/api exec jest src/bootstrap/i18n.bootstrap.spec.ts --runInBand`
- `pnpm --filter @repo/api type-check`
- `pnpm quality:gate`
- `pnpm loops:doctor`
- `pnpm loops:db-doctor`

## v1.2 · 飞书与测试矩阵

| 项                  | 当前状态 | 下一步                                                 |
| ------------------- | -------- | ------------------------------------------------------ |
| 飞书 Issue 入口     | blocked  | 缺 Feishu payload 样例、签名配置和应用凭据             |
| 飞书审批卡片        | blocked  | 缺审批按钮、状态机、幂等策略和用户映射决策             |
| 飞书反向通知        | blocked  | 缺 Feishu 发送 client 配置、通知目标和重试策略         |
| 完整 E2E/build 矩阵 | done     | 已新增 `pnpm regression:docs0620` 并接入 CI Loops 回归 |

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

真实 SSO 浏览器 E2E 仍因 B3 外部环境缺失保持 blocked。

解除 blocked 需要的外部输入统一见 [05-blockers.md](05-blockers.md)。

## v1.3 · 远端协作与执行能力

| 项                | 当前状态 | 下一步                                                 |
| ----------------- | -------- | ------------------------------------------------------ |
| 真实远端 PR 打开  | blocked  | 缺 git provider、token 管理、repo allowlist 与权限模型 |
| 多 Loop 并行队列  | blocked  | 缺队列、锁、幂等、并发限流和部署拓扑确认               |
| 独立 worker 池    | blocked  | 缺 worker 运行边界、队列协议和资源隔离方案             |
| 生产级 agent 告警 | blocked  | 缺告警通道、指标口径、SLO 和升级策略                   |

### 真实 PR 能力

最小实现：

- provider client 层封装 GitHub/GitLab/Gitea 之一。
- `GitAdapter` 从 convergence PR record 真实创建 PR。
- repo allowlist + branch name sanitizer。
- 失败时保留本地 record，不影响 CLOSED 判定。

### 多 Loop 并行

必须先解决：

- 同一 repo 的写锁。
- 同一 issue 的幂等锁。
- agent 资源限流。
- DB/file 双写一致性。

## 生产化额外项

| 项                               | 当前状态 | 下一步                                                 |
| -------------------------------- | -------- | ------------------------------------------------------ |
| 真实 Codex / Claude CLI 生产可用 | blocked  | 缺生产 CLI 版本、权限、超时、重试和沙箱策略            |
| 真实 diff 自动回收               | blocked  | 缺真实 git provider/工作区策略和 changedFiles 来源确认 |
| 成本真实统计与外部告警           | blocked  | 缺真实 token 计量来源、成本口径和外部告警通道          |

### 最小验收

- 真实 CLI 在目标仓库跑通一个完整 Loop。
- changedFiles 不再依赖人工或 adapter 伪数据。
- token/call cap 触发时有清晰状态、日志和告警。
