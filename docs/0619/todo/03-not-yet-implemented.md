# 未落实项（not-yet-implemented / 后置）

> 明确不在 v1 范围、按路线图后置到 v1.1+ 的能力。与 [`docs/0619/loops设计/todo/TASK-09-deferred-items-registry.md`](../loops设计/todo/TASK-09-deferred-items-registry.md) 保持一致。原始长期设计文档中的相关叙事保留，仅在 v1 裁剪说明中标注「后置」——不得作为 v1 验收项或 CLOSED 门槛。
>
> 注（2026-06-20）：SSO 与 file 唯一真源迁移当前可由 `docs/0619/sso` 范围的独立进程推进；即便该迁移在代码层部分落地，也不改变 Loops v1 的验收口径，本文件仍按 Loops v1 后置项记录。

| 能力                | 后置原因                              | 建议阶段 | 当前骨架状态                                                                      |
| ------------------- | ------------------------------------- | -------- | --------------------------------------------------------------------------------- |
| Dofe SSO 真实登录   | 第一版明确不加入登录                  | v1.1     | 🟡 进行中：SSO OIDC 登录链路由 `docs/0619/sso` 落地；Loops 面已接真实用户（见下） |
| 用户角色/权限       | 依赖 SSO                              | v1.1     | ✅ Loops 最小 RBAC 已落地；组织/团队级生产权限模型仍后置                          |
| 飞书 Issue 入口     | Web 表单覆盖主流程                    | v1.2     | 仅 Web 入口                                                                       |
| 飞书审批卡片        | 依赖飞书入口与用户映射                | v1.2     | Web 审核台覆盖人工门禁                                                            |
| 飞书反向通知        | v1 用 Web/CLI 通知记录                | v1.2     | `.loops/notifications` + Web/CLI 查询，无真实飞书发送                             |
| 真实远端 PR 打开    | provider API 后置                     | v1.3     | `GitAdapter` 骨架 + convergence PR record，默认 `commit_per_shard=false` 安全跳过 |
| 多 Loop 并行队列    | v1 先单 Loop/手动推进                 | v1.3     | 同进程 `max_parallel` 调度，无独立队列                                            |
| 独立 worker 池      | API 内置 Runner 足够验证              | v1.3     | `LoopsRunnerService` 内置，无 worker 隔离                                         |
| 完整 E2E/build 矩阵 | v1 先做最小冒烟 + regression commands | v1.2     | 文件侧 + live-DB jest 冒烟、`.loops/config.yaml` `tests.regression_commands`      |
| 生产级 agent 告警   | v1 先保证失败落日志/状态/通知可见     | v1.3     | 失败落 `log.jsonl` + 状态 + 通知记录                                              |

## v1.1 进度（2026-06-20）：Loops submitter 接真实 SSO 用户 + 最小 RBAC

`docs/0619/sso` 迁移落地 OIDC 登录链路后，已把 Loops 提交/操作面接入真实登录用户，并在后续实施中补上 Loops HTTP 最小 RBAC（推进「Dofe SSO 真实登录」与「用户角色/权限」的 Loops 子项；生产级组织/团队权限模型仍未做）：

- 后端：`LoopsController` 整体加 `@Auth('api')`（所有 Loops HTTP 端点需登录）；`createIssue` 经 `@Req() req: AuthenticatedRequest` 取 `req.userInfo`，`LoopsService.normalizeSubmitter` 在有认证用户时强制 `provider: 'dofe-sso'`、`userId/name` 取自 SSO 用户，**忽略**客户端提交的 submitter 字段（防伪造）；无认证用户（CLI / 内部直调）仍回退 `dev`。
- 权限：`LoopsController` 挂载 `@UseGuards(LoopsRbacGuard)`，并按 `read/create/operate/admin` 为列表/创建/执行/管理端点分组。`LoopsRbacGuard` 当前支持 SSO `isAdmin`、非生产 `MODE_USER_ID` bypass，以及 `LOOPS_RBAC_READ_USER_IDS` / `LOOPS_RBAC_CREATE_USER_IDS` / `LOOPS_RBAC_OPERATE_USER_IDS` / `LOOPS_RBAC_ADMIN_USER_IDS` allowlist；无权限返回 `CommonErrorCode.FeatureHasPermissions`（403）。CLI 直调 `LoopsService` 不经过 HTTP RBAC。
- 前端：`loopsContract` 接入 `tsRestClient`（`apps/web/lib/api/contracts/client.ts`），新增 `hooks/loops.ts`（queries + mutations，token 由 `customFetch` 从 `token-manager` 注入）。`/loops`、`/loops/new`、`/loops/[issueId]` 三个页面从「server component + server action + 无鉴权 `@/lib/requests`」改为客户端 ts-rest（访问 token 仅存客户端 localStorage，server action 无法转发，故必须客户端化）；`/loops/new` 表单用 `useAuth()` 做登录门，未登录跳 `/login`。
- CLI 不受影响：`scripts/loops-cli.ts` 直调 `LoopsService`（不经 HTTP/AuthGuard），`loops:doctor` / `loops:db-doctor` 仍 `ok: true`。
- 本地开发：未配置 SSO 时，API 可设 `MODE_USER_ID` 走 AuthGuard bypass；或保持 CLI 文件模式。
- 回归：`check:architecture` / `quality:gate`（6/6）/ Loops Jest（含 dofe-sso + dev 两条 submitter用例、RBAC allow/deny 用例）/ web test / `loops:doctor` 全绿；api+web type-check 通过。
- 仍后置：真实 SSO 浏览器 E2E（需可用 SSO client secret / Redis / DB，命令见 [`docs/0619/sso/09-implementation-status.md`](../sso/09-implementation-status.md)）、组织/团队级生产权限模型、权限管理 UI 与审计运营流程。
- round 16 复审：上述代码状态仍成立；本轮重新审查 `loops.controller.ts`、`loops-rbac.guard.ts`、`loops-rbac.guard.spec.ts`、`loops.module.ts`，确认最小 RBAC 已真实落地。真实浏览器 E2E 与生产级权限模型仍不作为 Loops v1 CLOSED 门槛。

## 额外未落实（生产化，非 TASK-09 清单但需在上线前推进）

| 能力                                  | 现状                                                                                                                                                        | 建议                                                                              |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 真实 Codex / Claude Code CLI 生产可用 | `LOOPS_AGENT_MODE=cli` 切换 CLI Adapter，输出经 Zod schema 校验 + `max_retry` 受控重试 + 失败 fallback deterministic；但真实 CLI 版本/权限/生产稳定性未固化 | 上线前用真实 `codex` / `claude` CLI 在目标仓库跑通端到端，固化参数与重试/告警策略 |
| 真实 diff 自动回收                    | Implementation Record 的 `changedFiles` 目前由 adapter 产出或人工登记                                                                                       | 接入真实 git diff 自动回收 changedFiles                                           |
| 成本真实统计与外部告警                | 已读 token/call cap，plan/decompose/runLoop 后熔断；真实 token 统计与外部告警未接                                                                           | 接入真实 token 计量与告警通道                                                     |

## 允许保留的骨架（不计入 v1 必需验收）

CLI Adapter、commit-per-shard、convergence PR record、notifications record、`max_parallel` / `context_budget` / `max_reloop` / `max_shard_redo` 等运行时配置——代码中已有骨架，可保留，但不作为 v1 完成条件。
