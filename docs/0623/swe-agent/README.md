# SWE-agent 竞品分析

项目：SWE-agent / mini-SWE-agent  
GitHub：https://github.com/SWE-agent/SWE-agent  
定位：面向真实 GitHub repo issue 修复与 SWE-bench 的 autonomous software engineering agent  
检索日期：2026-06-23

## 一句话判断

SWE-agent 是“agent 能否解决真实软件工程问题”的 benchmark 型参照，不是 DofeAI 的直接产品形态竞品，但对工具接口、评测、配置化 loop 很有价值。

## 产品画像

SWE-agent README 强调：

- 让语言模型自主使用工具修复真实 GitHub 仓库问题；
- 在 SWE-bench 开源项目中有优秀表现；
- 通过单一 YAML 配置；
- 研究友好、简单可 hack；
- 当前团队将主要开发精力转向 mini-SWE-agent。

## 与 DofeAI 的深度对比

| 维度     | SWE-agent                | DofeAI 当前                         | 差距/机会                 |
| -------- | ------------------------ | ----------------------------------- | ------------------------- |
| 核心目标 | benchmark / issue repair | 团队交付工作流                      | 定位不同                  |
| 用户     | 研究者、agent 开发者     | 产品/工程/平台团队                  | DofeAI 更产品化           |
| 配置     | YAML 驱动                | contract + service + `.loops`       | 可借鉴配置化策略          |
| 证据     | benchmark result / patch | implementation/test/review evidence | DofeAI 更适合审计         |
| UI       | CLI/docs 为主            | Web dashboard/detail                | DofeAI 更面向团队         |
| 评测     | SWE-bench                | 项目回归测试                        | DofeAI 可补自有 benchmark |

## 借鉴点

### 1. 建立 DofeAI 自有 Loop Bench

DofeAI 不能只靠普通单元测试证明 agent 有用。应沉淀一组真实任务 benchmark。

建议：

- `bench/loops/` 保存标准任务；
- 每个任务包含 initial repo、issue、expected files、expected tests；
- 记录 pass rate、tokens、calls、duration、human interventions。

### 2. Loop 策略配置化

SWE-agent 的 YAML 配置方式适合研究和复现实验。DofeAI 可在 workspace/profile 上配置策略。

建议：

- max rounds；
- model profile；
- tool permissions；
- test command policy；
- review strictness；
- cost cap。

### 3. 小核心优先

mini-SWE-agent 的转向说明，agent loop 越小越容易评测和稳定。

建议：

- 保持 `advance` 决策表可读；
- 每个 phase 的输入输出明确；
- 避免把过多 UI 状态塞进 engine。

## 对本项目的优化建议

| 优先级 | 建议                       | 验收                                                      |
| ------ | -------------------------- | --------------------------------------------------------- |
| P1     | 建立 Loop Bench            | 后续 Epic：需要标准任务集与隔离执行环境                   |
| P1     | Workspace strategy profile | 后续 Epic：需扩展 workspace profile contract              |
| P1     | Agent performance metrics  | 部分已有 cost/calls/trace；pass rate、redo rate 后续 Epic |
| P2     | Benchmark dashboard        | PM/工程负责人看趋势                                       |

## 实施标注

2026-06-23 本轮未实施 Loop Bench，因为它需要测试仓库、隔离执行环境和评测指标定义。当前已有 Loops metrics、cost、trace 和 evidence 基础；benchmark 化与策略配置归入后续 Epic。

## 结论

SWE-agent 给 DofeAI 的最大启发是“要可评测”。DofeAI 的产品形态更强，但需要 benchmark 化证明 agent workflow 真正提升交付质量。
