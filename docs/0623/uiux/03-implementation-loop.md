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
  - 在 preview 中展示推荐 Agent 路径与建议测试策略；
  - 保持原创建 payload、preview normalise、advanced overrides 逻辑不变。
- `apps/web/app/loops/new/loop-issue-templates.ts`
  - 为每个 simple template 绑定 agent path 与 test policy i18n key。
- `apps/web/locales/en/loops.json`
  - 增加提交状态英文文案。
- `apps/web/locales/zh-CN/loops.json`
  - 增加提交状态中文文案。
- `apps/web/app/loops/new/simple-loop-issue-form.test.tsx`
  - 覆盖 request 不足、request 满足、workspace 缺失三类提交反馈；
  - 覆盖异步 workspace query 返回 current workspace 时，预览与提交 payload 使用同一 workspace。
- `apps/web/app/loops/loops-dashboard-model.ts`
  - 再审查发现 Loop Board 中异常态会被 Spec Review gate 掩盖；
  - 调整 `humanGate` 优先级，使 paused/cost guard/global fail 优先显示 `Exception`。
  - 回归检测发现 `buildExceptionCenter` 已成为测试契约；
  - 确认并纳入 exception center 模型：输出 owner、action、evidence、source 与 capacity。
  - 纳入 `buildDashboardGuide`、`buildPerformanceSnapshot`、`buildPermissionProfile`，让 Dashboard 同时覆盖引导、健康评估和权限画像。
- `apps/web/app/loops/page.tsx`
  - 接入 Exception Center 区块；
  - 接入 Delivery Guide、Performance Snapshot、Permission Profile 区块；
  - 修正 doctor fallback 与 i18n 参数类型，保证 type-check 通过。

### 验收

已通过：

```bash
pnpm --filter @repo/web exec vitest run app/loops/new/simple-loop-issue-form.test.tsx
pnpm --filter @repo/web exec vitest run app/loops/page.test.tsx app/loops/loops-dashboard-model.test.ts
```

结果：

- Simple intake：8 passed；
- Dashboard + model：9 passed。

## 再审查

本轮 P0 已闭合：

- `/loops/new` 的主提交按钮不再只有 disabled 状态；
- 用户能在提交区看到“还差多少字 / 缺 workspace / 已可创建”；
- 用户能在创建前看到推荐 Agent 路径与建议测试策略；
- 状态说明对辅助技术可感知；
- 创建 payload 与既有 API contract 没有变化；
- current workspace 在预览目标仓库和提交 payload 中保持一致；
- Loop Board 阻塞异常优先展示为 `Exception`，避免把异常误读为普通 Spec Review。
- Exception Center v1 已闭合，dashboard 异常项具备 reason、owner、action、evidence、source 和 capacity 汇总。
- Dashboard Delivery Guide v1 已闭合，首次进入可按创建、审阅、异常、证据四步理解 dashboard。
- Performance Snapshot v1 已闭合，dashboard 可扫描通过率、返工率、成本和 trace 事件。
- Permission Profile v1 已闭合，dashboard 可扫描 agent/tool 的 read、write、shell、network、approval 状态。
- Provider Profile v1 已闭合，dashboard 可扫描 provider、runtime mode、active agents 和 planned tool routes。

循环 1 后仍存在的内容已按当时状态标注；其中 Spec diff review 已在循环 4 重新审查并实施：

| 项目                      | 状态      | 不在本轮实施原因                                                                   |
| ------------------------- | --------- | ---------------------------------------------------------------------------------- |
| Dashboard exception UI    | 已实施 v2 | 已补齐 impact、retry action、evidence link；权限/测试失败/re-loop limit 后续结构化 |
| Dashboard performance     | 已实施 v1 | 后续可加入时间窗口、趋势变化和目标阈值                                             |
| Dashboard permission      | 已实施 v1 | 后续可加入环境级权限、审批策略和运行时限制                                         |
| Dashboard provider        | 已实施 v1 | model/cost profile、provider 凭证健康和企业预设分发后续结构化                      |
| Spec diff review          | 已实施 v1 | 循环 4 基于已有 spec snapshot 落地轻量 diff 摘要                                   |
| Round-aware evidence view | 已实施 v2 | Artifact Workspace 已按 artifact round 默认过滤；coverage trend 后续增强           |
| Dashboard 新手引导        | 已实施 v1 | 后续可根据真实用户行为继续优化文案和个性化排序                                     |

结论：`docs/0623/uiux` 中不存在仍标记为“本轮实施”的未完成项。

## 循环 2

### 输入

再次审查 [01-product-structure-review.md](01-product-structure-review.md) 后发现：Detail 页“单 issue 异常卡片”不依赖新的后端 contract，可先用现有 `detail.state` 与 runtime 匹配结果落地 v1。

### 计划

- 在 `LoopIssueDetailPage` 中推导 issue-level exception；
- 在详情页行动侧栏顶部展示 reason、owner、recommended action、evidence；
- 增加中英文 i18n 文案；
- 更新 Detail 页组件测试；
- 再审查文档中是否仍存在可前端实施的未完成项。

### 实施状态

状态：已实施。

代码落点：

- `apps/web/app/loops/[issueId]/page.tsx`
  - 新增 `buildIssueExceptions`；
  - 暂停态、global verdict、P0 priority 可推导为 issue-level exception；
  - 在侧栏行动区上方展示 `Issue Exception` 卡片；
  - 每个异常显示 reason、owner、recommended action、phase/round evidence、runtime evidence。
- `apps/web/locales/en/loops.json`
  - 增加 Detail exception 英文文案。
- `apps/web/locales/zh-CN/loops.json`
  - 增加 Detail exception 中文文案。
- `apps/web/app/loops/[issueId]/page.test.tsx`
  - 覆盖 paused issue 的单 issue 异常卡片。

### 验收

已通过：

```bash
pnpm --filter @repo/web exec vitest run 'app/loops/[issueId]/page.test.tsx'
```

结果：

- Detail page：9 passed。

### 再审查

- Detail 页已具备与 Dashboard Exception Center 对齐的单 issue 异常入口；
- 用户进入异常 issue 后，不再需要从 header badge、next action、run diagnostics 多处拼接阻塞原因；
- 当前 v1 不新增 contract 字段；impact、retry action、evidence link 已在循环 5 的 Dashboard Exception Center v2 中补齐。

## 循环 3

### 输入

再次审查 [01-product-structure-review.md](01-product-structure-review.md) 与 Detail 页代码后发现：当时 artifact workspace 还缺少 round 元数据，但 implementation、review、test、global review 记录已有 `round` 字段，可以先完成 current-round evidence v1。artifact round 元数据已在循环 5 补齐。

### 计划

- Detail 页 Records 区默认只展示当前 round 的 implementation/review/test/global review；
- 在 Records 区提示当前展示轮次与隐藏的历史证据数量；
- artifact workspace 保持全量展示，避免在没有 artifact round 的情况下误过滤；
- 更新 Detail 页组件测试与 UIUX 文档标注。

### 实施状态

状态：已实施。

代码落点：

- `apps/web/app/loops/[issueId]/page.tsx`
  - 新增 `filterCurrentRound`；
  - Records 区使用 current round 的 implementation/review/test/global review；
  - 增加历史记录隐藏数量提示。
- `apps/web/locales/en/loops.json`
  - 增加 current round evidence 英文提示。
- `apps/web/locales/zh-CN/loops.json`
  - 增加 current round evidence 中文提示。
- `apps/web/app/loops/[issueId]/page.test.tsx`
  - 覆盖旧轮次记录不会默认展示，并显示隐藏历史数量。

### 验收

已通过：

```bash
pnpm --filter @repo/web exec vitest run 'app/loops/[issueId]/page.test.tsx'
```

结果：

- Detail page：10 passed。

### 再审查

- current round evidence v1 已闭合；
- Artifact Workspace 已在后续循环补齐 artifact round 元数据并默认过滤到当前轮；
- `docs/0623/uiux` 中仅剩 Spec diff review 需要重新判断是否可基于已有 spec snapshot 落地。

## 循环 4

### 输入

再次审查 [01-product-structure-review.md](01-product-structure-review.md)、[02-uiux-optimization-plan.md](02-uiux-optimization-plan.md) 与后端 `.loops/specs` 存储后发现：`writeSpec` 已保存 `spec.{version}.json` 与 `spec.{version}.md`，Spec diff review 可以先以 v1 摘要形式落地，不必等待全新的存储机制。

### 计划

- contract 增加可选 `specHistory`；
- 后端 detail 读取 `.loops/specs/{issueId}/spec.*.json` 历史 snapshot；
- Detail 页在 Spec Review 中展示当前版相对上一版的新增、删除、不变摘要；
- 更新中英文 i18n、contract/backend/frontend 测试；
- 再次审查文档，确认是否仍有需本轮实施项。

### 实施状态

状态：已实施。

代码落点：

- `packages/contracts/src/schemas/loops.schema.ts`
  - 新增 `LoopSpecHistoryItemSchema`；
  - `LoopDetailSchema` 增加可选 `specHistory`。
- `apps/api/src/modules/loops/loops-file-store.service.ts`
  - 新增 `readSpecHistory`；
  - `readDetail` 返回已排序的 spec history；
  - 继续复用既有 `.loops/specs/{issueId}/spec.{version}.json`，不改变写入流程。
- `apps/web/app/loops/[issueId]/page.tsx`
  - 新增 `buildSpecDiffReview`；
  - Spec Review 区展示 `Spec Diff`、版本范围、added/removed/unchanged 计数和最多 3 条示例行。
- `apps/web/locales/en/loops.json`
  - 增加 Spec Diff 英文文案。
- `apps/web/locales/zh-CN/loops.json`
  - 增加 Spec Diff 中文文案。
- `packages/contracts/src/__tests__/schemas.test.ts`
  - 覆盖 `specHistory` schema。
- `apps/api/src/modules/loops/loops.service.spec.ts`
  - 覆盖 revision 后 detail 返回 `v1 -> v2` spec history。
- `apps/web/app/loops/[issueId]/page.test.tsx`
  - 覆盖 Spec Diff 摘要与新增/移除示例行。

### 验收

已通过：

```bash
pnpm --filter @repo/contracts test -- --runTestsByPath src/__tests__/schemas.test.ts
pnpm --filter @repo/web exec vitest run 'app/loops/[issueId]/page.test.tsx'
pnpm --filter @repo/api test -- --runTestsByPath src/modules/loops/loops.service.spec.ts --testNamePattern 'regenerates a DRAFT spec'
```

结果：

- Contracts schemas：11 passed；
- Detail page：11 passed；
- API targeted smoke：20 passed。

### 再审查

- Spec diff review v1 已闭合；
- 用户在 re-loop 或 spec revision 后不再只能重读完整 spec，可先查看相邻版本差异摘要；
- 后续仍可增强为 acceptance criteria 级结构化 diff、审批绑定 spec version、完整上下文展开，但这些不再阻塞当前 UIUX 闭环。

## 循环 5

### 输入

用户要求处理脏文件并解决后续 Epic。再次审查后发现：Round-aware evidence view 的 artifact workspace 过滤、Exception Center 的 impact/retry/evidence link 字段，都可以基于现有数据继续闭合。

### 计划

- `LoopEvidenceArtifact` 增加可选 `round` 元数据；
- 后端 evidence artifacts 为 implementation/test/review/global review 写入 round；
- Detail 页 Artifact Workspace 默认过滤到当前 round，并显示隐藏历史 artifact 数；
- Dashboard Exception Center 补齐 impact、retry action、evidence link；
- 更新测试与文档，保留真正的大型 Epic。

### 实施状态

状态：已实施。

代码落点：

- `packages/contracts/src/schemas/loops.schema.ts`
  - `LoopEvidenceArtifactSchema` 增加可选 `round`。
- `apps/api/src/modules/loops/loops.service.ts`
  - implementation/test/review/global review artifacts 写入 round。
- `apps/web/app/loops/[issueId]/page.tsx`
  - 新增 current-round artifact 过滤；
  - Artifact Workspace 显示当前轮工件提示与隐藏历史工件数量。
- `apps/web/app/loops/loops-dashboard-model.ts`
  - `ExceptionCenterItem` 增加 impact、retryAction、evidenceHref；
  - cost、pause、global review、runtime、doctor 异常均补齐恢复语义。
- `apps/web/app/loops/page.tsx`
  - Exception Center 卡片展示 impact 与 retry action。
- `apps/web/locales/{en,zh-CN}/loops.json`
  - 增加 artifact round 与 exception v2 文案。
- 测试：
  - contract schema 覆盖 artifact round；
  - API smoke 覆盖 evidence artifacts round；
  - Detail 页测试覆盖旧轮 artifact 默认隐藏；
  - Dashboard model/page 测试覆盖 impact 与 retry action。

### 验收

已通过：

```bash
pnpm --filter @repo/contracts test -- --runTestsByPath src/__tests__/schemas.test.ts
pnpm --filter @repo/api test -- --runTestsByPath src/modules/loops/loops.service.spec.ts --testNamePattern 'runs createIssue'
pnpm --filter @repo/web exec vitest run 'app/loops/[issueId]/page.test.tsx'
pnpm --filter @repo/web exec vitest run app/loops/loops-dashboard-model.test.ts
pnpm --filter @repo/web exec vitest run app/loops/page.test.tsx
```

结果：

- Contracts schemas：11 passed；
- API targeted smoke：20 passed；
- Detail page：11 passed；
- Dashboard model：15 passed；
- Dashboard page：2 passed。

### 再审查

- Round-aware evidence view 不再缺 artifact round 元数据；
- Artifact Workspace 默认不再混入旧轮执行工件；
- Exception Center 已具备 reason、owner、action、impact、retry action、evidence/evidence link、source；
- 当时剩余的大型 Epic：队列化后台 worker、外部 GitHub/Linear/Slack 深集成、自然语言控制，以及更细的后端异常分类/测试失败/re-loop limit contract；其中自然语言控制已在循环 7 关闭 deterministic endpoint v1。

## 循环 6

### 输入

继续处理 0622 文档中仍标注为后续 Epic 的 `LoopMetricsActionItem` user-facing category。该项可以通过兼容性 contract 字段闭合，不需要引入 worker 或外部系统。

### 计划

- `LoopMetricsActionItem` 增加可选 `nextActionCategory`；
- 后端 metrics action queue 返回 continue/decision/exception/done 分类；
- 前端 Review Inbox 优先使用 `nextActionCategory`，旧数据 fallback 到 internal action code；
- 更新 contracts/api/web 测试与 0622 文档状态。

### 实施状态

状态：已实施。

代码落点：

- `packages/contracts/src/schemas/loops.schema.ts`
  - `LoopMetricsActionItemSchema` 增加可选 `nextActionCategory`。
- `apps/api/src/modules/loops/loops.service.ts`
  - `resolveNextAction` 返回用户语义分类；
  - metrics action queue 输出 `nextActionCategory`。
- `apps/web/app/loops/loops-dashboard-model.ts`
  - Review Inbox 优先按 `nextActionCategory === decision` 判断人工决策项；
  - 保留旧 action code fallback。
- 测试：
  - contract schema 覆盖 `nextActionCategory`；
  - API metrics 测试覆盖 action queue category；
  - Dashboard model 测试覆盖 category 优先于 internal action code。

### 验收

已通过：

```bash
pnpm --filter @repo/contracts test -- --runTestsByPath src/__tests__/schemas.test.ts
pnpm --filter @repo/api test -- --runTestsByPath src/modules/loops/loops.service.spec.ts --testNamePattern 'returns control-plane metrics'
pnpm --filter @repo/web exec vitest run app/loops/loops-dashboard-model.test.ts
```

结果：

- Contracts schemas：11 passed；
- API targeted metrics：21 passed；
- Dashboard model：16 passed。

### 再审查

- `LoopMetricsActionItem` category 不再是后续 Epic；
- 前端默认路径不再必须理解内部 action code；
- 当时剩余的大型 Epic：队列化后台 worker、外部 GitHub/Linear/Slack 深集成、自然语言控制，以及更细的后端异常分类/测试失败/re-loop limit contract；其中自然语言控制已在循环 7 关闭 deterministic endpoint v1。

## 循环 7

### 输入

继续处理 0622 文档中仍标注为后续 Epic 的 Natural-language control。再次审查后确认：完整聊天式控制台和 LLM intent parser 仍属后续增强，但安全的 deterministic command endpoint 可以先闭合 v1。

### 计划

- 在 contracts 中增加 natural command request/response schema 与 endpoint；
- 后端 service 用确定性 parser 映射常见命令；
- controller 复用 Loops 操作权限并写 audit；
- 未识别命令不执行破坏性动作；
- 更新 contract/backend 测试与 0622 文档状态。

### 实施状态

状态：已实施。

代码落点：

- `packages/contracts/src/schemas/loops.schema.ts`
  - 新增 `LoopNaturalCommandIntentSchema`、`LoopNaturalCommandRequestSchema`、`LoopNaturalCommandResponseSchema`；
  - 支持 `continue`、`pause`、`resume`、`approve-spec`、`request-revision`、`query-evidence`、`unknown`。
- `packages/contracts/src/api/loops.contract.ts`
  - 新增 `POST /loops/issues/:issueId/natural-command`。
- `apps/api/src/modules/loops/loops.service.ts`
  - 新增 `naturalCommand`；
  - deterministic parser 将自然语言映射到 `advance` / `intervene` / `reviewSpec` / evidence logs；
  - 所有命令写 `NATURAL_COMMAND` log；
  - unknown command 默认 `executed: false`。
- `apps/api/src/modules/loops/loops.controller.ts`
  - 新增 ts-rest handler；
  - 复用 `LOOPS_PERMISSION.OPERATE`；
  - audit 记录 intent 与 executed。
- 测试：
  - contract schema 覆盖 deterministic natural command response；
  - API service 覆盖 evidence query、unknown fallback 与 continue happy path。

### 验收

已通过：

```bash
pnpm --filter @repo/contracts test -- --runTestsByPath src/__tests__/schemas.test.ts
pnpm --filter @repo/api test -- --runTestsByPath src/modules/loops/loops.service.spec.ts --testNamePattern 'natural-language commands'
pnpm --filter @repo/contracts typecheck
pnpm --filter @repo/api type-check
```

结果：

- Contracts schemas：12 passed；
- API targeted natural command：22 passed；
- Contracts/API type-check：passed。

### 再审查

- Natural-language control 已闭合为 deterministic endpoint v1；
- 误识别命令不会执行破坏性动作；
- 自然语言操作已有 log 与 controller audit；
- 前端命令栏、LLM intent parser、置信度解释、危险操作二次确认，以及更丰富的证据问答仍为后续增强，不再阻断当前闭环。

## 最终再审查

- `docs/0622/uiux` 目录不存在；本轮按当前仓库实际存在且已持续维护的 `docs/0623/uiux` 执行。
- `docs/0623/uiux` 中原本标记为 P0/P1 且可实施的 UIUX 项已全部进入“已实施”或“已实施 v1”。
- 剩余内容均为后续增强，不属于当前文档循环中必须继续实施的未完成项：
  - Dashboard performance：时间窗口、趋势变化、目标阈值；
  - Dashboard permission：环境级权限、审批策略、真实运行时限制；
  - Spec diff：acceptance criteria 级结构化 diff 与审批版本绑定；
  - Exception Center：测试失败、re-loop limit、权限异常等更细后端分类；
  - 队列化后台 worker、SSE live stream、外部 GitHub/Linear/Slack 触发；
  - 自然语言控制的前端命令栏、LLM intent parser 与危险操作确认 UI。

## 回归检测记录

最终专项回归已通过：

```bash
pnpm --filter @repo/contracts test -- --runTestsByPath src/__tests__/schemas.test.ts
pnpm --filter @repo/api test -- --runTestsByPath src/modules/loops/loops.service.spec.ts
pnpm --filter @repo/api test -- --runTestsByPath src/modules/loops/loops-workspace-profile.service.spec.ts
pnpm --filter @repo/web exec vitest run app/loops/page.test.tsx app/loops/loops-dashboard-model.test.ts app/loops/new/simple-loop-issue-form.test.tsx 'app/loops/[issueId]/page.test.tsx'
pnpm --filter @repo/contracts typecheck
pnpm --filter @repo/web type-check
pnpm --filter @repo/api type-check
```

结果：

- Contracts schemas：12 passed；
- API loops service：22 passed；
- API workspace profile：4 passed；
- Web Test Files：4 passed；
- Web Tests：37 passed；
- Contracts/Web/API type-check：passed。

备注：本轮重新一次性执行 4 个 web 专项文件已通过。
