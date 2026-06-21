# 回归检查清单 & 文档标注规则

> 每轮实施后必跑。配合 [04-optimization-recommendations.md](04-optimization-recommendations.md) 与 [05-implementation-plan.md](05-implementation-plan.md)。

## 1. 批次级回归命令

### 批次 1（后端 P0）

```bash
# Loops 模块单测（最快反馈）
pnpm --filter @repo/api test -- loops 2>/dev/null \
  || (cd apps/api && pnpm exec jest --testPathPattern=loops)

# 或全量 API 测试
pnpm test:api
```

### 批次 2/4（后端架构 + 测试）

```bash
pnpm test:api
```

### 批次 3（前端）

```bash
pnpm --filter @repo/web test -- loops 2>/dev/null \
  || (cd apps/web && pnpm exec jest --testPathPattern=loops)
pnpm build:web
```

### 批次 5（重构）

```bash
pnpm type-check
pnpm lint
pnpm test
```

## 2. 全量回归（最终）

```bash
pnpm quality:gate   # 若脚本存在（含 lint + type-check + test + build）
# 或逐步：
pnpm lint
pnpm type-check
pnpm test
pnpm build
```

> 若 `quality:gate` 不存在，依次跑 lint/type-check/test/build，三者全绿即视为通过。

## 3. 重点回归矩阵（Loops 专项）

| 场景                 | 命令/文件                                    | 预期                 |
| -------------------- | -------------------------------------------- | -------------------- |
| Loops service 主链   | `loops.service.spec.ts`                      | 全绿，无 regression  |
| 持久化               | `loops-persistence.db.spec.ts`               | 全绿                 |
| work-lock            | `loops-work-lock.service.spec.ts`            | 全绿（含新并发用例） |
| PR provider          | `loops-pr-provider.client.spec.ts`           | 全绿（axios 迁移后） |
| 通知                 | `loops-notification-sender.service.spec.ts`  | 全绿（axios 迁移后） |
| 前端仪表盘           | `apps/web/app/loops/page.test.tsx`           | 全绿                 |
| 前端详情页           | `apps/web/app/loops/[issueId]/page.test.tsx` | 全绿                 |
| 前端 dashboard model | `loops-dashboard-model.test.ts`              | 全绿                 |
| 前端 new form        | `new/new-loop-issue-form.test.tsx`           | 全绿（含 Zod 用例）  |

## 4. 文档标注规则（强制）

每轮实施完成，**同一轮内**必须：

1. 在 [04-optimization-recommendations.md](04-optimization-recommendations.md) 把该批项的：
   - `状态`：`in-progress` → `done`（或 `accepted`/`blocked` 并说明）
   - `实施标注`：填实际改动文件 + commit hash（若提交）+ 偏差说明（若有）
2. 在 [README.md](README.md) 的「核心结论」或新增「实施轮次记录」追加一行：`round N：完成 R#…；回归 <命令> <结果>`。
3. 若发现新缺陷或新外部依赖，补到 [04] 对应行（新 R# 或新 B#），不得静默吞。

## 5. 失败处置

- 任一回归红：**不得标 done**。回滚或修复至全绿，再标注。
- 缺外部凭据/环境：标 `blocked`，记录解除条件，不伪装 `done`（沿用 `docs/0620` 口径）。
- 大重构（R14–R16）若中途发现风险超预期：标 `in-progress`，拆更小切片，记录暂停原因。

## 6. 与 `docs/0620` 回归集的关系

`docs/0620/04-regression-checklist.md` 固化了 `pnpm regression:docs0620`（含 Loops Jest、doctor、build）。本目录的回归是**其超集的 Loops 子集**：批次 1–5 完成后，最终一并跑 `pnpm regression:docs0620`（若存在）确认未回退既有基线。
