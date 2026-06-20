# Blocked 项解除条件

本文件记录 `docs/0620` 当前所有 blocked 项所需的外部输入。未满足前不得把对应项标为 `done`。

## B3 · 真实 SSO 浏览器 E2E

状态：done（round 14，本地真实联调环境）。

已满足：

- SSO client id / secret / issuer / callback 配置。
- 可用测试账号与登录策略。
- 可启动的 SSO API/Web 与 vibecoding API/Web 联调环境。
- 浏览器 E2E 执行命令与环境变量已记录在 `docs/0619/sso/09-implementation-status.md` 与 `docs/0620/03-deferred-items.md`。

已验收：

- `SSO_E2E_ENABLED=1 E2E_SSO_MOBILE=<test-mobile> E2E_SSO_PASSWORD=<password> E2E_SSO_ORIGIN=http://127.0.0.1:3100 E2E_SSO_LOGIN_ORIGIN=http://127.0.0.1:3000 E2E_API_ORIGIN=http://127.0.0.1:13100 pnpm --filter @repo/web test:e2e:sso`：通过（Chromium，1 passed）。

仍需按环境另行验收：

- 生产/测试域名、生产 SSO secret、生产测试账号策略。
- 对象存储预签名 PUT 与 CDN GET。

## B5 · 飞书入口 / 审批 / 反向通知

状态：blocked。

解除条件：

- Feishu webhook payload 样例与签名校验方式。
- Feishu app id / secret 或等价测试凭据。
- 飞书用户到 Dofe SSO 用户的映射规则。
- 审批按钮、审批状态机、幂等键和重复点击策略。
- 通知目标、发送失败重试策略和死信处理策略。

已满足的本仓前置：

- `LoopsNotificationSender` 已支持 `LOOPS_FEISHU_WEBHOOK_URL` / `LOOPS_FEISHU_WEBHOOK_TOKEN` 发送 Feishu channel notification，并记录 `SENT` / `FAILED` / `SKIPPED`。

## B6 · 真实远端 PR 与 diff 自动回收

状态：blocked。

解除条件：

- 真实 Git provider endpoint 与 token。
- token 管理方式与最小权限范围。
- 保护分支策略。
- PR 创建失败时的补偿策略。
- changedFiles 的真实来源：git diff、provider API 或 runner 输出。

已满足的本仓前置：

- `LoopsPrProviderClient` 已支持 GitHub / GitLab / Gitea。
- `LOOPS_PR_REPOSITORY_ALLOWLIST` 已支持 repo allowlist。
- `CliLoopsGitAdapter` 已在 push 后尝试真实开 PR，成功写入 `OPENED + provider + url`，失败保留本地 convergence PR record。

## B7 · 多 Loop 并行与独立 worker 池

状态：blocked。

解除条件：

- 队列系统与部署拓扑。
- 跨进程同一 repo 写锁、同一 issue 幂等锁和超时释放策略。
- worker 资源隔离、并发限流和重试策略。
- API 进程与 worker 进程之间的状态同步协议。

已满足的本仓前置：

- `LoopsWorkLockService` 已提供 API 进程内 issue/repo 写锁，防止同进程 `runLoop` 重入。

## B8 · 成本计量、生产告警、真实 CLI 稳定性

状态：blocked。

解除条件：

- Codex / Claude CLI 生产版本、权限、沙箱、超时和重试策略。
- 真实 token / call 计量来源。
- 成本指标口径、阈值和预算策略。
- 外部告警通道、升级策略和负责人。

已满足的本仓前置：

- `LoopsNotificationSender` 已支持 `LOOPS_ALERT_WEBHOOK_URL` / `LOOPS_ALERT_WEBHOOK_TOKEN` 发送外部告警 webhook。
