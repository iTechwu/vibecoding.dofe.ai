# 竞品矩阵

## 1. 竞品定位总览

| 产品         | 一句话定位                                               | 与 DofeAI 的关系                    |
| ------------ | -------------------------------------------------------- | ----------------------------------- |
| gstack       | AI engineering workflow layer，把 agent 包成虚拟工程团队 | 最重要的流程产品化参照              |
| DofeAI Loops | 团队级 AI delivery control plane                         | 应用 gstack 思路的结构化平台化方向  |
| Cline        | IDE 内 autonomic coding agent                            | 代码编辑体验参照                    |
| OpenHands    | 面向软件开发任务的 agent platform/runtime                | sandbox、任务执行和开源生态参照     |
| Aider        | Git-native CLI pair programmer                           | repo map、diff、git discipline 参照 |
| Goose        | 通用本地 AI agent，强调扩展、MCP、provider               | runtime/plugin 生态参照             |
| SWE-agent    | 研究和 benchmark 导向的软件工程 agent                    | 可评测性和任务成功率参照            |

## 2. 深度能力矩阵

| 维度             | gstack                                 | DofeAI Loops 当前                                          | Cline                          | OpenHands                       | Aider                    | Goose                        | SWE-agent               |
| ---------------- | -------------------------------------- | ---------------------------------------------------------- | ------------------------------ | ------------------------------- | ------------------------ | ---------------------------- | ----------------------- |
| 运行时           | 包装 Claude Code、Codex CLI 等多 host  | Codex CLI + Claude Code CLI 为核心边界                     | VS Code extension + model/tool | sandbox/container agent runtime | CLI + git + LLM          | local agent + extensions/MCP | benchmark agent runtime |
| 工作流编排       | slash command workflow pack            | Loop phase、recipe、gate、dashboard                        | chat/task loop                 | task session + environment      | edit/test/commit loop    | extensions/workflows         | task solve loop         |
| 团队治理         | 轻量 team install                      | contract/API/UI/审计更强                                   | 主要个人 IDE                   | 偏平台但治理需集成              | 个人/小团队 CLI          | 本地/企业扩展视具体部署      | 研究为主                |
| 浏览器 QA        | 强，persistent browser 是亮点          | report-only + trace/evidence + visual artifacts 基础       | 可通过 browser/tool 扩展       | 可在环境中运行浏览器类任务      | 弱                       | 可扩展                       | 弱                      |
| Memory           | local learnings/GBrain 思路            | LoopLearning + governance + pending approval               | 上下文/规则文件为主            | session/project memory 取决实现 | repo map 强，长期决策弱  | memory/extension 可扩展      | 弱                      |
| Second Opinion   | 多 agent/model 审查心智                | Codex primary + Claude secondary worker 已成形             | 可手动多模型                   | 可多 agent，但需设计            | 手动复审为主             | 可扩展                       | 不主打                  |
| Release/canary   | ship/canary/land 命令心智强            | Release Gate + PR evidence + canary checklist 基础         | 不主打                         | 可接 CI/CD                      | git commit/PR 强，发布弱 | 可扩展                       | 不主打                  |
| Runtime Security | guard/freeze/careful，命令层安全意识强 | shell/network/write policy + canary，OS/container 隔离待补 | 用户审批和工具权限             | sandbox 更原生                  | Git/CLI 透明但隔离弱     | 本地权限需治理               | sandbox 取决评测环境    |
| Evidence         | local artifacts/JSONL/浏览器输出       | evidence-first，API/detail/dashboard 可聚合                | chat/history                   | logs/artifacts                  | git diff/commit          | logs/tool traces             | benchmark logs          |
| 差异风险         | host sprawl、命令膨胀                  | worker/runtime 深度仍需补                                  | IDE 绑定                       | 部署/复杂度较高                 | 流程广度不足             | 方向较泛                     | 产品化弱                |

## 3. gstack vs DofeAI Loops

gstack 更像“个人到小团队的 AI 工程技能包”：它把常见工程角色包装成命令，强调快速调用、低配置、在本地形成工作流密度。

DofeAI Loops 更像“团队级交付控制面”：它有前后端、contract、worker、dashboard、evidence 和审计路径，适合做跨任务、跨团队、跨 workspace 的治理。

关键差异：

| 差异       | gstack 优势           | DofeAI 机会                                     |
| ---------- | --------------------- | ----------------------------------------------- |
| 启动心智   | 命令简单、角色明确    | 用模板/recipe 让用户不用理解底层状态机          |
| 状态治理   | 本地文件和命令链较轻  | 后端状态机可以强约束 gate 和 release            |
| 团队可视化 | 不是核心              | dashboard、inbox、readiness 可成为核心差异      |
| 安全审计   | 有安全意识但偏本地    | policy、approval、canary、audit export 可平台化 |
| 记忆治理   | 有复利，但去重/审批弱 | learning governance、跨 workspace 索引、审批 UI |

产品判断：DofeAI 不要追求“更多命令”，要追求“更可信的交付闭环”。

## 4. gstack vs Cline

Cline 的优势在 IDE 内体验：文件读写、终端命令、上下文交互、用户审批都在开发者日常界面里完成。它适合“我正在写代码，请帮我完成这个任务”。

gstack 的优势在流程广度：它不只做实现，还覆盖 plan、office-hours、QA、security、ship、learn。

DofeAI 应吸收 Cline 的细腻人机交互，但产品心智更接近 gstack：让用户管理一批可验证的交付 Loop，而不是只和一个 IDE agent 对话。

## 5. gstack vs OpenHands

OpenHands 更偏 agent runtime/platform，强调在隔离环境中完成软件工程任务。它对 DofeAI 的启发是 sandbox、任务环境、agent 执行日志和可复现运行。

gstack 更偏 workflow pack，强调“工程团队角色应该怎么协作”。

DofeAI 应把两者结合：用 OpenHands 式隔离/worker 思路承接 gstack 式流程密度，形成 Codex/Claude Code 双 runtime 的受控执行环境。

## 6. gstack vs Aider

Aider 的核心优势是 Git-native：repo map、精准编辑、diff、commit 体验清晰。它的用户信任来自“所有变更都在 git 里可见”。

gstack 的范围更宽，但单次代码编辑体验未必比 Aider 更极致。

DofeAI 可借鉴 Aider 的 git discipline，把每个 Loop 的 plan、patch、review、test、browser QA、release evidence 都绑定到 PR/commit 摘要里，降低团队 reviewer 成本。

## 7. gstack vs Goose

Goose 的启发是 runtime/provider/plugin 生态，尤其是 MCP 和扩展能力。它适合成为“本地通用 agent 外壳”。

gstack 的启发是工程工作流产品化。

DofeAI 当前不应优先走 Goose 式广泛插件生态，而应先把 Loops 的交付控制面打穿：worker 执行、证据沉淀、审批、release gate、runtime security。

## 8. gstack vs SWE-agent

SWE-agent 的强项是可评测性。它回答的是“agent 是否能在 benchmark 上解决软件工程问题”。

gstack 回答的是“真实开发者如何把 agent 纳入日常交付流程”。

DofeAI 的机会是把两者结合：在 Loops 里建设 Loop Bench，把 gstack 式流程产生的 evidence 转换为可度量的质量指标，例如首次通过率、返工率、review conflict rate、browser QA regression rate、release rollback rate。

## 9. DofeAI 差异化路线

| 差异化方向             | 为什么重要                | 近期落点                                             |
| ---------------------- | ------------------------- | ---------------------------------------------------- |
| 结构化 workflow        | 避免 prompt-only 流程失真 | Workspace recipe admin、新建 Loop 默认应用           |
| Evidence control plane | 让团队相信 agent 结果     | PR summary、trace、browser handoff、release evidence |
| Runtime governance     | 让 agent 执行进入可控范围 | network/write sandbox、override approval、canary     |
| Human gates            | 把高风险判断交还给人      | Review Inbox、conflict queues、release hard gate     |
| Learning governance    | 让经验复利但不过期污染    | dedupe、merge approval、cross-workspace index        |
| Browser/product QA     | 从代码正确走向用户可用    | multi-viewport visual regression、auth profile       |

## 10. 竞品结论

gstack 是 DofeAI 在“流程密度”上的最佳参照；OpenHands 是 runtime/sandbox 的参照；Aider 是 git discipline 的参照；Cline 是 IDE 交互的参照；Goose 是扩展生态的参照；SWE-agent 是可评测性的参照。

DofeAI 的胜负手不是做一个更大的 gstack，而是把 gstack 的工作流心智转成团队级、结构化、可审计的交付系统。
