# Tenant / Team 以 SSO 为唯一源审查

## 结论

当前项目已经把认证和权限检查接入 SSO，但还没有把 tenant/team 的
**归属、查询和授权**全部收敛到同一条 SSO 可信链。`tenantContext` 在
Loop 中既被当作展示信息，也被持久化为业务归属；而它在缺少 JWT scope
时可由浏览器请求体或请求头提供。对“tenant 和 team 唯一源是 SSO”的约束
而言，这需要优先整改。

本项目不应拥有 tenant/team 主数据、成员关系或切换逻辑。它只应保存经 SSO
验证后的不可变 scope 外键快照，用于归属、过滤、审计和权限判定。

## 实施状态（2026-07-12）

| 项目                 | 状态            | 说明                                                                         |
| -------------------- | --------------- | ---------------------------------------------------------------------------- |
| SSO tenant 解析      | 已实施          | 候选 ID 必须由 SSO subject 的 tenant 列表验证，名称以 SSO 返回值为准。       |
| 创建与归档可信链     | 已实施          | 公开 body/query 不再包含 tenantContext/tenantId；普通路径使用已验证 scope。  |
| Eval 默认 tenant     | 已实施          | 缺 scope 和旧 `aggregate-all` job 明确失败，不再产生 `default` 数据。        |
| 归档路径约束         | 已实施          | tenant/archive ID 必须是安全单路径段。                                       |
| LoopIssue scope 投影 | 部分实施        | 新记录写入 nullable tenantId/teamId，历史 NULL 记录尚未回填。                |
| Issue 资源级授权     | 部分实施        | issueId 读写隔离基本完成（Cycle 7-10）；剩余全局聚合 tenant 过滤与历史回填。 |
| 当前 team 解析       | 受 SSO 契约阻塞 | 已发布 SDK 未提供可信 current-team 选择；客户端 teamId 已被拒绝。            |

## 已符合的边界

- `AuthGuard` 基于 `@dofe/sso-nestjs` 的标准认证流程；本项目没有实现另一套
  token 验签或本地登录身份源。
  证据：[auth.guard.ts](../../../apps/api/libs/domain/auth/src/auth.guard.ts:28)。
- 模块权限通过 `SsoClientService` 查询，且使用认证请求中的 `teamId`。
  证据：[permission.service.ts](../../../apps/api/libs/domain/auth/src/permission.service.ts:15)。
- Loop 的 asset-permission 响应明确标识 `source: 'sso'`，并从请求认证上下文
  取用户、team、tenant。
  证据：[loops.controller.ts](../../../apps/api/src/modules/loops/loops.controller.ts:147)。
- Prisma 中没有 tenant/team 主数据或成员关系模型；现有 `LoopIssue` 也没有
  tenant/team 标量列。这避免了主数据复制，但造成后续 scope 查询和授权无法
  可靠下推到数据库。
  证据：[schema.prisma](../../../apps/api/prisma/schema.prisma:82)。

## 优化建议

### P0-1：禁止将客户端 tenant/team 作为 Loop 归属来源

**状态：已实施（Cycle 1-2）。** 公开创建 schema 与 Web body 已移除
`tenantContext`；`x-current-tenant` 只是候选值，controller 通过 SSO tenant 列表
验证后才构造内部归属。teamId 不再接受客户端输入。

`pickTenantContext` 当前优先使用 `req.tenantId`，但在其缺失时会依次回退到
`CURRENT_TENANT_HEADER` 和 `body.tenantContext.tenantId`；`teamId` 也会回退到
请求体，`tenantName` 完全取自请求体。
证据：[loops.controller.ts](../../../apps/api/src/modules/loops/loops.controller.ts:30)。

这意味着签发的 SSO token 不携带 scope 或 SDK 未将 scope 注入 request 时，
经认证的调用方仍可指定任意 tenant/team；展示名称也可伪造并进入 issue、intake
和 raw payload。应建立唯一的服务端 `VerifiedTenantTeamScope`：只接受已验签的
SSO claims，或由服务端使用 SSO 已发布 API 解析并校验当前 tenant/team 成员关系。
若当前 SSO API 无法提供该能力，应拒绝需要 scope 的操作，而不是降级信任请求。

### P0-2：让 Issue 归属可持久化、可过滤、可强制授权

**状态：部分实施（Cycle 6-7）。** `LoopIssue` 已有 nullable tenantId/teamId 投影、
索引和新写入（Cycle 6）；verified scope 过滤能力已贯穿 DB/Persistence/Issues/Service
（Cycle 7，additive，不传 scope 行为不变）。历史数据仍为 NULL，list/detail 运行时尚
未按新列过滤（待 Cycle 8 在 controller 下推后启用）。

创建时得到的 `tenantContext` 会写入 `.loops` 与 JSON payload，DB 的
`loop_issue` / `loop_issue_intake` 却没有 tenantId/teamId 字段。
证据：[loops-issues.service.ts](../../../apps/api/libs/domain/services/loops-issues/loops-issues.service.ts:104)、
[loops-db.service.ts](../../../apps/api/generated/db/modules/loops/loops-db.service.ts:50)。

因此列表和详情读取无法按 scope 下推：`listIssues` 只过滤状态、优先级、仓库和
phase，`getIssueDetailByIssueId` 只按 issueId 查询；文件回退路径同样不做 scope
过滤。
证据：[loops-db.service.ts](../../../apps/api/generated/db/modules/loops/loops-db.service.ts:195)、
[loops-issues.service.ts](../../../apps/api/libs/domain/services/loops-issues/loops-issues.service.ts:271)。

应在 LoopIssue（以及需要独立检索的 intake/audit 投影）持久化已验证的
`tenantId`、`teamId`，建立复合索引，并将每个 Issue 的读取、操作和列表都绑定到
同一 scope。保留 JSON 中的 tenant 名称只能作为创建时显示快照，不能作为授权
依据或反向同步 SSO 的来源。

### P0-3：把 Issue API 的 scope 授权补齐到业务层

**状态：部分实施（Cycle 7-10）。** 这是当前最高优先级剩余项；verified scope 过滤能力
已下沉到 DB/Persistence/Issues/Service（Cycle 7，additive），list/getIssue 读路径已在
controller 下推 verified scope（Cycle 8），核心推进写操作与证据读经 `assertIssueScope`
绑定 verified scope（Cycle 9），辅助 issueId 操作（naturalCommand/browserQa/secondOpinion/
delivery/intervene/getBrowserQaArtifact）与 logs/notifications 的 issueId 分支亦已接入
（Cycle 10）。剩余：全局聚合 list 的 tenant 过滤、历史 NULL 回填、SSO 阻塞项与前端
localStorage（Cycle 11）。

当前 `list`、`getIssue` 等 controller 只做模块级 `READ` 权限校验，且不接收
认证 request，因此无法将请求 SSO scope 传入 service。
证据：[loops.controller.ts](../../../apps/api/src/modules/loops/loops.controller.ts:59)、
[loops.controller.ts](../../../apps/api/src/modules/loops/loops.controller.ts:131)。

模块权限回答“能否使用 Loops”，不能回答“能否访问 tenant A 的 issue”。应在
service 的 Issue load/list 入口加入 scope filter / ownership assertion，并使所有
按 `issueId` 的读、推进、审阅、证据、下载和写操作复用它。不存在同 scope 的
记录时返回 404，避免泄漏其他 tenant 中 issue 的存在性。

### P0-4：收紧跨 tenant 端点和文件路径

**状态：部分实施（Cycle 3-5，12）。** 普通 archive/Eval 路径已绑定 current SSO tenant，
归档路径已验证，未验证的跨 tenant Eval 已拒绝。Cycle 12 直接审查 SSO SDK 确认 `req.isAdmin`
即 SSO super admin（见 [SSO-CONTRACT-AUDIT.md](./SSO-CONTRACT-AUDIT.md)），跨 tenant 管理端点
**不再被 SSO 阻塞**，待 Cycle 14 用专用 admin 端点实现；在此之前不能由普通 `READ` / `OPERATE` 路径绕过。

Eval 聚合和归档接口把 `tenantId` 放在 query/body 中，但 controller 没有把调用者
的 SSO scope 传入 service。归档列表仅要求 `READ`，归档 URL 刷新仅要求
`OPERATE`；只要知道 ID，调用者就可请求其他 tenant 的数据。
证据：[loops.controller.ts](../../../apps/api/src/modules/loops/loops.controller.ts:1305)、
[loops.controller.ts](../../../apps/api/src/modules/loops/loops.controller.ts:1443)。

此外 archive index 直接把 tenantId 交给 `path.join`，而 contract 只要求非空字符串。
证据：[loops-file-store.service.ts](../../../apps/api/libs/domain/services/loops-store/loops-file-store.service.ts:2896)。

普通调用应由服务端注入当前 verified scope；只有 SSO 明确定义的全局管理员能力
才可指定其他 tenant，并必须由专用权限、目标 tenant 校验、审计事件和安全的路径
标识符共同保护。不要把“跨 tenant”当作任意带权限用户可横向读取的默认语义。

### P1-1：降级浏览器 localStorage 的语义

**状态：已实施（Cycle 2, 11）。** localStorage 仍用于 UI 展示和请求候选值，但已显式
降级为非权威 UI cache（storage 模块注释声明不是归属/授权来源），且不再进入公开 mutation
body。tenant 切换后经 `useTenantQueryInvalidation` hook 失效 tenant-scoped 的 React Query
缓存（`['loops']`），避免显示旧 tenant 数据。

浏览器会把 SSO session 的当前 tenant 同步到 localStorage，随后创建表单直接将
这个缓存作为 `tenantContext` 发送；存储模块还导出了任意调用方可调用的 setter。
证据：[sso-session.ts](../../../apps/web/lib/sso-session.ts:33)、
[use-current-loop-tenant.ts](../../../apps/web/app/loops/new/use-current-loop-tenant.ts:6)、
[new-loop-issue-form.tsx](../../../apps/web/app/loops/new/new-loop-issue-form.tsx:71)。

这份数据可继续作为离线展示和 SSO session 刷新前的 UI hint，但需要改名/注释为
非权威缓存，并且不得进入创建契约或作为后端 fallback。SSO tenant 切换后应重新
获取 session，并使 React Query 中的 tenant-scoped key 失效。

### P1-2：移除非 SSO 的默认 tenant

**状态：已实施（Cycle 4）。** 生产 Eval 聚合不再使用 `default`；缺少 verified
tenant 会失败。历史 `default` 数据的处置仍需要数据盘点。

Eval 聚合在没有 tenantId 时写入/读取字面量 `default`。
证据：[loops.service.ts](../../../apps/api/src/modules/loops/loops.service.ts:2310)、
[loops-eval.service.ts](../../../apps/api/libs/domain/services/loops-eval/loops-eval.service.ts:722)。

该值会制造一个不属于 SSO 的伪 tenant。单 tenant 开发环境可用明确的开发 fixture
或测试注入；生产路径必须要求 verified scope。历史 `default` 数据需要迁移到
明确的 tenant，或隔离为不可对外查询的旧数据。

## 取舍与不建议事项

- 不在本项目创建 tenant、team、membership、切换状态或同步任务；其所有权属于
  `sso.dofe.ai`。
- 不仅依赖前端隐藏 tenantId，也不以 localStorage、普通 HTTP header、请求体或
  issue JSON 作为授权证据。
- 不将 SSO 的成员关系全量复制到本地。Loop 仅保存经验证 scope 的外键快照和
  必需的审计元数据。
- 不把超级管理员绕过扩散到一般 `READ` / `OPERATE` 权限。跨租户需要显式、可审计
  的 SSO 能力。

详细执行步骤见 [EXECUTION-PLAN.md](./EXECUTION-PLAN.md)。
