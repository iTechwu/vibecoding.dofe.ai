# 实施循环记录

每轮遵循：实施 -> 标注文档 -> 审查待实施项 -> 标注文档 -> 下一轮实施。

## Cycle 1：SSO tenant 解析边界

**实施**：新增 `SsoScopeService`。它只使用认证 guard 写入的已验证 SSO subject
调用 `SsoClientService.client.users.getTenants`，把客户端提交的 tenant ID 降级为
候选值，并从 SSO 返回权威 tenant ID 和显示名称；缺少候选值或不属于用户 scope
时拒绝请求。`AuthenticatedRequest` 补齐 SDK 已写入的 `ssoSub` 类型。

**验证**：`pnpm --filter @repo/api exec jest libs/domain/auth/src/sso-scope.service.spec.ts --runInBand`
通过（3 tests）。

**审查待实施项**：创建 controller 仍会回退请求体的 `tenantContext`，公开创建
contract 仍暴露该字段，前端也还会发送 localStorage 快照。因此 resolver 尚未进入
业务链路；下一轮应先收敛 contract 和 controller，且浏览器 header 只能作为经 SSO
解析的候选值。

**计划状态**：Step 1 已完成可消费 SSO tenant scope 的项目内实现；“SSO 当前 team
选择”的已发布契约仍缺失，team 不能从客户端候选值恢复。

## Cycle 2：Issue 创建可信链

**实施**：从两个公开 Issue 创建 schema 移除 `tenantContext`；全量 Web API client
只发送 `x-current-tenant` 候选 ID。Loops controller 使用 `SsoScopeService` 将候选 ID
与 authenticated `ssoSub` 交给 SSO 校验，只有返回的权威 tenantId/名称才进入内部
`tenantContext`。客户端 body 不再携带 tenantId、tenantName 或 teamId。

**验证**：contracts schema tests（18）、两个 New Issue form suites（137）、API 的
scope + issue service focused tests（8）以及 API `type-check` 均通过。

**审查待实施项**：Issue 的可信 tenantContext 仍只存在 `.loops` / JSON 中，数据库
没有可供 list/detail/action 过滤的 scope 列；因此 P0-2/P0-3 尚未关闭。归档 index
仍把请求 tenantId 用于路径，并且 Eval 聚合仍会创造 `default` tenant；两者可在不
依赖 DB migration 的前提下先行消除。

**计划状态**：Step 2 已完成。teamId 不再接受客户端值；在 SSO 发布当前 team
选择的可信契约前，Loop 创建不写 team scope。

## Cycle 3：归档路径输入边界

**实施**：新增 archive path utility，并使 archive index 的写入、列表读取和单项
读取统一使用它。tenantId/archiveId 现在必须是最长 128 个字符的单个安全路径段；
拒绝空值、`.` / `..`、斜杠、绝对路径和 URL 编码分隔符。

**验证**：`pnpm --filter @repo/api exec jest
libs/domain/services/loops-store/loops-archive-path.util.spec.ts --runInBand` 通过（11
tests）；相关 API eslint 通过。

**审查待实施项**：归档权限仍未把 SSO scope 传入 controller/service，因而安全的
路径并不等同于安全的跨 tenant 访问。Eval aggregation 仍为未提供 tenant 的 worker
写入 `default`，会制造非 SSO tenant 数据；下一轮先关闭这个无默认值原则。

**计划状态**：Step 5 的文件系统输入保护已完成；普通与跨 tenant 的授权模型仍待
Step 4/5 scope-aware controller 改造。

## Cycle 4：Eval 无默认 tenant

**实施**：Eval domain worker 在缺少 tenantId 时显式抛错，不再写入字面量 `default`。
同步读取、同步 worker 和 enqueue controller 都解析当前 SSO tenant，并覆盖 request
中可能提供的 tenantId；队列只产生 `aggregate-tenant` job。processor 拒绝
`aggregate-all` 或没有 tenantId 的旧 job，等待 SSO 全局管理员的 tenant 枚举契约。

**验证**：Eval service focused tests 通过（7 tests）；contracts schema tests 通过
（18 tests）；API `type-check` 通过。相关 eslint 没有错误；`loops-eval.service.ts`
仍报告一个既有的未使用变量 warning（行 662），本轮未修改该独立逻辑。

**审查待实施项**：LoopIssue 仍没有 tenant/team 标量列，Issue list/detail/action
仍未以 verified tenant 查询或断言，因此最重要的资源级隔离尚未关闭。归档 API 也仍
直接从 body/query 接收 tenantId；下一轮应至少在 archive controller 将目标 tenant
绑定到 resolver，并把跨 tenant 管理保留为显式待办。

**计划状态**：Step 5 的“移除 `default` tenant”完成；全量跨 tenant Eval 被安全地
暂停，不能在没有 SSO 管理员 scope 枚举的情况下恢复。

## Cycle 5：归档 API scope 绑定

**实施**：archive create/list/refresh 三个公开 contract 不再接受 tenantId；controller
对每个请求解析 SSO tenant，并只把该 ID 传给内部 archive service。内部 service 仍保留
tenantId 参数，作为未来 SSO 全局管理员专用接口的受限边界，而非普通 HTTP 输入。

**验证**：contracts schema tests 通过（19 tests），API `type-check` 通过；controller
和相关 contract eslint 通过。

**审查待实施项**：最主要的未关闭项是 LoopIssue DB 没有 verified tenantId 列，导致
list/detail 不能在数据库查询中按 scope 过滤，按 issueId 的业务操作也尚未统一做归属
断言。下一轮先以 additive migration 持久化 verified tenantId，并保持历史无 scope
记录的可见性为显式迁移状态，而非冒充任意 tenant。

**计划状态**：Step 5 的普通 archive 路径已完成。跨 tenant archive 仍必须等待 SSO
明确的全局管理员 capability，当前 API 不提供该绕过。

## Cycle 6：LoopIssue scope 持久化基础

**实施**：`LoopIssue` 增加 nullable `tenantId` / `teamId` 列及按更新时间的 scope
索引；新增数据库迁移；Loops DB service 从内部 `tenantContext` 将 scope 写入新记录。
Prisma client 已重新生成。列保持 nullable，历史数据不会被伪造地回填到 `default`。

**验证**：API `type-check` 通过；`prisma generate`、`prisma format` 和 `git diff
--check` 通过。generated DB service 被 lint 配置忽略，只报告无错误的 ignore warning。

**审查待实施项**：新列现在已可用于过滤，但 `listIssues`、`getIssueDetailByIssueId`
和所有 issueId action 尚未接受 verified scope；历史 NULL 记录也仍需要经 SSO/审计
证据回填。当前 published SSO SDK 没有可信的 current-team 选择，因此新 Web Issue
只持久化 tenantId，teamId 保持 NULL，不能由客户端补写。

**计划状态**：Step 3 部分完成（schema、迁移、新写入投影）；Step 4 尚未完成，资源
级读写隔离必须在后续将 verified scope 贯穿所有 Issue 入口后才可标记关闭。

## Cycle 7：scope 过滤能力下沉（additive 基础）

**实施**：新增共享 `LoopIssueScope` 契约（`{ tenantId, teamId? }`），并把经验证的
scope 作为**可选**参数贯穿 DB→Persistence→Issues→LoopsService：

- `LoopsDbService.listIssues(query, scope?)` 在 `where` 下推 `tenantId`；
  `getIssueDetailByIssueId(issueId, scope?)` 改用 `findFirst`，scope 不匹配读作 null。
- `LoopsPersistenceService.list(query, scope?)` 透传 DB，文件回退分支按
  `tenantContext.tenantId` 过滤；新增 `readDetailScoped(issueId, scope)`，**DB 不命中即
  返回 null，绝不回退文件**（JSON tenantContext 只是展示快照，不是授权依据）。
- `LoopsIssuesService.getIssue/list` 与 `LoopsService.getIssue/list` 接收可选 scope；
  standalone（无 persistence）路径在带 scope 时拒绝，不降级信任文件。

**验证**：`pnpm --filter @repo/api exec jest
libs/domain/services/loops-store/loops-persistence.scope.spec.ts --runInBand` 通过（5
tests）；API `type-check` 通过；contracts tests 通过（56 tests）。全部改动为 additive，
不传 scope 时行为不变，运行时未启用资源级隔离。

**审查待实施项**：scope 能力已就绪但 controller 仍未传入 verified scope，因此 list/detail
当前仍不按 tenant 过滤。NULL 历史记录、跨 tenant 读写隔离尚未真正生效。下一轮应在
controller `list`/`getIssue` 解析 `VerifiedTenantScope` 并下推，启用读路径的资源级隔离，
并补 controller/integration 测试覆盖跨 tenant 404 与 NULL 不可见语义。

**计划状态**：Step 4 的基础设施完成（scope 可贯穿读路径），但尚未启用；Step 3 历史回填
仍未开始。teamId 过滤待 SSO current-team 契约发布后启用，本轮只用 tenantId。

## Cycle 8：list / getIssue controller 启用资源级读隔离

**实施**：`list`、`listLegacy`、`getIssue` 三个 controller 新增 `@Req() req`，每个请求先经
`resolveTenantContext` 解析 verified SSO scope，再下推到 `LoopsService.list/getIssue`。
由此 DB 查询在 `where` 下推 `tenantId`，跨 tenant 与历史 NULL 记录在读路径不可见；`getIssue`
对不匹配 scope 的记录返回 404，避免泄漏其他 tenant issue 的存在性。

**验证**：`pnpm --filter @repo/api exec jest
libs/domain/services/loops-issues/loops-issues.scope.spec.ts --runInBand` 通过（4 tests，覆盖
scope mismatch→404、match→enriched detail、standalone 拒绝信任文件、list 下推 scope）；API
`type-check` 通过。controller 接线由 type-check 保证签名一致，端到端跨 tenant 行为复用
Cycle 7 的 persistence scope spec（readDetailScoped 不回退文件）。

**审查待实施项**：读隔离已对 list/detail 生效，但所有按 `issueId` 的写操作（generateSpec、
review、advance、finalize、intervene、naturalCommand 等）和 `getDeliveryEvidence` 仍直接调用
`LoopsService` 而未做 scope 归属断言——只要知道 issueId 即可推进/审阅其他 tenant 的 loop。
下一轮应统一在 `LoopsService` 提供 scope-aware 的 load 入口，并让这些写操作与证据读复用它。

**计划状态**：Step 4 的 list/detail 读路径已启用；issueId 写操作与证据/下载路径仍待 Cycle 9。
历史 NULL 回填（Step 3）与跨 tenant 显式管理员能力（Step 5）尚未开始。

## Cycle 9：核心 workflow 推进与证据读的 scope 归属断言

**实施**：`LoopsService` 新增 `assertIssueScope(issueId, scope?)`——复用 `readDetailScoped`，
scope 不匹配或 standalone 无 persistence 时抛 `NotFoundException`（404），无 scope 时 no-op
（CLI/internal 路径不受影响）。controller 新增 `authorizeIssueScope(req, issueId)` helper，
在以下核心推进/证据入口首先断言归属：`generateSpec`、`reviewSpec`、`decompose`、`runShardTests`、
`recordShardImplementation`、`reviewShard`、`runLoop`、`advance`、`reviewGlobal`、`reloop`、
`finalize`、`getDeliveryEvidence`。service 方法签名不变，保证既有 e2e/CLI 不破坏。

**验证**：`pnpm --filter @repo/api exec jest loops.service.scope.spec --runInBand` 通过（4 tests，
覆盖 no-scope no-op、mismatch→404、match→放行、standalone 拒绝）；API `type-check` 通过。

**审查待实施项**：核心 phase 推进链与证据读已绑定 scope，但辅助 issueId 操作尚未接入：
`naturalCommand`、`runBrowserQa`、`runSecondOpinion`/`resolveSecondOpinion`、`runReleaseCanary`、
`governDelivery`、`intervene`、`governLearning`、`resume`、`getBrowserQaArtifact`。只要知道 issueId
仍可触发这些跨 tenant 操作。此外 persistence 文件回退分支虽已按 tenantContext 过滤，但
`readDetail`（无 scope）仍是 detail 主路径，需在 Cycle 10 统一收紧并与 list 的 scope 行为一致。

**计划状态**：Step 4 的核心写操作归属断言完成（11 项 + getDeliveryEvidence）；辅助 issueId 操作、
文件回退一致性、历史 NULL 回填（Step 3）与跨 tenant 显式管理员能力（Step 5）仍待后续 Cycle。

## Cycle 10：辅助 issueId 操作 scope 断言 + 文件回退一致性确认

**实施**：把 `authorizeIssueScope` 接入剩余 issueId 入口——`naturalCommand`、`runBrowserQa`、
`runSecondOpinion`、`resolveSecondOpinion`、`runReleaseCanary`、`governDelivery`、`intervene`、
`getBrowserQaArtifact`，以及 `logs`/`notifications` 的 `issueId` 分支（仅当请求指定 issueId 时断言
归属）。`governLearning`（learningId 资源）、`resume`（全局 ADMIN 能力）、`cost`/`metrics`（全局
统计）不属 issueId scope，本轮不动。文件回退一致性在 Cycle 7 已奠定（`list` 文件回退按
`matchesScope` 过滤、`readDetailScoped` 绝不回退文件）；本轮确认无 scope 的 `readDetail` 仅用于
已 `authorizeIssueScope` 授权后的内部数据读取，授权与数据读取职责分离。

**验证**：API `type-check` 通过；三个 scope spec（persistence/issues/service）共 13 tests 通过。
辅助操作接线复用 `assertIssueScope`（Cycle 9 已测），签名一致性由 type-check 保证。

**审查待实施项**：`logs`/`notifications` 在**不带 issueId** 的全局聚合分支仍从文件 store 跨 tenant
读取（store 层未按 tenant 过滤），需后续在 store 层引入 tenant-scoped 读或要求 issueId。历史 NULL
回填（Step 3）、跨 tenant 显式管理员能力（Step 5，受 SSO 契约阻塞）仍未开始。前端 localStorage
降级与 React Query 失效（P1-1）留待 Cycle 11。

**计划状态**：Step 4 的 issueId 读写隔离基本完成（核心推进 + 辅助 + 证据 + logs/notifications 的
issueId 分支）；剩余仅全局聚合 list 的 tenant 过滤、历史回填与 SSO 阻塞项。

## Cycle 11：前端 localStorage 降级语义 + tenant 切换 React Query 失效

**实施**（P1-1）：`apps/web/lib/storage` 的 Tenant Storage Operations 段落加显式注释，声明
这些 `setCurrentTenant*`/`getCurrentTenant*`/`clearCurrentTenantId` 仅作非权威 UI cache 与
`x-current-tenant` 候选值，绝不是归属/授权来源，不得进入 mutation body。新增
`useTenantQueryInvalidation(queryClient)` hook：监听 `currentTenantUpdated`（同 tab）与 `storage`
（跨 tab，仅 tenant 相关 key）事件，在 tenant 变更时 `invalidateQueries({ queryKey: ['loops'] })`，
因为后端 list/detail 等按 verified tenant 过滤，同一 query key 在切换 tenant 后返回不同数据。
`QueryProvider` 调用该 hook，全局生效。

**验证**：`pnpm vitest run hooks/use-tenant-query-invalidation.test.ts` 通过（4 tests，覆盖
currentTenantUpdated→invalidate、cross-tab storage tenant key→invalidate、无关 key 不失效、
unmount 移除监听）；`lib/storage` + `use-current-loop-tenant` 既有 15 tests 通过；web
`tsc --noEmit` 通过。

**审查待实施项**：前端侧 P1-1 关闭。后端剩余项不依赖前端：历史 NULL scope 回填（Step 3，需
SSO/审计证据脚本）、全局聚合 list/logs 的 tenant 过滤（store 层）、跨 tenant 显式管理员能力
（Step 5，受 SSO 全局管理员 scope 契约阻塞）。这些在 SSO 发布可信 current-team / global-admin
契约前无法本地 fallback 实现。

**计划状态**：P1-1 完成（localStorage 降级 + React Query 失效）。Step 3/5 与全局聚合 tenant
过滤仍待 SSO 契约或数据回填推进。

## Cycle 12：SSO scope 契约确认 + current-tenant 解析升级

**实施**：直接审查已消费的 `@dofe/sso-nestjs@0.1.67` / `@dofe/sso-node` SDK，结论记录于
[SSO-CONTRACT-AUDIT.md](./SSO-CONTRACT-AUDIT.md)。据此升级 `SsoScopeService.resolve`：用
`client.users.getTenantPreference(ssoSubject).lastTenantId` 作为 current-tenant 的**权威唯一源**，
客户端候选（`x-current-tenant`）仅在 SSO 无 preference 时 fallback；`getTenants` 始终验证成员关系，
显示名取自 SSO。`getTenantPreference` 与 `getTenants` 并行（`Promise.allSettled`），preference 不可用
时降级到候选，不阻塞请求。

**关键结论（修正早期"SSO 阻塞"判断）**：

- `req.isAdmin` 即 SSO super admin，已由 `DofeSsoAuthGuardBase` 注入 → **跨 tenant 管理能力阻塞解除**。
- current-**tenant** 已有权威源（`getTenantPreference`），不再依赖客户端候选。
- current-**team** 确认无契约：`UserTenantPreference` 只含 tenant，token claim 也无 team → Loop 继续
  只用 tenant scope，`teamId` 保持 NULL（Cycle 6-10 已如此）。
- guard 注入 `ssoSub/userId/isAdmin/authClaims/userInfo`，**不**注入 `tenantId/teamId`（必须服务端解析）。

**验证**：`pnpm --filter @repo/api exec jest libs/domain/auth/src/sso-scope.service.spec.ts --runInBand`
通过（5 tests：preference 优先、preference null→候选 fallback、preference 不可用→候选 fallback、
preference tenant 不在 membership→拒绝、无 preference 无候选→拒绝）；API `type-check` 通过。

**审查待实施项**：契约确认完成，剩余项不再被 SSO 阻塞，转为纯实施：

1. 历史 NULL `tenant_id` 回填（Cycle 13）—— 用 issue 创建者 `submitterId` → SSO `getTenants`/
   `getTenantPreference` 映射归属 tenant；无法映射的行标记待处理。
2. 跨 tenant 管理端点（Cycle 14）—— 用 `req.isAdmin` 保护 eval/archive 跨 tenant 聚合枚举，配合
   目标 tenant 校验与审计。
3. 全局聚合 logs/notifications（无 issueId 分支）的 store 层 tenant 过滤。

**计划状态**：Step 1（SSO 契约确认）完成；current-tenant 解析升级为唯一源。Step 3/5 的 SSO 阻塞
前提已解除，剩余为本地实施工作。

## Final Review：Cycle 7-12 后的剩余边界

**审查结论**：在 Cycle 1-6 基础上，Cycle 7-12 把 verified SSO scope 从契约确认贯穿到 controller
读/写隔离、前端缓存失效与 current-tenant 唯一源解析：

- **Cycle 7-10**：`LoopIssueScope` 契约 + DB/Persistence/Issues/Service scope 过滤；`list`/`getIssue`
  读隔离；核心推进写操作 + 辅助 issueId 操作 + 证据/logs 经 `assertIssueScope` 绑定 verified scope；
  `readDetailScoped` 绝不回退文件，历史 NULL 与跨 tenant 记录在这些路径不可见。
- **Cycle 11（P1-1）**：前端 localStorage 降级为非权威 UI cache，`useTenantQueryInvalidation` 在
  tenant 切换时失效 React Query 缓存。
- **Cycle 12**：直接审查 SSO SDK 确认契约（[SSO-CONTRACT-AUDIT.md](./SSO-CONTRACT-AUDIT.md)）；
  `SsoScopeService` 升级为 `getTenantPreference.lastTenantId` 优先的 current-tenant 唯一源解析。

**Cycle 12 契约确认的关键修正**：`req.isAdmin` 已由 guard 注入 → 跨 tenant 管理阻塞解除；
current-**tenant** 有权威源（preference）；仅 current-**team** 确认无契约（`UserTenantPreference`
只含 tenant），Loop 继续只用 tenant scope。

**验证**：`pnpm quality:gate` 完整通过（架构、SSO source boundary、全 workspace type-check）。后端
scope specs（persistence/issues/service/sso-scope）共 18 tests、前端 invalidation hook 4 tests、
既有 storage/tenant 15 tests 全部通过。期间修复 quality:gate 目录遍历未忽略本地 `.worktrees/`。

**剩余项**（契约已确认，转为本地实施；仅 team 仍受 SSO 阻塞）：

1. **历史 NULL scope 回填（Step 3，Cycle 13）**：用 issue 创建者 `submitterId` → SSO
   `getTenants`/`getTenantPreference` 映射归属 tenant；无法映射的行标记待处理，不归入任何 tenant。
2. **跨 tenant 管理端点（Step 5，Cycle 14）**：用 `req.isAdmin` 保护 eval/archive 跨 tenant 聚合枚举，
   配合目标 tenant 校验与审计。
3. **全局聚合 logs/notifications 的 store 层 tenant 过滤**：无 issueId 分支仍跨 tenant 读取文件 store。
4. **current-team 投影/过滤**：唯一仍受 SSO 阻塞项——待 SSO 发布 team preference / token claim 契约。

**后续实施准入**：Cycle 13 起按「历史回填 → 跨 tenant 端点」顺序本地实施；历史 NULL 行在回填完成前
对所有 tenant 不可见，跨 tenant 数据仅经 `req.isAdmin` 保护的专用端点暴露，不进入普通 READ/OPERATE 路径。

## Cycle 13：全局日志与通知聚合 tenant allowlist

**实施**：为 `LoopsDbService` 新增 `listIssueIdsByScope`，以 `tenant_id` 和 `is_deleted=false`
返回完整、DB 权威的 issue ID 集合；`LoopsPersistenceService` 只透传该集合，明确不从 `.loops`
回退。`logs` / `notifications` controller 每次都解析 verified SSO scope，带 `issueId` 时继续先做
404 归属断言；无 `issueId` 时也将 scope 下传。文件 store 的聚合读新增 `issueIds` allowlist，日志按
`loop`/`issue` 字段筛选，通知仅遍历允许的目录。没有 persistence 的 scoped 调用返回空集合，fail closed。

**验证**：`pnpm --filter @repo/api type-check` 通过；`pnpm --filter @repo/api exec jest
loops.service.scope.spec --runInBand` 通过（4 tests）。

**审查待实施项**：`metrics`、`agentRuntime` 和 `cost` 仍先读取全局文件数据；它们虽使用
`list`，但尚未传入 verified scope，且 cost / trace / health 可携带其他 tenant 的统计。下一轮需要
将 metrics 与 runtime 的 issue list、cost、logs、health 分别收敛到同一个 scope，不能仅过滤最终 UI。

**计划状态**：Step 4 的 logs/notifications 无 issueId 聚合分支关闭；历史 NULL 回填（Step 3）、
跨 tenant 管理端点（Step 5）和 metrics/runtime 全局统计仍待执行。

## Cycle 14：cost、metrics 与 agent runtime tenant 统计隔离

**实施**：`LoopsService.cost(scope?)` 以 Cycle 13 的 DB issue allowlist 过滤 file-store cost 行；
`metrics(scope?)` 与 `agentRuntime(scope?)` 将 verified scope 下推到 `list` 和 `cost`，metrics 的 trace
复用 scoped logs。tenant metrics 不再调用全局 file doctor 或共享 benchmark history：health 返回仅反映
该 tenant 的 issue 数与安全的 `tenant-scoped` 标识，problems 为空，`loopBenchTrend` 省略。`/cost`、
`/metrics`、`/agent-runtime` controller 均先解析 SSO scope。

**验证**：`pnpm --filter @repo/api type-check` 通过；`pnpm --filter @repo/api exec jest
loops.service.spec --runInBand` 通过（69 tests）。

**审查待实施项**：普通聚合读取已按 tenant 收敛；但跨 tenant 的 archive/eval 仍只存在 service 内部
方法，没有专用、可审计的 HTTP contract。认证层已经有 `@RequireSuperAdmin()`，下一轮应通过显式
`targetTenantId` 管理端点暴露所需 archive 能力，禁止复用普通端点或接受普通用户的任意 tenant 参数。

**计划状态**：Step 4 的当前 HTTP 聚合读路径完成。Step 5 转入跨 tenant 管理端点实施；Step 3 历史
NULL scope 回填仍待处理。

## Cycle 15：显式 SSO superadmin 跨 tenant archive

**实施**：新增三个专用 ts-rest contract：`POST/GET /admin/tenants/:tenantId/archives` 与
`POST /admin/tenants/:tenantId/archives/:archiveId/refresh-url`。它们同时要求 `@RequireSuperAdmin()`
和模块权限，目标 tenant 只能来自明确的 path 参数；所有管理动作审计 `targetTenantId` 与
`authorizationSource: sso-superadmin`。普通 `/archives` contract 保持只使用当前 verified SSO tenant。
同时收紧 `LoopsArchiveCollectionPort`：`list` / `getIssue` 必须接收 `LoopIssueScope`，cross-tenant
archive service 把 target tenant 下推到 collection 读取，修复原先归档收集可能遍历全局 issue 的缺口。

**验证**：`pnpm --filter @repo/contracts test` 通过（56 tests）；API `type-check` 通过；
`loops-archive-collection.service.spec.ts` 与 `loops-admin.service.spec.ts` 通过（6 tests）。

**审查待实施项**：归档跨 tenant 入口与内部读取已绑定 SSO superadmin + target scope。历史 NULL
`tenant_id` 仍使旧 Issue 对所有 tenant 隐藏，需有可审计的 SSO preference/membership 回填机制；该流程
必须以 dry-run 为默认，无法由 SSO 证明归属的记录不得写入任何 tenant。

**计划状态**：Step 5 的 archive 跨 tenant 能力完成。Eval 的跨 tenant 管理操作与历史回填（Step 3）
仍需继续；team 仍等待 SSO current-team 契约。

## Cycle 16：历史 NULL tenant scope 的受控 SSO 回填

**实施**：`LoopsDbService.listUnscopedIssues` 只读取活跃且 `tenant_id IS NULL` 的最早记录；
`assignTenantIdIfUnscoped` 采用 `tenant_id IS NULL` 条件更新，防止并发任务覆盖新归属。新增
`LoopsScopeBackfillService`：仅处理 `submitterProvider=dofe-sso`，且只调用
`SsoScopeService.resolve({ ssoSubject })`，没有客户端 candidate，因此必须同时具备 SSO preference
和 membership 才能映射。新 superadmin contract `POST /admin/scope-backfill` 默认
`dryRun=true`，限制 1-500 条；无法证明、非 SSO submitter 或并发已处理的行保持 NULL 并返回明确
pending reason。每次调用均审计 dry-run、处理量、更新量和 pending 数量。

**验证**：API `type-check` 通过；`loops-scope-backfill.service.spec.ts` 通过（4 tests，覆盖
dry-run 不写入、真实条件写入、非 SSO/无验证 scope 保持 pending、并发更新不误计数）；contracts
tests 通过（56 tests）。

**审查待实施项**：历史回填已可安全执行，但尚未对生产数据执行，运行结果必须在每个 batch 后作为
审计证据保存。Eval service 的 `getCrossTenantEvalAggregation` 仍保留内部 `tenantId='default'` fallback，
与无 default tenant 原则冲突；下一轮应移除该 fallback，并新增由 SSO superadmin 保护的明确 target
tenant Eval 查询端点。

**计划状态**：Step 3 的回填工具与 fail-closed 策略完成，生产数据回填成为受控运维动作；Step 5
剩余 Eval 管理面收敛。

## Cycle 17：Eval target tenant 收敛与 superadmin 管理查询

**实施**：普通 `GET /eval-aggregation` contract 移除 client `tenantId` 字段，controller 继续只写入
当前 verified SSO tenant。`LoopsService.getCrossTenantEvalAggregation` 的 tenantId 改为必填，删除
`tenantId='default'` fallback；DB predicate 无条件写入 target tenant，request-time fallback 的
`collectEvalEvidence` 也接收 `{ tenantId }` scope，list/cost/detail 全部按目标 tenant 读取。新增
`GET /admin/tenants/:tenantId/eval-aggregation`，要求 `@RequireSuperAdmin()` + READ，并审计目标 tenant、
授权来源、数据源和总数。

**验证**：API `type-check` 通过；contracts tests 通过（56 tests）；`loops.service.spec.ts` 通过
（69 tests）。

**审查待实施项**：普通与跨 tenant Eval 读取均已收敛。仍需审计全局控制面：`doctor`、`resume`、
scheduler 等不以 tenant 为单位的操作不能只凭某一 tenant 的 Loops ADMIN 权限暴露；下一轮应把真正
全局操作明确限制为 SSO superadmin，或将其改为 tenant scope。

**计划状态**：Step 5 的 archive/Eval 跨 tenant 管理端点完成；后续仅剩全局控制面收紧、生产回填执行
与 current-team SSO 契约。

## Cycle 18：全局控制面限定为 SSO superadmin

**实施**：审查无 tenant 资源边界的 controller 后，为 `doctor`、`resume`、trigger scheduler 的
start/stop/status、Eval suite/run 与 trend/bench worker、Eval cache health、learning governance 及其
auto-merge/index worker 加上 `@RequireSuperAdmin()`。这些接口继续保留原模块权限，但 PermissionGuard
首先验证 SSO guard 写入的 `req.isAdmin`；已 tenant-scoped 的 issue 读写、普通 Eval aggregation、
cost/metrics/runtime 不受影响。

**验证**：API `type-check` 通过；`permission.guard.spec.ts` 通过（4 tests）；
`loops-scope-backfill.service.spec.ts` + `loops.service.scope.spec.ts` 通过（8 tests）。

**审查结论**：本地可实施的 tenant 唯一源待办已经关闭：tenant 解析、持久化投影、标准资源与聚合隔离、
显式跨 tenant 管理面、历史回填工具和全局控制面均已有 fail-closed 边界。剩余工作不是代码 fallback：
生产回填需由授权运维执行；current-team 仍等待 SSO 发布可信契约。

**计划状态**：Step 4、Step 5 的代码实施完成；Step 3 等待生产回填执行与报告，Step 6 等待完整质量门禁
和上线运维证据；team projection 仍是唯一 SSO 外部依赖。

## Cycle 19：Loops 业务权限与 SSO 成员事实解耦

**实施**：根据登录后的实际 401 证据，移除 Loops controller 上全部
`RequireModulePermission('vibecoding', 'loops', ...)` 路由要求及其专用 decorator。新增
`LoopsTenantAccessGuard`，它只通过 `SsoScopeService` 验证认证 subject 对当前 tenant 的成员关系，并将
验证后的 tenantId 写入 request，供既有 tenant 隔离链复用。`SsoScopeService` 在用户恰有一个 SSO
tenant membership 且尚未设置 preference/header 时选择该唯一成员；多 tenant 用户仍要求 SSO preference
或候选 tenant，避免任意选择。`LoopsService` 的 asset access 由 verified tenant membership 本地派生，
不再注入或调用 `PermissionService`；契约 `source` 和前端展示统一改为 `tenant-membership` / `tenant:member`。

**验证**：API Loops service、tenant guard、SSO scope 共 77 个 focused tests 通过；contracts schema
tests 20 个通过；Web Loops dashboard/page 41 个 focused tests 通过。全量 Web test 命令还暴露一个与本轮
无关的既有断言漂移：agent-runtime deep link 期望 `/loops#agent-runtime`，实际为
`/loops?view=operations#agent-runtime`，未在本轮修改。API/Web type-check 通过；完整
`quality:gate` 在既有 infra 版本一致性基线处停止（多数 `@dofe/infra-*` 为 `0.1.91`，
`@dofe/infra-common` 为 `0.1.92`），与本轮无关。

**审查待实施项**：普通 Loops 路由不再依赖 SSO 下发任何 `vibecoding:loops:*`，tenant 归属与资源级
隔离继续由 SSO membership + 本地 scope 过滤完成。`@RequireSuperAdmin()` 保留在真正全局控制面，它判断
SSO superadmin 身份而非 Loops 资源权限。生产历史 scope 回填与 SSO current-team 契约仍按 Cycle 16/18
的受控运维和外部依赖继续处理。

**计划状态**：已完成 SSO “身份/成员事实”与 Vibecoding “产品业务访问”职责切分；新 Loops 项目或资产
不需要向 SSO 增加资源权限。
