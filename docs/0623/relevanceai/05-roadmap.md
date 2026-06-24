# 05 · 30/60/90 天产品路线图

## 路线图原则

1. 先产品抽象，后大规模工程扩展；
2. 先软件交付垂直闭环，后横向业务场景；
3. 先 eval 和治理，再放大自动化触发；
4. 明确 Codex CLI 与 Claude Code CLI 是底层执行 runtime，DofeAI 做上层编排、策略、审计和证据；
5. 复用现有 Loops 能力，不推倒重来；
6. 所有新增 API 遵守 Zod-first、ts-rest contract、DB Service layer、Client layer 和 Winston logger 规则。

## 0-30 天：把 Loops 产品化为 Delivery Workforce

### 目标

让用户不用理解 phase/shard，也能看懂 DofeAI 如何交付软件任务。

### 交付项

| 项                          | 内容                                                                                 | 验收                                                        |
| --------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| Workforce Overview v1       | Dashboard/Detail 展示 agent team 和当前 handoff                                      | 用户能看到当前由哪个 agent 负责、下一步交给谁               |
| Runtime Backend Registry v0 | 将 Codex/Claude CLI、local/Docker runtime、health、permission profile 统一成产品对象 | 用户能看到可用 backend 与权限边界                           |
| Invent Delivery Preview v1  | 新建页展示 workforce plan、runtime plan、tool plan、eval plan、human gates           | 创建前 preview 不只显示 issue，还显示交付计划和执行 backend |
| Blueprint 数据模型草案      | 文档 + contract draft，不一定落库                                                    | 5 个内置 blueprint 被定义                                   |
| Eval Suite 设计稿           | schema、checks、UI 草图、指标口径                                                    | 团队评审通过，可进入实现                                    |
| 文案清理                    | Loop/phase/shard 在用户层转为 Delivery Loop/stage/work package                       | Dashboard 主要区域减少内部术语                              |

### 建议文件范围

- `packages/contracts/src/schemas/loops.schema.ts`
- `packages/contracts/src/api/loops.contract.ts`
- `apps/web/app/loops/new/*`
- `apps/web/app/loops/page.tsx`
- `apps/web/app/loops/[issueId]/page.tsx`
- `apps/web/app/loops/loops-dashboard-model.ts`
- `apps/web/locales/*/loops.json`

## 31-60 天：Eval Suite + Trigger Contract v2

### 目标

让每次交付有可复用评测，让自动化入口可治理。

### 交付项

| 项                       | 内容                                                                                             | 验收                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| Eval Suite v1            | blueprint/workspace scope、scenario、checks、run result                                          | finalized Loop 必须关联 eval result       |
| Built-in Delivery Checks | coverage、tests、review、cost、architecture guard                                                | 至少 8 个内置 checks                      |
| Manual Trigger Object    | 兼容当前创建入口                                                                                 | 现有 issue source 迁移到 trigger run 展示 |
| Webhook Trigger v1       | 签名校验、payload mapping、evidence redaction、payload size guard、in-process rate guard、replay | 外部 POST 可创建 Loop，失败可重放         |
| Schedule Trigger v1      | cron/timezone、pause/resume                                                                      | 可定时创建健康检查或依赖巡检 Loop         |
| Trigger Audit            | trigger created/paused/fired/failed/replayed                                                     | Audit Explorer 或日志可追溯               |

### 风险控制

- Webhook 默认只允许创建低风险 blueprint；
- 触发器默认 paused，需要 owner 启用；
- 每个 trigger 有 rate limit 和 cost policy；
- eval 未通过不自动 finalize。

## 61-90 天：Blueprint Marketplace 产品化 + Tool Invocation Runtime + Enterprise Packaging

### 目标

让 DofeAI 从“能交付”变成“可复制、可治理、可销售”。

### 交付项

| 项                       | 内容                                                  | 验收                            |
| ------------------------ | ----------------------------------------------------- | ------------------------------- |
| Blueprint Marketplace v1 | 后端 CRUD/rollback 已有码；补 clone/configure/共享    | 新建页可从 blueprint 开始       |
| Tool Registry v2         | 后端 CRUD/health/test 已有码；补真实 tool invocation  | 用户能查看工具风险与可用性      |
| GitHub Trigger           | issue label/comment、PR check failed                  | GitHub 事件可进入 Delivery Loop |
| Slack Command beta       | 从 Slack 创建/查询 Loop                               | 内部团队可试用                  |
| Delivery Intelligence v1 | lead time、human wait、reloop rate、cost per delivery | 管理者能看交付趋势              |
| Governance Center alpha  | audit explorer、quota、runtime policy                 | 企业 demo 可展示                |

## 里程碑验收

### M1：产品抽象闭环

用户能完成：

1. 选择一个 blueprint；
2. 输入自然语言需求；
3. 查看 agent team、runtime backend、tool plan、eval plan；
4. 创建 Delivery Loop；
5. 在 detail 中看到当前 agent 和 handoff；
6. 在 dashboard 中看到交付状态和异常。

### M2：自动化和质量闭环

系统能完成：

1. Webhook/schedule 创建 Loop；
2. Loop 执行后产生 eval run；
3. eval 失败阻止 finalize；
4. audit 记录 trigger、agent、tool、review 事件；
5. dashboard 展示 trigger health 和 eval trend。

### M3：复用和企业闭环

团队能完成：

1. clone blueprint；
2. 配置 tools/triggers/evals；
3. 分配 owner 和权限；
4. 查看成本、配额、审计；
5. 导出或流式传输关键事件。

## 建议 Epic 拆分

### Epic A · Delivery Workforce Productization

- Workforce data model；
- Runtime backend model；
- Handoff graph；
- UI copy；
- new issue preview；
- detail agent timeline。

### Epic B · Eval Suite

- schemas/contracts；
- built-in checks；
- eval runner；
- eval result UI；
- trend metrics。

### Epic C · Trigger Platform

- trigger schema；
- manual migration；
- webhook；
- schedule；
- trigger audit；
- replay/retry。

### Epic D · Blueprint Marketplace

- blueprint schema；
- built-in blueprint catalog；
- clone/config UI；
- blueprint-scoped evals and triggers。

### Epic E · Tool & Integration Registry

- tool schema；
- permission policy；
- health checks；
- GitHub/Slack/Linear clients；
- MCP adapter exploration。

### Epic F · Enterprise Control Plane

- audit explorer；
- quota/concurrency；
- event streaming；
- asset permissions；
- data retention。

## 指标目标

| 时间  | 指标                  | 目标                                           |
| ----- | --------------------- | ---------------------------------------------- |
| 30 天 | 创建页 preview 完整度 | 100% 新 Loop 展示 workforce/tool/eval/gate     |
| 30 天 | 用户术语暴露          | 主路径减少 phase/shard 直出                    |
| 60 天 | Eval 覆盖             | 80% finalized Loop 有 eval result              |
| 60 天 | Trigger 可用性        | webhook + schedule 可用                        |
| 90 天 | Blueprint 复用        | 至少 8 个 blueprint 可 clone                   |
| 90 天 | 管理指标              | lead time、reloop rate、cost per delivery 可见 |

## 依赖与注意事项

- 触发器需要队列/worker 策略，不能只在 HTTP request 内同步执行；
- Webhook 和外部集成必须有签名校验和速率限制；
- Eval Runner 不应绕过现有成本保护；
- Tool Registry 不应允许无边界 shell/network 权限；
- 企业审计日志要避免记录 secrets 和敏感 payload；
- 若新增 DB 表，必须走 DB Service layer 和迁移计划。

## 2026-06-24 路线图回标

### 0-30 天范围

| 项                          | 状态       | 说明                                                                                                         |
| --------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------ |
| Workforce Overview v1       | 已实施 v1  | Dashboard/Detail 已有 workforce/persona/handoff；本轮新增 Delivery Flow Pipeline                             |
| Runtime Backend Registry v0 | 已实施 v1  | 已有 contract/API/service/dashboard；仍缺真实持久化 policy 和 remote runner                                  |
| Invent Delivery Preview v1  | 已实施 v1  | 新建页已展示 workforce/runtime/eval/risk-gate preview                                                        |
| Blueprint 数据模型草案      | 已部分实施 | 有 blueprint catalog 和 UI；缺 DB/clone/config                                                               |
| Eval Suite 设计稿           | 已部分实施 | 有 derived eval plan/checks，也有 EvalSuite/EvalRun contract/API/service v1；缺持久化、版本化、runner、trend |
| 文案清理                    | 已部分实施 | 仍可继续减少 phase/shard 暴露                                                                                |

### 31-60 天范围

仍应作为下一轮主线：

- Eval Suite v1：在当前 derived API v1 基础上补持久化 schema、runner、result UI、trend metrics；
- Trigger Contract v2：当前已有 signed webhook、schedule/manual fire、BullMQ scheduler、retry/replay/dead-letter；后续补 GitHub/Slack/Linear/CI 专用 worker、payload replay UX、distributed rate limit/cost policy 和外部告警；
- Built-in Delivery Checks：将当前 derived checks 固化为可版本化 check catalog。

### 61-90 天范围

仍应作为中期主线：

- Blueprint Marketplace clone/config、跨租户共享与审批队列；
- Tool invocation runtime、OAuth/secret connection；
- GitHub/Slack/Linear integrations；
- Governance Center alpha；
- OTEL event streaming。
