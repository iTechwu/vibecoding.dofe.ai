# DofeAI Monorepo Scaffold

> **DoFe.AI — Do For Employee · Do For Enterprise · Do For Empowerment**
>
> 分布式 AI 执行力引擎，服务与成就中国智造的全球竞争力。

DofeAI 是一个面向团队的**多智能体驱动内容创作与运营平台**。本仓库是其**生产级全栈 monorepo 脚手架模板** — 开箱即用的前端、后端、共享包和基础设施集成，5 分钟即可启动新项目。

```
npx create-dofe-ai my-app && cd my-app && pnpm install && pnpm dev
```

## 目录

- [1. 项目介绍](#1-项目介绍)
- [2. 设计理念](#2-设计理念)
- [3. 快速开始](#3-快速开始)
- [4. 脚手架使用方式](#4-脚手架使用方式)
- [5. 架构与能力](#5-架构与能力)
- [6. 核心数据流](#6-核心数据流)
- [7. 配置体系](#7-配置体系)
- [8. 可用命令](#8-可用命令)
- [9. 发布到 npm](#9-发布到-npm)
- [10. Docker 部署](#10-docker-部署)
- [11. 文档索引](#11-文档索引)

---

## 1. 项目介绍

### DofeAI 做什么

DofeAI 是一个多智能体驱动的内容创作与运营平台，核心能力：

| 领域             | 能力                                                         |
| ---------------- | ------------------------------------------------------------ |
| **AI 内容创作**  | 智能写作、创意生成、多模态内容创作                           |
| **知识库管理**   | 进化型知识库、智能提取、质量评估、版本控制、相似度检测与合并 |
| **智能推荐**     | 基于向量检索和协同过滤的知识推荐系统                         |
| **招聘面试**     | AI 招聘 Agent、简历解析、JD 分析、人才匹配、智能面试         |
| **会议管理**     | 实时转写、知识提取、智能纪要生成                             |
| **多智能体协作** | 支持多智能体协同工作                                         |

### 这个脚手架是什么

这是 DofeAI 平台的**完整项目模板** — clone 后即可得到一个包含所有源码、配置、文档、脚本、数据库迁移的生产级项目，而不是一个空壳。它包含：

- 已搭建好的 NestJS + Next.js monorepo 架构
- 可复用的 10 个基础设施包（`@dofe/infra-*`）
- 完整的认证系统（JWT + OAuth2）
- 三层配置体系（Zod 校验）
- 类型安全的 API 契约（ts-rest）
- Docker 部署配置
- 交互式项目初始化脚本

### 谁适合用

- 需要快速搭建全栈 AI 应用的团队
- 基于 DofeAI 平台开发新业务模块的开发者
- 需要 NestJS + Next.js monorepo 最佳实践参考的工程师

### 技术栈

| 层级         | 技术                                                            |
| ------------ | --------------------------------------------------------------- |
| **前端**     | Next.js 16 (App Router) + React 19 + Tailwind CSS 4 + shadcn/ui |
| **后端**     | NestJS 11 + Fastify + Prisma ORM                                |
| **API 契约** | ts-rest + Zod 4 — 编译时类型检查 + 运行时校验                   |
| **缓存**     | Redis (ioredis) + 命名缓存键                                    |
| **消息队列** | RabbitMQ + BullMQ                                               |
| **认证**     | Passport (JWT, OAuth2 — 微信/Google/Discord)                    |
| **校验**     | Zod 4（前后端统一 Schema）                                      |
| **构建**     | pnpm workspaces + Turborepo                                     |
| **容器化**   | Docker Compose（多阶段构建）                                    |

---

## 2. 设计理念

### 双仓库架构

```
父目录/
├── scaffold.dofe.ai/        # 业务项目（本仓库）
│   ├── apps/api/             # NestJS 后端
│   ├── apps/web/             # Next.js 前端
│   └── packages/             # 共享包
│
└── infra.dofe.ai/            # 基础设施（独立仓库，同级目录）
    └── packages/             # @dofe/infra-* 可复用包
```

**为什么分开**：

- **scaffold** 是项目代码 — 每个项目独立一份，包含业务逻辑
- **infra** 是基础设施 — 多个项目共享，与产品无关，可独立版本管理
- 通过 `pnpm-workspace.yaml` 引用同级目录，开发时 symlink 直连源码

### 四层依赖方向

```
                    依赖方向 ──────────────────────►

┌─────────────┐    ┌─────────────┐    ┌──────────────────┐
│   modules   │───►│   domain    │───►│   @dofe/infra-*  │
│ (Controller │    │  (auth,     │    │ (common, clients, │
│  + Service) │    │  services)  │    │  prisma, redis,   │
│             │    │             │    │  jwt, utils, ...) │
└─────────────┘    └─────────────┘    └──────────────────┘
       │                                     ▲
       │  ┌──────────────────┐               │
       └──│  DB Service 层   │───────────────┘
          │ (generated/db)   │   直接操作 Prisma
          └──────────────────┘
```

规则：

- **infra** 禁止依赖 domain — 保持可复用性
- **modules** 通过 DB Service 操作数据库 — 禁止直接调用 Prisma
- **modules** 通过 Client 层调用外部服务 — 禁止直接使用 axios

### 三条核心架构规则

1. **数据库操作仅在 DB Service 层** — Service 使用 Prisma 类型定义构建查询条件，通过 DB Service 方法执行
2. **Zod-first 校验** — 所有 API 请求/响应使用 Zod Schema，Controller 层禁止手动类型断言
3. **外部服务调用在 Client 层** — 第三方 API 封装在 `@dofe/infra-clients`，使用 `@nestjs/axios`

---

## 3. 快速开始

```bash
# 1. 创建项目
npx create-dofe-ai my-app
cd my-app

# 2. 克隆 infra 依赖（必须与项目同级）
git clone https://github.com/iTechwu/infra.dofe.ai.git ../infra.dofe.ai

# 3. 安装依赖
pnpm install

# 4. 生成 Prisma Client
pnpm db:generate

# 5. 启动开发服务
pnpm dev
```

**交互式初始化**（可选，配置端口、数据库、Redis 等）：

```bash
node scripts/init-project.js
```

启动后：

- 前端：http://localhost:3000
- 后端：http://localhost:3101
- API 文档：http://localhost:3101/docs

---

## 4. 脚手架使用方式

### 方式一：npx / pnpm create（推荐）

```bash
npx create-dofe-ai my-app
# 或
pnpm create dofe-ai my-app
```

### 方式二：本地仓库（开发/未发布时）

```bash
git clone <scaffold-repo-url> scaffold
cd scaffold

pnpm run export-scaffold        # 生成模板
pnpm run create-scaffold -- my-app  # 创建项目
```

### 方式三：直接 clone

```bash
git clone <scaffold-repo-url> my-project
cd my-project
```

### 方式四：GitHub Template

使用 GitHub / GitLab 的 "Use this template" 功能。

### 创建后必做

1. 克隆 `infra.dofe.ai` 到**同级目录**
2. 检查 `pnpm-workspace.yaml` 中 infra 路径
3. 配置三层配置文件（见[配置体系](#7-配置体系)）
4. `pnpm install && pnpm db:generate`

---

## 5. 架构与能力

### 目录结构

```
dofe-ai/
├── apps/
│   ├── web/                          # @repo/web — Next.js 16 前端
│   │   ├── app/                      # App Router 页面
│   │   ├── components/               # React 组件
│   │   ├── lib/
│   │   │   ├── api/                  # ts-rest 客户端 + React Query hooks
│   │   │   │   ├── contracts/        # ts-rest 合约客户端
│   │   │   │   └── queries/          # React Query 查询 hooks
│   │   │   ├── config/               # 前端 env Zod 校验
│   │   │   ├── actions/              # Next.js Server Actions
│   │   │   └── agent/                # AI Agent 客户端
│   │   └── hooks/                    # 自定义 React Hooks
│   │
│   └── api/                          # @repo/api — NestJS 后端
│       ├── src/
│       │   ├── modules/              # 功能模块（Controller + Service）
│       │   ├── interceptor/          # 全局拦截器
│       │   └── common/               # 守卫、中间件、装饰器（→ @dofe/infra-common）
│       ├── libs/domain/              # 业务域（auth、services）
│       ├── prisma/                   # 数据库 Schema & 迁移
│       ├── config.local.yaml         # 结构化配置
│       └── keys/config.json          # 密钥凭证
│
├── packages/                         # 前后端共享包
│   ├── ui/                           # @repo/ui — shadcn/ui 组件库
│   ├── utils/                        # @repo/utils — 工具函数
│   ├── types/                        # @repo/types — TypeScript 类型
│   ├── config/                       # @repo/config — 共享配置（ESLint、Tailwind 等）
│   ├── constants/                    # @repo/constants — 常量
│   ├── validators/                   # @repo/validators — Zod 校验 Schema
│   ├── contracts/                    # @repo/contracts — ts-rest API 契约
│   └── create-dofe-ai/              # npm 发布包（脚手架 CLI + 模板）
│
└── ../infra.dofe.ai/                 # 基础设施包（同级目录，独立仓库）
    └── packages/
        ├── common/                   # 装饰器、拦截器、管道、配置、过滤器、日志
        ├── clients/                  # 第三方 API 客户端（SMS、OSS、OCR、TTS 等）
        ├── prisma/                   # 数据库连接、读写分离、监控
        ├── redis/                    # 缓存层
        ├── rabbitmq/                 # 消息队列
        ├── jwt/                      # JWT 管理
        ├── utils/                    # 纯工具函数
        ├── i18n/                     # 国际化资源
        ├── shared-db/                # 事务基类、UnitOfWork
        └── shared-services/          # 邮件、短信、文件上传、系统健康检查
```

### Import 别名

**前端** (`apps/web`):

```
@/*          → apps/web 内部
@repo/ui     → packages/ui
@repo/utils  → packages/utils
@repo/types  → packages/types
@repo/contracts → packages/contracts
```

**后端** (`apps/api`):

```
@/common/*       → @dofe/infra-common/src/*
@/config/*       → @dofe/infra-common/src/config/*
@/utils/*        → @dofe/infra-utils/src/*
@/prisma/*       → @dofe/infra-prisma/src/*
@app/redis       → libs 中的 Redis 模块
@app/auth        → libs/domain/auth
@app/db          → generated/db（自动生成的 DB Service）
@repo/contracts  → packages/contracts
```

### 已完成的能力清单

#### 后端基础设施（@dofe/infra-\*，10 个子包）

| 模块                | 能力                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **common**          | `@Cacheable` / `@Transactional` / `@FeatureFlag` 装饰器、拦截器、管道、全局异常过滤器、Winston 日志、三层配置加载器、功能注册表 |
| **clients**         | SMS（火山引擎 / 阿里云 / 自定义）、对象存储（OSS / TOS / Qiniu / UCloud / GCS）、OCR、TTS、风控、图片处理、IP 归属地            |
| **prisma**          | 读写分离（prisma-read / prisma-write）、慢查询监控（三级阈值）、软删除中间件、连接池管理                                        |
| **redis**           | 命名缓存键 + TTL 管理、`@Cacheable` / `@CacheEvict` 装饰器、分布式锁                                                            |
| **rabbitmq**        | 事件驱动架构、BullMQ 任务队列、`@OnEvent` 装饰器                                                                                |
| **jwt**             | Token 签发 / 刷新 / 验证、多策略 Passport 认证                                                                                  |
| **shared-db**       | AsyncLocalStorage 事务上下文、UnitOfWork 模式、指数退避自动重试                                                                 |
| **shared-services** | 邮件（SendCloud）、短信（多供应商）、文件上传、系统健康检查                                                                     |

#### 后端业务域

| 模块         | 能力                                                                          |
| ------------ | ----------------------------------------------------------------------------- |
| **auth**     | JWT 认证、OAuth2（微信 / Google / Discord）、手机号 / 邮箱登录、Refresh Token |
| **uploader** | 多供应商文件上传、分片上传（50MB）、私有 / 公开桶、CDN 分发                   |

#### 前端

| 能力       | 实现                                                    |
| ---------- | ------------------------------------------------------- |
| API 客户端 | ts-rest + React Query — 编译时类型推导，运行时 Zod 校验 |
| UI 组件库  | shadcn/ui + Tailwind CSS 4 + class-variance-authority   |
| 国际化     | next-intl（zh-CN / en），12 个命名空间                  |
| 状态管理   | React Query（服务端状态）+ Zustand（客户端状态）        |
| 权限控制   | RBAC + `usePermissions` hook                            |
| AI Agent   | 多智能体聊天客户端                                      |
| 配置校验   | Zod Schema 校验前端 env，校验失败降级为默认值           |
| 监控       | 页面追踪、性能监控                                      |

#### 配置体系

| 能力     | 实现                                                                        |
| -------- | --------------------------------------------------------------------------- |
| 三层配置 | `.env`（连接串）+ `config.local.yaml`（结构化）+ `keys/config.json`（密钥） |
| Zod 校验 | 三层配置 + 前端 env 均通过 Zod Schema 校验                                  |
| 功能注册 | `requiredFeatures` 按需声明，启动时自动校验完整性                           |
| 向后兼容 | `syncKeysToEnv()` 自动将 keys 密钥注入 process.env                          |
| 统一错误 | `FeatureNotConfiguredError` — dev 警告，prod 阻止启动                       |

#### 数据库模型

| 模型        | 说明                                                     |
| ----------- | -------------------------------------------------------- |
| UserInfo    | 用户档案，多认证标识符                                   |
| Auth        | OAuth（微信 / Google / Discord / 手机 / 邮箱）+ 密码认证 |
| FileSource  | 多供应商文件存储（OSS / TOS / Qiniu / GCS / UCloud）     |
| CountryCode | 大洲 / 国家映射（IP 归属地）                             |

---

## 6. 核心数据流

### API 契约流（ts-rest + Zod）

前后端通过共享的 `@repo/contracts` 包实现端到端类型安全：

```
┌──────────────────────────────────────────────────────────────────┐
│                    @repo/contracts                               │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  contract = c.router({                                     │  │
│  │    list: {                                                 │  │
│  │      method: 'GET', path: '/list',                        │  │
│  │      query: PaginationQuerySchema,     ← Zod Schema      │  │
│  │      responses: { 200: PaginatedResponseSchema }         │  │
│  │    }                                                       │  │
│  │  })                                                        │  │
│  └──────────────────────────┬─────────────────────────────────┘  │
│                             │                                     │
│              ┌──────────────┴──────────────┐                     │
│              ▼                             ▼                      │
│     Backend (NestJS)              Frontend (React)               │
│  ┌────────────────────┐       ┌──────────────────────┐          │
│  │ @TsRestHandler(c)  │       │ useQuery({           │          │
│  │ 自动校验 query/body │       │   queryKey,          │          │
│  │ 返回类型安全        │       │   queryData: {query} │          │
│  └────────────────────┘       │ })                    │          │
│                               └──────────────────────┘          │
│  编译时：TypeScript 推导 query/body/response 类型                  │
│  运行时：Zod Schema 自动校验请求和响应                              │
└──────────────────────────────────────────────────────────────────┘
```

### 请求生命周期

```
Client Request
    │
    ▼
Fastify (rate limit → CORS → cookie)
    │
    ▼
NestJS Pipeline
    ├── GlobalPrefix: /
    ├── Versioning: x-api-version header
    ├── Guard: VersionGuard
    ├── Pipe: ValidationPipe (transform)
    ├── Middleware: RequestMiddleware (auth context)
    │
    ▼
Controller (@TsRestHandler)
    │  ← Zod 校验 query / body / pathParams
    │
    ▼
Service (业务逻辑)
    │  ← 使用 Prisma 类型构建查询条件
    │  ← 调用 DB Service 方法执行数据库操作
    │  ← 调用 Client 层访问外部服务
    │
    ▼
Interceptor: TransformInterceptor
    │  ← 统一包装 { code, msg, data }
    │
    ▼
Client Response
```

### 分页标准模式

所有 GET 列表端点遵循统一分页规范：

```typescript
// Request
const query = PaginationQuerySchema.extend({ status: z.string().optional() });

// Response
const response = PaginatedResponseSchema(ItemSchema);
// → { list: T[], total: number, page: number, limit: number }
```

---

## 7. 配置体系

三层配置架构，所有配置均通过 Zod 校验：

| 层  | 文件                | 内容           | 校验               |
| --- | ------------------- | -------------- | ------------------ |
| 1   | `.env`              | 基础设施连接串 | `envSchema`        |
| 2   | `config.local.yaml` | 结构化配置     | `yamlConfigSchema` |
| 3   | `keys/config.json`  | 所有密钥凭证   | `keysConfigSchema` |

### `.env` — 基础设施连接串

仅保留启动必需的连接信息，**不含任何密钥**：

```env
NODE_ENV=dev
BASE_HOST=127.0.0.1
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
READ_DATABASE_URL=postgresql://user:password@localhost:5432/dbname
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://localhost:5672
RABBITMQ_EVENTS_URL=amqp://user:password@${BASE_HOST}:5672/events
API_BASE_URL=http://localhost:3101
INTERNAL_API_BASE_URL=http://127.0.0.1:3101
```

### `config.local.yaml` — 结构化配置

非敏感的结构化配置 + 功能声明：

```yaml
app:
  name: 'my-app'
  port: 3101
  domain: 'my-app.example.com'
  requiredFeatures: # 声明项目依赖的功能模块
    - database
    - redis
    - rabbitmq
    - jwt
    - crypto
    - email
    # ...
```

还包含：功能开关、限流配置、CDN、Redis 缓存键定义、存储桶定义、数据库监控、事务重试、Prisma 配置。

### `keys/config.json` — 所有密钥

统一管理所有密钥凭证（JWT、Crypto、第三方服务）：

```json
{
  "jwt": { "secret": "...", "expireIn": 3600 },
  "crypto": { "key": "...", "iv": "..." },
  "encryption": { "key": "..." },
  "admin": { "registerSecret": "..." },
  "sendcloud": { "apiUser": "...", "apiKey": "..." },
  "sms": { "default": "volcengine", "providers": [...] },
  "storage": { "oss": {...}, "tos": {...}, "qiniu": {...} },
  "openai": { "apiKey": "...", "baseUrl": "..." }
}
```

### 功能校验

启动时 `initAllConfig()` 自动校验所有声明的 `requiredFeatures`：

```
main.ts 启动流程:
1. loadEnv()              ← 加载 .env
2. initAllConfig()        ← 一次性完成：
   ├─ initEnvValidation()     校验 .env
   ├─ initConfig()            加载 config.local.yaml
   ├─ initKeysConfig()        加载 keys/config.json
   ├─ syncKeysToEnv()         向后兼容注入 process.env
   └─ validateRequiredFeatures()  按声明校验
       ├─ dev:  警告 + 继续
       └─ prod: 报错 + 阻止启动
3. NestFactory.create()   ← 创建应用
```

### 前端配置

前端 env 通过 Zod 校验（`apps/web/lib/config/env.ts`），校验失败降级为默认值而不阻止启动。

---

## 8. 可用命令

```bash
# 开发
pnpm dev                # 启动所有应用
pnpm dev:web            # 仅前端
pnpm dev:api            # 仅后端

# 构建
pnpm build              # 构建所有
pnpm build:web          # 仅前端
pnpm build:api          # 仅后端

# 数据库
pnpm db:generate        # 生成 Prisma Client
pnpm db:migrate:dev     # 运行迁移（开发）
pnpm db:migrate:deploy  # 运行迁移（生产）
pnpm db:push            # 推送 Schema 变更

# 代码质量
pnpm lint               # Lint 全部
pnpm lint:web           # Lint 前端
pnpm lint:api           # Lint 后端
pnpm type-check         # 类型检查
pnpm test               # 运行测试
pnpm test:api           # 仅后端测试

# 清理
pnpm clean              # 清理构建产物

# 脚手架
pnpm run export-scaffold    # 导出模板到 packages/create-dofe-ai/template/
pnpm run create-scaffold    # 基于模板创建新项目
```

---

## 9. 发布到 npm

只有 `create-dofe-ai` 包会发布到 npm，其余包均标记为 `private: true`。

### 发布步骤

```bash
# 1. 在仓库根目录，导出 git 跟踪文件到模板目录
pnpm run export-scaffold

# 2. 进入 create-dofe-ai 包目录
cd packages/create-dofe-ai

# 3. 验证包内容（可选）
npm pack --dry-run

# 4. 发布
npm publish
# scope 包需加 --access public

# 5. 更新版本后重新发布
npm version patch   # 或 minor, major
npm publish
```

### 导出脚本做了什么

`scripts/export-scaffold-for-create.js`：

1. `git ls-files` 获取所有 git 跟踪文件
2. 排除：脚手架自身、构建产物、旧文档、AI/编辑器配置
3. 复制到 `packages/create-dofe-ai/template/`
4. 注入 `infra.dofe.ai` 工作区引用

### 常见问题

| 问题                  | 解决                              |
| --------------------- | --------------------------------- |
| `404 Not Found`       | 包未发布，先执行发布流程          |
| `403 Forbidden`       | scope 包加 `--access public`      |
| `prepublishOnly` 失败 | 先运行 `pnpm run export-scaffold` |
| 需要 2FA              | 使用 `--otp=<code>` 参数          |

详细指南见 [docs/发布到npm.md](./docs/发布到npm.md)。

---

## 10. Docker 部署

```bash
# 仅启动基础设施
docker compose up -d postgres redis rabbitmq

# 启动全部服务
docker compose up -d

# 重新构建 API
docker compose up -d --build api
```

API 容器自动挂载配置文件（只读）：

- `./apps/api/config.local.yaml:/app/config.local.yaml:ro`
- `./apps/api/keys/config.json:/app/keys/config.json:ro`

| 服务       | 端口         | 说明                |
| ---------- | ------------ | ------------------- |
| PostgreSQL | 5432         | 数据库              |
| Redis      | 6379         | 缓存                |
| RabbitMQ   | 5672 / 15672 | 消息队列 / 管理界面 |
| API        | 3101         | NestJS 后端         |
| Web        | 3000         | Next.js 前端        |

---

## 11. 文档索引

| 文档                       | 路径                                                                                                 |
| -------------------------- | ---------------------------------------------------------------------------------------------------- |
| 脚手架范围说明             | [docs/脚手架说明.md](./docs/脚手架说明.md)                                                           |
| 发布到 npm 指南            | [docs/发布到npm.md](./docs/发布到npm.md)                                                             |
| 配置分层设计方案           | [docs/0429/env-opz/配置分层与校验优化设计方案.md](./docs/0429/env-opz/配置分层与校验优化设计方案.md) |
| 配置实施总结               | [docs/0429/env-opz/scaffold-实施总结.md](./docs/0429/env-opz/scaffold-实施总结.md)                   |
| 架构分层与事务管理         | apps/api/docs/架构分层与事务管理方案-new.md                                                          |
| ts-rest Zod-first 协议设计 | docs/ts-rest*Zod-first_REST*协议框架设计方案.md                                                      |
| 业务与基础设施拆分         | apps/api/docs/业务与基础设施拆分方案.md                                                              |

---

## License

MIT License
