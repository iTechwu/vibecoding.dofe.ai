# ts-rest Zod-first REST 协议框架设计方案

> 本文档为脚手架占位文档，请在业务项目中按需完善。

## 概述

本文档定义了基于 ts-rest 和 Zod 的类型安全 API 设计方案，确保前后端类型一致性和运行时验证。

---

## 1. 核心概念

### 1.1 Zod-first 原则

**所有 API 请求/响应必须使用 Zod Schema 定义**，禁止手动类型断言。

```typescript
// ✅ 正确：使用 Zod Schema
const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
});

// ❌ 错误：手动类型断言
const user = data as User;
```

### 1.2 Contract 定义

```typescript
// packages/contracts/src/api/user.contract.ts
import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { createApiResponse } from '../base';

const c = initContract();

export const userContract = c.router({
  getUser: {
    method: 'GET',
    path: '/users/:id',
    pathParams: z.object({
      id: z.string().uuid(),
    }),
    responses: {
      200: createApiResponse(UserSchema),
      404: createApiResponse(z.object({ message: z.string() })),
    },
    summary: '获取用户信息',
  },
});
```

---

## 2. 后端实现

### 2.1 Controller 使用 ts-rest

```typescript
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { userContract as c } from '@repo/contracts/api';
import { success } from '@/common/ts-rest/response.helper';

@Controller()
export class UserController {
  @TsRestHandler(c.getUser)
  async getUser() {
    return tsRestHandler(c.getUser, async ({ params }) => {
      // params.id 已由 Zod 验证，类型安全
      const user = await this.userService.findById(params.id);

      if (!user) {
        return { status: 404, body: { code: 404, msg: 'Not found', data: { message: 'User not found' } } };
      }

      return success(user);
    });
  }
}
```

### 2.2 响应格式

```typescript
// 标准成功响应
{
  code: 200,
  msg: 'ok',
  data: { ... }
}

// 标准错误响应
{
  code: 404,
  msg: 'Not found',
  data: { message: 'User not found' }
}
```

---

## 3. 前端使用

### 3.1 ts-rest + React Query

```typescript
import { initQueryClient } from '@ts-rest/react-query';
import { userContract } from '@repo/contracts/api';

const client = initQueryClient(userContract, {
  baseUrl: '/',
});

// 在组件中使用
function UserProfile({ userId }: { userId: string }) {
  const { data, isLoading, error } = client.getUser.useQuery({
    queryKey: ['user', userId],
    params: { id: userId },
  });

  if (isLoading) return <Skeleton />;
  if (error) return <Error message={error.message} />;

  // data.body.data 类型安全
  return <div>{data.body.data.name}</div>;
}
```

---

## 4. 类型共享

### 4.1 从 Schema 推断类型

```typescript
// packages/contracts/src/schemas/user.schema.ts
export const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
});

// 导出推断类型
export type User = z.infer<typeof UserSchema>;
```

### 4.2 在前后端使用

```typescript
// 后端
import { User } from '@repo/contracts/schemas';

// 前端
import type { User } from '@repo/contracts/schemas';
```

---

## 5. 最佳实践清单

- [ ] 所有 API 使用 ts-rest Contract 定义
- [ ] 请求/响应使用 Zod Schema 验证
- [ ] 禁止使用 `as any` 类型断言
- [ ] 使用 `z.infer` 推断类型，而非手动定义
- [ ] 前后端共享 Contract 和 Schema
- [ ] 使用 `createApiResponse` 统一响应格式

---

## 参考资源

- [ts-rest 官方文档](https://ts-rest.com/)
- [Zod 官方文档](https://zod.dev/)
