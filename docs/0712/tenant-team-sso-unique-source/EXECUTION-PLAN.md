# Tenant / Team SSO 唯一源执行计划

## 前置原则

- SSO 是 tenant、team、成员关系、当前选择和跨租户管理员能力的唯一权威。
- Vibecoding 保存的 `tenantId` / `teamId` 是经验证的归属外键快照，不是可编辑的
  主数据。
- 每一步先补相应测试，再切换行为；DB 访问继续通过现有 DB service 层。

## Step 1：确认并固化 SSO scope 契约

**状态（Cycle 1）**：部分完成。已证实当前 SSO AuthGuard 只注入 subject/身份，
不注入 tenant/team；已发布 `SsoClientService.client.users.getTenants(subject)` 可作为
服务端 tenant 成员关系的唯一解析来源，`SsoScopeService` 已消费该能力。当前 SDK
没有“当前 team 选择”字段，team 的可信解析保留为 SSO 契约待办，禁止客户端回填。

**目标**：确定 API 服务端获得“当前 tenant、team、成员关系、全局管理员能力”的
唯一已验证方式，并将其收敛为一个内部 `VerifiedTenantTeamScope` 契约。

**范围**：检查已消费的 `@dofe/sso-nestjs` / `SsoClientService` 能力和当前 token
claims；与 `sso.dofe.ai` 所有者确认缺失字段的发布契约。为 scope 缺失、tenant
切换、成员资格失效、全局管理员跨 tenant 访问定义明确错误语义和审计字段。

**不做**：不在本项目解析未签名 token，不新增本地 tenant/team/member 表，不实现
SSO 的 tenant 切换或成员管理。

**受益**：后续 controller、worker、持久化和测试使用同一个可信输入，避免每条
路径各自猜测 tenant/team 来源。

## Step 2：切断客户端 context 到服务端归属的信任链

**状态（Cycle 2）**：已完成。公开创建 schema、Web mutation body 和 controller
body fallback 都已移除 `tenantContext`；`x-current-tenant` 仅作为候选，必须经
`SsoScopeService` 的 SSO 成员查询后才能成为内部归属数据。当前 tenant 的 teamId
不再由客户端传入。

**目标**：所有 Web Issue 创建由服务端的 `VerifiedTenantTeamScope` 写入归属，任何
请求体、普通 header 或 localStorage 值都不能影响 tenant/team 或 tenantName。

**范围**：从公开的创建 schema 移除 `tenantContext`；删除 `pickTenantContext` 的
header/body fallback；controller 仅将认证 scope 传给 service。前端保留 tenant 名称
展示，但创建 mutation 不再提交它；将 localStorage API 注释/命名为非权威 UI cache。

**不做**：不改变 SSO session 恢复、登录回调或产品的 Issue 表单字段；不要求前端
在每次提交前额外调用 SSO 来替代服务端校验。

**受益**：杜绝客户端篡改 tenant/team 归属和名称污染，令 Issue 创建与 SSO 当前
scope 一致。

## Step 3：持久化已验证 scope 并迁移历史记录

**状态（Cycle 6-7）**：部分完成。`LoopIssue` 已新增 nullable tenantId/teamId 投影及
索引，迁移和新写入已落地（Cycle 6）；verified scope 已作为可选参数贯穿 DB/Persistence/
Issues/Service 的 list/detail 读路径（Cycle 7，additive）。历史记录保持 NULL，回填报告、
可证明的 SSO 映射、在回填完成后收紧非空约束，以及在 controller 启用过滤仍待执行。

**目标**：让 Loop Issue 的归属能由数据库可靠查询和索引，而不是依赖 `.loops` 或
`rawPayload` 中的 JSON。

**范围**：在 `LoopIssue` 增加不可空或有明确迁移策略的 `tenantId`、`teamId` 字段，
按主要查询维度建立索引；评估 `LoopIssueIntake` 是否也需投影字段用于审计。通过
DB service 写入/读取，编写 migration、回填脚本、失败报表和回滚方案；历史无法映射
的记录显式标记为待处理，不能静默归入 `default`。

**不做**：不建立外键指向本地 tenant/team 表，不复制成员关系，不以 tenantName
作为主键或授权条件。

**受益**：列表、详情和后台任务可在 DB 层按 verified scope 过滤；审计、索引性能
和数据修复边界都更清晰。

## Step 4：在业务入口统一执行 scope 授权

**状态（Cycle 7-10）**：基础设施完成（Cycle 7）+ 读路径启用（Cycle 8）+ 核心写操作归属断言
（Cycle 9）+ 辅助 issueId 操作接入（Cycle 10）。verified scope 作为可选参数贯穿
DB/Persistence/Issues/Service；`list`/`listLegacy`/`getIssue`、核心推进写操作、证据读、辅助
issueId 操作（naturalCommand/browserQa/secondOpinion/delivery/intervene/getBrowserQaArtifact）
与 logs/notifications 的 issueId 分支均经 `assertIssueScope` 绑定 verified scope，跨 tenant 与
历史 NULL 记录在这些路径不可见，不匹配 scope 返回 404。文件回退一致性在 Cycle 7 已奠定
（list 文件回退按 scope 过滤、readDetailScoped 绝不回退文件）。剩余：全局聚合 list/logs 的
tenant 过滤、历史 NULL 回填与 SSO 阻塞的跨 tenant 管理员能力。

**目标**：任何 Issue 的读取、推进、审阅、证据访问或写入都先验证调用者 SSO scope
与记录归属一致。

**范围**：为 `LoopsService` / domain service 引入 scope-aware 的 load/list port；
将 controller 的认证 scope 传入 list、detail、issueId action 和文件/下载入口。DB
查询下推 tenant/team 条件；文件回退路径做相同过滤；对不可见资源返回 404。审查
worker、scheduler 和内部调用，要求它们传入系统身份或显式受限 scope。

**不做**：不以现有模块级 `READ` / `OPERATE` 权限代替资源归属判断，不让普通用户
通过过滤参数选择任意 tenant，不改变 Loop 状态机。

**受益**：修复跨 tenant 列表、详情和 issueId 操作的横向越权面，同时保持 SSO
模块权限与资源级 scope 的职责分离。

## Step 5：重构跨 tenant 聚合与归档权限

**状态（Cycle 3-4）**：部分完成。archive 文件路径已验证，Eval 的普通读取、同步
运行和入队已绑定当前 SSO tenant，`default` tenant 与未验证的 `aggregate-all` 已被
拒绝。Cycle 5 已将普通 archive create/list/refresh 绑定当前 SSO tenant；仅 SSO
全局管理员的明确跨 tenant 能力仍待完成。

**目标**：将跨 tenant 行为从“客户端提供 tenantId”改为“SSO 显式授权的管理操作”。

**范围**：普通 eval/archive 请求忽略或移除 tenantId 参数，使用服务端 verified
scope；保留跨 tenant 查询/执行时拆分为专用管理端点，要求 SSO 全局管理员或明确
的跨租户 permission，并审计 actor、目标 tenant、授权来源和结果。对归档路径使用
SSO ID allowlist/安全编码，拒绝路径分隔符；移除生产路径的 `default` tenant。

**不做**：不把所有 Loops 管理员默认为全局 SSO 管理员，不允许仅凭 `READ` 或
`OPERATE` 枚举、下载或刷新其他 tenant 的归档，不在业务 service 直连外部 API。

**受益**：跨租户运维仍可用，但权限语义可证明、可审计且不会把任意字符串带入
文件系统或缓存分区。

## Step 6：验证、观测与渐进上线

**目标**：证明唯一源改造在 tenant 切换、历史迁移和后台任务中持续生效，并可安全
发布。

**范围**：新增 contract/controller/service/DB tests，覆盖 body/header 篡改、缺少
scope、跨 tenant list/detail/action、管理员显式跨 tenant、tenant 切换缓存失效、
`default` 数据拒绝和 archive path 拒绝。记录 scope resolve、授权拒绝、历史回填和
worker scope 缺失的结构化指标（不记录 token 或敏感成员数据）。灰度期间双读比对
旧 JSON scope 与新列，完成回填后删除兼容回退；执行相关 focused tests、type-check
和 `pnpm quality:gate`。

**不做**：不在日志中输出 JWT、完整 SSO session 或成员列表；不在未完成回填和
越权测试前直接删除历史证据；不借此重构与 scope 无关的 Loop 功能。

**受益**：改造结果有可自动验证的安全边界、可观测的迁移状态和可回滚的发布路径，
避免唯一源规则随新端点或后台任务再次漂移。

## 建议顺序与验收门槛

1. 完成 Step 1 后才开始改契约和 controller，避免在消费者仓库猜测 SSO 语义。
2. Step 2、3、4 是同一安全闭环，必须在同一发布窗口完成；其中 Step 4 的越权
   回归测试通过是启用新 schema 的门槛。
3. Step 5 可在主路径收敛后紧接执行，但不应以“跨租户功能存在”为由保留普通 API
   的任意 tenant 参数。
4. Step 6 完成历史回填比对、focused validation 和 `pnpm quality:gate` 后，才删除
   body/header/localStorage 的兼容回退。
