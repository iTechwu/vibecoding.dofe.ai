# DofeAI VibeCoding

> **DoFe.AI — Do For Employee · Do For Enterprise · Do For Empowerment**
>
> 面向团队的 AI 研发执行闭环，让需求从提交、拆解、实施、测试、审查到归档都可追踪、可恢复、可审计。

DofeAI VibeCoding 的核心不是一个通用脚手架，而是一套正在产品化的 **Loops AI 编码执行引擎**。它试图解决大型 AI 编码任务中最常见的三个问题：单个 agent 上下文退化、既写又审导致质量不可信、大任务需要人反复手动接力。

当前仓库已经落地了 Loops Web 控制台、NestJS 编排 API、SSO 身份边界、类型安全 API 契约、文件态与 DB 索引并存的状态管理，以及围绕质量门禁和回归验证的工程体系。脚手架能力仍然存在，但它是产品的底座，而不是本项目的主叙事。

## 产品初衷

AI 编码工具已经能完成单点任务，但当需求变成“持续推进一个大功能直到收敛”时，流程会迅速变脆：

- 上下文会被压缩，早期约束、设计取舍和已完成工作容易丢失。
- 同一个 agent 既写代码又审代码，质量判断缺少独立性。
- 任务被切碎后，人需要反复唤起、接力、记录状态，执行链路难以规模化。

Loops 的产品假设是：**把大需求拆成小上下文，用规划/审查 agent 与实施 agent 分工，用文档标注和测试证据锁定真相，再通过循环收敛直到交付。**

换句话说，本项目的目标不是“让 AI 回答怎么做”，而是让 AI 有一条可观测、可审核、可恢复的执行流水线，把需求真正做完。

## 产品目标

### 核心目标

| 目标           | 说明                                                                                |
| -------------- | ----------------------------------------------------------------------------------- |
| 需求入口产品化 | 用户通过 Web 控制台提交 Issue，记录提交人、来源、目标仓库、验收标准和原始 payload。 |
| 规格先行       | Issue 先进入 Spec 草稿与人工审核，避免 agent 直接对模糊需求开工。                   |
| 小上下文拆解   | Codex 将审核后的 Spec 拆成 shard，每个 shard 具备独立验收标准、文件提示和测试要求。 |
| 分工执行       | 规划/审查与实施角色分离，降低“自己给自己判卷”的风险。                               |
| 测试证据约束   | shard 必须写入测试记录、实现记录和审查记录，测试缺失或失败不能静默通过。            |
| 循环收敛       | 全局审查不通过时支持 re-loop，重新进入规格版本与分片修正流程。                      |
| 人在环控制     | 人可以审核 Spec、接管 shard、暂停/恢复 Issue、记录人工实现证据。                    |
| 状态可恢复     | `.loops` 文件态保留可读真相源，DB persistence 提供产品查询索引和恢复能力。          |
| 身份与安全边界 | Web 入口通过 Dofe SSO/OIDC 统一身份，refresh token 仅存在 HttpOnly cookie。         |

### 期望效果

- 产品/技术负责人可以从页面提交和追踪需求，而不是靠聊天记录保存上下文。
- 工程团队可以看到每个 shard 的执行状态、测试结果、审查结论和风险。
- AI 执行失败、超时、测试缺失、成本超限时都有明确记录，而不是静默消失。
- 长任务可以在中断后恢复，历史状态由文档和索引共同支撑。
- 后续接入飞书、真实 PR、独立 worker、真实 CLI 后，仍沿用同一条执行闭环。

## 当前完成情况

### 已完成的产品主链路

| 模块               | 当前状态                                                                                                                                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web Issue Intake   | 已实现 `/loops/new`，支持 title、target repo、priority、body、acceptance criteria。后端从认证用户派生 submitter，避免客户端伪造身份。                                                                                 |
| Loops 队列         | 已实现 `/loops`，展示 Issue 列表、doctor、cost、logs、notifications 等运行面板。                                                                                                                                      |
| Issue 详情与操作台 | 已实现 `/loops/[issueId]`，支持生成 Spec、审核 Spec、分解 shard、运行测试、记录实现、审查 shard、全局审查、re-loop、finalize、暂停/恢复、人工接管。                                                                   |
| Loops API          | 已实现 `/loops/issues`、`/spec`、`/decompose`、`/tests`、`/implementation`、`/review`、`/run`、`/global-review`、`/reloop`、`/finalize`、`/interventions`、`/doctor`、`/cost`、`/logs`、`/notifications`、`/resume`。 |
| SSO 登录闭环       | 已实现 `/login`、`/auth/oidc/callback`、后端 OIDC authorize/callback/token/logout/revoke；真实浏览器 E2E 已验证 login → callback → refresh → logout。                                                                 |
| SSO 文件边界       | 本项目不再保留本地 uploader 和 FileSource 真源；前端通过 `@dofe/file-sdk-web` + `/api/proxy/sso` 访问 SSO 文件能力。                                                                                                  |
| RBAC 最小门禁      | Loops HTTP 端点已按 `read/create/operate/admin` 权限分组，无权限返回 403。                                                                                                                                            |
| 可观测性           | 已提供 doctor、cost guard、不可变 logs、notifications、resume 等运维入口。                                                                                                                                            |
| 回归矩阵           | 已固化 `pnpm regression:docs0620`，覆盖质量门禁、类型检查、包测试、Loops Jest、doctor/db-doctor 和 build。                                                                                                            |

### 已完成的工程底座

| 领域       | 当前状态                                                                                                       |
| ---------- | -------------------------------------------------------------------------------------------------------------- |
| Monorepo   | pnpm workspaces + Turborepo，包含 `apps/web`、`apps/api` 和共享 `packages/*`。                                 |
| 前端       | Next.js 16 App Router、React 19、Tailwind CSS 4、shadcn/ui、next-intl、React Query、Zustand。                  |
| 后端       | NestJS 11、Fastify、Prisma 7、PostgreSQL、Redis、RabbitMQ/BullMQ、Winston 日志。                               |
| API 契约   | `@repo/contracts` 使用 ts-rest + Zod 4，前后端共享请求/响应 Schema。                                           |
| DB Service | Prisma CRUD 通过生成的 `@app/db` DB Service 层访问，业务 Service 禁止直接使用 `prisma.read` / `prisma.write`。 |
| 配置体系   | `.env`、`config.local.yaml`、`keys/config.json` 三层配置，启动时通过 Zod 校验。                                |
| Infra 依赖 | `@dofe/infra-*` 已从本仓拆出，通过 npm 依赖消费。                                                              |
| CI         | 包含 lint、type-check、quality gate、packages test、API test、Web test、build 和 security audit。              |

### 已验证事项

- `vibecoding.dofe.ai` API/Web 类型检查通过。
- `@repo/contracts`、`@repo/validators`、`@repo/web`、API Jest 回归通过。
- `pnpm quality:gate` 所含架构检查、列表契约检查、敏感日志检查、utils hygiene 和 type-check 已通过。
- Loops doctor / db-doctor 已纳入回归。
- 真实 SSO E2E 在可用 SSO/Redis/DB/密钥环境下验证通过。

完整历史记录见：

- [docs/0619/loops设计](docs/0619/loops设计)
- [docs/0619/sso/09-implementation-status.md](docs/0619/sso/09-implementation-status.md)
- [docs/0620/README.md](docs/0620/README.md)

## 后续进一步完成事项

当前本仓 Loops v1 收尾范围已无 P0/P1 阻断；剩余主要是 v1.1+ 和生产化能力，很多依赖外部凭据、产品决策或运行环境。

| 阶段   | 事项                         | 状态    | 需要补齐                                                                |
| ------ | ---------------------------- | ------- | ----------------------------------------------------------------------- |
| v1.1   | 真实 SSO 浏览器 E2E 常态化   | blocked | 稳定测试账号、client secret、可启动联调环境。                           |
| v1.2   | 飞书 Issue 入口              | blocked | Feishu payload 样例、签名配置、应用凭据、submitter 映射策略。           |
| v1.2   | 飞书审批卡片                 | blocked | approve/request changes/reject/intervene 按钮设计、幂等策略、用户映射。 |
| v1.2   | 飞书反向通知                 | blocked | Feishu client、通知目标、发送状态、重试策略。                           |
| v1.3   | 真实远端 PR 打开             | blocked | Git provider 选择、token 管理、repo allowlist、分支权限模型。           |
| v1.3   | 多 Loop 并行队列             | blocked | 同 repo 写锁、同 issue 幂等锁、agent 资源限流、部署拓扑。               |
| v1.3   | 独立 worker 池               | blocked | worker 边界、队列协议、资源隔离与沙箱策略。                             |
| 生产化 | 真实 Codex / Claude CLI 运行 | blocked | 生产 CLI 版本、权限、超时、重试、沙箱与日志策略。                       |
| 生产化 | 真实 diff 自动回收           | blocked | git provider/worktree 策略、changedFiles 来源确认。                     |
| 生产化 | 成本真实统计与外部告警       | blocked | token 计量来源、成本口径、SLO、告警通道。                               |

后续实施入口以 [docs/0620/03-deferred-items.md](docs/0620/03-deferred-items.md) 和 [docs/0620/05-blockers.md](docs/0620/05-blockers.md) 为准。

## 核心工作流

```text
Web Issue Intake
  -> 记录 submitter / source / raw payload
  -> 生成 Spec 草稿
  -> 人工审核 Spec
  -> 拆解 Shards + Test Matrix
  -> 执行 / 记录实现证据
  -> 运行测试并写入 Test Record
  -> 审查实现与测试证据
  -> 全局审查
  -> re-loop 或 finalize
  -> 终态标注与 CLOSED
```

## 仓库结构

```text
.
├── apps
│   ├── web                  # Next.js Web 控制台
│   │   ├── app/loops        # Loops 队列、提交页、详情页
│   │   ├── app/auth         # OIDC callback
│   │   ├── lib/api          # ts-rest client 与 hooks
│   │   ├── lib/sso-session  # SSO session/token 生命周期
│   │   └── locales          # zh-CN / en i18n 文案
│   └── api                  # NestJS 编排 API
│       ├── src/modules/loops
│       ├── src/modules/oidc-client-api
│       ├── libs/domain/auth
│       ├── libs/domain/audit-log
│       └── prisma
├── packages
│   ├── contracts            # ts-rest + Zod API 契约
│   ├── ui                   # shadcn/ui 组件
│   ├── utils                # 共享工具
│   ├── validators           # 通用 Zod 校验
│   ├── constants
│   ├── config
│   └── types
├── docs
│   ├── 0619/loops设计       # Loops 产品与架构设计
│   ├── 0619/sso             # SSO 唯一真源与实施状态
│   └── 0620                 # v1.1+ 后续执行入口
└── scripts                  # 枚举生成、质量检查、Loops CLI、回归脚本
```

## 重要架构规则

这些规则是代码审查和质量门禁的硬约束：

1. **数据库访问只通过 DB Service 层**：API/Service 层禁止直接使用 `prisma.write` / `prisma.read`。
2. **Zod-first validation**：API 请求和响应以 `@repo/contracts` 的 Zod Schema 为准。
3. **外部 API 只通过 Client 层**：业务 Service 不直接调用第三方 SDK 或 axios。
4. **生产代码只使用 Winston Logger**：禁止 NestJS 内置 Logger 和生产 `console.log`。
5. **SSO 是认证与文件唯一真源**：本项目不恢复本地 `/sign`、本地 uploader、旧 provider auth models 或前端可读 refresh token。
6. **Loops 状态以 `.loops` 文件态为 v1 真源**：DB persistence 负责索引、查询和恢复辅助，冲突时以文件态为准。

完整编码规范见 [CLAUDE.md](CLAUDE.md)。

## 快速开始

### 环境要求

- Node.js >= 18
- pnpm >= 9，当前 lockfile 使用 pnpm 10
- PostgreSQL
- Redis
- RabbitMQ

### 安装与启动

```bash
pnpm install
pnpm db:generate
pnpm dev
```

默认端口：

- Web: <http://localhost:3003>
- API: <http://localhost:13100>
- Swagger/API docs: <http://localhost:13100/docs>

### 常用命令

```bash
# 开发
pnpm dev
pnpm dev:web
pnpm dev:api

# 构建
pnpm build
pnpm build:web
pnpm build:api

# 类型、测试、质量门禁
pnpm type-check
pnpm test
pnpm test:web
pnpm test:api
pnpm test:packages
pnpm quality:gate
pnpm regression:docs0620

# 数据库
pnpm db:generate
pnpm db:migrate:dev
pnpm db:migrate:deploy
pnpm db:push

# Loops 运维
pnpm loops:status
pnpm loops:doctor
pnpm loops:db-doctor
pnpm loops:cost
pnpm loops:logs
pnpm loops:notifications
pnpm loops:resume
pnpm loops:pause
pnpm loops:resume-loop
pnpm loops:take
pnpm loops:run
pnpm loops:global-review
pnpm loops:reloop
pnpm loops:finalize
```

## 配置说明

后端采用三层配置：

| 文件                         | 用途                                                               |
| ---------------------------- | ------------------------------------------------------------------ |
| `apps/api/.env`              | 基础设施连接串，例如 PostgreSQL、Redis、RabbitMQ、API base URL。   |
| `apps/api/config.local.yaml` | 非敏感结构化配置，例如 app port、features、limits、loops runtime。 |
| `apps/api/keys/config.json`  | JWT、crypto、第三方服务等密钥。                                    |

SSO 本地联调常用变量：

```bash
SSO_API_URL=http://127.0.0.1:3100
SSO_INTERNAL_API_URL=http://127.0.0.1:3100
SSO_ISSUER=http://127.0.0.1:3100
SSO_CLIENT_ID=vibecoding-dofe-ai
SSO_CLIENT_SECRET=<from sso.dofe.ai>
SSO_SERVICE_NAME=vibecoding.dofe.ai
INTERNAL_API_SECRET=<from sso.dofe.ai>
```

Web 侧常用变量：

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:13100
NEXT_PUBLIC_SSO_BASE_URL=http://127.0.0.1:3100
```

示例配置见：

- [apps/api/.env.example](apps/api/.env.example)
- [apps/web/.env.example](apps/web/.env.example)

## 真实 SSO E2E

真实 SSO E2E 依赖可用的 SSO API、vibecoding API、vibecoding Web、测试账号和 client secret。

```bash
SSO_E2E_ENABLED=1 \
E2E_SSO_MOBILE=<test-mobile> \
E2E_SSO_PASSWORD=<password> \
E2E_SSO_ORIGIN=http://127.0.0.1:3100 \
E2E_SSO_LOGIN_ORIGIN=http://127.0.0.1:3000 \
E2E_API_ORIGIN=http://127.0.0.1:13100 \
pnpm --filter @repo/web test:e2e:sso
```

未设置 `SSO_E2E_ENABLED=1` 时，该测试默认跳过，不影响普通回归。

## API 契约模式

前后端共同依赖 `@repo/contracts`：

```typescript
// packages/contracts
export const loopsContract = c.router({
  list: {
    method: 'GET',
    path: '/issues',
    query: LoopIssuesQuerySchema,
    responses: { 200: ApiResponseSchema(LoopListResponseSchema) },
  },
});
```

后端使用 `@TsRestHandler` 实现契约，前端通过 ts-rest client 和 React Query hooks 消费。所有 list endpoint 应使用统一分页结构：

```typescript
export const QuerySchema = PaginationQuerySchema.extend({
  status: z.string().optional(),
});

export const ResponseSchema = PaginatedResponseSchema(ItemSchema);
```

## 文档索引

| 文档                                                                                   | 内容                                   |
| -------------------------------------------------------------------------------------- | -------------------------------------- |
| [CLAUDE.md](CLAUDE.md)                                                                 | 代码代理工作规范与架构规则。           |
| [docs/0619/loops设计/01-产品概述.md](docs/0619/loops设计/01-产品概述.md)               | Loops 背景、愿景、目标用户与设计原则。 |
| [docs/0619/loops设计/03-工作流设计.md](docs/0619/loops设计/03-工作流设计.md)           | Loops 端到端工作流。                   |
| [docs/0619/loops设计/06-系统架构.md](docs/0619/loops设计/06-系统架构.md)               | Loops 系统架构。                       |
| [docs/0619/loops设计/09-实施路线图.md](docs/0619/loops设计/09-实施路线图.md)           | MVP 到生产化路线图。                   |
| [docs/0619/sso/09-implementation-status.md](docs/0619/sso/09-implementation-status.md) | SSO 与文件唯一真源实施状态。           |
| [docs/0620/03-deferred-items.md](docs/0620/03-deferred-items.md)                       | v1.1+ 后置项拆解。                     |
| [docs/0620/04-regression-checklist.md](docs/0620/04-regression-checklist.md)           | 回归命令与文档标注规则。               |
| [docs/脚手架说明.md](docs/脚手架说明.md)                                               | 脚手架导出与模板范围说明。             |

## 项目定位

本仓保留 `create-dofe-ai` / scaffold 相关脚本，是因为 Loops 产品需要一个稳定、可复制、可回归的工程底座。但 README 的第一优先级是描述 **VibeCoding 作为 AI 研发执行产品的目的、当前能力和下一步路线**。

当你评估或继续开发本项目时，应优先围绕这条主线判断价值：

```text
需求是否更容易进入系统？
状态是否更可信？
AI 执行是否更可控？
质量证据是否更完整？
失败和成本是否更可见？
最终是否能从 Issue 收敛到可交付结果？
```
