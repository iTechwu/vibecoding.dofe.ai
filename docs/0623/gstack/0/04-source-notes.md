# 来源与证据记录

日期：2026-06-23  
分析者：Codex  
分析范围：公开 GitHub 仓库 README/源码结构、项目现有 `docs/0623/gstack` 文档、本项目 Loops 代码路径。

## 1. 外部来源

| 对象      | URL                                       | 用途                             |
| --------- | ----------------------------------------- | -------------------------------- |
| gstack    | https://github.com/garrytan/gstack        | 核心竞品分析对象                 |
| Cline     | https://github.com/cline/cline            | IDE agent 对比                   |
| OpenHands | https://github.com/All-Hands-AI/OpenHands | agent runtime/sandbox 对比       |
| Aider     | https://github.com/Aider-AI/aider         | Git-native pair programming 对比 |
| Goose     | https://github.com/block/goose            | local agent/plugin/MCP 生态对比  |
| SWE-agent | https://github.com/SWE-agent/SWE-agent    | benchmark/research agent 对比    |

## 2. 本项目参考路径

| 路径                                                                | 用途                                                            |
| ------------------------------------------------------------------- | --------------------------------------------------------------- |
| `docs/0623/gstack/README.md`                                        | 既有 gstack 分析与 Epic 状态标注                                |
| `docs/0623/gstack/03-optimization-roadmap.md`                       | 已实施/后续能力边界                                             |
| `packages/contracts/src/schemas/loops.schema.ts`                    | Loop workflow/review/release/browser/learning/security contract |
| `packages/contracts/src/api/loops.contract.ts`                      | Loops API contract                                              |
| `apps/api/src/modules/loops/loops.service.ts`                       | Loops detail/list 派生与治理能力                                |
| `apps/api/src/modules/loops/loops-browser-qa-worker.service.ts`     | Browser QA worker                                               |
| `apps/api/src/modules/loops/loops-second-opinion-worker.service.ts` | Second Opinion worker                                           |
| `apps/api/src/modules/loops/loops-runner.service.ts`                | Runtime command policy 与 test runner                           |
| `apps/api/src/modules/loops/loops-file-store.service.ts`            | file-backed evidence/governance                                 |
| `apps/web/app/loops/page.tsx`                                       | Loops dashboard                                                 |
| `apps/web/app/loops/[issueId]/page.tsx`                             | Loop detail delivery controls                                   |

## 3. 分析边界

- 本轮曾尝试读取 GitHub raw README，但网络读取不稳定，因此外部事实以 GitHub 页面、既有来源笔记和公开仓库定位为准。
- 未在本地安装或运行 gstack，因此不评价其真实执行稳定性、浏览器性能、命令成功率。
- 对竞品的判断以产品定位和公开能力为主，不做逐行源码审计。
- 对 DofeAI 的判断基于当前工作区文件结构、既有文档状态和 Loops 相关代码路径；由于工作区已有大量未提交改动，本轮不回滚、不覆盖已有实现。

## 4. 关键假设

- DofeAI 的底层运行时边界应保持为 Codex CLI + Claude Code CLI。
- Codex 更适合作为 planner、primary reviewer、gate/release decision owner。
- Claude Code 更适合作为 implementer、secondary reviewer 和独立验证路径之一。
- gstack 的多 host 能力可作为竞品启发，但不应直接成为 DofeAI 当前阶段的实现目标。
- 团队级产品的核心差异不是更多 agent，而是可审计状态、证据、审批、策略和回归检测。

## 5. 本轮输出文件

- `docs/0623/gstack/0/README.md`
- `docs/0623/gstack/0/01-gstack-product-analysis.md`
- `docs/0623/gstack/0/02-competitive-matrix.md`
- `docs/0623/gstack/0/03-dofeai-optimization-recommendations.md`
- `docs/0623/gstack/0/04-source-notes.md`

## 6. 复审后续建议

2026-06-24 R7/R8 已闭合 gstack P0/P1/P2 主路径。若继续推进，不建议从新增文档或 UI 派生状态开始，而应优先选择以下非阻断的深度集成项：

- CI/CD provider webhook 深度集成、自动 rollback proposal 和发布后指标。
- Browser QA fail 自动生成 QA regression candidate。
- Learning Memory 的 evidence drilldown、lifecycle 质量指标和 DB 查询路径替换 file-backed worker。
- Second Opinion 的 finding 原文/evidence 工作台与更细粒度 conflict 分类。
- Runtime Security 的 network allowlist、writeScope overlay/mount 和执行层 override 审批细化。
