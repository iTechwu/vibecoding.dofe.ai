# 回归与文档标注清单

每轮实施 accepted / 后置项后，必须执行本清单。

## 必跑质量门禁

```bash
pnpm quality:gate
```

若失败，需要拆开定位：

```bash
pnpm check:architecture
pnpm check:list-contracts
pnpm check:sensitive-logs
pnpm check:utils-hygiene
pnpm type-check
```

## 包级类型与测试

```bash
pnpm --filter @repo/api type-check
pnpm --filter @repo/web type-check
pnpm --filter @repo/contracts typecheck
pnpm --filter @repo/contracts test
pnpm --filter @repo/utils typecheck
pnpm --filter @repo/utils test
pnpm --filter @repo/validators test
pnpm --filter @repo/web test
```

## Loops 回归

```bash
pnpm --filter @repo/api exec jest src/modules/loops --runInBand
pnpm loops:doctor
pnpm loops:db-doctor
```

如涉及 live DB：

```bash
LOOPS_DB_SMOKE=1 pnpm --filter @repo/api exec jest src/modules/loops/loops-persistence.db.spec.ts --runInBand
```

## SSO / 浏览器 E2E

涉及真实登录、token、前端页面时追加：

```bash
pnpm --filter @repo/web test
```

真实 SSO 浏览器 E2E 需要环境变量与服务启动，按 `docs/0619/sso/09-implementation-status.md` 中的命令执行。

## 文档标注规则

每轮实施后更新：

1. `docs/0620/README.md`：总体状态。
2. 具体任务文档：把 `open` / `ready` / `in-progress` 改为 `done` / `accepted` / `blocked`。
3. 若影响 `docs/0619/todo` 的历史状态，仅追加“后续已在 docs/0620 推进”的说明，不重写历史事实。
4. 标注必须包含：
   - 具体代码文件；
   - 验收命令；
   - 仍未完成的边界；
   - 是否影响 Loops v1 CLOSED 门槛。

## round 2 回归记录（2026-06-20）

范围：

- Loops RBAC 最小门禁复核与标注。
- 回归中修复 `apps/api/src/bootstrap/i18n.bootstrap.ts` 的 `AppConfig.zones` 可空类型缺口。

结果：

- `pnpm --filter @repo/api exec jest src/modules/loops --runInBand`：通过。
- `pnpm --filter @repo/api exec jest src/bootstrap/i18n.bootstrap.spec.ts --runInBand`：通过。
- `pnpm --filter @repo/api type-check`：通过。
- `pnpm quality:gate`：通过。
- `pnpm loops:doctor`：通过。
- `pnpm loops:db-doctor`：通过。
- `pnpm --filter @repo/web type-check`：通过。
- `pnpm --filter @repo/contracts typecheck` / `pnpm --filter @repo/contracts test`：通过。
- `pnpm --filter @repo/utils typecheck` / `pnpm --filter @repo/utils test`：通过。
- `pnpm --filter @repo/validators test` / `pnpm --filter @repo/web test`：通过。

仍未完成：

- 真实 SSO 浏览器 E2E：blocked，需真实 SSO client secret、测试账号和可启动联调环境。
- v1.2+ 飞书、真实 PR、多 Loop 并行、worker 池、生产告警和成本计量仍为后置项。

Loops v1 CLOSED 门槛：不受影响；本轮为 v1.1 权限边界和回归修复。

## round 3 回归记录（2026-06-20）

范围：

- 固化非真实 SSO 范围的 E2E/build 回归矩阵。
- 将 Loops 专项回归接入 CI API job。

实施文件：

- `scripts/docs0620-regression.sh`
- `package.json`
- `.github/workflows/ci.yml`

结果：

- `pnpm regression:docs0620`：通过。

脚本覆盖：

- `pnpm quality:gate`
- API/Web/package 类型检查与测试
- API bootstrap targeted Jest
- Loops module Jest
- `pnpm loops:doctor`
- `pnpm loops:db-doctor`
- `LOOPS_DB_SMOKE=1` 时追加 live DB persistence smoke
- `pnpm build`

仍未完成：

- 真实 SSO 浏览器 E2E：blocked。
- 飞书入口/审批/反向通知：blocked，需 Feishu payload、签名配置、应用凭据、用户映射和通知目标。
- 真实 PR、并行 worker、真实 CLI、真实成本/告警：blocked，需 provider/凭据/部署拓扑/指标通道决策。

Loops v1 CLOSED 门槛：不受影响；本轮为回归矩阵固化。

## round 4 回归记录（2026-06-20）

范围：

- 优化 `pnpm regression:docs0620`，补齐本地 build 回归。

实施文件：

- `scripts/docs0620-regression.sh`
- `docs/0620/01-execution-plan.md`
- `docs/0620/04-regression-checklist.md`

结果：

- `pnpm regression:docs0620`：通过。

附带生成变更：

- `apps/web/next-env.d.ts`：由 `pnpm build` / Next build 自动更新 routes 类型引用，从 `.next/dev/types/routes.d.ts` 切换为 `.next/types/routes.d.ts`。

Loops v1 CLOSED 门槛：不受影响；本轮仅补齐回归矩阵覆盖面。

## round 5 回归记录（2026-06-20）

范围：

- 收敛 `docs/0620` 的剩余状态标注。
- 新增 blocked 项解除条件清单。

实施文件：

- `docs/0620/README.md`
- `docs/0620/03-deferred-items.md`
- `docs/0620/04-regression-checklist.md`
- `docs/0620/05-blockers.md`

结果：

- `pnpm regression:docs0620`：通过。

Loops v1 CLOSED 门槛：不受影响；本轮仅补齐文档阻塞条件标注。

## round 6 回归记录（2026-06-20）

范围：

- 复核 `docs/0620` 状态表、任务拆解和 blocked 清单。
- 确认本目录无 `open` / `ready` / `in-progress` 待执行项。
- 确认剩余 blocked 项仍缺外部凭据、产品决策或运行环境。

实施文件：

- `docs/0620/README.md`
- `docs/0620/04-regression-checklist.md`

结果：

- `pnpm regression:docs0620`：通过。

Loops v1 CLOSED 门槛：不受影响；本轮无新增代码实施项。

## round 7 回归记录（2026-06-20）

范围：

- 复核 `docs/0620` 是否存在新的 `open` / `ready` / `in-progress` / TODO / 未实施 / 待优化标记。
- 复核 blocked 项解除条件是否仍准确。
- 本轮未发现新的本仓可实施项。

实施文件：

- `docs/0620/README.md`
- `docs/0620/04-regression-checklist.md`

结果：

- `pnpm regression:docs0620`：通过。

Loops v1 CLOSED 门槛：不受影响；本轮无新增代码实施项。

## round 8 回归记录（2026-06-20）

范围：

- 使用精确状态扫描复核 `docs/0620` 是否存在新的可执行项。
- 复核 blocked 项解除条件是否仍与当前外部依赖一致。
- 本轮未发现新的本仓可实施项。

实施文件：

- `docs/0620/README.md`
- `docs/0620/04-regression-checklist.md`

结果：

- `pnpm regression:docs0620`：通过。

Loops v1 CLOSED 门槛：不受影响；本轮无新增代码实施项。

## round 9 回归记录（2026-06-20）

范围：

- 使用精确状态扫描复核 `docs/0620` 是否存在新的可执行项。
- 复核 blocked 项解除条件是否仍与当前外部依赖一致。
- 本轮未发现新的本仓可实施项。

实施文件：

- `docs/0620/README.md`
- `docs/0620/04-regression-checklist.md`

结果：

- `pnpm regression:docs0620`：通过。

Loops v1 CLOSED 门槛：不受影响；本轮无新增代码实施项。

## round 10 回归记录（2026-06-20）

范围：

- 使用精确状态扫描复核 `docs/0620` 是否存在新的可执行项。
- 复核 blocked 项解除条件是否仍与当前外部依赖一致。
- 本轮未发现新的本仓可实施项。

实施文件：

- `docs/0620/README.md`
- `docs/0620/04-regression-checklist.md`

结果：

- `pnpm regression:docs0620`：通过。

Loops v1 CLOSED 门槛：不受影响；本轮无新增代码实施项。

## round 11 回归记录（2026-06-20）

范围：

- 使用精确状态扫描复核 `docs/0620` 是否存在新的可执行项。
- 复核 blocked 项解除条件是否仍与当前外部依赖一致。
- 本轮未发现新的本仓可实施项。

实施文件：

- `docs/0620/README.md`
- `docs/0620/04-regression-checklist.md`

结果：

- `pnpm regression:docs0620`：通过。

Loops v1 CLOSED 门槛：不受影响；本轮无新增代码实施项。

## round 12 回归记录（2026-06-20）

范围：

- 复核 `docs/0620` 与当前 Loops 实现标注的一致性。
- 修复 deterministic Loops spec/annotation 中过期的 “SSO mock user” 描述。
- 增加 Loops smoke 断言，防止生成 spec/annotation 再次倒退为不准确标注。

实施文件：

- `apps/api/src/modules/loops/adapters/deterministic-loops-agent.adapter.ts`
- `apps/api/src/modules/loops/loops.service.spec.ts`
- `docs/0620/README.md`
- `docs/0620/04-regression-checklist.md`

结果：

- `pnpm --filter @repo/api exec jest src/modules/loops --runInBand`：通过（1 skipped DB smoke，2 passed；8 passed，3 skipped）。
- `pnpm regression:docs0620`：通过。

仍未完成：

- 真实 SSO 浏览器 E2E：blocked，需真实 SSO client secret、测试账号和可启动联调环境。
- 飞书、真实远端 PR、多 Loop 并行、worker 池、真实 CLI、真实成本/外部告警：blocked，解除条件见 [05-blockers.md](05-blockers.md)。

Loops v1 CLOSED 门槛：不受影响；本轮为生成文档标注准确性修复，不扩大外部验收口径。

## round 13 回归记录（2026-06-20）

范围：

- B6：新增 GitHub/GitLab/Gitea PR provider client；`CliLoopsGitAdapter` push 后可真实创建远端 PR，并在 convergence PR record 写入 `OPENED`、`provider`、`url`。
- B7：新增 API 进程内 issue/repo 写锁，防止同进程 `runLoop` 并发重入。
- B8/B5 通知前置：新增 Loops notification webhook sender，支持 external alert 与 Feishu webhook 配置后发送并记录状态。
- 前端 Loops 详情页展示远端 PR 链接。

实施文件：

- `apps/api/src/modules/loops/adapters/loops-pr-provider.client.ts`
- `apps/api/src/modules/loops/adapters/loops-pr-provider.client.spec.ts`
- `apps/api/src/modules/loops/adapters/cli-loops-git.adapter.ts`
- `apps/api/src/modules/loops/loops-work-lock.service.ts`
- `apps/api/src/modules/loops/loops-work-lock.service.spec.ts`
- `apps/api/src/modules/loops/loops-notification-sender.service.ts`
- `apps/api/src/modules/loops/loops-notification-sender.service.spec.ts`
- `apps/api/src/modules/loops/loops-file-store.service.ts`
- `apps/api/src/modules/loops/loops.module.ts`
- `apps/api/src/modules/loops/loops.service.ts`
- `packages/contracts/src/schemas/loops.schema.ts`
- `apps/web/app/loops/[issueId]/page.tsx`
- `docs/0620/README.md`
- `docs/0620/01-execution-plan.md`
- `docs/0620/03-deferred-items.md`
- `docs/0620/04-regression-checklist.md`
- `docs/0620/05-blockers.md`

结果：

- `pnpm --filter @repo/api exec jest src/modules/loops --runInBand`：通过（1 skipped DB smoke，5 passed；17 passed，3 skipped）。
- `pnpm --filter @repo/api type-check`：通过。
- `pnpm --filter @repo/web type-check`：通过。
- `pnpm --filter @repo/contracts exec jest --runInBand`：通过。
- `pnpm regression:docs0620`：通过。

仍未完成：

- 真实 SSO 浏览器 E2E：blocked，需真实 SSO client secret、测试账号和可启动联调环境。
- 飞书入口/审批：blocked，需真实 payload、签名、用户映射和审批状态机；Feishu webhook 发送前置已完成。
- 真实远端 PR 环境验收与真实 diff 自动回收：blocked，需真实 provider token/仓库与 changedFiles 来源。
- 独立 worker 池：blocked，需跨进程队列/锁/资源隔离/部署拓扑。
- 真实 CLI 生产稳定性与真实 token 计量：blocked，需生产 CLI 版本、权限、沙箱和计量来源。

Loops v1 CLOSED 门槛：不受影响；本轮为 v1.1+ / 生产化前置能力，不扩大真实外部验收口径。

## 失败处理

| 失败类型          | 处理                                                      |
| ----------------- | --------------------------------------------------------- |
| architecture 失败 | 优先判断是否违反 DB Service / Logger / Console / Any 边界 |
| type-check 失败   | 先判断是否由并行 SSO/file 变更造成                        |
| Loops doctor 失败 | 区分 `.loops` 真相源问题、DB index 漂移、配置问题         |
| E2E 失败          | 保留 trace / screenshot，文档标 blocked，不得标 done      |
