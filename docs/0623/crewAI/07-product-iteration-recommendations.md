# CrewAI 深度对比审查 · DofeAI 产品迭代建议

日期：2026-06-23（基于 ../crewAI 最新仓库 v1.14.7 + AMP Suite 深度审查）
审查者视角：产品经理
底层运行时边界：Codex CLI + Claude Code CLI

## 1. crewAI 最新能力画像

基于 `../crewAI` 仓库（v1.14.7，MIT license，54K+ stars）的深度审查：

| 维度            | crewAI 当前                                                                                                       | 判断                 |
| --------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------- |
| 开源框架        | Agent/Task/Crew/Flow/Memory/Knowledge/Guardrail/MCP/A2A                                                           | 成熟、扩展性强       |
| 企业平台 (AMP)  | Tracing、ACP、Automations、RBAC、Tool Repository、Triggers、Studio                                                | 完整的企业 SaaS 飞轮 |
| Skills 生态     | Claude Code 官方 skills plugin（4 个 skill：getting-started/design-agent/coding-agent/deployment-and-monitoring） | 开发者体验闭环       |
| 企业 API        | Crew execution lifecycle（required-inputs → start → status → resume with human feedback）、webhook streaming      | 异步执行 + 人机协作  |
| Flow-first 架构 | DSL（@start/@listen/@router/or*/and*）、持久化状态、恢复、HITL                                                    | 生产级事件驱动编排   |
| 工具生态        | crewai-tools（文件/搜索/RAG/DB/Automation/Browser/Cloud）、MCP、A2A                                               | 工具品类丰富         |
| 开发者教育      | learn.crewai.com（100K+ 认证开发者）、社区课程                                                                    | 高认知度和生态锁入   |

## 2. DofeAI 对比差异矩阵

| 维度             | crewAI v1.14.7                       | DofeAI 当前（R6）                                  | 差距      | 优先级 |
| ---------------- | ------------------------------------ | -------------------------------------------------- | --------- | ------ |
| Skills 生态      | Claude Code 官方 skills plugin       | 无 Codex/Claude 官方 Loops skills                  | 🔴 高     | P0     |
| 企业 API/Webhook | Crew execution lifecycle API         | Trigger portfolio（仅前端展示，无 webhook 接收端） | 🟡 中     | P1     |
| Flow 产品化      | Flow DSL + @start/@listen/@router    | Loop state machine（工程化但未产品化命名）         | 🟡 中     | P1     |
| MCP/工具生态     | MCP server + crewai-tools + A2A      | Tool registry（前端展示），无 MCP 集成             | 🟡 中     | P1     |
| 开发者教育       | learn.crewai.com（100K+）            | 无                                                 | 🟢 可延后 | P2     |
| 人机协作 (HITL)  | Resume with human feedback API       | Review Inbox + Human Gates（Dashboard）            | 🟢 低     | P2     |
| Studio/低代码    | Crew Studio（AMP Suite）             | `/loops/new`（text-based，较工程化）               | 🟢 可延后 | P2     |
| 多租户/RBAC      | Enterprise RBAC + entity permissions | Workspace RBAC decorator（单 workspace 级）        | 🟡 中     | P1     |

## 3. P0 迭代建议

### P0-1 · DofeAI Loops Skills for Codex/Claude Code

**问题诊断：**

crewAI 已有官方 Claude Code skills plugin（4 个 skill），让 coding agents 自动遵循 crewAI 最佳实践。DofeAI 的 Codex CLI / Claude Code CLI 是底层运行时，但这些 agents 不清楚 DofeAI 的架构规则和交付协议。没有官方 skills 的话，agent 每次都需要从 CLAUDE.md 重新理解规则。

**建议实现：**

创建 `dofeai-loops-skills` 包（或作为 `.claude/skills/` 下的文件），包含以下 skills：

| Skill                | 触发条件                | 作用                                                                                 |
| -------------------- | ----------------------- | ------------------------------------------------------------------------------------ |
| `loops-architecture` | agent 修改代码          | 告知 agent 架构规则：DB Service 层、Zod-first contract、Client layer、Winston Logger |
| `loops-delivery`     | agent 被分配实现任务    | 告知 agent 交付协议：spec → shard → implement → test → review → evidence             |
| `loops-review`       | agent 被分配审查任务    | 告知 agent 审查规则：架构合规、路径策略、测试覆盖、PR evidence                       |
| `loops-security`     | agent 运行测试/执行命令 | 告知 agent 运行时安全策略：shell allowlist、network deny、write scope                |

落点：

- `.claude/skills/dofeai/loops-architecture.md`
- `.claude/skills/dofeai/loops-delivery.md`
- `.claude/skills/dofeai/loops-review.md`
- `.claude/skills/dofeai/loops-security.md`

验收标准：

- agent 在实现阶段自动遵循 DB Service 层架构
- agent 在审查阶段自动检查 contract 合规性
- agent 在执行命令前自动检查 shell allowlist

### P0-2 · Webhook/API Trigger 接收端

**问题诊断：**

crewAI 的企业 API 提供了完整的外部系统触发和异步执行状态追踪。DofeAI 当前只有 Trigger Portfolio（前端展示），没有真正的 webhook 接收端点来接收来自 GitHub/Linear/Slack 的外部事件并创建 Loop。

**建议实现：**

新增 `POST /loops/triggers/webhook` 端点：

```typescript
// packages/contracts/src/schemas/loops.schema.ts
const LoopWebhookTriggerSchema = z.object({
  source: z.enum(['github', 'linear', 'jira', 'slack', 'generic']),
  event: z.string(),
  payload: z.record(z.unknown()),
  signature: z.string().optional(),
  signatureHeader: z.string().optional(),
});

// Controller: POST /loops/triggers/webhook
// Service: validateSignature → mapEventToIssue → createIssue → returnLoopId
```

落点：

- `packages/contracts/src/schemas/loops.schema.ts`
- `packages/contracts/src/api/loops.contract.ts`
- `apps/api/src/modules/loops/loops.service.ts`
- `apps/api/src/modules/loops/loops.controller.ts`
- `apps/web/lib/api/contracts/hooks/loops.ts`

验收标准：

- GitHub issue label 变更可创建 Loop
- 签名验证（HMAC-SHA256）防止伪造
- webhook 触发记录写入 audit log
- webhook 触发与 Loop 可双向追溯

## 4. P1 迭代建议

### P1-1 · Delivery Flow 产品化

**问题诊断：**

crewAI 的 Flow-first 架构让用户理解"这是一个事件驱动的自动化流程"。DofeAI 的 Loop state machine 功能更强（11 个 phase、stateful orchestration、review gates），但对外表述仍是 "phase/shard/reloop" 而非 "delivery flow"。

**建议实现：**

将现有 Workflow Recipe 面板升级为 Delivery Flow 可视化：

- Show flow diagram（intake → spec → review → decompose → implement → test → review → converge → global review → annotate → close）
- 标注每个步骤的 runtime owner（Codex/Claude/Human）
- 标注 human gates（暂停点）和 automated gates（质量门禁）
- 在 Dashboard 顶部展示 "Active Delivery Flow" 概览

落点：

- `apps/web/app/loops/loops-dashboard-model.ts`（`buildDeliveryFlow()`）
- `apps/web/app/loops/page.tsx`（Dashboard 顶部新增 Delivery Flow 可视化）

### P1-2 · MCP Server 集成

**问题诊断：**

crewAI 支持 MCP servers 作为工具来源。DofeAI 的 tool registry 当前仅为前端展示，未与 MCP 协议集成。将 tool registry 与 MCP 集成可让 DofeAI 的工具生态从 "内置 N 个工具" 变为 "可扩展的 tool ecosystem"。

**建议实现：**

- 在 Tool Registry 面板中新增 MCP 兼容性标识
- 展示哪些 tools 支持 MCP 协议
- 添加 MCP server 配置管理（list/connect/disconnect/test）

### P1-3 · 多租户 Workspace 权限增强

**问题诊断：**

crewAI 的 RBAC 支持 feature permissions + entity permissions 两层。DofeAI 当前只有 `RequireLoopsPermission` decorator（READ/CREATE/OPERATE/ADMIN），缺少资产级（per-asset）权限。

**建议实现：**

参考 models.dofe.ai 的多租户模型：

- Workspace 级权限：admin/member/viewer
- Blueprint 级权限：哪些 workspace 可用哪些 blueprint
- 与 SSO 超级管理员系统集成

## 5. 不需要做的

- ❌ 不做 Python agent framework（crewAI 已有成熟方案）
- ❌ 不做通用 business automation（定位于软件交付）
- ❌ 不做 Slash command 系统（用 recipe/gate 表达流程）
- ❌ 不做 Developer certification 平台（成本高，非核心技术差异化）
- ❌ 不追求 100K+ 开发者社区（聚焦团队级付费转化）

## 6. 推荐实施路线

| 阶段          | 时间   | 优先事项                                  |
| ------------- | ------ | ----------------------------------------- |
| **本轮 (R7)** | 即刻   | P0-1 Loops Skills + P0-2 Webhook Trigger  |
| 后续          | 2 周内 | P1-1 Delivery Flow 产品化 + P1-2 MCP 集成 |
| 后续          | 4 周内 | P1-3 多租户权限 + Workspace admin         |

## 7. 产品定位更新

基于 crewAI 最新审查，DofeAI 的产品定位应更新为：

> DofeAI 是面向软件团队的 AI Delivery Control Plane，基于 Codex CLI 与 Claude Code CLI 双运行时。它把每次 agent 交付变成可追踪、可验证、可发布、可学习的 Loop——并用官方 Loops Skills 让 coding agents 天生理解 DofeAI 的架构规则和交付协议。
