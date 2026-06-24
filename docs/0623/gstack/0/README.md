# gstack 再分析：DofeAI Loops 竞品与优化建议

日期：2026-06-23  
对象：`garrytan/gstack`  
输出目录：`docs/0623/gstack/0`

## 核心结论

gstack 的真正价值不是“又一个 coding agent”，而是把 Claude Code、Codex CLI、浏览器、记忆、安全和发布命令包装成一套高密度的 AI 工程工作流。它占住的是“一个人如何像工程团队一样交付”的心智。

DofeAI Loops 不应该复刻 gstack 的 slash command 包，也不应该把运行时范围扩成任意 host。更优路径是：以 Codex CLI + Claude Code CLI 为底层双运行时，把 gstack 的工作流密度产品化为团队级控制面，包括结构化 recipe、review gate、browser QA、learning memory、second opinion、release gate 和 runtime security gate。

## 本轮判断

| 问题                | 判断                                                                                                                                                                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| gstack 最强在哪里   | 角色化流程、浏览器 QA、本地记忆、安全/发布命令密度                                                                                                                                                                                     |
| DofeAI 当前强在哪里 | Loop 状态机、contract、dashboard、evidence、API/worker 可治理能力                                                                                                                                                                      |
| DofeAI 当前短板     | 2026-06-24 R7/R8 已闭合 Browser QA 登录态/ignore/mask/内嵌预览、Learning/Second Opinion DB 模型、Release health check、Docker sandbox 和 Loop Bench drilldown；剩余为 provider webhook、自动 rollback、evidence drilldown 等非阻断增强 |
| 不应复制什么        | 大量 markdown/slash commands、多宿主泛化、不可审计的 prompt-only 流程                                                                                                                                                                  |
| 应该产品化什么      | Codex planner/reviewer + Claude Code implementer 的可审计交付控制面                                                                                                                                                                    |

## 文档导航

- [01-gstack-product-analysis.md](01-gstack-product-analysis.md)：gstack 产品定位、核心能力、护城河与风险。
- [02-competitive-matrix.md](02-competitive-matrix.md)：gstack、DofeAI Loops、Cline、OpenHands、Aider、Goose、SWE-agent 的深度对比。
- [03-dofeai-optimization-recommendations.md](03-dofeai-optimization-recommendations.md)：结合本项目已实施状态的 P0/P1/P2 优化建议。
- [04-source-notes.md](04-source-notes.md)：来源、访问时间、证据边界与分析假设。

## 产品定位建议

DofeAI Loops 的一句话定位建议：

> 面向团队的 AI delivery control plane：用 Codex 负责计划、审查和门禁，用 Claude Code 负责实现与二次审查，把每次 agent 交付变成可追踪、可验证、可发布、可学习的 Loop。

## 与现有实施的关系

本项目已经围绕 gstack 启发完成了多轮实现，包括 Workflow Recipe、Multi-review Gate、Browser QA Worker、Learning Memory、Second Opinion、Release Gate、Runtime Security Gate 等能力。`docs/0623/gstack/0` 是上一轮再分析文档包，当前实施状态以同目录 `IMPLEMENTATION-ANNOTATIONS.md` 和上级 `../03-optimization-roadmap.md` 的 R7/R8 标注为准。

当前仍应保持清晰边界：R7/R8 已经完成 gstack P0/P1/P2 闭环；provider webhook、自动 rollback proposal、finding/evidence 工作台、Learning lifecycle metrics 和更细的 runtime approval enforcement 属于后续增强，不应混同为当前阻断项。
