# 循环实施计划与状态标注

## 状态口径

| 状态          | 含义                               |
| ------------- | ---------------------------------- |
| `planned`     | 已列入计划但尚未具备实施细节       |
| `ready`       | 可开始实施                         |
| `in-progress` | 正在实施                           |
| `done`        | 已实施并通过回归                   |
| `blocked`     | 需要外部输入、凭据、环境或产品决策 |

## R1 Control Plane Dashboard

状态：done

目标：

- 将 `/loops` 首页从 Issue Queue 升级为 Agent Control Plane。
- 复用现有 `useLoopsList`、`useLoopsDoctor`、`useLoopsCost`、`useLoopsLogs`、`useLoopsNotifications`。
- 不新增 API、不改数据库、不碰 SSO/权限。

实施内容：

- [done] 运行健康 KPI：active、in-loop、paused、attention、closed。
- [done] Phase distribution：按状态机阶段展示数量。
- [done] Risk queue：优先展示 paused、cost guard、global non-pass、high priority 等 issue。
- [done] Cost runway：展示 tripped 数、calls/tokens remaining。
- [done] Recent activity：事件与通知更紧凑，适合运营扫描。
- [done] 新增 `apps/web/app/loops/page.test.tsx`，用 mock telemetry 验证控制台关键区块渲染。

实施文件：

- `apps/web/app/loops/page.tsx`
- `apps/web/app/loops/page.test.tsx`
- `docs/0620/crewAI/*`

验收命令：

```bash
pnpm --filter @repo/web type-check
pnpm --filter @repo/web test
pnpm regression:docs0620
```

验收结果：

- `pnpm --filter @repo/web type-check`：通过。
- `pnpm --filter @repo/web test`：通过。
- `pnpm regression:docs0620`：通过。

回归中发现并修复：

- `scripts/loops-cli.ts` 仍按旧 `LoopsService` 构造函数注入依赖，导致 `pnpm loops:doctor` / `pnpm loops:db-doctor` 编译失败。
- 已补 `LoopsWorkLockService` 注入，单独验证 `pnpm loops:doctor` 与 `pnpm loops:db-doctor` 通过，随后全量回归通过。

## R2 Issue Detail Evidence View

状态：done

目标：

- 详情页补齐 Shard 证据链和 Next Action。
- 不改后端契约。

实施内容：

- [done] 顶部新增 Next Action，根据 paused/spec/shard/global verdict/finalized 状态提示下一步。
- [done] 顶部新增 Evidence Coverage，聚合 implementation/test/review/annotation 覆盖。
- [done] 保留原有 Shard 表单、Spec review、Test Matrix、Review/Test/Annotation/Event/Notification 区块。

实施文件：

- `apps/web/app/loops/[issueId]/page.tsx`

验收结果：

- `pnpm --filter @repo/web type-check`：通过。
- `pnpm regression:docs0620`：通过。

## R3 Tests And Visual Regression

状态：done

目标：

- 为 dashboard 聚合函数补单测。
- 若本地浏览器可用，启动 dev server 并做 Playwright smoke。

实施内容：

- [done] 新增 `apps/web/app/loops/loops-dashboard-model.ts`，抽出 phase label、聚合、风险队列和 phase display。
- [done] 新增 `apps/web/app/loops/loops-dashboard-model.test.ts`，覆盖 health metrics、risk priority、phase display。
- [done] 保留 R1 的 `apps/web/app/loops/page.test.tsx` 渲染测试。
- [accepted] Playwright smoke 未纳入本轮硬门槛；`pnpm regression:docs0620` 已覆盖 build。

验收结果：

- `pnpm --filter @repo/web type-check`：通过。
- `pnpm --filter @repo/web test`：通过。
- `pnpm regression:docs0620`：通过。

## R4 Metrics API

状态：planned

目标：

- 新增后端聚合 endpoint，减少前端拼装。
- 需要 contract/schema/service/controller/test 全链路。

## R5 CrewAI Template Compatibility

状态：planned

目标：

- 将 CrewAI Crew/Flow 设计思想转成 Loops issue 模板。
- 需要产品确认模板范围和默认 acceptance criteria。

## Blocked

以下项继续沿用 `docs/0620/05-blockers.md`：

- 真实 SSO 浏览器 E2E。
- Feishu 入口/审批/反向通知。
- 真实远端 PR 与 diff 自动回收。
- 多 Loop 并行与独立 worker。
- 真实 CLI 稳定性、成本计量和生产告警。
