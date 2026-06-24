# Relevance AI 竞品文档实施标注

日期：2026-06-24（R37 当前代码复审标注）
实施范围：Relevance AI gap analysis 全部 P0/P1/P2 级建议
底层运行时边界：本项目以 Codex CLI 与 Claude Code CLI 为底层执行运行时，DofeAI 负责控制面、编排、证据、治理与可视化。

## 复审结论（R37）

Relevance AI 竞品分析的推荐方向与 CrewAI 分析高度一致。当前代码已经覆盖所有 P0/P1 级控制面 v1：Workforce、Runtime Backend、Eval、PR Evidence、Trigger、Tool Registry、Blueprint Marketplace、MCP/CI integration 与 SSO/RBAC 均有 contract/API/service 或 dashboard 落点。P2 级企业基础设施仍需按"已有码 v1 / 生产化后续"区分。

### 与 CrewAI 分析的重叠项

Relevance AI 分析中的关键建议与 CrewAI 分析高度重叠，实施状态映射如下：

| Relevance AI 建议        | 对应 CrewAI 项                                                                                        | 状态                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Workforce 产品抽象       | P0-1 Workforce Overview (R1)                                                                          | ✅ 已实施                                |
| Runtime Backend Registry | P0-2 Runtime Backend Registry (R11/R16)                                                               | ✅ 已实施                                |
| Invent Delivery Loop     | P1-1 Invent Delivery Loop (R4/R15)                                                                    | ✅ 已实施                                |
| Eval Suite               | P0-3 Eval Suite (R13/R19)                                                                             | ✅ 已实施 v1                             |
| PR Evidence              | P0-4 PR Evidence First (R5/R6/R29)                                                                    | ✅ 已实施                                |
| Trigger System           | P0-2 Webhook (R7) + Schedule/Trigger Lifecycle (R30c) + manual fire (R32) + BullMQ scheduler (R34b)   | ✅ 已实施 v2                             |
| Tool Registry            | P1-4 Tool Registry backend CRUD/test/health (R31) + MCP handshake (R37)                               | ✅ 已实施 v1                             |
| Blueprint Marketplace    | P1-2 Blueprint backend CRUD + rollback/history (R31/R32)                                              | ✅ 已实施 v1                             |
| Enterprise Control Plane | P2-1/P2-2 (Fleet Health R4, Rules Center, Recipe Admin R20/R24/R25)                                   | ✅ v1 控制面已闭合                       |
| Delivery Flow 产品化     | P1-1 Delivery Flow Pipeline (R8)                                                                      | ✅ 已实施                                |
| MCP/Integration          | P1-2 MCP Server Registry + CI Checks Registry (R10/R17/R18/R22/R23/R27/R28/R29) + MCP handshake (R37) | ✅ 控制面闭环，MCP 真实 handshake 已有码 |
| SSO/RBAC                 | P1-3 SSO Asset Permissions (R9)                                                                       | ✅ 已实施                                |
| Loops Skills             | P0-1 DofeAI Loops Skills (R7)                                                                         | ✅ 已实施                                |

### 本轮新增实施（R34a–R37，工作区未提交）

| R#   | 功能                                                  | 文件                                                                                                                                             | 状态      | 说明                                                                                                                                                                      |
| ---- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R34a | Remote Runner BullMQ distributed queue + CLI dispatch | `loops-remote-runner.processor.ts` (新增), `loops.service.ts` (executeRemoteShardJob), `loops-file-store.service.ts` (writeRemoteRunnerArtifact) | ✅ 已集成 | BullMQ processor → LoopsService.executeRemoteShardJob → claudeAdapter.run / runner.runShardTests / agentAdapter.review; Docker sandbox fallback; job artifact persistence |
| R34b | Trigger auto-execution scheduler                      | `loops-trigger-scheduler.processor.ts` (新增)                                                                                                    | 已有码    | 60s repeatable BullMQ job, distributed Redis lock, cron-based trigger fire, file store state                                                                              |
| R35  | Cross-tenant archive                                  | `loops-cross-tenant-archive.service.ts` (新增)                                                                                                   | 已有码    | Manifest generation, SHA256 checksums, upload to object storage, presigned download URLs                                                                                  |
| R36  | Webhook source enrichment + artifact upload           | `loops.service.ts` (enrichWebhookFromSource), `loops-file-store.service.ts` (readRemoteRunnerArtifact)                                           | 已有码    | Linear/Jira/Slack payload mapping; remote runner artifact upload to OSS                                                                                                   |
| R37  | MCP client + Docker sandbox execution                 | `loops-mcp-client.service.ts` (新增), `loops-docker-sandbox.service.ts` (execute/executeOrThrow/isDockerAvailable)                               | 已有码    | MCP JSON-RPC 2.0 stdio transport; Docker sandbox with --network=none, --read-only, --cap-drop=ALL                                                                         |

### Relevance AI 特有的差异点

| 建议                                                  | 状态      | 说明                                                                                                   |
| ----------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------ |
| OTEL / vendor-neutral event streaming                 | 后置 P2   | 当前 Winston log + file-backed event log + durable artifacts 已满足 v1；OTEL 需要基础设施升级          |
| Slack/GitHub/Linear/Jira/CI 入口闭环                  | 部分实现  | Webhook trigger 已支持 generic/github/linear/jira/slack payload mapping (R36)；CI fail→Loop 映射待推进 |
| Template marketplace / clone / configurable blueprint | 已实施 v1 | Blueprint CRUD、version rollback/history 已有代码；clone、跨租户共享与审批流仍后续                     |
| Cross-system trigger mapping                          | 部分实现  | Schedule trigger + BullMQ scheduler (R34b) 已有码；GitHub label→Loop 已有码；CI fail→Loop 映射待推进   |

## 已验证（R37，2026-06-24）

- `pnpm --filter @repo/api test` — 25 suites, 172 passed
- `pnpm --filter @repo/web test` — 10 files, 71 passed
- `pnpm --filter @repo/contracts test` — 3 suites, 54 passed
- `pnpm --filter @repo/api type-check` — 通过
- `pnpm --filter @repo/web type-check` — 通过
- `pnpm quality:gate` — 通过

## 仍为下一阶段（需要真实基础设施投入）

- **持久化 Eval Suite/Run**：当前 derived EvalSuite/EvalRun API v1 基于文件存储 read-through；需要 DB schema + runner + trend metrics 才能版本化和趋势分析
- **分布式限流与 cost policy**：当前 webhook rate guard 为单实例 in-process；需要分布式 Redis-based rate limiter 与 per-trigger cost policy
- **Trigger replay/dead-letter**：trigger execution 已有 schema 与记录；需要 worker 实现 replay 和 dead-letter queue 消费
- **OTEL event streaming**：需要基础设施升级
- **Tool invocation runtime**：Tool Registry 已有 CRUD/test/health + MCP handshake；真实 provider invocation sandbox 后续
- **Cross-tenant archive**：R35 已有码（manifest 生成 + object storage 上传 + presigned URL）；生产配置需要 SSO-side FileStorageService 可用
- **Remote Runner**：R34a CLI adapter dispatch 集成已完成并通过 E2E 验证 — `executeRemoteShardJob` 覆盖 implement/test/review 三种 workerKind；Codex CLI v0.141.0 + Claude Code v2.1.186 真实二进制 smoke test 通过；deterministic 模式完整 implement→test→review pipeline 集成测试可运行；后续需 staging 环境 BullMQ worker 长期运行验证
- **Enterprise Governance Center**：Audit Explorer、quota/concurrency、data retention 等产品面需要独立前端模块
