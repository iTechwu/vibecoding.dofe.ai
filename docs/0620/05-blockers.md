# Blocked 项解除条件

本文件记录 `docs/0620` 当前所有 blocked 项所需的外部输入。未满足前不得把对应项标为 `done`。

## B3 · 真实 SSO 浏览器 E2E

状态：blocked。

解除条件：

- SSO client id / secret / issuer / callback 配置。
- 可用测试账号与登录策略。
- 可启动的 API / Web / Redis / PostgreSQL 联调环境。
- 浏览器 E2E 执行命令、环境变量和 trace 保存位置。

验收后更新：

- `docs/0620/01-execution-plan.md`
- `docs/0620/03-deferred-items.md`
- `docs/0620/04-regression-checklist.md`

## B5 · 飞书入口 / 审批 / 反向通知

状态：blocked。

解除条件：

- Feishu webhook payload 样例与签名校验方式。
- Feishu app id / secret 或等价测试凭据。
- 飞书用户到 Dofe SSO 用户的映射规则。
- 审批按钮、审批状态机、幂等键和重复点击策略。
- 通知目标、发送失败重试策略和死信处理策略。

## B6 · 真实远端 PR 与 diff 自动回收

状态：blocked。

解除条件：

- Git provider 选择：GitHub / GitLab / Gitea 或内部 provider。
- token 管理方式与最小权限范围。
- repo allowlist、branch 命名规则和保护分支策略。
- PR 创建失败时的补偿策略。
- changedFiles 的真实来源：git diff、provider API 或 runner 输出。

## B7 · 多 Loop 并行与独立 worker 池

状态：blocked。

解除条件：

- 队列系统与部署拓扑。
- 同一 repo 写锁、同一 issue 幂等锁和超时释放策略。
- worker 资源隔离、并发限流和重试策略。
- API 进程与 worker 进程之间的状态同步协议。

## B8 · 成本计量、生产告警、真实 CLI 稳定性

状态：blocked。

解除条件：

- Codex / Claude CLI 生产版本、权限、沙箱、超时和重试策略。
- 真实 token / call 计量来源。
- 成本指标口径、阈值和预算策略。
- 外部告警通道、升级策略和负责人。
