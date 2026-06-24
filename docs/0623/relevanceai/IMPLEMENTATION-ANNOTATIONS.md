# Relevance AI 竞品文档实施标注

日期：2026-06-24（R30c 复审标注）
实施范围：Relevance AI gap analysis 全部 P0/P1/P2 级建议
底层运行时边界：本项目以 Codex CLI 与 Claude Code CLI 为底层执行运行时，DofeAI 负责控制面、编排、证据、治理与可视化。

## 复审结论（R30c）

Relevance AI 竞品分析的推荐方向与 CrewAI 分析高度一致。所有 P0/P1 级产品缺口已通过 CrewAI gap analysis 的实施闭环（R1-R30c）覆盖。P2 级基础设施项已标注为后续 Epic。

### 与 CrewAI 分析的重叠项

Relevance AI 分析中的关键建议与 CrewAI 分析高度重叠，实施状态映射如下：

| Relevance AI 建议        | 对应 CrewAI 项                                                                  | 状态                         |
| ------------------------ | ------------------------------------------------------------------------------- | ---------------------------- |
| Workforce 产品抽象       | P0-1 Workforce Overview (R1)                                                    | ✅ 已实施                    |
| Runtime Backend Registry | P0-2 Runtime Backend Registry (R11/R16)                                         | ✅ 已实施                    |
| Invent Delivery Loop     | P1-1 Invent Delivery Loop (R4/R15)                                              | ✅ 已实施                    |
| Eval Suite               | P0-3 Eval Suite (R13/R19)                                                       | ✅ 已实施                    |
| PR Evidence              | P0-4 PR Evidence First (R5/R6/R29)                                              | ✅ 已实施                    |
| Trigger System           | P0-2 Webhook (R7) + P1-3 Schedule/Trigger Lifecycle (R30c)                      | ✅ 已实施                    |
| Tool Registry            | P1-4 (frontend lifecycle display R4)                                            | ⚠️ 前端 v1，后端 CRUD 待推进 |
| Blueprint Marketplace    | P1-2 (frontend display R4)                                                      | ⚠️ 前端 v1，后端 CRUD 待推进 |
| Enterprise Control Plane | P2-1/P2-2 (Fleet Health R4, Rules Center, Recipe Admin R20/R24/R25)             | ✅ v1 控制面已闭合           |
| Delivery Flow 产品化     | P1-1 Delivery Flow Pipeline (R8)                                                | ✅ 已实施                    |
| MCP/Integration          | P1-2 MCP Server Registry + CI Checks Registry (R10/R17/R18/R22/R23/R27/R28/R29) | ✅ 控制面闭环                |
| SSO/RBAC                 | P1-3 SSO Asset Permissions (R9)                                                 | ✅ 已实施                    |
| Loops Skills             | P0-1 DofeAI Loops Skills (R7)                                                   | ✅ 已实施                    |

### Relevance AI 特有的差异点

| 建议                                                  | 状态     | 说明                                                                                  |
| ----------------------------------------------------- | -------- | ------------------------------------------------------------------------------------- |
| OTEL / vendor-neutral event streaming                 | 后置 P2  | 当前 Winston log + file-backed event log 已满足 v1；OTEL 需要基础设施升级             |
| Slack/GitHub/Linear/Jira/CI 入口闭环                  | 部分实现 | Webhook trigger (R7) 已支持 generic/github source；具体平台 payload mapping 需扩展    |
| Template marketplace / clone / configurable blueprint | 后置 P2  | 前端 Blueprint Marketplace 展示 (R4) 已可；clone/configurable 需后端 CRUD             |
| Cross-system trigger mapping                          | 部分实现 | Schedule trigger (R30c) 已支持 cron-based；GitHub label→Loop、CI fail→Loop 映射待推进 |

## 已验证（R30c）

- `pnpm --filter @repo/api test` — 25 suites, 172 passed
- `pnpm --filter @repo/web test` — 10 files, 71 passed
- `pnpm --filter @repo/contracts test` — 3 suites, 54 passed
- `pnpm --filter @repo/api type-check` — 通过
- `pnpm --filter @repo/web type-check` — 通过
- `pnpm quality:gate` — 通过

## 仍为下一阶段（需要真实基础设施投入）

- Tool Registry 后端 CRUD（前端已有 lifecycle display v1）
- Blueprint Marketplace 后端 CRUD（前端已有 8 blueprint 展示 v1）
- OTEL event streaming
- Cross-system trigger mapping（GitHub label→Loop, CI fail→Loop 自动映射）
- Feishu 入口闭环（依赖外部凭据与应用审批）
