# Aider 竞品分析

项目：Aider  
GitHub：https://github.com/Aider-AI/aider  
定位：终端 AI pair programming  
检索日期：2026-06-23

## 一句话判断

Aider 是个人开发者场景中最成熟的终端 AI 编程工具之一。DofeAI 不应复制其聊天/终端心智，但应借鉴 repo map、Git 自动提交、lint/test feedback loop。

## 产品画像

Aider README 强调：

- 在终端与 LLM pair program；
- 支持云端和本地模型；
- repo map 帮助理解大型项目；
- 自动 git commit；
- IDE watch、图片/网页输入、语音输入；
- 自动 lint/test，并可修复检测到的问题。

## 与 DofeAI 的深度对比

| 维度     | Aider              | DofeAI 当前                            | 差距/机会                          |
| -------- | ------------------ | -------------------------------------- | ---------------------------------- |
| 使用场景 | 个人终端协作       | 团队工程交付                           | DofeAI 更偏平台                    |
| 上下文   | repo map           | runtime/workspace profile，缺 repo map | DofeAI 应缓存代码地图              |
| Git      | 自动 commit        | git adapter / convergence PR           | DofeAI 可增强自动 commit/undo 展示 |
| 测试     | lint/test feedback | test records                           | DofeAI 可强化测试命令策略          |
| 交互     | 聊天式             | Spec gate + dashboard                  | DofeAI 更适合团队                  |

## 借鉴点

### 1. Repo Map 是基础设施

Aider 的 repo map 是大型代码库能力关键。DofeAI 每次 Spec/decompose 都需要理解 repo，可缓存 workspace map。

建议：

- workspace scan；
- file/module dependency map；
- public API map；
- recent change map；
- generated context summary for planner。

### 2. Git 操作要可撤销、可审计

Aider 自动提交并让用户用熟悉 git 工具 diff/undo。DofeAI 的 evidence 更适合团队，但要把 Git 状态展示得更直观。

建议：

- 每个 Loop 显示 branch、commit range、dirty state；
- artifact 关联 commits；
- rollback guidance。

### 3. Lint/Test feedback loop 产品化

Aider 自动运行 lint/test 并修复。DofeAI 已有 test records，但页面上还可以更清晰地展示命令、失败摘要、重试策略。

## 对本项目的优化建议

| 优先级 | 建议                     | 验收                                                                              |
| ------ | ------------------------ | --------------------------------------------------------------------------------- |
| P1     | Workspace repo map       | 已实施 v1：Repo Context Map 展示仓库覆盖、阶段分布和阻塞；代码地图后续 Epic       |
| P1     | Git evidence panel       | 部分实施：Loop Board v1 展示派生 branch 与 PR 状态；commits/dirty state 后续 Epic |
| P1     | Test command policy      | 已实施 v1：创建页 preview 展示模板级测试策略；repo 级命令配置后续 Epic            |
| P2     | Voice/image issue intake | 面向非工程用户补充输入方式                                                        |

## 实施标注

2026-06-23 已在 Loop Board v1 中加入 branch / PR 状态的第一层展示，并在 `/loops/new` preview 中加入模板级 test policy 提示。本轮新增 Repo Context Map v1，基于现有 Loop issue 的 `targetRepo`、phase、更新时间和 cost guard 汇总仓库覆盖、阶段分布、阻塞数和每仓最近 Loop。真实 commit range、dirty state、代码地图与 repo 级可配置 test command policy 仍需要 git/workspace profile contract，归入后续 Epic。

## 结论

Aider 的优势是开发者手感和代码库理解。DofeAI 要吸收其 repo map 与 git feedback，但保持“证据驱动团队交付”的产品差异。
