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

- 状态：partial
- 实施分支：main
- 关键改动：
  - `CreateLoopIssueRequestSchema` 已允许 `submitter`、`submitterId`、`submitterName` 可选。
  - `LoopIssuesQuerySchema` 基于 `PaginationQuerySchema` 扩展 status/phase/priority/targetRepo。
  - `LoopListResponseSchema` 使用 `PaginatedResponseSchema(LoopIssueListItemSchema)`。
  - `loops.contract.ts` 已提供 `POST /loops/issues`、`GET /loops/issues`、`GET /loops/issues/:issueId` 以及原有 Loop 操作路由。
- 验证命令：
  - `sed -n '1,240p' packages/contracts/src/schemas/loops.schema.ts`
  - `sed -n '1,260p' packages/contracts/src/api/loops.contract.ts`
  - `sed -n '1,190p' apps/api/src/modules/loops/loops.controller.ts`
- 验证结果：partial；Zod-first API 表面已存在，但 `LoopsService.createIssue` 仍读取 `submitterId` / `submitterName`，服务端默认 dev submitter 未真正兜底；列表实现仍来自 `.loops` 文件，不是 DB index。
- 剩余风险：如果前端不传 mock submitter，后端可能写出 undefined submitter 字段；后续应在 service/persistence 层统一 normalize。
- 需要归档到 IMPLEMENTATION-ANNOTATIONS.md 的内容：
  - TASK-02 最终状态为 partial：contract/API 基本完成，服务端默认 submitter 与 DB-backed API 边界未完成。
