# 04 · 实施路线图

## 已完成的关键改造

### P0 · 去除 shard 手动表单

状态：已落地。

改造内容：

- detail 页 shard 区域改为只读进度卡；
- 展示 implementation/test/review 证据计数；
- 展示最新测试、最新审阅和 acceptance snippets；
- 删除默认用户路径中的接管、记录实现、运行测试、记录审阅。

验收：

- 普通用户无法在 detail 页被引导手动填写 shard 证据；
- shard 状态仍可被审计；
- 页面能解释当前自动化步骤。

### P0 · 自动恢复中断 shard

状态：已落地。

改造内容：

- `runLoop` 找不到 runnable shard 时，自动恢复 `IN_PROGRESS` / `TIMEOUT`；
- 写恢复日志；
- 恢复后继续调度。

验收：

- 不再出现“人工接管后必须手填证据才能继续”的默认死胡同；
- 中断 shard 可通过调度器恢复为 `DONE`；
- service spec 覆盖恢复路径。

### P0 · 产品级推进接口

状态：已落地。

改造内容：

- 新增 `POST /loops/issues/:issueId/advance`；
- 后端统一判断下一步，并循环推进到下一人工关卡、异常决策点或终态；
- 前端主操作调用 `advance`；
- 保留细粒度端点作为兼容层。

验收：

- 无 Spec 时自动生成 Draft；
- Draft Spec 停住等待人工审阅；
- 批准后自动拆解、执行、全局审阅、finalize；
- service spec 覆盖 happy path。

### P0 · 页面主操作收敛

状态：已落地。

改造内容：

- 右侧操作区主按钮改为“继续推进 Loop”；
- 暂停/恢复保留为安全阀；
- Spec Draft、Global Review 非 PASS 等状态给出明确提示；
- 不再把 generate/decompose/run/global-review/finalize 并列暴露给普通用户。

验收：

- 页面首屏只有一个默认推进动作；
- 用户无需理解内部 phase 按钮；
- Spec 审阅仍然清晰可达。

### P0 · 细粒度端点终态幂等保护

状态：已落地。

改造内容：

- `decompose` 在已终态或已拆解时直接返回当前 detail；
- `runLoop` / `reviewGlobal` / `finalize` 在 CLOSED 后幂等返回；
- 保留 CLI、管理员和旧调用方兼容入口，但不允许它们把自动终态倒退回执行态。

验收：

- Spec approve 自动 finalize 后，再调用 granular endpoints 仍保持 CLOSED；
- service spec 覆盖兼容端点幂等路径。

## 下一阶段任务

### P1a · 同步自动推进到下一人工关卡

状态：已落地。

目标：用户批准 Spec 后，Loop Engine 在同一 API 调用中自动持续推进，不需要每个阶段都点击 `Continue Loop`。

已实现：

1. `reviewSpec(approve)` 写入 APPROVED 后调用 `advance`；
2. `advance` 循环执行 decompose / runLoop / reviewGlobal / finalize；
3. 遇到 Draft Spec、非 PASS global verdict、暂停或终态时停止；
4. 设置最大推进步数保护，避免异常状态无限循环。

验收：

- 批准 Spec 后无需再次点击，系统能自动完成到下一人工关卡或终态；
- 中断 shard 可被自动恢复并继续；
- 旧细粒度端点不会破坏 CLOSED 终态。

### P1b · 队列化后台 worker

状态：后续 Epic，不阻断当前闭环。

目标：把同步自动推进迁移为后台队列 worker，避免长任务占用 HTTP 请求，并支持进程重启恢复。

建议实现：

1. 新增 loop scheduler queue；
2. issue state 变化后入队；
3. worker 调用 `advance`；
4. 遇到 human gate / exception 停止并通知；
5. UI 通过 polling / SSE 展示实时进度。

验收：

- worker 重启后可从 `.loops` 恢复；
- 同一 issue/repo 有锁，避免并发写冲突；
- 所有 worker 动作有日志。

### P1 · 异常决策中心

状态：后续 Epic，不阻断当前闭环。

目标：把异常从散落的日志/提示变成用户可处理的 action card。

异常类型：

- runtime unavailable；
- workspace not mountable；
- cost guard tripped；
- context budget exceeded；
- max shard redo reached；
- max re-loop reached；
- regression failed；
- permission / auth required。

每个异常卡必须包含：

- 原因；
- 影响；
- 推荐动作；
- 责任人；
- 重试入口；
- 相关证据链接。

验收：

- 每个 blocking 状态都有可读 action card；
- 用户不需要读原始日志才能恢复；
- 管理员异常和产品审阅异常分开展示。

### P1 · Round-aware evidence view

状态：后续 Epic，不阻断当前闭环。

目标：re-loop 后默认聚焦当前 round，旧轮证据归档可查但不污染判断。

建议实现：

- evidence filters：current round / all rounds；
- artifact group 显示 round；
- global review 与 convergence record 标明所属 round；
- requirements coverage 按当前 round 计算，另给历史趋势。

验收：

- re-loop 后页面不会把旧轮 DONE 误当当前完成；
- 用户能查看历史，但默认看到当前待决事项。

### P1 · Spec diff review

状态：后续 Epic，不阻断当前闭环。

目标：让人工审阅从“读整篇 Spec”升级为“看变化和风险”。

建议实现：

- 新 Draft Spec 与上一版 diff；
- 自动摘要变更点；
- 标记新增/删除 acceptance criteria；
- 标记高风险文件或模块；
- 批准按钮旁展示风险确认。

验收：

- 二轮及以后审阅时间下降；
- 用户能清楚知道为什么要重新批准；
- 批准记录包含 spec version 和 reviewer。

### P2 · Natural-language control

状态：后续 Epic，不阻断当前闭环。

目标：支持用户用自然语言操作 Loop。

示例：

- “继续推进这个 issue”
- “暂停，等我确认登录方案”
- “要求修改 Spec：不要改 OAuth，只改回调页”
- “解释为什么停住了”
- “给我看本轮失败测试”

建议实现：

- intent parser 将自然语言映射到 `advance` / reviewSpec / intervene / query evidence；
- 高风险操作仍显示确认；
- 所有自然语言操作写 audit log。

验收：

- 常见 10 个操作意图可识别；
- 误识别时不执行破坏性动作；
- 用户能从聊天式入口完成 happy path。

## 设计验收清单

### 普通用户

- 只需一句需求即可创建 issue；
- 只在 Spec 审阅时必须操作；
- 页面能解释当前进度；
- 失败时知道下一步；
- 不需要理解 shard 表单。

### 工程负责人

- 能看到 shard 进度；
- 能看到每个 shard 的实现、测试、审阅证据；
- 能看到 trace timeline；
- 能查看当前 round 与历史 round；
- 能确认 finalize 前证据完整。

### 平台管理员

- 能诊断 runtime/workspace/docker；
- 能恢复中断；
- 能查看成本与熔断；
- 能处理权限和环境问题；
- 能审计所有状态变更。

## 质量门禁

每次继续重构 Loop Engineering，都应至少跑：

```bash
pnpm --filter @repo/web exec eslint 'app/loops/[issueId]/page.tsx' 'app/loops/[issueId]/use-loop-operations.ts' 'app/loops/[issueId]/page.test.tsx'
pnpm --filter @repo/web exec vitest run 'app/loops/[issueId]/page.test.tsx'
pnpm --filter @repo/web exec tsc --noEmit
pnpm --filter @repo/api exec jest src/modules/loops/loops.service.spec.ts --runInBand
pnpm --filter @repo/api exec tsc -p tsconfig.type-check.json --noEmit
```

新增后台 worker 后，还需要增加：

- queue worker integration tests；
- issue/repo lock tests；
- resume after worker crash tests；
- SSE / polling UI tests；
- exception action card tests。

## 不做事项

近期不要做：

- 把 shard 手动表单重新放回普通用户页面；
- 为每个内部 phase 增加一个用户按钮；
- 让用户手动补 `.loops` 证据；
- 把 runtime secret、CLI 路径、Docker 命令暴露给普通用户；
- 在前端复制完整后端状态机。

## 本轮闭环审查结果（2026-06-22）

| 项目                         | 结论                                                             |
| ---------------------------- | ---------------------------------------------------------------- |
| P0 shard 手动表单移除        | 已实施，detail 页 shard 仅展示自动化进度和证据                   |
| P0 中断 shard 自动恢复       | 已实施，`runLoop` 可恢复 `IN_PROGRESS` / `TIMEOUT`               |
| P0 产品级推进接口            | 已实施，`advance` 循环推进到下一人工关卡、异常决策点或终态       |
| P0 页面主操作收敛            | 已实施，普通用户路径只保留 `Continue Loop` + pause/resume 安全阀 |
| P0 细粒度端点终态幂等        | 已实施，CLOSED 后 granular endpoints 不会倒退状态                |
| P1a 同步自动推进             | 已实施，`reviewSpec(approve)` 自动唤醒引擎并推进                 |
| P1b 队列化后台 worker        | 后续 Epic，不阻断当前闭环                                        |
| P1 异常决策中心              | 后续 Epic，不阻断当前闭环                                        |
| P1 Round-aware evidence view | 后续 Epic，不阻断当前闭环                                        |
| P1 Spec diff review          | 后续 Epic，不阻断当前闭环                                        |
| P2 Natural-language control  | 后续 Epic，不阻断当前闭环                                        |
