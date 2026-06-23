# OpenHands 竞品分析

项目：OpenHands / Agent Canvas  
GitHub：https://github.com/All-Hands-AI/OpenHands  
定位：自托管 coding agents 与 automations 控制中心  
检索日期：2026-06-23

## 一句话判断

OpenHands 是 DofeAI 在“agent control plane / self-host / backend abstraction”上的最强参照。

## 产品画像

OpenHands README 将 Agent Canvas 定位为 self-hosted developer control center，可以运行 OpenHands、Claude Code、Codex、Gemini 或 ACP-compatible agent，并支持 local、Docker、VM、cloud backend。它还强调 automations、Slack/GitHub/Linear/Notion 集成，以及 agent server / automation server 架构。

## 与 DofeAI 的深度对比

| 维度         | OpenHands                    | DofeAI 当前                        | 差距/机会                       |
| ------------ | ---------------------------- | ---------------------------------- | ------------------------------- |
| 产品中心     | Agent Canvas 控制台          | Loops Control Plane                | 方向一致                        |
| 后端抽象     | Agent Server + multi backend | local CLI / Docker fallback        | DofeAI 需要 remote backend 抽象 |
| 自动化       | schedule / webhook events    | Loops 手动/同步推进                | DofeAI 需要 worker + trigger    |
| 第三方 agent | ACP-compatible               | Codex / Claude adapter             | 可设计 ACP adapter 层           |
| 集成         | Slack/GitHub/Linear/Notion   | 现阶段偏 Web/API                   | 入口集成是明显短板              |
| 沙箱         | Docker / VM / direct warning | Docker fallback + workspace policy | DofeAI 已有基础，可产品化权限   |

## 借鉴点

### 1. Agent backend 是产品能力

OpenHands 把 local、Docker、VM、cloud 都做成 backend。DofeAI 当前 runtime diagnostics 已经开始做这件事，但还没有让 backend 成为可切换的一等对象。

建议：

- `LoopRuntimeBackend`：local-cli、docker、remote-agent-server、cloud；
- 每个 backend 有 health、capacity、workspace mount、permission profile；
- Dashboard 可按 backend 过滤任务。

### 2. Automations 不应只是“按钮”

OpenHands 的 automations 强调 schedule/webhook/event trigger。

建议：

- DofeAI 增加 triggers：manual、GitHub issue label、PR check failed、schedule、Slack command；
- 每个 Loop 记录 trigger source；
- action queue 变成 automation inbox，而不是静态列表。

### 3. Self-host security 是购买理由

OpenHands README 明确提醒 direct mode 有完整文件系统访问风险。DofeAI 可以把权限做得更细。

建议：

- workspace permission profile；
- command allow/deny list；
- secret redaction status；
- Docker image provenance；
- admin-only runtime diagnostics。

## 对本项目的优化建议

| 优先级 | 建议                         | 验收                                                                                      |
| ------ | ---------------------------- | ----------------------------------------------------------------------------------------- |
| P0     | 抽象 runtime backend model   | 部分已实施：local CLI / Docker runtime diagnostics 已有；remote/cloud backend 后续 Epic   |
| P1     | Automation trigger contract  | 已实施 v1：Trigger Portfolio 展示 issue source/repo/submitter；payload contract 后续 Epic |
| P1     | Webhook/Schedule trigger     | GitHub/Slack/cron 可创建或唤醒 Loop                                                       |
| P1     | Backend capacity dashboard   | 已实施 v1：Exception Center 展示 running/queued/failed/capacity                           |
| P2     | ACP-compatible agent adapter | 可接第三方 agent server                                                                   |

## 实施标注

2026-06-23 再审查确认：DofeAI 已有 local CLI / Docker fallback、workspace profile 和 runtime diagnostics，因此 OpenHands P0 的“backend model”已部分落地。本轮新增 Trigger Portfolio v1，基于现有 `LoopIssue.sourceChannel/sourceKind/targetRepo/submitter` 在 dashboard 展示入口来源、仓库覆盖与近期触发记录，闭合 Automation trigger contract 的第一层可见性。remote agent server / cloud worker / signed webhook / schedule trigger / payload replay 仍需要新增 runtime backend contract、队列与外部 webhook，归入后续 Epic。Loop Board v1 已提升 control plane 的团队可视化；Exception Center v1 已补上 backend capacity dashboard 的第一层 running/queued/failed/capacity 可见性。

## 结论

OpenHands 证明“agent 控制面”是独立产品形态。DofeAI 应继续坚持 Loops 的 evidence-first 差异化，但需要补 backend abstraction 和 automation trigger。
