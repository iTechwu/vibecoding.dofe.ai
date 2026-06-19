# 02 · API / Contract / Service 计划

## 目标

将现有 Loops API 从「文件态 MVP」升级为「DB Issue 索引 + `.loops` 文档真相源」的 v1 产品链路，同时保持 Zod-first 和 ts-rest contract。

## 当前可复用能力

- `packages/contracts/src/schemas/loops.schema.ts` 已定义 Issue、Intake、Spec、Shard、State、Record、Notification 等 schema。
- `packages/contracts/src/api/loops.contract.ts` 已定义 `/loops` API。
- `apps/api/src/modules/loops` 已包含 controller / service / file-store / runner / adapters。
- `apps/web/app/loops` 已能展示队列与详情，并触发 run / review / finalize 等操作。

## Contract 调整

### CreateLoopIssueRequest

v1 继续保留 submitter 字段，但前端可不传，由后端默认：

```ts
submitterId: "dev-user"
submitterName: "Developer"
```

后端需要保证：

- request body 不要求登录 token。
- response 返回 DB 与 `.loops` 均创建成功后的 IssueCreatedResponse。
- 错误返回字段级 message，供 Web 表单展示。

### LoopListResponse

保持现有结构，但数据源改为 DB 优先：

```ts
{
  issues: LoopIssue[],
  loops: LoopStateItem[]
}
```

### LoopDetailResponse

保持现有结构，detail 仍从 `.loops` 读取；未来可逐步补 DB records。

## Service 分层

建议拆成三层：

| 层 | 模块 | 责任 |
| --- | --- | --- |
| Controller | LoopsController | ts-rest handler，只做 request/response |
| Orchestrator | LoopsService | Phase 状态机、agent 调度、收敛控制 |
| Persistence | LoopsPersistenceService | DB + `.loops` 双写、状态同步、一致性检查 |
| DB Service | LoopIssueDbService 等 | 唯一 Prisma 访问点 |
| File Store | LoopsFileStoreService | `.loops` 文档真相源 |

## 关键 API 行为

### POST /loops/issues

v1 语义：

1. 无登录。
2. 默认开发者 submitter。
3. 写 DB Issue / Intake / LoopState。
4. 写 `.loops` Issue / Intake / State / raw payload。
5. 返回创建结果。

### GET /loops

1. 查 DB Issue 列表。
2. 查 DB LoopState 列表。
3. 如果 DB 暂无数据但 `.loops` 有旧数据，可显示 `.loops` fallback，并在 doctor 提示 backfill。

### GET /loops/issues/:issueId

1. 确认 DB 或 `.loops` 中存在 issue。
2. 返回 `.loops` detail。
3. 详情页展示 DB 与文件状态不一致时的 doctor warning。

### POST /loops/issues/:issueId/run

1. 从 `.loops` detail 驱动现有 runLoop。
2. runLoop 完成后同步 DB LoopState。
3. 若所有 shard DONE，phase 同步为 `PHASE_6_CONVERGE`。

### POST /loops/issues/:issueId/finalize

1. 现有 finalize 成功后同步 DB Issue CLOSED。
2. 同步 DB LoopState CLOSED / finalized。

## 错误策略

- DB 写成功但 `.loops` 写失败：返回失败，并记录补偿日志；doctor 应能提示 DB/file 不一致。
- `.loops` 写成功但 DB 写失败：返回失败；保留 `.loops` 证据，提供 backfill。
- targetRepo 不在允许根：创建失败，不写 DB。
- 缺少标题、body、验收标准：创建失败，Web 显示字段错误。

## 验收

- Controller 不直接访问 DB。
- LoopsService 不直接访问 Prisma。
- 所有 API request/response 走 Zod schema。
- 创建、列表、详情、run、finalize 都能同步 DB 状态。

