# 下一步执行 Checkpoints

## 每批固定循环

每个 Step 执行时继续使用：

1. 实施
2. 标注文档
3. 审查待实施项
4. 再标注文档

每批至少更新：

- `docs/0626/struct-opz-nextstep/EXECUTION-PLAN.md` 的状态备注或新增执行记录。
- `docs/0626/struct-opz/EXECUTION.md` 顶部总览。
- 必要时更新 `docs/0626/struct-opz/IMPLEMENTATION-ANNOTATIONS.md` 历史标注。

## 验证门禁

每批最小验证：

```bash
rg "from ['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)|require\\(['\\\"].*(apps/api/src/modules/loops|src/modules/loops|\\.\\./\\.\\./\\.\\./src/modules/loops)" apps/api/libs/domain/services
pnpm --filter @repo/api type-check
```

按领域追加 focused tests：

| 领域             | 建议测试                                                                                      |
| ---------------- | --------------------------------------------------------------------------------------------- |
| Archive          | `loops-admin.service.spec.ts`                                                                 |
| Trigger fire     | `loops-triggers.service.spec.ts` + trigger processor focused spec                             |
| Remote execution | `loops-remote-runners.service.spec.ts` + remote runner CLI/e2e focused subset                 |
| Eval worker IO   | `loops-eval.service.spec.ts` + aggregation worker spec                                        |
| Integrations     | `loops-integrations` PR/MCP/notification/CI focused specs                                     |
| Engine           | `loops-engine.service.spec.ts` + `loops.service.spec.ts --runInBand`                          |
| Step 10 收敛     | `pnpm check:architecture` + `pnpm --filter @repo/api type-check` + widest focused loops suite |

## 状态标记

| 标记 | 含义                                               |
| ---- | -------------------------------------------------- |
| ✅   | 已完成并通过 type-check / focused tests / 结构扫描 |
| 🚧   | 部分完成，仍有明确待办                             |
| ⏳   | 尚未开始                                           |
| ⚠️   | 存在依赖阻塞或需先做 port 设计                     |

## 完成定义

某一步可标记为 ✅ 的条件：

- 对应业务实现已从 legacy `LoopsService` 下沉到目标 domain service。
- API facade 只保留兼容 wrapper，或 wrapper 已在 Step 10 删除。
- domain service 不 import API loops。
- focused tests 覆盖主要成功/失败路径。
- `pnpm --filter @repo/api type-check` 通过。
- 文档中“剩余待实施项”同步更新。

## 暂停条件

遇到以下情况应暂停实施并先补 port 设计：

- 需要 domain service 注入 legacy `LoopsService`。
- 需要使用 `forwardRef` 才能让 module graph 通过。
- 需要复制 controller permission/audit 逻辑到 domain。
- 需要改变 ts-rest contract 才能完成迁移。
- 需要 raw `prisma.read` / `prisma.write` 绕过 DB service 层。
