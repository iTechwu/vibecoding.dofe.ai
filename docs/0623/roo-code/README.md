# Roo Code 竞品分析

项目：Roo Code  
GitHub：https://github.com/RooCodeInc/Roo-Code  
定位：编辑器内 AI-powered dev team，源自 Cline 生态  
检索日期：2026-06-23

## 一句话判断

Roo Code 当前项目状态已有不确定性，但其 Modes 设计对 DofeAI 的 agent role / workflow mode 很有启发。

## 产品画像

Roo Code README 强调：

- 自然语言生成代码；
- Code / Architect / Ask / Debug / Custom Modes；
- 重构、调试、文档；
- MCP Servers；
- 多语言本地化；
- README 中说明 Roo Code Extension 已关闭，并推荐替代项目。

## 与 DofeAI 的深度对比

| 维度   | Roo Code                        | DofeAI 当前                       | 差距/机会                     |
| ------ | ------------------------------- | --------------------------------- | ----------------------------- |
| 模式   | Code/Architect/Ask/Debug/Custom | phase + agent role                | DofeAI 可以把 mode 显式产品化 |
| 产品面 | IDE extension                   | Web control plane                 | DofeAI 更适合团队             |
| 状态   | Extension shut down             | 本项目持续建设                    | 提醒避免过度依赖单一插件形态  |
| MCP    | 支持                            | 可通过 runtime/agent adapter 扩展 | 可增强                        |

## 借鉴点

### 1. Modes 比 phase 更容易被用户理解

用户不关心 PHASE_4_IMPLEMENT，但能理解：

- Architect：规划；
- Code：实现；
- Debug：修复；
- Review：审查；
- Ask：解释。

建议：

- detail 页 Flow Status 同时显示 `phase` 和用户语义 mode；
- action queue 用 mode 分类；
- agent runtime 用 mode 展示职责。

### 2. Custom Modes 可映射为 Loop Templates

DofeAI `/loops/new` 已有 templates，可进一步与 mode 绑定。

建议：

- Feature Loop -> Architect + Code + Review；
- Bugfix Loop -> Debug + Code + Regression；
- Docs Loop -> Ask + Docs Review；
- Integration Loop -> Architect + Security Review。

## 对本项目的优化建议

| 优先级 | 建议                             | 验收                                                                       |
| ------ | -------------------------------- | -------------------------------------------------------------------------- |
| P1     | 引入 user-facing mode 字段       | 部分实施：Loop Board v1 已派生 Plan / Code / Review / Recovery / Delivered |
| P1     | Loop template 与 agent mode 绑定 | 已实施 v1：创建页 preview 展示推荐 agent path                              |
| P2     | Custom mode 配置                 | 团队可定义合规/性能/安全模式                                               |

## 实施标注

2026-06-23 已在 dashboard Loop Board v1 中展示 user-facing mode，并在 `/loops/new` preview 中按 template 展示推荐 agent path。当前 mode / path 仍由前端解释层派生；后续应沉淀为 contract 字段，并与真实 agent route / permission mode 绑定。

## 结论

Roo Code 的项目状态提醒：DofeAI 不应把产品命运押在 IDE 插件，而应沉淀平台工作流。但 Modes 是非常值得吸收的用户心智。
