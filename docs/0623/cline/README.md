# Cline 竞品分析

项目：Cline  
GitHub：https://github.com/cline/cline  
定位：IDE、CLI、SDK、Kanban 多形态开源 coding agent  
检索日期：2026-06-23

## 一句话判断

Cline 是 DofeAI 最值得持续跟踪的产品型竞品。它已经从 VS Code agent 扩展到 CLI、headless、SDK、Kanban、多 agent、定时任务和外部消息平台连接。

## 产品画像

Cline README 展示了多个产品面：

- CLI：终端交互或 headless CI/CD；
- Kanban：多 agent 并行任务板，每张卡有独立 worktree、auto-commit、dependency chains；
- VS Code / JetBrains：IDE agent；
- SDK：构建自定义 agent 和集成；
- Plan / Act 模式；
- Rules / Skills；
- MCP / plugin；
- multi-agent teams；
- scheduled agents；
- Slack、Telegram、Discord、Google Chat、WhatsApp、Linear 连接。

## 与 DofeAI 的深度对比

| 维度     | Cline                   | DofeAI 当前           | 差距/机会                        |
| -------- | ----------------------- | --------------------- | -------------------------------- |
| 多端入口 | IDE/CLI/Kanban/SDK      | Web/API/CLI 脚本      | DofeAI 入口较少                  |
| 任务板   | Kanban + worktree       | Loops dashboard       | DofeAI 可引入 worktree 卡片模型  |
| 模式     | Plan/Act                | Spec Review/advance   | 心智相近                         |
| 多 agent | coordinator/specialists | Codex/Claude roles    | DofeAI 可显式 agent team         |
| 规则     | `.clinerules` / skills  | CLAUDE.md / AGENTS.md | DofeAI 可 workspace rules 产品化 |
| 集成     | messaging + Linear      | 待补                  | Cline 领先                       |
| 定时任务 | schedule create         | 待补                  | DofeAI 需 automation trigger     |

## 借鉴点

### 1. Kanban + 独立 worktree

Cline Kanban 的每张卡独立 worktree、auto-commit、dependency chains，与 DofeAI shard/loop 非常接近。

建议：

- Dashboard 增加 Loop Board 视图；
- 每个 issue 显示 branch/worktree；
- shard dependency graph 可视化；
- 并行执行明确受锁和依赖约束。

### 2. Plan/Act 与 DofeAI Spec/Advance 可以融合

Cline 的 Plan/Act 是强心智。DofeAI 可把 Spec Review 表达成 Plan gate，把 `advance` 表达成 Act engine。

建议文案：

- Plan：Review Spec；
- Act：Continue Loop；
- Evidence：Delivery proof。

### 3. Skills / Rules 产品化

Cline 的 rules/skills 说明用户需要把团队规范交给 agent。DofeAI 当前依赖仓库文档，但未产品化。

建议：

- workspace rules index；
- agent-readable rules health；
- rule conflict diagnostics；
- per-loop rule snapshot。

### 4. 外部连接是增长入口

Cline 连接 Slack/Linear/Discord 等。DofeAI 应优先做 GitHub + Slack + Linear。

## 对本项目的优化建议

| 优先级 | 建议                        | 验收                                                                              |
| ------ | --------------------------- | --------------------------------------------------------------------------------- |
| P0     | Loop Board 视图设计         | 已实施 v1：issue 卡片显示 human gate、mode、evidence、blocker、branch、PR 状态    |
| P1     | 独立 worktree/branch 可视化 | 部分实施：v1 展示派生 branch 与仓库上下文；真实 worktree/commit 仍为后续 Epic     |
| P1     | Workspace rules panel       | 已实施 v1：规则扫描、diagnostics、per-loop snapshot 与 agent-readable enforcement |
| P1     | Slack/Linear intake         | 外部消息可创建或评论 Loop                                                         |
| P2     | SDK/plugin boundary         | 第三方工具可注册 Loop capability                                                  |

## 实施标注

2026-06-23 已完成 Loop Board v1，回应 Cline Kanban / Plan-Act 心智：dashboard 现在能以任务板方式展示多个 Loop 的阶段、模式、人工关卡和交付信号。Exception Center v1 已把成本、暂停、全局审阅、runtime diagnostic 和 doctor problem 统一为可决策卡片。本轮新增 Workspace Rules Panel v1：`GET /loops/workspaces` 返回 `AGENTS.md`、`CLAUDE.md`、`.cursor/rules`、`.clinerules` 的存在状态、摘要、更新时间和 rule diagnostics，dashboard workspace switcher 展示规则健康度与可能的规则重叠/缺失。Repo Context Map v1 进一步展示仓库覆盖、阶段分布和阻塞仓库。Per-loop rule snapshot / agent-readable enforcement v1 已落地：创建 Loop 时固化规则快照，详情页 Intake 区展示 `snapshot-required` enforcement 状态与 agent-readable 证据。规则优先级配置、规则内容结构化解析、agent adapter 执行前硬阻断、真实 worktree/commit、Slack/Linear intake、SDK/plugin boundary 仍是后续 Epic。

## 结论

Cline 正在从“IDE agent”长成“agent platform”。DofeAI 的机会是比 Cline 更团队化、更证据化、更后端工作流化。
