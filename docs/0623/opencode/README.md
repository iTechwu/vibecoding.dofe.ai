# OpenCode 竞品分析

项目：OpenCode  
GitHub：https://github.com/sst/opencode  
定位：开源 AI coding agent，终端 + 桌面应用  
检索日期：2026-06-23

## 一句话判断

OpenCode 的 build/plan 双 agent 心智非常清晰，适合 DofeAI 借鉴到 Spec Review 和 runtime 权限模型里。

## 产品画像

OpenCode README 强调：

- open source AI coding agent；
- 终端安装、桌面应用；
- built-in agents：build 和 plan；
- build 是默认 full-access development agent；
- plan 是 read-only agent，默认拒绝文件编辑，运行 bash 前请求许可；
- general subagent 用于复杂搜索和多步任务。

## 与 DofeAI 的深度对比

| 维度       | OpenCode                          | DofeAI 当前                  | 差距/机会                    |
| ---------- | --------------------------------- | ---------------------------- | ---------------------------- |
| Agent mode | build / plan / general            | Codex/Claude + phase owner   | DofeAI 可做权限化 agent mode |
| 权限       | plan read-only, build full access | runtime path policy + Docker | DofeAI 可更直观表达权限      |
| 产品面     | CLI/Desktop                       | Web control plane            | DofeAI 更团队化              |
| 子任务     | general subagent                  | shard/agent adapter          | DofeAI shard 更结构化        |

## 借鉴点

### 1. Plan agent 必须 read-only

DofeAI Spec 生成阶段应默认只读，避免计划阶段产生副作用。

建议：

- Codex planner runtime 默认 read-only；
- decompose 前不允许写代码；
- UI 显示当前 agent permission mode。

### 2. Build agent 权限要可解释

用户需要知道何时 agent 获得写权限。

建议：

- Flow Status 显示 permission: read-only / write / shell / network；
- 高风险命令进入 exception decision；
- audit log 记录权限升级。

### 3. General subagent 可用于深检索

DofeAI 可引入 researcher agent，用于：

- 代码地图；
- 竞品/文档检索；
- release notes；
- issue triage。

## 对本项目的优化建议

| 优先级 | 建议                          | 验收                                                                                                       |
| ------ | ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| P1     | Agent permission mode         | 已实施 v2：权限画像 + SSO asset permission + command policy + Docker sandbox health/执行层；细粒度审批后续 |
| P1     | Planner read-only enforcement | Spec/decompose 前无代码写入                                                                                |
| P2     | Researcher subagent           | 支持文档/竞品/代码搜索任务                                                                                 |

## 实施标注

2026-06-24 复审：已实施 Loop Board v1 的 user-facing mode，并在 Capability Registry 中新增 Permission Profile v1，按现有 agent/tool registry 展示 read/write/shell/network/approval 的状态和证据。当前代码还已有 SSO asset permission、runner command policy、Docker sandbox command builder/health endpoint 与 strict allowlist 执行路径。后续 Epic 是更细粒度的 per-tool 审批、override 工作流、adapter 级统一强制和审计回放。

## 结论

OpenCode 的核心启发是“agent mode 与权限绑定”。DofeAI 要把权限从技术配置变成用户可理解的产品状态。
