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

| 批次 | 状态  | 目标                                | 为什么先做                                 |
| ---- | ----- | ----------------------------------- | ------------------------------------------ |
| B1   | done  | 关闭 `OPT-5`                        | 已改为 config 文件位置解析并通过回归       |
| B2   | ready | Loops RBAC 最小门禁                 | 已有 SSO 身份，下一步自然是权限边界        |
| B3   | ready | 真实 SSO 浏览器 E2E                 | 验证登录态、token 注入、Loops 页面真实可用 |
| B4   | open  | 完整 E2E/build 矩阵                 | 在身份链路稳定后扩展测试矩阵               |
| B5   | open  | 飞书入口 / 审批 / 反向通知          | 依赖身份和审批决策，适合放到 v1.2          |
| B6   | open  | 真实远端 PR 与 diff 自动回收        | 依赖 git provider 决策和真实 CLI 稳定性    |
| B7   | open  | 多 Loop 并行与独立 worker 池        | 涉及调度、资源隔离、状态一致性，风险较高   |
| B8   | open  | 成本计量、生产告警、真实 CLI 稳定性 | 生产运维闭环，适合在 runner 能力稳定后推进 |

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

状态：ready，下一轮优先实施。

目标：在已有 `@Auth('api')` 登录校验基础上，为 Loops 操作增加最小角色/权限控制。

建议最小切分：

- 定义 Loops 权限枚举，如 `loops:read`、`loops:create`、`loops:operate`、`loops:admin`。
- 将只读端点与写操作端点分组。
- 本地开发保留 `MODE_USER_ID` bypass，但必须在文档中标注仅限非生产。
- 权限缺失返回标准 ts-rest error，不能落成普通 500。

验收：

- 未登录：仍被 AuthGuard 拦截。
- 已登录但无权限：返回 403。
- 有权限用户：可创建 / 操作 Loop。
- CLI 直调 `LoopsService` 不受 HTTP RBAC 影响。

## B3 · 真实 SSO 浏览器 E2E

目标：用真实浏览器路径验证登录、token 注入、Loops 页面访问和提交。

前置：

- 可用 SSO client secret。
- Redis / DB / API / Web 本地或测试环境可启动。
- 可用测试账号。

验收：

- 登录页跳转 OIDC。
- callback 后写入 token。
- `/loops` 能加载。
- `/loops/new` 能提交并由服务端记录 `provider: dofe-sso`。
- 不泄露 token 到 server action 或日志。

## B4-B8 后续批次

这些批次均需在每轮开始前重新拆为更小任务，不建议一次性实现：

- 飞书相关能力需要先明确入口 payload、审批状态机和通知目标。
- 真实远端 PR 需要明确 provider、权限模型、repo allowlist、失败补偿。
- 多 Loop 并行和 worker 池需要先设计锁、队列、幂等、资源限流。
- 生产告警和成本计量需要先确定指标来源与告警通道。
