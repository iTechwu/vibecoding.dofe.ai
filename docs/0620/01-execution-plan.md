# 后续优化执行计划

## 基线

来源：`docs/0619/todo` round 15。

- `pnpm quality:gate` 全绿。
- Loops HTTP submitter 已接真实 SSO 用户。
- `OPT-3` 已完成：Loops per-model 生成 DB Service 已裁剪。
- 当前仍需进入下一阶段的内容：
  - `OPT-5`：API Jest config `process.cwd()` 依赖，已在 docs/0620 round 1 实施为 done。
  - v1.1：角色/权限门禁、真实 SSO 浏览器 E2E。
  - v1.2：飞书入口、审批卡片、反向通知、完整 E2E/build 矩阵。
  - v1.3：真实远端 PR、多 Loop 并行、独立 worker 池、生产级 agent 告警。
  - 生产化额外项：真实 Codex / Claude CLI、真实 diff 自动回收、真实 token 计量与外部告警。

## 推荐实施顺序

| 批次 | 状态    | 目标                                | 为什么先做                                                          |
| ---- | ------- | ----------------------------------- | ------------------------------------------------------------------- |
| B1   | done    | 关闭 `OPT-5`                        | 已改为 config 文件位置解析并通过回归                                |
| B2   | done    | Loops RBAC 最小门禁                 | 已按 read/create/operate/admin 分组并通过回归                       |
| B3   | blocked | 真实 SSO 浏览器 E2E                 | 缺真实 SSO client secret、测试账号和可启动环境                      |
| B4   | done    | 完整 E2E/build 矩阵                 | 已固化非真实 SSO 范围回归入口与 CI Loops 检查                       |
| B5   | blocked | 飞书入口 / 审批 / 反向通知          | 缺 Feishu payload、签名配置、应用凭据和通知目标                     |
| B6   | partial | 真实远端 PR 与 diff 自动回收        | PR provider client 已落地；真实凭据验收/diff 来源仍 blocked         |
| B7   | partial | 多 Loop 并行与独立 worker 池        | 同进程 issue/repo 写锁已落地；跨进程队列/worker 拓扑仍 blocked      |
| B8   | partial | 成本计量、生产告警、真实 CLI 稳定性 | webhook 告警发送已落地；真实 CLI/token 计量和告警通道验收仍 blocked |

## B1 · `OPT-5` 处理

状态：done（round 1 / 2026-06-20）。

目标：决定是否把 `apps/api/jest.config.ts` 从 `process.cwd()` 改为文件位置解析，或正式关闭为 accepted。

验收：

- 若实施：从 repo 根、`apps/api` 目录分别运行 API Jest showConfig / Loops Jest，均正确解析 `apps/api/tsconfig.json`。
- 若关闭：文档写明为什么继续依赖 `process.cwd()`，并保留命令级约束。

实施结果：已将 `apps/api/jest.config.ts` 改为 `dirname(fileURLToPath(import.meta.url))` 定位配置文件目录，再读取同目录 `tsconfig.json`，不再依赖 `process.cwd()`。

回归：

- `pnpm --filter @repo/api exec jest --showConfig --runInBand`：通过。
- `(cd apps/api && pnpm exec jest --showConfig --runInBand)`：通过。
- `pnpm --filter @repo/api exec jest src/modules/loops --runInBand`：通过。
- `(cd apps/api && pnpm exec jest src/modules/loops --runInBand)`：通过。
- `pnpm --filter @repo/api type-check`：通过。
- `pnpm quality:gate`：通过。
- `pnpm loops:doctor` / `pnpm loops:db-doctor`：通过。

## B2 · RBAC 最小门禁

状态：done（round 2 / 2026-06-20）。

目标：在已有 `@Auth('api')` 登录校验基础上，为 Loops 操作增加最小角色/权限控制。

实施结果：

- 已在 `apps/api/src/modules/loops/loops-rbac.decorator.ts` 定义 `loops:read`、`loops:create`、`loops:operate`、`loops:admin`。
- 已在 `apps/api/src/modules/loops/loops-rbac.guard.ts` 增加 Loops HTTP 局部门禁：管理员拥有全部权限；非生产 `MODE_USER_ID` 保留本地 bypass；其他用户通过 `LOOPS_RBAC_*_USER_IDS` allowlist 授权。
- 已在 `apps/api/src/modules/loops/loops.controller.ts` 将端点分组标注，并通过 `LoopsRbacGuard` 执行。
- 权限缺失复用 `CommonErrorCode.FeatureHasPermissions`，HTTP status 为 403，不落成普通 500。
- CLI 直调 `LoopsService` 不经过 controller guard，仍保留无 HTTP RBAC 的内部/CLI 路径。

验收：

- 未登录：仍由全局 `AuthGuard` 拦截。
- 已登录但无权限：`loops-rbac.guard.spec.ts` 覆盖 403。
- 有权限用户：管理员、非生产 `MODE_USER_ID`、allowlist 用户均有单测覆盖。
- CLI 直调 `LoopsService` 不受 HTTP RBAC 影响，Loops service smoke 继续通过。

回归：

- `pnpm --filter @repo/api exec jest src/modules/loops --runInBand`：通过。
- `pnpm --filter @repo/api exec jest src/bootstrap/i18n.bootstrap.spec.ts --runInBand`：通过。
- `pnpm --filter @repo/api type-check`：通过。
- `pnpm quality:gate`：通过。
- `pnpm loops:doctor` / `pnpm loops:db-doctor`：通过。
- 包级回归：`@repo/web type-check/test`、`@repo/contracts typecheck/test`、`@repo/utils typecheck/test`、`@repo/validators test` 均通过。

附带优化：

- 回归中发现 `apps/api/src/bootstrap/i18n.bootstrap.ts` 对 `AppConfig.zones` 可空类型缺少保护，已补 `zones ?? []` 与单测；该修复不改变 Loops v1 CLOSED 门槛。

## B3 · 真实 SSO 浏览器 E2E

状态：blocked（round 2 / 2026-06-20）。

目标：用真实浏览器路径验证登录、token 注入、Loops 页面访问和提交。

前置：

- 可用 SSO client secret。
- Redis / DB / API / Web 本地或测试环境可启动。
- 可用测试账号。

阻塞原因：当前工作区未提供真实 SSO client secret、可用测试账号、以及 API/Web/Redis/DB 的真实登录联调环境；不得用 mock 登录结果替代“真实 SSO 浏览器 E2E”验收。

验收：

- 登录页跳转 OIDC。
- callback 后写入 token。
- `/loops` 能加载。
- `/loops/new` 能提交并由服务端记录 `provider: dofe-sso`。
- 不泄露 token 到 server action 或日志。

## B4 · E2E/build 回归矩阵

状态：done（round 3 / 2026-06-20，真实 SSO 浏览器 E2E 除外）。

目标：将 `docs/0620/04-regression-checklist.md` 中已可本地执行的回归命令固化为脚本，并把 Loops 专项回归接入 CI。

实施结果：

- 新增 `scripts/docs0620-regression.sh`，封装质量门禁、包级类型/测试、API bootstrap/Loops Jest、`loops:doctor`、`loops:db-doctor` 和 `pnpm build`。
- 新增根脚本 `pnpm regression:docs0620`。
- 更新 `.github/workflows/ci.yml` 的 `test-api` job，在 `pnpm test:api` 后追加 Loops 模块 Jest、`loops:doctor`、`loops:db-doctor`。
- `LOOPS_DB_SMOKE=1` 时，回归脚本会追加 live DB Loops persistence smoke。

回归：

- `pnpm regression:docs0620`：通过（round 3 初版）。

round 4 优化：

- 将 `pnpm build` 纳入 `scripts/docs0620-regression.sh`，使本地一键回归与 “E2E/build 矩阵” 名称一致。
- `pnpm regression:docs0620` 已重新执行通过；Next build 自动更新 `apps/web/next-env.d.ts` 的 routes 类型引用。

边界：

- 真实 SSO 浏览器 E2E 仍归属 B3，因缺真实环境保持 blocked。
- CI 真实 DB smoke 仍依赖 workflow 中的 PostgreSQL service 与 `pnpm db:push`。

## B5-B8 后续批次

这些批次仍有外部凭据、产品决策或跨进程/跨系统设计依赖；round 13 已先完成本仓可验证前置，不伪装外部验收：

- 飞书相关能力需要先明确入口 payload、签名校验密钥、应用凭据、审批状态机和通知目标。
- 真实远端 PR 已支持 `LOOPS_PR_PROVIDER=github|gitlab|gitea`、`LOOPS_PR_API_BASE_URL`、`LOOPS_PR_REPOSITORY`、`LOOPS_PR_TOKEN`、`LOOPS_PR_REPOSITORY_ALLOWLIST` 配置后真实开 PR；缺真实 token/仓库验收和 changedFiles 真实来源时仍不得标 full done。
- 多 Loop 并行已增加同进程 issue/repo 写锁，防止 API 进程内重入写坏；独立 worker 池仍需确认队列/锁/幂等/资源限流/部署拓扑。
- 生产告警已支持 `LOOPS_ALERT_WEBHOOK_URL` / `LOOPS_ALERT_WEBHOOK_TOKEN` 与 `LOOPS_FEISHU_WEBHOOK_URL` / `LOOPS_FEISHU_WEBHOOK_TOKEN` 发送 notification 状态；真实 token 来源、指标口径与外部告警通道验收仍需输入。
