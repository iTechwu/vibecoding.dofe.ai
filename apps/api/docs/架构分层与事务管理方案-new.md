# 架构分层与事务管理方案

> 本文档为脚手架占位文档，请在业务项目中按需完善。

## 概述

本文档定义了后端架构分层设计和事务管理策略，确保代码的可维护性和数据一致性。

---

## 1. 架构分层

### 1.1 四层架构

```
┌─────────────────────────────────────────────────────────────┐
│                      API Layer (Controller)                  │
│  - 处理 HTTP 请求/响应                                        │
│  - 参数验证（通过 ts-rest + Zod）                             │
│  - 不包含业务逻辑                                             │
├─────────────────────────────────────────────────────────────┤
│                      Service Layer                           │
│  - 业务逻辑处理                                               │
│  - 调用 DB Service 和 Client                                 │
│  - 事务协调                                                   │
├─────────────────────────────────────────────────────────────┤
│                      DB Service Layer                        │
│  - 数据库访问封装                                             │
│  - 继承 TransactionalServiceBase                             │
│  - 读写分离支持                                               │
├─────────────────────────────────────────────────────────────┤
│                      Client Layer                            │
│  - 外部 API 调用封装                                          │
│  - 使用 @nestjs/axios                                        │
│  - 不包含业务逻辑                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 依赖方向

```
Controller → Service → DB Service / Client
                ↓
              Prisma / External API
```

**核心规则**：
- Controller 不直接访问数据库
- Service 不直接使用 Prisma，通过 DB Service 访问
- Client 不包含业务逻辑，仅封装 HTTP 调用

---

## 2. 事务管理

### 2.1 使用 @Transactional 装饰器

```typescript
import { Transactional } from '@/decorators/transaction/transactional.decorator';

@Injectable()
export class OrderService {
  constructor(
    private readonly orderDb: OrderDbService,
    private readonly inventoryDb: InventoryDbService,
  ) {}

  @Transactional()
  async createOrder(data: CreateOrderDto): Promise<Order> {
    // 创建订单
    const order = await this.orderDb.create(data);

    // 扣减库存（在同一事务中）
    await this.inventoryDb.decrease(data.productId, data.quantity);

    return order;
  }
}
```

### 2.2 TransactionalServiceBase

```typescript
import { TransactionalServiceBase } from '@app/shared-db';

@Injectable()
export class OrderDbService extends TransactionalServiceBase {
  async create(data: CreateOrderInput): Promise<Order> {
    return this.getWriteClient().order.create({ data });
  }

  async findById(id: string): Promise<Order | null> {
    return this.getReadClient().order.findUnique({ where: { id } });
  }
}
```

---

## 3. 错误处理

### 3.1 使用 @HandlePrismaError

```typescript
import { HandlePrismaError } from '@/decorators/prisma-error.decorator';

@Injectable()
export class UserDbService extends TransactionalServiceBase {
  @HandlePrismaError()
  async create(data: CreateUserInput): Promise<User> {
    return this.getWriteClient().user.create({ data });
  }
}
```

### 3.2 API 错误响应

```typescript
import { apiError } from '@/filter/exception/api.exception';
import { CommonErrorCode } from '@repo/contracts/errors';

// 抛出业务错误
throw apiError(CommonErrorCode.NotFound, { resource: 'User' });
```

---

## 4. 最佳实践清单

- [ ] Controller 仅处理请求/响应，不包含业务逻辑
- [ ] Service 通过 DB Service 访问数据库，不直接使用 Prisma
- [ ] 使用 @Transactional 装饰器管理事务
- [ ] DB Service 继承 TransactionalServiceBase
- [ ] 使用 @HandlePrismaError 统一处理数据库错误
- [ ] 外部 API 调用封装在 Client 层

---

## 参考资源

- [NestJS 官方文档](https://docs.nestjs.com/)
- [Prisma 事务文档](https://www.prisma.io/docs/concepts/components/prisma-client/transactions)
