# gstack 产品深析

## 1. 定位

gstack 可以被理解为：

> 一个围绕 Claude Code、Codex CLI 和其他 agent host 的 AI 工程 workflow layer。

它不主要竞争“谁的模型更会写代码”，而是竞争“谁能把 AI coding 变成完整工程交付流程”。这使它和 IDE 插件、CLI pair programmer、研究型 SWE agent 形成了明显区分。

## 2. 目标用户

| 用户              | 核心痛点                                        | gstack 的解决方式                                 | DofeAI 可转化方向                                             |
| ----------------- | ----------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------- |
| 高产独立开发者    | 想同时推进多个功能，但缺少产品/QA/安全/发布角色 | 用 slash command 模拟虚拟工程团队                 | 用 Loops 表达并行任务、门禁和证据                             |
| Founder/PM 型用户 | 不想只看代码 diff，想看计划、风险、发布结果     | office-hours、plan review、ship/canary 等流程命令 | 用 dashboard 提供产品化进度和 release readiness               |
| 小团队工程负责人  | 需要统一 agent 工作方式和 repo 经验             | team mode、skills、local learnings                | 用 workspace recipe、policy、learning governance 固化团队规范 |
| 安全敏感团队      | 担心 agent 执行破坏性命令、泄露 secret          | guard/freeze/careful、安全角色与审查命令          | 用 runtime policy、审批、canary、审计日志落库                 |

## 3. 产品飞轮

gstack 的飞轮是：

1. 用命令降低启动成本：用户不需要设计复杂流程，只要调用 `/plan`、`/qa`、`/ship` 等角色命令。
2. 用浏览器能力增加真实反馈：agent 能看见页面结果，而不是只根据代码猜测。
3. 用 memory 形成复利：项目经验、踩坑和决策能被后续会话复用。
4. 用 safety/release 增加信任：交付不止是“改完了”，还要能审查、验证、发布。
5. 用 team install 扩散：流程进入 repo 后，团队成员共享同一套操作习惯。

这套飞轮的核心不是单点功能，而是工作流密度。它让用户觉得“我雇了一个可调用的小型工程组织”。

## 4. 核心能力拆解

| 能力             | gstack 表现                             | 产品价值               | DofeAI 对应                                 |
| ---------------- | --------------------------------------- | ---------------------- | ------------------------------------------- |
| Workflow pack    | 大量角色化 slash commands               | 低摩擦启动复杂工程流程 | Workflow Recipe + Loop state machine        |
| Browser QA       | 本地浏览器、页面观察、QA 命令           | 从代码验证走向产品验证 | Browser QA Worker + trace/evidence          |
| Learning memory  | 本地项目 learnings/GBrain 思路          | 跨会话复利             | LoopLearning + governance + recall          |
| Second opinion   | 用不同 agent/model 做审查               | 降低单模型盲区         | Codex primary + Claude Code secondary       |
| Release flow     | ship/canary/land/deploy 命令            | 让交付接近真实发布     | Release Gate + PR evidence + canary worker  |
| Runtime security | guard/freeze/careful、安全命令          | 提升 agent 执行可信度  | Runtime Security Gate + sandbox + approvals |
| Multi-host       | Claude Code、Codex CLI、OpenCode 等入口 | 捕获不同用户工作台     | DofeAI 应保持 Codex/Claude 双运行时聚焦     |

## 5. 护城河

gstack 的护城河主要有四个：

| 护城河          | 说明                                 | 可复制性                                 |
| --------------- | ------------------------------------ | ---------------------------------------- |
| 工作流命名权    | 把工程团队角色变成易记命令，心智清晰 | 中，DofeAI 不应照搬命令，但可抽象 recipe |
| 浏览器在环      | agent 能看到真实 UI，QA 结果更可信   | 中高，需要 worker/runtime 投入           |
| 本地记忆        | 使用越久，越了解项目                 | 中，难点在治理和去重，不是存储           |
| 安全/发布完整度 | 从 plan 到 ship 都有对应动作         | 高，但需要产品化为结构化 gate            |

## 6. 风险与限制

| 风险                       | 影响                                   | DofeAI 应如何避开                                  |
| -------------------------- | -------------------------------------- | -------------------------------------------------- |
| Slash command 规模膨胀     | 命令越多，学习和维护成本越高           | 用 recipe/gate schema 表达流程，不堆命令           |
| 多 host 支持发散           | 每个 host 行为差异会稀释体验一致性     | 锁定 Codex CLI + Claude Code CLI 的双 runtime 归因 |
| 本地文件治理弱             | learning、policy、audit 难做组织级查询 | 将关键 artifact 进入 DB/API/worker 治理路径        |
| Prompt-only 流程不够强约束 | 容易出现“看起来执行了，实际不可审计”   | 后端状态机、Zod contract、evidence-first           |
| Browser/session 安全复杂   | cookie、账号、截图可能泄露敏感信息     | auth session policy、测试账号治理、脱敏和审批      |

## 7. 对 DofeAI 的启发

DofeAI 要学的是 gstack 的“工程组织感”，不是命令形态。具体来说：

- 把 gstack 的角色命令转成可配置 Workflow Recipe。
- 把 gstack 的 plan/review/ship 转成 review/release gate。
- 把 gstack 的 browser 能力转成可审计 Browser QA Worker。
- 把 gstack 的 learnings 转成 LoopLearning 数据资产。
- 把 gstack 的 guard/careful 转成 runtime policy 和审批拦截。
- 把 gstack 的 canary/ship 转成 release worker 和 rollback gate。

最终产品形态应是“团队可以管理和审计的 agent 交付系统”，而不是“个人电脑上的命令集合”。
