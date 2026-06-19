# API 版本兼容方案 - 统一设计

> 本文档为脚手架占位文档，请在业务项目中按需完善。

## 概述

本文档定义了 API 版本控制策略，确保 API 的向后兼容性和平滑升级。

---

## 1. 版本控制模式

### 1.1 Header 版本控制

本项目采用 **Header 模式** 进行 API 版本控制：

```typescript
// main.ts
app.enableVersioning({
  type: VersioningType.HEADER,
  header: 'x-api-version',
});
```

### 1.2 版本类型

| 类型 | 装饰器 | 说明 |
|------|--------|------|
| 版本中立 | `VERSION_NEUTRAL` | 接受任何版本或无版本请求 |
| 指定版本 | `version: '1'` | 仅接受指定版本请求 |
| 多版本 | `version: ['1', '2']` | 接受多个版本请求 |

---

## 2. 使用示例

### 2.1 版本中立（基础设施接口）

```typescript
@Controller({
  version: VERSION_NEUTRAL,
})
export class HealthController {
  @Get('health')
  check() {
    return { status: 'ok' };
  }
}
```

### 2.2 指定版本（业务接口）

```typescript
@Controller({
  version: '1',
})
export class UserControllerV1 {
  @Get('users')
  list() {
    // V1 实现
  }
}

@Controller({
  version: '2',
})
export class UserControllerV2 {
  @Get('users')
  list() {
    // V2 实现（新增字段、改变结构等）
  }
}
```

---

## 3. 客户端调用

### 3.1 Web 端

```typescript
// 无需版本头（VERSION_NEUTRAL 接口）
fetch('/api/health');

// 需要版本头（版本化接口）
fetch('/api/users', {
  headers: {
    'x-api-version': '1',
  },
});
```

### 3.2 APP 端

```typescript
// 在 HTTP 客户端中统一设置版本头
const client = axios.create({
  headers: {
    'x-api-version': '2',
  },
});
```

---

## 4. 版本升级策略

### 4.1 向后兼容原则

1. **新增字段**：可选字段，不影响旧版本
2. **废弃字段**：标记为 deprecated，保留一段时间
3. **破坏性变更**：创建新版本

### 4.2 版本生命周期

```
V1 发布 → V2 发布 → V1 废弃通知 → V1 下线
   │         │           │            │
   └─────────┴───────────┴────────────┘
              支持期（建议 6 个月）
```

---

## 5. 废弃通知机制

### 5.1 后端标记废弃 API

使用 `@DeprecatedVersion` 装饰器标记即将废弃的 API：

```typescript
import { DeprecatedVersion } from '@/common/decorators/version';

@Controller({ version: '1' })
export class UserControllerV1 {
  @Get('profile')
  @DeprecatedVersion('请迁移到 V2 API', '2025-06-01')
  getProfile() {
    // V1 实现（即将废弃）
  }
}
```

### 5.2 响应头

当 API 被标记为废弃时，响应会包含以下 Header：

| Header | 说明 | 示例 |
|--------|------|------|
| `Deprecation` | 废弃标识 | `true` |
| `X-Deprecation-Message` | 废弃原因和迁移建议 | `请迁移到 V2 API` |
| `Sunset` | 下线日期 (ISO 8601) | `2025-06-01` |

### 5.3 前端处理

前端 API 客户端会自动检测废弃响应头，并显示警告通知：

- 使用 Toast 警告样式
- 显示废弃消息和下线日期
- 同一 API 路径每会话只提示一次
- 用户可关闭通知

### 5.4 废弃流程

```
1. 标记废弃 → 2. 前端显示警告 → 3. 到达下线日期 → 4. 移除 API
     │              │                    │              │
     └──────────────┴────────────────────┴──────────────┘
                    迁移期（建议 3-6 个月）
```

---

## 6. 最佳实践

- [ ] 基础设施接口使用 `VERSION_NEUTRAL`
- [ ] 业务接口明确指定版本号
- [ ] 破坏性变更创建新版本，而非修改现有版本
- [ ] 废弃版本前提前通知客户端
- [ ] 在 API 文档中标注版本信息

---

## 参考资源

- [NestJS 版本控制文档](https://docs.nestjs.com/techniques/versioning)
