# Cline Kanban 竞品分析

项目：Cline Kanban  
GitHub：https://github.com/cline/kanban  
定位：Web-based multi-agent task board  
检索日期：2026-06-23

## 一句话判断

Cline Kanban 是 DofeAI Loops Dashboard / Loop Board 最直接的 UI 与工作流参照：它把多个 agent 任务放在任务板中并行推进，每张卡拥有独立 worktree、自动提交、依赖链和 PR 流程。

## 产品画像

从 Cline README 对 Kanban 的介绍可确认，它的核心能力包括：

- web-based task board；
- 多 agent 并行；
- 每张 card 独立 worktree；
- auto-commit；
- dependency chains；
- 与 Cline agent 生态联动。

补充检索还显示 Cline Kanban 关注：

- cards with dependencies；
- start downstream tasks automatically when dependencies complete；
- live diff / real-time agent progress；
- auto-create PRs。

## 与 DofeAI 的深度对比

| 维度     | Cline Kanban            | DofeAI 当前                  | 差距/机会                            |
| -------- | ----------------------- | ---------------------------- | ------------------------------------ |
| 展示形态 | Kanban task board       | Loops dashboard + detail     | DofeAI 缺 board 视图                 |
| 并行模型 | 多 card / 多 worktree   | issue + shard + lock         | DofeAI 有后端模型，但 UI 未充分表达  |
| 依赖     | dependency chains       | shard dependsOn              | 语义相近，可直接借鉴可视化           |
| Git      | auto-commit / PR        | git adapter / convergence PR | DofeAI 可增强 branch/worktree 可见性 |
| 进度     | real-time progress/diff | logs + trace timeline        | DofeAI 可加 live stream              |
| 证据     | diff/commit/PR          | `.loops` evidence            | DofeAI 审计更强                      |

## 借鉴点

### 1. Loop Board 是 DofeAI 的下一块核心屏幕

当前 Dashboard 更像 control plane 和指标总览；Detail 页很强，但用户需要一个“团队任务板”来管理多个 Loop。

建议新增：

- Backlog / Spec Review / Running / Blocked / Ready for Review / Delivered；
- 每张卡显示 owner agent、phase、human gate、branch、PR、evidence completeness；
- 支持按 workspace、priority、runtime backend、blocked reason 过滤。

### 2. Shard DAG 应该可视化为 dependency chain

DofeAI 已有 `dependsOn`，但普通用户看不到它带来的计划价值。

建议：

- Detail 页增加 “Work Plan” 图；
- shard 卡片显示 blockers 和 downstream；
- 当依赖完成时自动触发后续 shard 的状态解释。

### 3. Worktree/branch 是并行执行的用户信任基础

多 agent 并行最怕互相覆盖。Cline Kanban 用 independent worktree 解决心智问题。

建议：

- 每个 Loop 显示 worktree path / branch / base branch；
- 并发锁状态可见；
- conflict 作为异常决策卡；
- final merge 前展示 changed files 和 PR checks。

### 4. Live diff 可以补足 evidence 的即时感

DofeAI 的 evidence 适合审计，但不够实时。

建议：

- running 状态显示 live changed files；
- 每次 implementation record 关联 diff summary；
- 用户可从 card 直接进入 PR/diff。

## 对本项目的优化建议

| 优先级 | 建议                         | 验收                                                                               |
| ------ | ---------------------------- | ---------------------------------------------------------------------------------- |
| P0     | 设计 Loop Board 信息架构     | 已实施 v1：dashboard 按 Backlog / Spec Review / Running / Blocked / Delivered 分组 |
| P1     | Card 展示 worktree/branch/PR | 部分实施：v1 展示派生 branch 与 PR 状态；真实 worktree path 仍为后续 Epic          |
| P1     | Shard dependency graph       | blocked 原因已在 Loop Board / Exception Center v1 可读；dependsOn 图后续 Epic      |
| P1     | Live progress stream         | 卡片实时展示 latest event/diff/test                                                |
| P2     | 自动创建 PR 策略             | PASS 后按策略自动 PR 或等待人工确认                                                |

## 实施标注

2026-06-23 已完成 Loop Board v1：`/loops` dashboard 新增团队任务板，卡片包含 mode、human gate、evidence、branch、PR 状态与 blocker。Exception Center v1 进一步把 blocker 汇总为 owner/action/evidence。尚未实施独立 worktree 真实路径、dependsOn 图、实时 diff 和自动 PR 策略，这些需要后端 git/runtime contract 支持，归入后续 Epic。

## 结论

Cline Kanban 对 DofeAI 的启发非常直接：Loops 应从“控制台 + detail”升级为“团队 AI 工程任务板 + 证据详情”。DofeAI 的差异化仍然是 `.loops` evidence 和企业 runtime governance，但 Board 形态会显著提升产品可理解度。
