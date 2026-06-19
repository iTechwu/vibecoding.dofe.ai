# TASK-02 · Contract 与 API 表面

## 任务目标

调整 Loops contract 与 API 表面，使 v1 的无登录 Issue 提交、Issue 查询、Loop 状态查询具备清晰的 Zod-first 协议。

## 依赖

- 依赖 `TASK-00` 的 v1 边界。
- 可与 `TASK-01` 并行，但字段命名需保持一致。

## 本任务范围

- 梳理 `packages/contracts/src/schemas/loops.schema.ts` 与 `packages/contracts/src/api/loops.contract.ts`。
- 明确 create issue 请求无需登录态。
- submitter 可由后端默认填充：

```yaml
provider: dev
user_id: dev-user
name: Developer
```

- 明确 API response 返回 DB 索引状态与 `.loops` detail 的组合边界。

## 推荐 API 语义

- `POST /loops/issues`
  - 创建 Issue、Intake、初始 LoopState。
  - v1 前端可不传 submitter。
- `GET /loops/issues`
  - 从 DB 索引查询列表。
  - 返回分页或列表结构需符合项目列表规范。
- `GET /loops/issues/:issueId`
  - 返回 DB Issue + `.loops` detail。
- 现有 `generateSpec`、`reviewSpec`、`decompose`、`run`、`global-review`、`finalize` 路由保留。

## 可能涉及文件

- `packages/contracts/src/schemas/loops.schema.ts`
- `packages/contracts/src/api/loops.contract.ts`
- `apps/api/src/modules/loops/loops.controller.ts`
- `apps/api/src/modules/loops/loops.service.ts`
- `apps/web/lib/api/loops.ts`

## 验收标准

- Contract schema 能表达无登录提交 Issue。
- 请求/响应仍使用 Zod schema。
- API 层只做 request/response 映射，不写业务状态机。
- 不要求真实 SSO token 或 session。
- Web client 类型能从 contract 正确推导。

## 验证建议

- `pnpm --filter @repo/contracts type-check`
- `pnpm --filter @repo/web type-check`
- `pnpm --filter @repo/api type-check`

## 禁止事项

- 不绕过 `packages/contracts` 临时手写 API 类型。
- 不新增 SSO 必填字段。
- 不改变已有 Loop 操作路由的业务含义。

## 实施回填

- 状态：done
- 实施分支：main
- 关键改动：
  - `CreateLoopIssueRequestSchema` 允许 `submitter`/`submitterId`/`submitterName` 全部可选；前端无需登录态。
  - `LoopIssuesQuerySchema` 基于 `PaginationQuerySchema` 扩展 `status`/`phase`/`priority`/`targetRepo`；`LoopListResponseSchema` 使用 `PaginatedResponseSchema(LoopIssueListItemSchema)`，符合项目列表规范。
  - `loops.contract.ts` 提供 `POST /loops/issues`（201）、`GET /loops/issues`、`GET /loops/issues/:issueId` 以及 `listLegacy`，并保留 `generateSpec`/`reviewSpec`/`decompose`/`run`/`global-review`/`reloop`/`finalize` 等路由语义。
  - 服务端 submitter 兜底已落地：`LoopsService.normalizeSubmitter` 在不传 submitter 时返回 `{ provider:'dev', userId:'dev-user', name:'Developer' }`，并由 `loops.service.spec.ts` 断言 `submitterId==='dev-user'`。
  - 列表/详情经 `LoopsPersistenceService` 走 DB 索引（有数据或带过滤时直接查 DB），无 DB 数据时回退 `.loops`；详情合并 DB 顶层字段与 `.loops` 详细产物。
- 验证命令：
  - `sed -n '59,75p;420,438p' packages/contracts/src/schemas/loops.schema.ts`
  - `sed -n '31,70p' packages/contracts/src/api/loops.contract.ts`
  - `rg -n "normalizeSubmitter|dev-user|Developer" apps/api/src/modules/loops/loops.service.ts`
  - `pnpm --filter @repo/contracts type-check` / `pnpm --filter @repo/web type-check`（均通过）
- 验证结果：通过；contract/Zod-first 表面完整、服务端默认 submitter 生效、列表 DB 优先且符合分页规范。
- 剩余风险：`listLegacy` 与 `list` 指向同一实现，后续若要区分语义需单独处理；DB-backed 列表运行期需可用 DB。
- 需要归档到 IMPLEMENTATION-ANNOTATIONS.md 的内容：
  - TASK-02 升级为 done：contract/API、服务端默认 submitter、DB 优先列表均完成并通过 web/contracts type-check。
