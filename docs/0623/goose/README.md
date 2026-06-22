# Goose 竞品分析

项目：Goose  
GitHub：https://github.com/block/goose  
定位：通用本机 AI agent，Desktop / CLI / API  
检索日期：2026-06-23

## 一句话判断

Goose 是 agent runtime 与生态集成参照。它不只面向 coding，而是通用本机 agent，强调 Desktop、CLI、API、MCP、ACP、多 provider 和自定义发行版。

## 产品画像

Goose README 显示：

- native open source AI agent；
- desktop app、CLI、API；
- code、workflow、research、writing、automation、data analysis；
- Rust 实现；
- 支持 15+ provider；
- 支持 ACP 使用现有 Claude/ChatGPT/Gemini 订阅；
- 通过 MCP 连接 70+ extensions；
- 项目已迁移到 Linux Foundation 下的 Agentic AI Foundation。

## 与 DofeAI 的深度对比

| 维度       | Goose                 | DofeAI 当前           | 差距/机会                           |
| ---------- | --------------------- | --------------------- | ----------------------------------- |
| 范围       | 通用 agent            | 工程交付 agent        | DofeAI 更聚焦                       |
| 端形态     | Desktop/CLI/API       | Web/API/CLI 脚本      | DofeAI 可补 API/desktop-ish runtime |
| Provider   | 15+ providers         | Codex/Claude adapters | 可扩展 provider abstraction         |
| Extensions | MCP 70+               | 可接 MCP，但未产品化  | 机会明显                            |
| 治理       | Linux Foundation/AAIF | 私有产品项目          | 可借鉴开放生态                      |
| 定制发行   | custom distros        | 无                    | 企业私有化可用                      |

## 借鉴点

### 1. API-first agent runtime

DofeAI 的 LoopsService 是业务服务，不是通用 agent runtime API。若要接更多 agent，应有更明确 runtime API。

建议：

- agent session API；
- tool invocation audit；
- provider profile；
- extension registry；
- runtime diagnostics。

### 2. MCP/ACP 是生态入口

Goose 明确拥抱 MCP/ACP。DofeAI 当前可以将 MCP 作为工具扩展层，将 ACP 作为 agent backend 协议候选。

### 3. 企业定制发行

Goose custom distributions 提示：企业用户希望预配置 provider、extensions、branding。

建议：

- DofeAI workspace template；
- default tools；
- compliance policy；
- branded runtime profile。

## 对本项目的优化建议

| 优先级 | 建议                          | 验收                                                 |
| ------ | ----------------------------- | ---------------------------------------------------- |
| P1     | MCP extension registry        | 后续 Epic：需要 tool registry 管理面与权限策略       |
| P1     | Provider profile              | 后续 Epic：需要 provider/model/cost profile contract |
| P2     | ACP backend exploration       | 可接 ACP-compatible agent                            |
| P2     | Enterprise workspace template | 新 workspace 可套用预设                              |

## 实施标注

2026-06-23 本轮未实施 MCP/ACP/provider profile。当前代码已有 capability registry 和 runtime diagnostics，可作为后续扩展基础；真正的 extension registry 与 provider profile 需要后端 contract 和管理员 UI，归入后续 Epic。

## 结论

Goose 的启发是生态和 runtime。DofeAI 应保持工程交付聚焦，但用 MCP/ACP/provider profile 扩展 agent 能力边界。
