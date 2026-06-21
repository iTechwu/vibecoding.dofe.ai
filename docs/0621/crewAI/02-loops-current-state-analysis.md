# Loops 现状剖析（本项目）

> 范围：`apps/api/src/modules/loops/`（后端 ~6.85k LoC）+ `packages/contracts/src/{schemas,api}/loops.*`（契约）+ `apps/web/app/loops/*` + `apps/web/lib/api/contracts/hooks/loops.ts`（前端）。引用 `file:line` 均有证据。
>
> 与 `docs/0620` 的差异：本文件以**竞品对标视角**重审架构、规则一致性与确凿缺陷，输出可执行改进项（→ [04](04-optimization-recommendations.md)）。

## 1. 领域模型 & 状态机

### 1.1 生命周期（issue → spec → shards → records → 收敛）

状态枚举（`packages/contracts/src/schemas/loops.schema.ts`）：

- **Issue status**（`:4-12`）：`INTAKE | NEEDS-CLARIFICATION | OPEN | IN_LOOP | CLOSED | ARCHIVED | REJECTED`。
- **Phase**（`:24-36`）：`PHASE_0_INTAKE … PHASE_8_ANNOTATE` + `CLOSED`/`PAUSED`，**9-Phase 线性流水线**。
- **Shard status**（`:40-49`）：`TODO | IN_PROGRESS | IMPLEMENTED | DONE | NEEDS-WORK | FAILED | BLOCKED | TIMEOUT`。

### 1.2 已实现的转移

`LoopsService`（`apps/api/src/modules/loops/loops.service.ts`，**2160 行 god object**）：

- `createIssue:146-188` → `OPEN` + `phase=PHASE_1_SPEC`，`specVersion='v0'`。
- `generateSpec:241-273` → `PHASE_2_REVIEW`，`costCalls+1`，受 cost guard 约束。
- `reviewSpec:275-317` → approve=`PHASE_3_DECOMPOSE`；reject=`CLOSED`；revision=`PHASE_1_SPEC`。
- `decompose:319-348` → `PHASE_4_IMPLEMENT`，置 `shardsTotal`。
- `runLoop:350-426` → 调度；全 `DONE` → `PHASE_6_CONVERGE`；上下文预算违例 → `BLOCKED`（`blockShardForContextBudget:1628-1683`）。
- `reviewShard:1319-1454` → PASS 置 `DONE`，按 verdict 置 `NEEDS-WORK`/`FAILED` + `max_shard_redo` 升级（`:1344-1354`）。
- `reviewGlobal:428-552` → 证据不全/回归失败 → `NEEDS-WORK` + `PHASE_4_IMPLEMENT`；pass → `PHASE_8_ANNOTATE`；非 PASS → `autoReloopAfterGlobalReview:598-691`（`PHASE_1_SPEC`，round+1）或 `PAUSED`（`maxReloop`）。
- `finalize:712-757` → `CLOSED` + `finalized=true`。

### 1.3 状态机缺口

- **`LoopPhaseSchema` 仅信息性，非强制**。无中央转移表/守卫（如 XState）。转移合法性散落在 20 个方法的 `if` 里。`reviewSpec` 对 `CLOSED` issue 直接放行。
- **Phase 漂移**：`runLoopUnlocked:414-424` 在全 shard `DONE` 时升 `CONVERGE`，但 `reviewShard:1400-1406` 也设 `CONVERGE` —— 两个真源可竞态（见 §9.2）。
- **`autoReloopAfterGlobalReview` 写两套冲突状态**：`writeGlobalReview`（`phase=PHASE_1_SPEC`，`:668-678`）后立即 `writeSpec`（`phase=PHASE_2_REVIEW`，`:679`），后写者赢（`writeSpec→upsertState`），全局评审写部分冗余 —— 脆弱。
- **`PAUSED` 过载**：既表"人工暂停"又表"cost guard 暂停"又表"reloop 上限暂停"；`resume()` 无法区分，恢复 cost 触发的 loop 只去暂停不清 cost 计数（`resumeInterruptedLoops:321-370`）。

## 2. 执行流（端到端）

### 2.1 HTTP → controller → service → adapters

`LoopsController`（`loops.controller.ts:18-335`）薄 ts-rest 门面：每个方法 `@TsRestHandler` + `tsRestHandler` 委托 `LoopsService`，再写 `AuditLog`（`:285-334`）。**单一审计咽喉，良好。**

编排器 `LoopsService`（2160 行）直接调 adapters（`agentAdapter`/`claudeAdapter`/`gitAdapter`）、file store、（可选）DB 持久化。

### 2.2 run loop（`runLoopUnlocked:358-426`）

```
readDetail → while advanced<maxParallel:
   find runnable shard(TODO|NEEDS-WORK, deps DONE) →
     if estContext>=budget → BLOCKED + log + notify;
     else runRunnableShard:
        mark IN_PROGRESS → claudeAdapter.run → persistImplementationRecord →
        runShardTests → agentAdapter.reviewTests → agentAdapter.review →
        reviewShard(verdict) [PASS 时也 commitShard]
```

- **同步、单进程**。每个"step"经 `execFile` 内联跑 Claude Code/Codex（`loops-runner.service.ts:91`、`loops-process.util.ts:59`）。单次 `runLoop` HTTP 请求阻塞整个 shard 实现（最长 `shardTimeoutSec=900s` × 重试）—— **controller 早已超时**。
- **`maxParallel` 误导**（`runtime-config:49` 默认 1）。环在一个 HTTP 请求内**顺序**跑 shard，不派发 worker 队列；即便设 `maxParallel>1` 也只是顺序循环 N 次（`runLoopUnlocked:371`）。

### 2.3 并发 & work-lock

`LoopsWorkLockService`（`loops-work-lock.service.ts`，35 行）：**内存 `Set<string>`**（`:5`）。**非分布式** —— 两个 API 实例各自持集 → 跨 pod 对同一 issue 的并发 `runLoop` 自由竞态。能力注册表自承 `worker-concurrency` 为 `planned`（`loops.service.ts:1052-1067`）。**重入直接抛 `ConflictException` 而非排队** —— 同 issue 第二次 `runLoop` 直接 500。

### 2.4 Shards & commits

`commitShard`（`cli-loops-git.adapter.ts:33-64`）：`git checkout -B loops/<issue-id>` + `git add` + `git commit`。**分支按 issue 而非按 shard**，commit 堆叠在一个分支（对收敛 PR 可接受，但单个 `git add` 失败会污染所有后续 shard 的分支）。

## 3. 适配器设计

三接口（agent/claude/git）+ Symbol DI token，`loops.module.ts:41-66` 按 `LOOPS_AGENT_MODE` 装配：

- `LOOPS_AGENT_MODE==='cli'` → `CliLoopsAgentAdapter` + `CliLoopsClaudeAdapter`；否则 deterministic。Git adapter 恒为 `CliLoopsGitAdapter`，受 `LOOPS_GIT_COMMIT_PER_SHARD` 门控。

### 3.1 Deterministic adapters（默认）

`DeterministicLoopsAgentAdapter`（`deterministic-loops-agent.adapter.ts`，413 行）：模板化 Spec（`renderSpec:251-256`）、两个硬编码 MVP shard（`createMvpShards:258-312`）、派生测试矩阵、启发式 `review`（`:87-118`，检查实现摘要是否**包含**每个验收标准前 12 字符）—— **可被绕过且易误判真实实现**的字符串包含评审器。

### 3.2 CLI adapters

`CliLoopsAgentAdapter`（`cli-loops-agent.adapter.ts`）：`codex exec --json`（`:157`），`extractJson`（`loops-process.util.ts:106-124`，找首个 `{`/`[` 与最后匹配 `}`/`]`，嵌套尾括号会失败）启发式提取，Zod 校验，**任何失败回退 deterministic**（`:64,75,103,115`）。仅 `plan/decompose/review/reviewGlobal` 真调 codex；`designTests/reviewTests/annotateFinalize` **恒为 deterministic**（`:78-92,118-129`）—— 即便 CLI 模式，"大脑"一半仍是模板。

`CliLoopsClaudeAdapter`（`cli-loops-claude.adapter.ts`）：`claude -p ... --output-format json --add-dir <root> --permission-mode acceptEdits`（`:43-55`）。**`--permission-mode acceptEdits` 授予仓库内自主写文件** —— 重要安全面；配合 `resolveAllowedTargetRepo` 限定到白名单根，但白名单内任何目录 Claude 无逐文件确认即可写。

### 3.3 可扩展性结论

- 接口干净、DI 可换 —— 好。
- **无流式**：`execFile` `maxBuffer`（8MB，`loops-process.util.ts:28`）整体捕获；超 8MB 的长跑全部丢输出。
- **Token 记账是启发式**：`tokens: output.tokens ?? Math.round(result.stdout.length/4)`（`cli-loops-claude.adapter.ts:103`）—— Claude 不报 token 时退化为"字符/4"。cost guard（`enforceCostGuard`）用这些猜测触发上限。
- **无结构化输出强约束**：依赖 `extractJson` 正则刮取而非 `--output-format json` schema 绑定。

## 4. 持久化 & 存储

### 4.1 双写：`.loops/` 文件（真源）+ DB（索引）

`.loops/` 权威；DB 可选索引（`LoopsService:97-99` 注入 persistence `@Optional()`）。

- `LoopsFileStoreService`（`loops-file-store.service.ts`，**1131 行第二 god object**）为每个实体写 JSON + Markdown + YAML 三镜像（`writeIssue:372-409`、`writeShards:440-489` 等）。
- **跨文件无事务**。每个写是一串独立 `fs.writeFile`（`writeShards` 单独 ~8 次写 `:451-488`）。中途崩溃留不一致工作区（如 `shards.json` 更新但 `state.json` 未更新）。`doctor()`（`persistence:121-168`）检测**但不修复**漂移。
- **状态为单一 `state.json`** 持所有 loop 数组（`upsertState:756-765`）。每次状态变更**整文件覆写** —— O(N)/写，且**丢更新竞态**：两个并发 `runLoop`（不同 issue）都 `readState → 各改各的条目 → writeJson`，后写者覆盖先写者（`upsertState:757-764` 无读改写原子性）。

### 4.2 日志：append-only JSONL（`appendLog:748-754`）—— 好。`readLogs:150-165` 每次读全文件并内存排序 —— 过几千条不扩展。

### 4.3 DB 层（`LoopsDbService`，生成）

`apps/api/generated/db/modules/loops/loops-db.service.ts` —— extends `TransactionalServiceBase`，读写分离正确，`createIssue` 事务化（`$transaction` 建 issue+intake+state）。**符合 Rule 1**（DB-only Prisma）。schema：`loop_issue`/`loop_issue_intake`/`loop_state`（`schema.prisma:82-157`），`onDelete: Cascade`。

### 4.4 Work-lock 语义

仅内存（§2.3）。非 Redis、非 DB 行锁。**最大生产化缺口。**

## 5. RBAC & 通知

### 5.1 RBAC

`loops-rbac.decorator.ts`（13 行）：`READ|CREATE|OPERATE|ADMIN` → `RequireModulePermission('vibecoding','loops',<perm>)`，由 `PermissionGuard` 强制（SSO client 错误时 fail-closed）。controller 按方法装配。**干净正确。** 注：工作树中 `loops-rbac.guard.ts` + 其 spec 已删除（换共享 guard）—— 净中性但 loops 专属 spec 覆盖丢失。

### 5.2 通知

`LoopsNotificationSender`（`loops-notification-sender.service.ts`，49 行）：设 `LOOPS_ALERT_WEBHOOK_URL`/`LOOPS_FEISHU_WEBHOOK_URL` 则 `fetch` POST，否则 `SKIPPED`。**用全局 `fetch` 而非 `@nestjs/axios` `HttpService`** —— **违反 Rule 3**（见 §8）。`fetch` 失败吞掉（`.catch(()=>undefined)` `:30`）→ `FAILED` 状态，无重试、无死信。通知在发送确认前先落文件（`writeNotification:720-746`）—— 可接受。

## 6. 前端（摘要）

- **`page.tsx`（仪表盘，657 行）**：7 个 useQuery（`:94-100`），客户端 fallback 模型 `loops-dashboard-model.ts`。**无 `refetchInterval`**，`staleTime:0`（`loops.ts:38-56`）—— 最差缓存。无错误态（collapse isLoading/isError）。5+ 处不安全 `as` 强转（`:106-109`）。
- **`[issueId]/page.tsx`（1124 行）**：极端 god 组件；~14 模块助手 + 800 行 return。**在驱动活体 agent loop 的页面无轮询**（`useLoopIssue` `loops.ts:70-77`）—— "Run Step" 后 UI 直到 HTTP 往返返回才更新，后台进度永不浮现。无乐观更新。shard 表单缺 `<label>`（a11y）。
- **`use-loop-operations.ts`**：11 个 ts-rest mutation hook → 表单处理器。硬编码 `reviewer:'codex'`/`'human'`（`:128,54,76`）。`as Verdict`/`as Severity` 强转。无 `onError`。
- **`new/new-loop-issue-form.tsx`**：**不用契约 Zod schema 校验**（Rule 2 客户端违规）；仅 HTML `required`。失败通用错误。模板 apply 静默销毁用户编辑。
- **`loops.ts`（hooks）**：`loopsKeys` factory 好；`useInvalidateIssue` 每个 shard 变更失效 5 个缓存 → 忙仪表盘惊群；`useCreateLoopIssue` 不失效任何缓存（`:99-101`）—— 创建后 list 缓存陈旧。

## 7. 测试覆盖

**5 个 spec 文件；CI 14 测试通过（~2.2s）。** 隔离良好（临时工作区、env save/restore、runner/git 的 hermetic fake、mock `fetch`）。

**覆盖良好**：SSO submitter 防伪造（`loops.service.spec.ts:134`）、主 deterministic 生命周期冒烟（`:254-340`）、仪表盘纯函数、work-lock 同步语义、PR provider happy + 2 否认路径、通知 sender。

**高风险未测**：

1. cost guard 触发 + resume（`enforceCostGuard`）。
2. reloop 上限（`reloop` 抛错、`autoReloopAfterGlobalReview` 暂停路径）。
3. 上下文预算 shard 阻塞。
4. **CLI adapter 模式**（`LOOPS_AGENT_MODE=cli`）—— `cli-loops-{agent,claude}.adapter.ts` 零 spec。
5. finalize 真实 git/PR 流（`LoopsPrProviderClient` 从未经 `finalize` 跑通）。
6. `reviewGlobal` 证据不全 + 回归失败分支。
7. Loops RBAC 权限串到 guard。
8. `LoopsDbService`（仅 `LOOPS_DB_SMOKE=1` 门控套件覆盖）。
9. **并发**：work-lock 测试是同步/嵌套，从无 `Promise.all` 竞态；多实例未测。

**质量注**：主链冒烟对"No runnable shard"用裸 `catch{}` 容忍（`loops.service.spec.ts:309-311`）—— 暴力 N+1 迭代，掩盖收敛语义。

## 8. 架构规则一致性（vs CLAUDE.md）

| 规则                                                 | 状态    | 证据                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------ | ------------------------------------------------------------------------------- |
| **Rule 1**（DB-only Prisma）                         | ✅ 合规 | `LoopsDbService` extends `TransactionalServiceBase`；`LoopsPersistenceService` 仅用 Prisma 类型                                                                                                                                                                                                                                    |
| **Rule 2**（Zod-first）                              | ⚠️ 部分 | 后端契约 Zod；CLI adapter 输出已校验。但 `LoopsFileStoreService` 读 JSON 无 schema 再校验（`readJson` 无类型 cast）；`extractJson` 正则刮取。**前端 `new-loop-issue-form.tsx` 无客户端 Zod 校验**                                                                                                                                  |
| **Rule 3**（外部调用仅 Client 层 + `@nestjs/axios`） | ❌ 违规 | `LoopsNotificationSender` 用全局 `fetch`（`loops-notification-sender.service.ts:14`）；`LoopsPrProviderClient` 用全局 `fetch`（`loops-pr-provider.client.ts:68`）；`LoopsRunnerService` `execFile`（`:8,91`）；`loops-process.util.ts:59` spawn `codex`/`claude`/`git`。均不用 `@nestjs/axios`，均不在 `libs/clients/`，活在模块层 |
| **Winston 日志**                                     | ⚠️ 部分 | `LoopsController` + `CliLoops*Adapter` 注入 `WINSTON_MODULE_PROVIDER`。但 `LoopsService`/`LoopsFileStoreService`/`LoopsRunnerService`/`LoopsPersistenceService` **完全无日志** —— 静默失败                                                                                                                                         |
| **4-layer 架构**                                     | ⚠️ 模糊 | Controller → Service → (Adapter                                                                                                                                                                                                                                                                                                    | FileStore | Runner | Persistence)。无独立 Client 层 —— git/PR/notify/codex/claude 全是模块内 adapter |

## 9. 代码异味 & 风险

### 9.1 God objects

- `loops.service.ts` **2160 行**，30+ 方法混编排/调度/指标/能力注册表（300+ 行静态数据 `:839-1133`）/需求覆盖文本匹配（`:2036-2159`）。应拆为 `LoopsOrchestrator`/`LoopsScheduler`/`LoopsMetricsService`/`LoopsCapabilityRegistry`/`LoopsCoverageService`。
- `loops-file-store.service.ts` **1131 行**，30 个写方法各重复 JSON+MD+YAML+log+notify 模式。
- `[issueId]/page.tsx` **1124 行**单组件。

### 9.2 确凿缺陷 / 正确性风险

- **finalize 重复 `commitShard`**：`reviewShard` 在 PASS 时提交（`loops.service.ts:1437-1451`）**且** `finalize` 遍历所有 shard 再调 `commitShard`（`:719-728`）。第二次仅在无变更时 no-op，否则重复/分叉提交。
- **`runLoop` 收敛判据用陈旧 `detail`**：`runLoopUnlocked:414` 用环外初始快照 `detail.shards.every(DONE)` 而非环内更新的 `currentDetail` —— 可误升或漏升。
- **`upsertState` 丢更新**（§4.1）—— 并发 issue 腐蚀 `state.json`。
- **`createIssueId` 用 `Math.random()`**（`:1600-1603`）—— 非密码学，6 字符后缀 → 规模化碰撞。
- **`enforceCostGuard` 仅在 ~6 个成本路径的 2 个强制**：`generateSpec:271`、`decompose:337`、`persistImplementationRecord:1477`；**未在** `reviewShard`/`runShardTests`/`reviewGlobal`(回归)/`reloop` —— 成本记账不全，上限可被绕过。
- **`runShardTests` round 过滤错配**：`readDetail` 按 `state.round` 过滤（`file-store:112-120`），`runGlobalRegression` 写 `__global__` 记录 `round=state.round`（`:1551-1561`）—— 同 round 的 shard 测试记录碰撞（不同 ID，`collectGlobalEvidenceIssues:1517-1519` 按 `shardId===shard.id && round` 过滤偶然没问题，但脆弱）。
- **`blockShardForContextBudget` 永久置 shard `BLOCKED`**，无回 `TODO` 路径（除手动 `intervene`/re-decompose）—— 单个超预算 shard 死锁整个 loop。

### 9.3 错误处理 & 可观测

- Service 方法抛 `BadRequestException`/`NotFoundException` 但**从不记日志**；file-store 静默 `catch(()=>[])` 缺目录（`readAllIssues:773`）—— 损坏工作区与空工作区不可区分。
- 无 tracing/span（能力注册表自承 `complete-span-trace` 为 `planned` `:1068-1083`）。
- 无 Prometheus/OTel 指标；`cost()`/`metrics()` 是唯一可观测且同步读文件。
- `runProcess` 在非零退出重试（`loops-process.util.ts:39-47`）**且** CLI adapter 也重试（`cli-loops-agent.adapter.ts:136-153`）→ 有效重试 = `maxRetry × (1+runProcess.retries)`，失败时延迟复合。

### 9.4 安全

- **`--permission-mode acceptEdits`**（`cli-loops-claude.adapter.ts:51`）—— 白名单根内自主写。
- **`execFile('/bin/sh', ['-lc', command])`**（`loops-runner.service.ts:91`）—— shell 调用白名单测试命令。`isAllowedCommand`（`:69-75`）基于前缀（`=== prefix || startsWith(prefix+' ')`）—— `pnpm test; rm -rf /` 被挡（无 `;` 前缀），但 `pnpm test$(curl ...)` 过前缀检查；**无 shell 元字符拒绝**。
- **`resolveAllowedTargetRepo`**（`loops-path-policy.util.ts`）`LOOPS_ALLOWED_REPO_ROOTS` 未设时默认到工作区根（`:21-27`）—— 配错时进程可见的任意目录 Claude 可写。
- **PR provider token**（`LOOPS_PR_TOKEN`）以 `Authorization: Bearer` 发往 `LOOPS_PR_API_BASE_URL` —— 无 URL scheme 校验（可能 `http://`）。

### 9.5 重复

- `CliLoopsAgentAdapter` 与 `DeterministicLoopsAgentAdapter` 均实现 `initialAnnotations`/`createInitialAnnotations`，body 几乎相同（`cli-loops-agent.adapter.ts:233-276` vs `deterministic-loops-agent.adapter.ts:314-358`）。
- `envNonNegativeInteger`/`envPositiveNumber` 在两个 CLI adapter 重复。
- `maxRetry()`/`shardTimeoutMs()` 重复。
- Markdown/YAML 渲染助手在 15 个 file-store 方法重复。

## 10. 与 crewAI 级产品的差距

详见 [03-gap-analysis.md](03-gap-analysis.md)。一句话：Loops 是一条线性流水线 + 单 Codex 大脑 + 单 Claude 双手 + 内存锁 + 文件真源 + 整体捕获；crewAI 是可分支 Flow + 多 agent + 统一记忆 + 检查点重放 + 流式 + provider 无关结构化输出。

## 11. 关键文件索引

- 后端：`loops.service.ts`、`loops-file-store.service.ts`、`loops-persistence.service.ts`、`loops-runner.service.ts`、`loops-work-lock.service.ts`、`loops-runtime-config.util.ts`、`loops-path-policy.util.ts`、`loops-notification-sender.service.ts`、`loops-rbac.decorator.ts`、`loops.controller.ts`、`loops.module.ts`、`adapters/*`
- 契约：`packages/contracts/src/schemas/loops.schema.ts`、`packages/contracts/src/api/loops.contract.ts`
- DB：`apps/api/prisma/schema.prisma:82-157`、`apps/api/generated/db/modules/loops/loops-db.service.ts`
- 前端：`apps/web/app/loops/page.tsx`、`loops-dashboard-model.ts`、`[issueId]/page.tsx`、`[issueId]/use-loop-operations.ts`、`new/{page,new-loop-issue-form,loop-issue-templates}.tsx`、`apps/web/lib/api/contracts/hooks/loops.ts`
