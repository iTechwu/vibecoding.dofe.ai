# 后置项实施拆解

## v1.1 · 身份与权限

| 项                  | 当前状态    | 下一步                                                            |
| ------------------- | ----------- | ----------------------------------------------------------------- |
| Dofe SSO 登录       | in-progress | Loops submitter 已接 SSO；跟随 `docs/0619/sso` 完成真实浏览器 E2E |
| 用户角色/权限       | open        | 设计并实现 Loops 最小 RBAC                                        |
| 真实 SSO 浏览器 E2E | ready       | 补 Playwright E2E，需真实 SSO 环境                                |

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
- 无权限：403。
- 有权限：原路径正常。
- CLI 直调不受 HTTP RBAC 影响。

## v1.2 · 飞书与测试矩阵

| 项                  | 当前状态 | 下一步                                              |
| ------------------- | -------- | --------------------------------------------------- |
| 飞书 Issue 入口     | open     | 定义 Feishu payload → `CreateLoopIssueRequest` 映射 |
| 飞书审批卡片        | open     | 定义审批动作与 Loops review/intervene 的映射        |
| 飞书反向通知        | open     | 将 `.loops/notifications` 接入真实发送通道          |
| 完整 E2E/build 矩阵 | open     | 将最小冒烟扩展为 CI 可跑矩阵                        |

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

## v1.3 · 远端协作与执行能力

| 项                | 当前状态 | 下一步                                             |
| ----------------- | -------- | -------------------------------------------------- |
| 真实远端 PR 打开  | open     | 选定 git provider，落 repo allowlist 与 token 管理 |
| 多 Loop 并行队列  | open     | 设计队列、锁、并发限流                             |
| 独立 worker 池    | open     | 将 runner 从 API 进程解耦                          |
| 生产级 agent 告警 | open     | 定义失败、超时、成本、重试耗尽告警                 |

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

| 项                               | 当前状态 | 下一步                              |
| -------------------------------- | -------- | ----------------------------------- |
| 真实 Codex / Claude CLI 生产可用 | open     | 固化 CLI 版本、权限、超时、重试策略 |
| 真实 diff 自动回收               | open     | 从 git diff 自动生成 changedFiles   |
| 成本真实统计与外部告警           | open     | 接 token 计量与告警通道             |

### 最小验收

- 真实 CLI 在目标仓库跑通一个完整 Loop。
- changedFiles 不再依赖人工或 adapter 伪数据。
- token/call cap 触发时有清晰状态、日志和告警。
