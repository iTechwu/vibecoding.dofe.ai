# 03 · 实施闭环记录

## 循环 1

### 输入

依据 [01-product-structure-review.md](01-product-structure-review.md) 和 [02-uiux-optimization-plan.md](02-uiux-optimization-plan.md)，优先处理 `/loops/new` 创建入口提交状态不可解释的问题。

### 计划

- 在 `SimpleLoopIssueForm` 中引入提交就绪状态；
- 增加中英文 i18n 文案；
- 更新组件测试，覆盖 blocked/ready/workspace 三类反馈；
- 再审查文档中是否仍存在本轮应实施项。

### 实施状态

状态：已实施。

代码落点：

- `apps/web/app/loops/new/simple-loop-issue-form.tsx`
  - 增加 request 剩余字数、workspace 阻塞、ready 三类提交状态；
  - 在提交按钮区域加入 `aria-live="polite"` 状态说明；
  - 保持原创建 payload、preview normalise、advanced overrides 逻辑不变。
- `apps/web/locales/en/loops.json`
  - 增加提交状态英文文案。
- `apps/web/locales/zh-CN/loops.json`
  - 增加提交状态中文文案。
- `apps/web/app/loops/new/simple-loop-issue-form.test.tsx`
  - 覆盖 request 不足、request 满足、workspace 缺失三类提交反馈。
- `apps/web/app/loops/loops-dashboard-model.ts`
  - 再审查发现 Loop Board 中异常态会被 Spec Review gate 掩盖；
  - 调整 `humanGate` 优先级，使 paused/cost guard/global fail 优先显示 `Exception`。
  - 回归检测发现 `buildExceptionCenter` 已成为测试契约；
  - 确认并纳入 exception center 模型：输出 owner、action、evidence、source 与 capacity。
- `apps/web/app/loops/page.tsx`
  - 接入 Exception Center 区块；
  - 修正 doctor fallback 与 i18n 参数类型，保证 type-check 通过。

### 验收

已通过：

```bash
pnpm --filter @repo/web exec vitest run app/loops/new/simple-loop-issue-form.test.tsx
pnpm --filter @repo/web exec vitest run app/loops/page.test.tsx app/loops/loops-dashboard-model.test.ts
```

结果：

- Simple intake：6 passed；
- Dashboard + model：9 passed。

## 再审查

本轮 P0 已闭合：

- `/loops/new` 的主提交按钮不再只有 disabled 状态；
- 用户能在提交区看到“还差多少字 / 缺 workspace / 已可创建”；
- 状态说明对辅助技术可感知；
- 创建 payload 与既有 API contract 没有变化；
- Loop Board 阻塞异常优先展示为 `Exception`，避免把异常误读为普通 Spec Review。
- Exception Center v1 已闭合，dashboard 异常项具备 reason、owner、action、evidence、source 和 capacity 汇总。

仍存在的内容均已标注为后续 Epic：

| 项目                      | 状态      | 不在本轮实施原因                                                             |
| ------------------------- | --------- | ---------------------------------------------------------------------------- |
| Dashboard exception UI    | 已实施 v1 | impact、retry action、evidence links、权限/测试失败/re-loop limit 后续结构化 |
| Spec diff review          | 后续 Epic | 需要 spec snapshot/diff 数据结构                                             |
| Round-aware evidence view | 后续 Epic | 需要 artifact round 元数据                                                   |
| Dashboard 新手引导        | 后续优化  | 不阻断当前创建与推进主路径                                                   |

结论：`docs/0623/uiux` 中不存在仍标记为“本轮实施”的未完成项。

## 回归检测记录

最终专项回归已通过：

```bash
pnpm --filter @repo/web exec vitest run app/loops/loops-dashboard-model.test.ts app/loops/page.test.tsx app/loops/new/simple-loop-issue-form.test.tsx 'app/loops/[issueId]/page.test.tsx'
pnpm --filter @repo/web type-check
```

结果：

- Test Files：4 passed；
- Tests：24 passed；
- Type check：passed。
