# @repo/utils

> Migration note (2026-06-26): this package is now a legacy local package for
> vibecoding-specific behavior that is not yet covered by `@dofe/infra-*`. New
> shared utilities should prefer direct imports from published infra packages,
> for example `@dofe/infra-web-runtime/cn`, `@dofe/infra-contracts`, and
> browser-safe `@dofe/infra-utils/*` subpaths. Do not add new cross-project
> helpers here.

## 保留用途

`@repo/utils` 目前只作为 vibecoding 本地兼容包保留。新增或迁移代码不要把通用工具继续放进本包；优先直接消费已发布 infra 包。

```typescript
// Legacy local package only. Prefer @dofe/infra-* for shared helpers.
import { getHeaders } from '@repo/utils/headers';
```

## 通用工具迁移

| 历史本地能力                                                  | 新代码优先来源                                             |
| ------------------------------------------------------------- | ---------------------------------------------------------- |
| `cn`                                                          | `@dofe/infra-web-runtime/cn`                               |
| 标准 header/version 常量                                      | `@dofe/infra-contracts`                                    |
| browser-safe mask                                             | `@dofe/infra-utils/mask.util`                              |
| array/json/object/string/timer/urlencode/validate 等通用 util | `@dofe/infra-utils/<name>.util`                            |
| fetch helper                                                  | 优先评估 `@dofe/infra-web-runtime/fetch` 或项目 API client |
| encrypt/file helper                                           | 需先确认签名、存储或上传行为等价；未验证前保留项目本地实现 |

不要在本包内建立 re-export wrapper。旧 `moduleResolution: "node"` 无法稳定解析 infra package 子路径 `exports`；消费代码应直接 import from `@dofe/infra-*`。

## 构建

```bash
pnpm --filter @repo/utils build
```
