# Continue 竞品分析

项目：Continue  
GitHub：https://github.com/continuedev/continue  
定位：开源 coding agent，曾覆盖 CLI / VS Code / JetBrains  
检索日期：2026-06-23

## 一句话判断

Continue 是“开源 coding assistant 先驱”的案例。它当前仓库已不再活跃维护，给 DofeAI 的启发不是功能复制，而是产品战略风险：单纯 IDE coding assistant 会被快速迭代和平台迁移冲击。

## 产品画像

Continue README 显示：

- coding agent available as CLI、VS Code extension、JetBrains plugin；
- final 2.0.0 release；
- 仓库 no longer actively maintained / read-only；
- 移除匿名 telemetry 和 authentication 等。

## 与 DofeAI 的深度对比

| 维度     | Continue              | DofeAI 当前             | 差距/机会                  |
| -------- | --------------------- | ----------------------- | -------------------------- |
| 产品形态 | IDE/CLI agent         | Web control plane + API | DofeAI 更平台化            |
| 生命周期 | 已只读                | 活跃开发                | DofeAI 要避免同质化红海    |
| 差异化   | open-source assistant | evidence workflow       | DofeAI 差异更清晰          |
| 集成     | VS Code/JetBrains/CLI | Web/API                 | 可借鉴多端，但不要只做插件 |

## 借鉴点

### 1. 开源 AI 编程助手迭代非常快

Continue 作为先驱项目进入只读状态，说明：

- 模型能力变化会重塑产品；
- 单一 IDE assistant 护城河有限；
- 用户入口会迁移；
- 工作流和数据资产比聊天 UI 更持久。

### 2. DofeAI 应沉淀不可替代资产

建议聚焦：

- `.loops` evidence；
- workspace/repo knowledge；
- team policies；
- issue-to-PR trace；
- benchmark metrics；
- runtime/backend governance。

## 对本项目的优化建议

| 优先级 | 建议                     | 验收                                                                                 |
| ------ | ------------------------ | ------------------------------------------------------------------------------------ |
| P0     | 明确非 IDE 插件定位      | 已实施：0622/0623 文档和 `/loops` dashboard 均表达 control plane / delivery workflow |
| P1     | 数据资产沉淀             | evidence、metrics、repo map 可跨 agent 复用                                          |
| P2     | IDE 插件作为入口而非核心 | 插件只创建/查看 Loop，不承载状态机                                                   |

## 实施标注

2026-06-23 已完成非 IDE 插件定位标注：DofeAI 的默认产品面是 Loops Control Plane / Agent Delivery Console，而不是编辑器插件。Loop Board v1 进一步强化了团队交付控制面的心智。repo map、IDE 入口等属于后续扩展。

## 结论

Continue 说明“开源 coding assistant”本身不是长期差异化。DofeAI 应把自己定义为 agent delivery operating system，而不是又一个编辑器助手。
