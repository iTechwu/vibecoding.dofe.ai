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

## Final Review：Cycle 7-11 后的剩余边界

**审查结论**：在 Cycle 1-6 基础上，Cycle 7-11 把 verified SSO scope 从契约贯穿到 controller
读/写隔离与前端缓存失效：

- **Cycle 7**：新增 `LoopIssueScope` 契约，DB/Persistence/Issues/Service 的 additive scope 过滤
  能力（`listIssues`/`getIssueDetailByIssueId` 下推 tenantId、`readDetailScoped` 绝不回退文件）。
- **Cycle 8**：`list`/`listLegacy`/`getIssue` controller 下推 verified scope，启用资源级读隔离；
  历史 NULL 与跨 tenant 记录在读路径不可见，不匹配 scope 返回 404。
- **Cycle 9**：核心推进写操作（generateSpec/review/decompose/runLoop/advance/reloop/finalize 等）
  与证据读经 `LoopsService.assertIssueScope` 绑定 verified scope。
- **Cycle 10**：辅助 issueId 操作（naturalCommand/browserQa/secondOpinion/delivery/intervene/
  getBrowserQaArtifact）+ logs/notifications 的 issueId 分支接入同一归属断言；文件回退一致性在
  Cycle 7 已奠定。
- **Cycle 11（P1-1）**：前端 localStorage 降级为非权威 UI cache，`useTenantQueryInvalidation`
  在 tenant 切换时失效 tenant-scoped 的 React Query 缓存（`['loops']`）。

**验证**：`pnpm quality:gate` 完整通过（架构、SSO source boundary、全 workspace type-check）。
后端三个 scope spec（persistence/issues/service）共 13 tests、前端 invalidation hook 4 tests、
既有 storage/tenant 15 tests 全部通过。期间发现并修复 quality:gate 的目录遍历未忽略本地
`.worktrees/`（现与 `.gitignore` 一致），使 gate 反映主仓库真实状态。

**仍不可标记完成**（不依赖新增 SSO 能力即无法本地 fallback）：

1. **历史 NULL scope 回填（Step 3）**：需 SSO/审计证据脚本将历史 `loop_issue.tenant_id` 映射到
   verified tenant；回填完成前这些行对所有 tenant 不可见。
2. **全局聚合的 tenant 过滤**：`logs`/`notifications` 无 issueId 的跨 issue 聚合分支仍从文件
   store 跨 tenant 读取，需在 store 层引入 tenant-scoped 读。
3. **当前 team 选择 / 显式跨 tenant 管理能力（Step 5）**：受 SSO 未发布 current-team /
   global-admin scope 契约阻塞。

**后续实施准入**：先确认 SSO 的 current-team 与 global-admin 契约，再据此回填历史 NULL 并设计
跨 tenant 管理端点；在此之前任何本地 fallback 都不得让历史 NULL 或跨 tenant 数据对普通路径可见。
