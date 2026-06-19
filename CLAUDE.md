# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DofeAI is a multi-agent driven content creation and operations platform. This repository serves as a **scaffold/template**: it retains **all files except logs**; `logs/` and `*.log` are excluded via `.gitignore`. See [docs/脚手架说明.md](docs/脚手架说明.md) for scope and exclusions.

This is a full-stack monorepo built with pnpm workspaces + Turborepo, containing:

- **Next.js 16 frontend** (React 19)
- **NestJS backend** (Fastify + Prisma)
- **Shared packages** for code reuse across frontend and backend

## Development Commands

```bash
# Install dependencies
pnpm install

# Development (all apps)
pnpm dev

# Development (specific apps)
pnpm dev:web          # Next.js frontend only
pnpm dev:api          # NestJS backend only

# Build
pnpm build
pnpm build:web        # Build web only
pnpm build:api        # Build api only

# Lint
pnpm lint
pnpm lint:web
pnpm lint:api

# Type check
pnpm type-check

# Test
pnpm test
pnpm test:api

# Database (NestJS/Prisma)
pnpm db:generate      # Generate Prisma client
pnpm db:migrate:dev   # Run migrations (development)
pnpm db:migrate:deploy # Run migrations (production)
pnpm db:push          # Push schema changes

# Clean
pnpm clean
```

## Architecture

### Monorepo Structure

```
dofe-ai/
├── apps/
│   ├── web/                    # @repo/web - Next.js 16 frontend
│   │   ├── app/                # App Router pages
│   │   ├── components/         # React components
│   │   ├── lib/                # API client, queries, utilities
│   │   └── hooks/              # Custom React hooks
│   │
│   └── api/                    # @repo/api - NestJS backend
│       ├── src/                # Main application source
│       │   └── modules/        # Feature modules (API layer)
│       ├── libs/               # Backend-only shared libraries (domain only)
│       │   └── domain/         # 业务：与 Dofe 领域/流程强相关
│       │       ├── auth/       # Authentication / identity
│       │       └── services/   # Business domain services (ip-info, etc.)
│       └── prisma/             # Database schema & migrations
│
│   node_modules/@dofe/infra-*/ # Infra packages installed from npm (^0.1.55)
│   ├── @dofe/infra-common/     # Decorators, interceptors, pipes, config, filter
│   ├── @dofe/infra-clients/    # Third-party API clients
│   ├── @dofe/infra-prisma/     # DB connection, read/write split
│   ├── @dofe/infra-redis/      # Cache
│   ├── @dofe/infra-rabbitmq/   # Message queue
│   ├── @dofe/infra-jwt/        # JWT
│   ├── @dofe/infra-utils/      # Pure utilities
│   ├── @dofe/infra-i18n/       # i18n assets
│   ├── @dofe/infra-shared-db/  # TransactionalServiceBase, UnitOfWork
│   └── @dofe/infra-shared-services/ # email, sms, ip-info, file-storage, etc.
│
└── packages/                   # Shared packages (frontend + backend)
    ├── ui/                     # @repo/ui - UI components (shadcn/ui)
    ├── utils/                  # @repo/utils - Utility functions
    ├── types/                  # @repo/types - TypeScript types
    ├── config/                 # @repo/config - Shared configs (tsconfig, eslint)
    ├── constants/              # @repo/constants - Shared constants
    ├── validators/             # @repo/validators - Zod validation schemas
    └── contracts/              # @repo/contracts - API contracts (ts-rest)
```

### Import Aliases

**Frontend (apps/web):**

- `@/*` - App-internal imports
- `@repo/ui` - UI components
- `@repo/utils` - Utilities
- `@repo/types` - Types
- `@repo/config` - Configs
- `@repo/constants` - Shared constants
- `@repo/validators` - Shared validators
- `@repo/contracts` - API contracts and types

**Backend (apps/api):**

- `@/common/*` - Common utilities (→ `@dofe/infra-common/src/*`)
- `@/config/*` - Configuration (→ `@dofe/infra-common/src/config/*`)
- `@/utils/*` - Utility functions (→ `@dofe/infra-utils/src/*`)
- `@/prisma/*` - Prisma module (→ `@dofe/infra-prisma/src/prisma/*`)
- `@app/<lib>` - Backend libraries (e.g. `@app/redis`, `@app/auth`, `@app/db`)
- `@app/clients/internal/*` - Third-party API clients (→ `@dofe/infra-clients/src/internal/*`)
- `@app/shared-services/*` - Shared services (→ `@dofe/infra-shared-services/src/*`)
- `@app/auth`, `@app/db` - Domain libs (→ `libs/domain/auth`, `generated/db`)
- `@repo/constants` - Shared constants
- `@repo/validators` - Shared validators
- `@repo/contracts` - API contracts

**Backend libs: infra vs domain boundary**

- **infra** (`@dofe/infra-*`): 已从 `libs/infra/` 提取至独立仓库 `infra.dofe.ai`（10 个子包），已发布到 npm，本仓库通过 `package.json` 依赖（`^0.1.55`）从 npm 安装消费，**不再**通过 `pnpm-workspace.yaml` 引用同级 `infra.dofe.ai` 目录。包含 common, clients, prisma, redis, rabbitmq, jwt, utils, i18n, shared-db, shared-services。与产品/领域无关，可复用。**禁止**依赖 `libs/domain/**`。
- **domain** (`libs/domain/`): auth, services。与 Dofe 领域/业务流程强相关。**可**依赖 infra。`@app/db` 指向 `generated/db`（自动生成的 DB Service 模块）。
- **依赖方向**：`src` → `domain` → `@dofe/infra-*`。infra 内模块可相互依赖，但不得 import domain。
- 详见 `apps/api/docs/业务与基础设施拆分方案.md` 和 `docs/0426/infra/迁移状态.md`。

### Key Technologies

**Frontend:**

- **Framework**: Next.js 16 with App Router, React 19
- **API Contract**: ts-rest for type-safe client-server communication
- **State Management**: React Query (@tanstack/react-query)
- **Styling**: Tailwind CSS 4 + class-variance-authority
- **API Client**: ts-rest + React Query
- **Validation**: Zod 4 (see Zod 4 Usage Guidelines below)

**Backend:**

- **Framework**: NestJS 11 with Fastify
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis (ioredis)
- **Queue**: RabbitMQ + BullMQ
- **Auth**: Passport (JWT, OAuth2)
- **API Contract**: ts-rest
- **Validation**: Zod 4 (see Zod 4 Usage Guidelines below)

**Shared:**

- **Validation Library**: Zod 4.x (NOT Zod 3.x)
- **API Contract**: ts-rest ^3.53.0-rc.1 (supports Zod 4)

### Build Configuration

**Backend (apps/api)**: Uses NestJS webpack builder with custom SWC loader for `@dofe/infra-*` source files. See `apps/api/webpack.config.js` for configuration. Type checking is done separately via `tsc --noEmit`.

**Shared packages** use **CommonJS** output format for compatibility with both NestJS and Next.js:

```json
// packages/*/tsconfig.build.json
{
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node",
    "noEmit": false,
    "declaration": true
  }
}
```

### API Architecture

**API Contract Pattern** (ts-rest):

```typescript
// packages/contracts - Define contract
export const teamContract = contract.router({
  list: { method: 'GET', path: '/list', responses: { 200: TeamListSchema } }
});

// apps/api - Implement contract
@TsRestHandler(c.list)
async list() { return tsRestHandler(...); }

// apps/web - Consume contract
const { data } = useTeamList();
```

**Frontend API Client** (`apps/web/lib/api/client.ts`):

- `apiClient.get/post/put/delete()` - Returns parsed `data` from `{code, msg, data}`
- `apiClient.getFullResponse()` - Returns full response
- `ApiError` class with typed error handling

**Backend API Pattern**:

- Controllers handle HTTP requests
- Services contain business logic
- Modules organize features
- Guards/Interceptors for cross-cutting concerns

### API List Standardization Pattern

**ALL GET list endpoints MUST follow this standardization pattern:**

#### 1. Query Schema (Request)

**Rule**: Use `PaginationQuerySchema` or extend it for additional filters.

```typescript
// packages/contracts/src/base.ts - Base schema definition
export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().positive().optional().default(20),
  page: z.coerce.number().positive().min(1).optional().default(1),
  sort: z.enum(['createdAt', 'name', 'fsize', 'disable', 'frameTime', 'expireAt']).optional(),
  asc: z.enum(['asc', 'desc']).optional(),
});

// Example 1: Use directly (no additional filters)
export const GetCommentsQuerySchema = PaginationQuerySchema;

// Example 2: Extend with additional filters
export const GetRecommendationsQuerySchema = PaginationQuerySchema.extend({
  recommendTypes: z.array(RecommendTypeSchema).optional(),
  context: z.string().optional(),
});

// Example 3: Complex filters
export const GetUserBehaviorsQuerySchema = PaginationQuerySchema.extend({
  userId: z.string().uuid().optional(),
  knowledgeUnitId: z.string().uuid().optional(),
  behaviorType: BehaviorTypeSchema.optional(),
  sessionId: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});
```

#### 2. Response Schema

**Rule**: Use `PaginatedResponseSchema` factory function.

```typescript
// packages/contracts/src/base.ts - Factory function definition
export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    list: z.array(itemSchema),
    total: z.number(),
    page: z.number(),
    limit: z.number(),
  });

// Usage: Wrap your item schema
export const UserBehaviorsResponseSchema = PaginatedResponseSchema(UserBehaviorItemSchema);

export const RecommendationListResponseSchema = PaginatedResponseSchema(RecommendationItemSchema);

// Special case: Extend with additional fields
export const NotificationListResponseSchema = PaginatedResponseSchema(
  NotificationListItemSchema,
).extend({
  unreadCount: z.number(),
});
```

**Standard response structure:**

```typescript
{
  list: T[],      // Array of items (NOT: items, data, recommendations, etc.)
  total: number,  // Total count
  page: number,   // Current page number
  limit: number   // Items per page
}
```

#### 3. Contract Definition

```typescript
// packages/contracts/src/api/*.contract.ts
import { initContract } from '@ts-rest/core';
import { createApiResponse } from '../base';

const c = initContract();

export const userBehaviorContract = c.router({
  list: {
    method: 'GET',
    path: '/user-behavior',
    query: GetUserBehaviorsQuerySchema,
    responses: {
      200: createApiResponse(UserBehaviorsResponseSchema),
    },
    summary: '获取用户行为列表',
    description: '查询用户行为记录，支持多维度过滤',
  },
});
```

#### 4. Backend Implementation

**Controller Layer** (`apps/api/src/modules/*/controller.ts`):

```typescript
@TsRestHandler(c.list)
async list(@Req() req: FastifyRequest) {
  const { userId, teamId } = req;
  return tsRestHandler(c.list, async ({ query }) => {
    const result = await this.service.list(teamId, query);
    return { success: true, body: result };
  });
}
```

**Service Layer** (`apps/api/src/modules/*/service.ts`):

```typescript
async list(
  teamId: string,
  query: GetUserBehaviorsQuery,
): Promise<UserBehaviorsResponse> {
  // 1. Extract pagination params with defaults
  const { limit = 20, page = 1, ...filters } = query;

  // 2. Convert page-based to offset-based pagination for Prisma
  const offset = (page - 1) * limit;

  // 3. Call business service or DB service
  const { behaviors, total } = await this.businessService.getUserBehaviors(
    { teamId, ...filters },
    { limit, offset },
  );

  // 4. Return standardized response
  return {
    list: behaviors.map((b) => ({
      id: b.id,
      // ... map fields
    })),
    total,
    page,    // Return page (NOT offset)
    limit,
  };
}
```

**Key implementation points:**

- ✅ Extract `limit` and `page` with defaults: `const { limit = 20, page = 1, ...filters } = query`
- ✅ Calculate offset: `const offset = (page - 1) * limit`
- ✅ Return `page` in response (NOT offset)
- ✅ Response field must be `list` (NOT: items, data, behaviors, recommendations, etc.)

#### 5. Frontend Usage (ts-rest + React Query)

```typescript
// apps/web/lib/api/queries/user-behavior.ts
import { tsRestClient } from '@repo/contracts';

export const useUserBehaviors = (query: GetUserBehaviorsQuery) => {
  return tsRestClient.userBehavior.list.useQuery({
    queryKey: ['user-behaviors', query],
    queryData: { query },
  });
};

// Component usage
const { data } = useUserBehaviors({ page: 1, limit: 20, userId: 'xxx' });
// data.body.list - Array of items
// data.body.total - Total count
// data.body.page - Current page
// data.body.limit - Items per page
```

#### 6. Standardized Examples

**Fully standardized APIs** (reference these as examples):

- [knowledge-recommendation.contract.ts:29](packages/contracts/src/api/knowledge-recommendation.contract.ts#L29) - `getRecommendations`
- [user-behavior.contract.ts:58](packages/contracts/src/api/user-behavior.contract.ts#L58) - `list`
- [recruitment.contract.ts](packages/contracts/src/schemas/recruitment.schema.ts) - `JobDescriptionQuerySchema`, `CandidateListQuerySchema`, etc.
- [meeting.contract.ts](packages/contracts/src/schemas/meeting.schema.ts) - `ListMeetingsQuerySchema`
- [notification.contract.ts](packages/contracts/src/schemas/notification.schema.ts) - `GetNotificationListRequestSchema` (with extended response)
- [comment.contract.ts](packages/contracts/src/schemas/comment.schema.ts) - `CommentsListResponseSchema`
- [message.contract.ts](packages/contracts/src/schemas/message.schema.ts) - `MessageListQuerySchema`

#### 7. Common Violations to Avoid

❌ **Wrong - Custom pagination fields:**

```typescript
const query = z.object({
  offset: z.number(), // ❌ Use page instead
  size: z.number(), // ❌ Use limit instead
});
```

❌ **Wrong - Non-standard response structure:**

```typescript
const response = z.object({
  data: z.array(ItemSchema),        // ❌ Use list instead
  totalCount: z.number(),            // ❌ Use total instead
  recommendations: z.array(...),     // ❌ Use list instead
});
```

❌ **Wrong - Missing pagination entirely:**

```typescript
const query = z.object({
  userId: z.string(),
  // ❌ No pagination fields
});

const response = z.object({
  items: z.array(ItemSchema),
  // ❌ No total/page/limit
});
```

❌ **Wrong - Backend returning offset:**

```typescript
return {
  list: items,
  total,
  offset, // ❌ Return page instead
  limit,
};
```

✅ **Correct - Full standardization:**

```typescript
// Contract
export const ListQuerySchema = PaginationQuerySchema.extend({
  status: StatusSchema.optional(),
});

export const ListResponseSchema = PaginatedResponseSchema(ItemSchema);

// Backend
const { limit = 20, page = 1, ...filters } = query;
const offset = (page - 1) * limit;
const { items, total } = await this.service.find({ ...filters }, { limit, offset });

return {
  list: items,
  total,
  page,
  limit,
};
```

### Environment Variables

**Frontend** (`apps/web/.env.local`):

```
# API
NEXT_PUBLIC_SERVER_BASE_URL=http://localhost:13100
# AI integration endpoints (service-specific, configure as needed)

# Brand
NEXT_PUBLIC_BRAND_NAME='Dofe.AI'
NEXT_PUBLIC_BRAND_TITLE=DofeAI - Multi-Agent Content Creation
```

**Backend** (`apps/api/.env`):

```
NODE_ENV=development
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://localhost:5672
JWT_SECRET=your-secret-key
```

## Code Patterns

### Adding UI Components

UI components go in `packages/ui/` and must be exported from `packages/ui/index.ts`.

### Adding API Endpoints (Frontend)

API modules go in `apps/web/lib/api/`. Use `apiClient` from `./client.ts` or ts-rest hooks from `./contracts/`.

### Adding API Endpoints (Backend)

```bash
# Generate NestJS artifacts
cd apps/api
npx nest g module <name> src/modules
npx nest g controller <name> src/modules
npx nest g service <name> src/modules
```

### Adding Backend Libraries

Backend-only shared code goes in `apps/api/libs/`. Use NestJS schematics:

```bash
cd apps/api
npx nest g library <name>
```

### Adding Shared Packages

Code shared between frontend and backend goes in `packages/`:

- `packages/constants/` - Constants (HTTP codes, limits, etc.)
- `packages/validators/` - Validation schemas (zod)
- `packages/contracts/` - API contracts (ts-rest)

**Important**: When adding a new shared package:

1. Create in `packages/` directory
2. Set `name` to `@repo/<package-name>` in package.json
3. Configure `tsconfig.build.json` with:
   ```json
   {
     "compilerOptions": {
       "noEmit": false,
       "module": "commonjs",
       "moduleResolution": "node"
     }
   }
   ```
4. Add to consumer's dependencies: `"@repo/<package-name>": "workspace:*"`

### Server Components vs Client Components

Next.js 16 App Router is used. Client components must include `'use client'` directive.

## 🔷 Zod 4 Usage Guidelines

**IMPORTANT: This project uses Zod 4.x (NOT Zod 3.x). All code MUST follow Zod 4 patterns.**

### Import Statement

```typescript
// ✅ Correct: Import from 'zod' (uses Zod 4 classic mode)
import { z } from 'zod';

// ❌ Wrong: Do NOT use zod/v3 compatibility layer
import { z } from 'zod/v3';
```

### Key Differences from Zod 3

1. **Object Schema Definition**

   ```typescript
   // Zod 4 uses $strip instead of strip() for object mode
   const schema = z.object({
     name: z.string(),
     age: z.number(),
   }); // Default is $strip mode
   ```

2. **Error Handling**

   ```typescript
   // Zod 4 error structure
   const result = schema.safeParse(data);
   if (!result.success) {
     // Use result.error.issues for error details
     console.log(result.error.issues);
   }
   ```

3. **Type Inference**
   ```typescript
   // Both work in Zod 4
   type User = z.infer<typeof UserSchema>;
   type User = z.output<typeof UserSchema>;
   ```

### ts-rest Compatibility

This project uses **ts-rest ^3.53.0-rc.1** which supports Zod 4. The contract definitions work the same way:

```typescript
import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

export const userContract = c.router({
  getUser: {
    method: 'GET',
    path: '/user/:id',
    pathParams: z.object({
      id: z.string().uuid(),
    }),
    responses: {
      200: z.object({
        id: z.string(),
        name: z.string(),
      }),
    },
  },
});
```

### Migration Notes

If you encounter code using Zod 3 patterns, update to Zod 4:

| Zod 3                        | Zod 4                                               |
| ---------------------------- | --------------------------------------------------- |
| `z.object({}).strip()`       | `z.object({})` (default is strip)                   |
| `z.object({}).passthrough()` | `z.looseObject({})` or `z.object({}).passthrough()` |
| `z.object({}).strict()`      | `z.strictObject({})` or `z.object({}).strict()`     |

## 📋 Code Quality Standards

All code MUST follow these quality standards:

1. **Follow Architecture Layering Standards**
   - Strictly follow 4-layer architecture: API Layer → Service Layer → DB Layer/Client Layer
   - API layer cannot directly access database or external APIs
   - Service layer accesses database through DB Service, external APIs through Client layer
   - DB layer handles data access, Client layer handles external API calls

2. **Use Zod-first Validation**
   - All API requests/responses MUST use Zod Schema for validation
   - Forbidden: Manual type assertions in Controller or Service layer
   - Must rely on Zod Schema validation for type safety

3. **Type-safe API Contracts**
   - Use `@repo/contracts` to define API contracts
   - Use ts-rest for type-safe frontend-backend communication
   - Backend: `@ts-rest/nest`, Frontend: `@ts-rest/react-query`
   - Compile-time type checking, runtime Zod validation

4. **Unified Winston Logger Usage**
   - Forbidden: NestJS built-in `Logger`
   - Forbidden: `console.log`, `console.error`, etc. (except startup logs)
   - Must use Winston Logger (injected via `WINSTON_MODULE_PROVIDER`)
   - Unified log levels: `info`, `warn`, `error`, `debug`

---

## ⚠️ Core Architecture Rules (MUST Follow)

**Before making any code changes, AI assistants MUST strictly follow these three core rules:**

### 1. **DO NOT perform database read/write operations outside DB Service layer**

- **Allowed**: Use Prisma **type definitions** (e.g., `Prisma.MeetingRecordUpdateInput`, `Prisma.MeetingRecordWhereInput`) in non-DB layers
- **Forbidden**: Direct database read/write operations in non-DB layers
- **Only DB Service layer** (services extending `TransactionalServiceBase`) can directly perform database operations
- **Service layer** (e.g., `MeetingService`, `WebhookService`) MUST access database through DB Service functions
- **Forbidden** in Service layer:
  - Direct use of `prisma.write`, `prisma.read`
  - Direct use of `getWriteClient()`, `getReadClient()` (these are protected methods)
  - Direct calls to Prisma database methods (`updateMany`, `findMany`, `create`, `update`, `delete`, etc.)
- **Allowed** in Service layer:
  - Use Prisma type definitions as function parameter types or return types
  - Use Prisma type definitions to build query condition objects (passed to DB Service)

**Example violations:**

```typescript
// ❌ WRONG: Service layer performing direct database operations
@Injectable()
export class MeetingService {
  constructor(private readonly meetingRecordDb: MeetingRecordService) {}

  async batchUpdate(ids: string[]) {
    // ❌ Forbidden: Direct database write operation in Service layer
    await this.meetingRecordDb.getWriteClient().meetingRecord.updateMany({...});
  }
}

// ✅ CORRECT: Implement in DB Service layer
@Injectable()
export class MeetingRecordService extends TransactionalServiceBase {
  async batchUpdateTranscripts(ids: string[], data: Prisma.MeetingRecordUpdateInput) {
    // ✅ Correct: Prisma access in DB Service layer
    return await this.getWriteClient().meetingRecord.updateMany({...});
  }
}

// ✅ CORRECT: Service layer uses Prisma types but calls DB Service methods
@Injectable()
export class MeetingService {
  constructor(private readonly meetingRecordDb: MeetingRecordService) {}

  // ✅ Correct: Use Prisma type definition as parameter type
  async updateMeeting(id: string, data: Prisma.MeetingRecordUpdateInput) {
    // ✅ Correct: Database operation through DB Service function
    return await this.meetingRecordDb.updateMeetingRecord(id, data);
  }

  // ✅ Correct: Use Prisma type to build query conditions (passed to DB Service)
  async listMeetings(where: Prisma.MeetingRecordWhereInput) {
    // ✅ Correct: Database query through DB Service function
    return await this.meetingRecordDb.listMeetingRecords(where, {});
  }

  async batchUpdate(ids: string[]) {
    // ✅ Correct: Database operation through DB Service function
    await this.meetingRecordDb.batchUpdateTranscripts(ids, data);
  }
}
```

### 2. **Zod-first: All APIs MUST use Zod Schema for validation**

- All API requests/responses MUST use Zod Schema for validation
- When using `tsRestHandler`, Zod Schema from contract is automatically used for validation
- **Forbidden**: Manual type assertions in Controller or Service layer
- **Required**: Depend on Zod Schema validation
- External interfaces (webhooks, callbacks) MUST also use Zod Schema (use `z.any()` only with valid reason)

**Example:**

```typescript
// ✅ CORRECT: Contract defines Zod Schema
export const webhookContract = c.router({
  audioTranscribe: {
    method: 'POST',
    path: '/audio-transcribe/:vendor',
    body: AudioTranscribeWebhookRequestSchema, // Zod Schema
    responses: { 200: WebhookSuccessResponseSchema },
  },
});

// ✅ CORRECT: Controller uses tsRestHandler (auto-validates with Zod)
@TsRestHandler(webhookContract.audioTranscribe)
async handleWebhook() {
  return tsRestHandler(webhookContract.audioTranscribe, async ({ body }) => {
    // body is automatically validated by Zod Schema
    await this.webhook.handleAudioTranscribeWebhook(body);
  });
}
```

### 3. **All external service calls MUST be in Client layer, using @nestjs/axios**

- **All third-party API calls and external service integrations** MUST be encapsulated in Client layer (`apps/api/libs/clients/`)
- **Client layer MUST use** `@nestjs/axios`'s `HttpService`, **forbidden** to use `axios` directly
- **Service layer** (business logic layer) **MUST NOT** directly call external APIs, must go through Client layer
- **Client layer responsibilities**: Only HTTP calls, no business logic, no database access
- Import `HttpModule` in Module, inject `HttpService` in Client
- Use `firstValueFrom` to convert RxJS Observable to Promise

**Example violations:**

```typescript
// ❌ WRONG: Service layer directly calling external API
@Injectable()
export class MeetingService {
  constructor(private readonly httpService: HttpService) {}

  async fetchExternalData() {
    // ❌ Forbidden: Direct external API call in Service layer
    const response = await axios.get('https://api.example.com/data');
    return response.data;
  }
}

// ❌ WRONG: Using axios directly instead of @nestjs/axios
@Injectable()
export class ExternalApiClient {
  async fetchData() {
    // ❌ Forbidden: Direct axios import
    const response = await axios.get('https://api.example.com/data');
    return response.data;
  }
}
```

**Correct implementation:**

```typescript
// ✅ CORRECT: Client layer encapsulates external API calls
@Module({
  imports: [HttpModule.register({ timeout: 10000 })],
  providers: [ExternalApiClient],
  exports: [ExternalApiClient],
})
export class ExternalApiClientModule {}

@Injectable()
export class ExternalApiClient {
  constructor(private readonly httpService: HttpService) {}

  async fetchData() {
    // ✅ Correct: Using @nestjs/axios HttpService
    const response = await firstValueFrom(this.httpService.get('https://api.example.com/data'));
    return response.data;
  }
}

// ✅ CORRECT: Service layer uses Client layer
@Injectable()
export class MeetingService {
  constructor(private readonly externalApiClient: ExternalApiClient) {}

  async processData() {
    // ✅ Correct: Access external API through Client layer
    const data = await this.externalApiClient.fetchData();
    // ... business logic processing
  }
}
```

**Reference implementations** (in `@dofe/infra-clients` package):

- `@dofe/infra-clients/src/internal/agentx/agentx-client.service.ts` - AgentX API client
- `@dofe/infra-clients/src/internal/ocr/ocr.client.ts` - OCR service client
- `@dofe/infra-clients/src/internal/sms/sms-zxjc.client.ts` - SMS service client

## ⚠️ Required Reading Before Coding

When using Cursor or Claude for vibecoding (real-time coding), **MUST** read and understand the following specification documents before making any code changes:

### Frontend Specifications

1. **代码质量与类型定义规范** (`apps/web/docs/代码质量与类型定义规范.md`)
   - Type definition standards
   - Type import conventions (`import type`)
   - Props type definitions (use `interface`, not `React.FC`)
   - Utility types usage
   - Type checking checklist

2. **前端架构与交互优化方案** (`apps/web/docs/前端架构与交互优化方案.md`)
   - Architecture design
   - Performance optimization strategies
   - Code splitting strategies
   - Network request optimization
   - Image loading optimization

### Backend Specifications

3. **架构分层与事务管理方案** (`apps/api/docs/架构分层与事务管理方案-new.md`)
   - Architecture layering design
   - Transaction management patterns
   - Error handling (`@HandlePrismaError`)
   - Soft delete middleware
   - Batch operations
   - Cache strategies
   - **CRITICAL**: API Service layer MUST NOT directly access Prisma (must go through DB Service)
   - **⚠️ Rule 1**: DO NOT perform database read/write operations outside DB Service layer (Prisma type definitions are allowed)
   - **⚠️ Rule 3**: All external service calls MUST be in Client layer, using @nestjs/axios

4. **API 版本兼容方案** (`apps/api/docs/API版本兼容方案-统一设计.md`)
   - Version system design (Generation for Web, Contract for APP)
   - Contract adapter pattern
   - Version validation flow

5. **业务与基础设施拆分方案** (`apps/api/docs/业务与基础设施拆分方案.md`)
   - libs split into **infra** (`@dofe/infra-*` packages) and **domain** (`libs/domain/`)
   - **infra**: common, clients, prisma, redis, rabbitmq, jwt, utils, i18n, shared-db, shared-services (source repo `infra.dofe.ai`, consumed via npm). MUST NOT depend on `libs/domain/**`.
   - **domain**: auth, services. MAY depend on infra.
   - **Dependency direction**: `src` → `domain` → `@dofe/infra-*`. When adding or changing code under `apps/api/libs/`, obey this boundary.

### API Contract Design

6. **ts-rest Zod-first REST 协议框架设计方案** (`docs/ts-rest_Zod-first_REST_协议框架设计方案.md`)
   - API contract definition using `@repo/contracts`
   - Type-safe API design
   - Zod Schema definitions
   - Backend: `@ts-rest/nest`
   - Frontend: `@ts-rest/react-query`
   - **⚠️ Rule 2**: Zod-first - All APIs MUST use Zod Schema for validation

**See `.cursorrules` file for detailed coding guidelines and violation patterns.**
