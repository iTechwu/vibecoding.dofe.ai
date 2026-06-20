# 进一步优化执行入口（2026-06-20）

> 本目录承接 `docs/0619/todo` round 15 之后仍明确保留的 accepted / 后置项，用于进入下一阶段实施循环。
>
> 当前基线：`docs/0619/todo` 已确认 Loops v1 收尾范围无 P0/P1 阻断，`pnpm quality:gate` 全绿；`OPT-3` 已实施；`OPT-5` 已在本目录 round 1 关闭为 done；后续聚焦 v1.1+ / 生产化后置能力。

## 当前结论

- Loops v1 收尾项已完成，不再把 `docs/0619/todo` 作为新增实施清单。
- round 1：完成 `OPT-5`，`apps/api/jest.config.ts` 不再依赖 `process.cwd()`，改为从 config 文件位置解析 `tsconfig.json`。
- round 2：复核并关闭 Loops RBAC 最小门禁；HTTP 端点已按 `read/create/operate/admin` 权限分组，缺权限返回 403；回归中发现并修复 `i18n.bootstrap` 的 `zones` 可空类型缺口。
- round 3：完成非真实 SSO 范围的 E2E/build 回归矩阵固化，新增 `pnpm regression:docs0620`，并在 CI API job 中追加 Loops Jest 与 doctor/db-doctor。
- round 4：将 `pnpm build` 纳入 `pnpm regression:docs0620`，补齐本地 build 回归覆盖。
- round 5：完成 `docs/0620` 阻塞项收敛标注，新增解除阻塞输入清单；本目录已无 `open` / `ready` / `in-progress` 待执行项。
- round 6：复核确认无新增本仓可实施项；剩余项均维持 blocked，等待 [05-blockers.md](05-blockers.md) 所列外部输入。
- round 7：再次复核确认无新增本仓可实施项；继续维持 blocked 清单和回归矩阵。
- round 8：再次复核确认无新增本仓可实施项；blocked 项解除条件未变化。
- round 9：再次复核确认无新增本仓可实施项；blocked 项解除条件未变化。
- round 10：再次复核确认无新增本仓可实施项；blocked 项解除条件未变化。
- round 11：再次复核确认无新增本仓可实施项；blocked 项解除条件未变化。
- `docs/0620` 作为新阶段优化入口，聚焦：
  - accepted 项是否继续维持、转实施或关闭；
  - v1.1+ 后置能力的可执行拆解；
  - 每轮实施后的文档标注和回归测试。
- SSO/file 唯一真源仍以 `docs/0619/sso` 为权威来源；本目录只记录与 Loops 后续能力、生产化、质量回归相关的执行事项。
- 真实 SSO 浏览器 E2E、飞书、真实远端 PR、worker 池、真实 CLI 与外部告警仍依赖外部凭据/产品决策/运行环境，当前不得标为 done。

## 文件索引

| 文件                                                     | 目的                                  |
| -------------------------------------------------------- | ------------------------------------- |
| [01-execution-plan.md](01-execution-plan.md)             | 下一阶段实施顺序、批次和退出条件      |
| [02-accepted-items.md](02-accepted-items.md)             | accepted 项处理，当前 `OPT-5` 已 done |
| [03-deferred-items.md](03-deferred-items.md)             | v1.1+ / 生产化后置项拆解              |
| [04-regression-checklist.md](04-regression-checklist.md) | 每轮实施后的回归命令和文档标注规则    |
| [05-blockers.md](05-blockers.md)                         | blocked 项解除条件和所需外部输入      |

## 执行原则

1. 每次只推进一个批次，避免 SSO/file、Loops runner、生产化能力互相覆盖。
2. 代码实施前先确认所属边界：Loops 本目录、`docs/0619/sso`、或生产运维后置项。
3. 实施完成后必须同步标注本文档对应项状态，并运行 [04-regression-checklist.md](04-regression-checklist.md) 中的回归集。
4. 若发现某后置项仍缺少外部凭据、真实环境或产品决策，则标为 blocked，不伪装为 done。

## 状态口径

| 状态          | 含义                                   |
| ------------- | -------------------------------------- |
| `open`        | 尚未开始，需要实现或进一步设计         |
| `ready`       | 可开始实施，依赖条件已满足             |
| `in-progress` | 正在实施                               |
| `done`        | 已实施并通过回归                       |
| `accepted`    | 已复核，维持当前实现，不作为阻断       |
| `blocked`     | 需要外部凭据、环境、产品决策或跨仓变更 |
