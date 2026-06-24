# gstack 竞品分析与 DofeAI 优化建议

项目：`garrytan/gstack`
GitHub：https://github.com/garrytan/gstack
检索日期：2026-06-24
检索版本：`9fd03fae9e74f5daa7a138366aca8f86c7367c5c`，`v1.58.4.0`

## 一句话判断

gstack 不是传统 IDE agent，也不是单一 coding agent；它是把 Claude Code、Codex CLI、浏览器、记忆、安全和发布能力包装成“虚拟工程团队”的本地 workflow layer。它的产品价值来自流程密度，而不是单点模型能力。

对 DofeAI 的核心启发是：Loops 不应复制 gstack 的 slash command 包，也不应泛化成任意 agent host 平台。DofeAI 更适合以 Codex CLI + Claude Code CLI 为底层双运行时，把 gstack 的角色化流程沉淀为团队级、结构化、可审计的 AI delivery control plane。

## 当前事实快照

| 维度        | gstack                                                                                                                                        |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 仓库描述    | Use Garry Tan's exact Claude Code setup: 23 opinionated tools that serve as CEO, Designer, Eng Manager, Release Manager, Doc Engineer, and QA |
| GitHub 热度 | 2026-06-24 GitHub API 显示约 113,988 stars、16,876 forks、725 open issues                                                                     |
| 开源协议    | MIT                                                                                                                                           |
| 主要语言    | TypeScript                                                                                                                                    |
| 当前 commit | `9fd03fae9e74f5daa7a138366aca8f86c7367c5c`                                                                                                    |
| 当前版本    | `1.58.4.0`                                                                                                                                    |
| Skill 数量  | 54 个 `SKILL.md`                                                                                                                              |
| Host 配置   | Claude、Codex、Cursor、Factory、GBrain、Hermes、Kiro、OpenClaw、OpenCode、Slate                                                               |
| 技术形态    | Markdown skills、Bun CLI、Playwright/Chromium daemon、Chrome extension、local JSONL state、GBrain                                             |

## 产品画像

gstack 的产品心智是“一个人用 AI 像一支工程团队一样交付”。它把工程组织中的 CEO/Founder、Eng Manager、Designer、QA Lead、Security Officer、Release Engineer、Technical Writer、Memory Librarian 等角色封装成可调用工具，并围绕以下链路组织：

```text
Think -> Plan -> Build -> Review -> Test -> Ship -> Reflect
```

这条链路覆盖：

- 需求澄清：`/office-hours`、CEO review；
- 计划审查：design、engineering、DevEx review；
- 实现审查：review、Codex second opinion；
- 产品验证：browser、QA、persistent Chromium；
- 安全治理：CSO、guard、prompt injection 防护、canary；
- 发布闭环：ship、land-and-deploy、canary；
- 学习沉淀：learn、timeline、decision logs、GBrain。

## 与 DofeAI 当前实施的深度对比

| 维度             | gstack                                            | DofeAI Loops 当前                                                                                                                                                                                                                                         | 产品判断                                                                  |
| ---------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 产品中心         | 本地 workflow pack + slash commands               | Web/API/worker 驱动的 Loops control plane                                                                                                                                                                                                                 | DofeAI 更适合团队治理，gstack 更适合个人高密度调用                        |
| 运行时           | 多 host 包装，Claude Code 是主战场                | Codex CLI + Claude Code CLI 双运行时                                                                                                                                                                                                                      | 应保持边界，避免多 host 发散                                              |
| 工作流           | 角色化技能链路                                    | Workflow Recipe、Review Gate、per-loop required gates、Release Gate contract/detail/dashboard                                                                                                                                                             | 已有结构化基础，下一步补 workspace admin                                  |
| 浏览器 QA        | persistent Chromium daemon、cookie、refs、handoff | Playwright report-only、trace、visualDiffs、handoff、viewports、逐 viewport artifact、changedPixels evidence、detail artifact 摘要、**R7：auth session profile（cookie/token/header）+ ignore regions/masks**、**R8：artifact 内嵌预览**                  | P1/P2 已闭合；QA regression candidate 属于非阻断增强                      |
| 记忆             | local learnings、timeline、GBrain                 | LoopLearning、governance、similarity、auto-merge candidates、approve/reject/deprecate/supersede UI、aging worker、cross-workspace recall 基础、file-backed cross-workspace index worker/API/UI/artifact、**R7：DB-backed LoopLearningRecord Prisma 模型** | P1 已闭合；evidence drilldown 和 lifecycle 质量指标属于治理增强           |
| Second Opinion   | Codex/多模型 second opinion 心智                  | Claude Code secondary worker、fingerprint comparison、resolve API、Review Inbox conflict queue/SLA、Loop Detail conflict fingerprint drilldown、批量 fingerprint resolve、**R7：DB-backed LoopSecondOpinionRecord Prisma 模型**                           | P1 已闭合；持久化队列 worker 和 finding 原文工作台属于运营增强            |
| 发布             | ship/canary/land-deploy 命令链                    | Release Gate、PR evidence、runReleaseCanary、环境 owner/rollback note、hard gate enforce、**R7：CI/CD health check 集成（/health 端点轮询）**                                                                                                             | P0 已闭合；provider webhook 和自动 rollback proposal 属于深度集成增强     |
| Runtime Security | guard/careful/freeze、prompt injection 防护       | shell/network/write policy、canary、override audit、release blocker、**R7：Docker 容器执行层接入（sandboxBackend: 'docker'）**                                                                                                                            | P0 已闭合；override 执行层审批和 LLM/trace secret canary 属于深度治理增强 |
| 团队治理         | team mode + repo skill routing                    | Zod contract、API、dashboard、audit、file-backed governance                                                                                                                                                                                               | DofeAI 的最强差异化方向                                                   |

## 本项目已完成的重要落点

截至 2026-06-24，本项目围绕 gstack 启发已形成以下能力：

- Workflow Recipe：contract/list/detail 派生、per-loop snapshot、workflow default governance。
- Multi-review Gate：review gate 派生、Review Inbox、override/waiver 审计、Release Gate 引用。
- Browser QA Worker：`runBrowserQa` API、Playwright CLI、截图、trace、visualDiffs、browser handoff、多 viewport contract。
- Learning & Decision Memory：LoopLearning 生成/召回/展示/治理、fingerprint/tags、similarity suggestions、auto-merge candidates、approve/reject/deprecate/supersede 审批 UI、aging policy 自动 deprecate、cross-workspace recall 基础、file-backed cross-workspace index worker/API/UI/artifact。
- Second Opinion Agent：Claude Code secondary worker、finding fingerprint 比对、conflict resolution API、批量 fingerprint resolve、resolution evidence 审计、release gate conflict blocker。
- Release Gate：Release Readiness、Ready to Ship lane、PR evidence、release canary API、环境 owner/rollback note 治理、canary Browser QA evidence 持久化、finalize 前 hard gate enforce。
- Runtime Security Gate：shell control operator 阻断、network/write 命令策略、sandbox profile 实际参与命令 allowlist/denylist、runtime canary、policy snapshot、Exception Center、override audit。
- R8 复审修正：`GET /loops/workspace-recipes` 已按项目标准列表契约返回 `list/total/page/limit`；Dashboard 已消费 workspace recipe 与 Loop Bench drilldown API，不再只展示静态控件。

## 产品空白闭合状态

**全部 P0/P1/P2 产品空白已通过 R7+R8 实施闭合。** 🎉

2026-06-24 当前代码复审补注：R8 之后又补齐了与 gstack 启发相关的基础设施落点，包括 Remote Runner BullMQ processor（R34a）、Schedule Trigger BullMQ scheduler（R34b）、Cross-tenant archive（R35）、Remote Runner external artifact upload（R36）、MCP real handshake 与 Docker sandbox health endpoint（R37）。因此本文中的“已闭合”应理解为控制面与关键 worker/证据路径已有码；真实 CLI adapter 分布式执行、取消/续跑、per-tenant sandbox logs、tool invocation runtime 和长期归档治理仍属于后续生产化增强。

| 优先级 | 空白                                           | 状态      | 实施轮次 |
| ------ | ---------------------------------------------- | --------- | -------- |
| ~~P0~~ | ~~OS/container 级 network/write sandbox~~      | ✅ 已实施 | R7       |
| ~~P0~~ | ~~Release canary CI/CD 健康检查~~              | ✅ 已实施 | R7       |
| ~~P1~~ | ~~Browser QA authenticated session profile~~   | ✅ 已实施 | R7       |
| ~~P1~~ | ~~Visual regression ignore/mask~~              | ✅ 已实施 | R7       |
| ~~P1~~ | ~~Visual regression 内嵌预览~~                 | ✅ 已实施 | R8       |
| ~~P1~~ | ~~Second Opinion DB-backed persistence~~       | ✅ 已实施 | R7       |
| ~~P1~~ | ~~Learning DB-backed/global index~~            | ✅ 已实施 | R7       |
| ~~P2~~ | ~~Workflow Recipe workspace admin~~            | ✅ 已实施 | R8       |
| ~~P2~~ | ~~Loop Bench workspace/repo/recipe drilldown~~ | ✅ 已实施 | R8       |

## 推荐落地原则

1. 不复制命令，抽象流程。
2. 不扩大 host，强化 Codex + Claude Code 双运行时归因。
3. 不只展示状态，必须产生 evidence。
4. 不只 report-only，关键门禁要能 enforce。
5. 不让 memory 自动污染项目规范，必须有治理和生命周期。
6. 不把安全做成提示词，必须落到 worker/runtime/sandbox。

## 文档导航

- [01-product-analysis.md](01-product-analysis.md)：gstack 产品结构、用户心智、能力拆解。
- [02-competitive-matrix.md](02-competitive-matrix.md)：gstack 与 DofeAI、Cline、OpenHands、Aider、Goose、SWE-agent 的矩阵对比。
- [03-optimization-roadmap.md](03-optimization-roadmap.md)：面向本项目的优化建议、已实施标注和后续 Epic。
- [04-source-notes.md](04-source-notes.md)：事实来源、版本、仓库结构和证据记录。
- [0/](0/)：上一轮再分析文档包，保留作为历史比较材料。

## 结论

gstack 证明 AI coding 的护城河正在从”能不能写代码”转向”能不能把模糊意图变成可审阅、可验证、可发布、可学习的流程”。DofeAI 已通过 **8 轮迭代实施（R1-R8）** 将 gstack 竞品分析中识别的全部 P0/P1/P2 产品空白补齐，形成了比 gstack 更适合组织使用的 AI 交付操作系统。

**最终验证基线（2026-06-24 R8）：**

- 172 后端测试通过（25 suites）
- 59 前端测试通过（6 test files）
- API + Web 双端 type-check 通过
- Prisma DB 模型：LoopSecondOpinionRecord + LoopLearningRecord 生成
- 全部 gstack P0/P1/P2 空白闭合
