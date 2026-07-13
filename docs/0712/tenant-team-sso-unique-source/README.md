# Tenant / Team 以 SSO 为唯一源审查

## 当前结论（2026-07-12）

Tenant 的唯一权威已收敛到 SSO：本项目不维护 tenant、team、成员关系或当前选择主数据；仅保存
经 SSO 验证后的 tenant 外键快照，用于资源归属、查询过滤和审计。`getTenantPreference` 提供当前
tenant，`getTenants` 验证成员关系，客户端 header/localStorage 仅在 SSO 尚无 preference 时作为候选，
绝不作为授权或归属依据。

Loops 的业务访问另有明确边界：SSO 只提供“该用户属于哪个 tenant”的事实，Vibecoding 在本地把已验证
tenant 成员资格解释为可使用 Loops 的产品访问权。不得在 SSO 中定义或要求 `vibecoding:loops:*`；仅真正
全局的控制面仍使用 SSO superadmin 身份判断。

| 项目                                    | 状态                     | 当前边界                                                                                   |
| --------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------ |
| SSO current tenant 解析                 | 已完成                   | preference 优先，membership 必验，显示名仅取自 SSO。                                       |
| 创建、列表、详情、issue 操作            | 已完成                   | DB tenant predicate + 404 归属断言；历史 NULL 对任何 tenant 不可见。                       |
| 日志、通知、cost、metrics、runtime 聚合 | 已完成                   | 文件聚合由 DB tenant issue allowlist 过滤。                                                |
| Eval 与 archive                         | 已完成                   | 普通路由固定当前 tenant；跨 tenant 只能走 audited superadmin 路由。                        |
| 历史 NULL tenant_id                     | 工具完成，未执行生产回填 | 默认 dry-run；只凭 submitter 的 SSO preference + membership 条件写入。                     |
| 全局控制面                              | 已完成                   | doctor、scheduler、全局 Eval/learning worker、resume 等仅 SSO superadmin。                 |
| current team                            | 受 SSO 契约阻塞          | SDK 没有可信 current-team preference/token claim，teamId 继续不接收客户端输入且保持 NULL。 |

## 已关闭的风险

- 公开 Issue 创建 contract 不再接受 `tenantContext`；controller 只将 `SsoScopeService` 返回的
  tenant 写入内部 context。
- `LoopIssue.tenantId` / `teamId` 为 additive 投影，按 tenant 有索引；新记录写入 verified tenant。
- list/detail/action/evidence/download 与不带 issueId 的日志、通知均不能跨 tenant；file JSON 从不
  作为授权回退。
- Eval service 不再产生或读取 `default` tenant；request-time fallback 同样按 target tenant 收集 evidence。
- 普通 archive/Eval 不能指定 tenant；`/admin/tenants/:tenantId/...` 与 `/admin/scope-backfill` 均要求
  `req.isAdmin` 对应的 SSO superadmin，且写入审计事件。
- 归档 collection port 也接收 target scope，避免 archive manifest 混入其他 tenant 的 issue。
- 浏览器 localStorage 仅为 UI cache；tenant 切换时 React Query 的 `['loops']` 查询失效。

## 受控运维项

历史回填必须先调用 `POST /admin/scope-backfill` 的默认 `dryRun=true`，保存 mapped/pending 结果后，
由 SSO superadmin 用同样 batch 参数执行 `dryRun=false`。无法验证、非 SSO submitter 或并发已经赋值的
记录必须继续保留 `tenant_id = NULL`，不能归入 `default` 或任意猜测 tenant。完成全部可验证批次前，
不得把列改为非空。

## 唯一外部阻塞项

当前 SSO SDK 的 `UserTenantPreference` 和认证 claims 不包含可信 current-team。只有 SSO 发布
team preference 或已签名 team claim 后，才可把 `teamId` 投影为必填并在 DB predicate 中启用 team 过滤；
本项目不得以 header、body、localStorage 或本地 team 表补偿该能力。

## 文档索引

- [SSO 契约审查](./SSO-CONTRACT-AUDIT.md)
- [执行计划](./EXECUTION-PLAN.md)
- [循环实施记录](./CYCLE-LOG.md)
