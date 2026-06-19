# Loops 实施标注（2026-06-19）

> 标注口径：本文件记录本轮代码实施后的真实状态。`done` 表示已落到代码且可调用；`partial` 表示 MVP 骨架已落地但仍有明确缺口；`not-started` 表示文档要求尚未实施。

## 总体状态

```yaml
target: loops-mvp
annotator: codex
round: 1
impl_status: in-progress
test_status: partial
verdict: needs-work
coverage: partial
location:
  - packages/contracts/src/schemas/loops.schema.ts
  - packages/contracts/src/api/loops.contract.ts
  - apps/api/src/modules/loops
  - apps/web/app/loops
  - scripts/loops-cli.ts
  - .loops/config.yaml
risk: medium
notes: 已完成 M0/M1 的 Web Issue、Spec 审核门禁、基础拆解、.loops 文件真相源、状态诊断/恢复、Test Matrix 派生、Implementation Record 登记、Runner 测试证据写入、Review Record 门禁、日志查询、成本熔断骨架、通知记录 MVP、人工介入 pause/resume/take 和标注看板骨架；Agent Adapter 已抽象但仍为确定性实现，真实 SSO、真实 Codex/Claude Code CLI、自动 Codex 审查、飞书真实发送、Git commit-per-shard 尚未完成。
```

## 已完成

| 文档要求                   | 状态    | 位置                                                                                                                                                                           | 说明                                                                                                                                                                    |
| -------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 共享 Zod Contract          | done    | `packages/contracts/src/schemas/loops.schema.ts`, `packages/contracts/src/api/loops.contract.ts`                                                                               | 定义 Issue/Intake/Spec/Shard/Annotation/State schema 与 `/loops` ts-rest contract。                                                                                     |
| Web Issue Intake           | done    | `apps/web/app/loops/new`, `apps/api/src/modules/loops`                                                                                                                         | 支持页面提交标题、目标仓库、正文、优先级、验收标准、mock submitter。                                                                                                    |
| `.loops/` 文件真相源       | done    | `.loops/config.yaml`, `apps/api/src/modules/loops/loops-file-store.service.ts`                                                                                                 | 写入 issues/intakes/specs/shards/annotations/state.json/log.jsonl。                                                                                                     |
| Issue 队列                 | done    | `apps/web/app/loops/page.tsx`                                                                                                                                                  | 展示 Issue、状态、Phase、优先级。                                                                                                                                       |
| Issue 详情与 Loop 进度     | done    | `apps/web/app/loops/[issueId]/page.tsx`                                                                                                                                        | 展示 intake、spec、state、shards、annotations。                                                                                                                         |
| Spec 生成骨架              | partial | `apps/api/src/modules/loops/loops.service.ts`                                                                                                                                  | 使用确定性 MVP 模板生成 Spec；尚未调用真实 CodexAdapter.plan。                                                                                                          |
| 人工审核门禁               | done    | `apps/web/app/loops/[issueId]/page.tsx`, `LoopsService.reviewSpec`                                                                                                             | 支持 approve/request-revision，未 APPROVED 时禁止 decompose。                                                                                                           |
| 基础拆解                   | partial | `LoopsService.decompose`                                                                                                                                                       | 生成 2 个 MVP Shard 与 DAG/annotations；尚未调用真实 CodexAdapter.decompose/designTests。                                                                               |
| 标注体系骨架               | partial | `.loops/annotations`, `apps/web/app/loops/[issueId]/page.tsx`                                                                                                                  | 已生成结构化 annotation 并展示；终态全量刷新尚未实现。                                                                                                                  |
| Agent Adapter 抽象         | partial | `apps/api/src/modules/loops/adapters`                                                                                                                                          | 已把 plan/decompose 抽象为 Adapter；当前实现为 deterministic，真实 CLI Adapter 待接入。                                                                                 |
| 状态诊断 API               | done    | `GET /loops/doctor`, `LoopsFileStoreService.doctor`                                                                                                                            | 能检查 `.loops` 根目录、state、issue/intake/spec/shards 文件一致性。                                                                                                    |
| 状态恢复 API               | done    | `POST /loops/resume`, `LoopsFileStoreService.resumeInterruptedLoops`                                                                                                           | 能将中断的 `IN_PROGRESS` / `TIMEOUT` shard 重置为 `TODO` 并写日志。                                                                                                     |
| 运维 CLI                   | done    | `scripts/loops-cli.ts`, `pnpm loops:status/doctor/resume`                                                                                                                      | 能从命令行查询状态、运行 doctor、恢复中断 shard。                                                                                                                       |
| Web 可观测增强             | partial | `apps/web/app/loops/page.tsx`, `apps/web/app/loops/[issueId]/page.tsx`, `GET /loops/logs`, `GET /loops/cost`, `GET /loops/notifications`, `pnpm loops:logs/cost/notifications` | 队列页展示 doctor 状态、Resume Interrupted、最近日志、最近通知、成本熔断概览；详情页展示 issue 事件流、通知记录与成本字段；实时推送仍待做。                             |
| Test Matrix 派生与展示     | partial | `.loops/tests/**/matrix.json`, `.loops/tests/**/matrix.md`, `apps/web/app/loops/[issueId]/page.tsx`                                                                            | decompose 后从 Shard testRequirements/acceptance 派生 ACTIVE Test Matrix，写入 JSON/Markdown，并在详情展示；真实 CodexAdapter.designTests 与测试设计复核待接入。        |
| Implementation Record      | partial | `.loops/runs/**/implementation.json`, `.loops/runs/**/implementation.md`, `POST /loops/issues/:issueId/shards/:shardId/implementation`                                         | 支持登记 shard 实施摘要、变更文件、备注，写入 JSON/Markdown，并在 Issue 详情展示；真实 Claude Code 自动实施与 diff 回收待接入。                                         |
| Runner 测试执行骨架        | partial | `apps/api/src/modules/loops/loops-runner.service.ts`, `POST /loops/issues/:issueId/shards/:shardId/tests`                                                                      | 能执行用户传入或默认测试命令，捕获 stdout/stderr/exitCode/duration 并生成 Test Record。                                                                                 |
| Test Record 存储与展示     | partial | `.loops/tests/**/records`, `apps/web/app/loops/[issueId]/page.tsx`                                                                                                             | 能写入 JSON/Markdown 测试证据并在 Issue 详情展示；覆盖率解析和 Codex 测试审查待接入。                                                                                   |
| Review Record 门禁         | partial | `.loops/runs/**/review.json`, `.loops/runs/**/review.md`, `POST /loops/issues/:issueId/shards/:shardId/review`                                                                 | 支持登记 PASS/NEEDS-WORK/FAIL 审查结论；PASS 前强制要求本轮 Implementation Record 与 TEST-PASS，满足后推进 Shard 到 DONE；真实 Codex 自动审查待接入。                   |
| 通知记录 MVP               | partial | `.loops/notifications/**`, `GET /loops/notifications`, `apps/web/app/loops/page.tsx`, `apps/web/app/loops/[issueId]/page.tsx`, `scripts/loops-cli.ts`                          | 已在 Issue 接收、Spec 待审、Loop 开始、成本熔断、人工介入、收敛就绪等节点记录 Web 通知 JSON/Markdown，并写 `NOTIFY_SENT` 日志；真实 Web 站内已读/推送和飞书发送待接入。 |
| 人工介入 pause/resume/take | partial | `POST /loops/issues/:issueId/interventions`, `apps/web/app/loops/[issueId]/page.tsx`, `scripts/loops-cli.ts`, `pnpm loops:pause/resume-loop/take`                              | 支持暂停整个 Loop、恢复 Loop phase、接管单个 Shard，并写入 `HUMAN_INTERVENE` 日志与 annotation；真实 agent 进程接管/释放、通知与 Git 工作流联动待接入。                 |

## 未完成

| 文档要求                                       | 状态        | 原因 / 下一步                                                                                                                                                                        |
| ---------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dofe SSO 真实登录校验                          | not-started | 当前使用 mock submitter；需接 `sso.dofe.ai` / `api.sso.dofe.ai`。                                                                                                                    |
| CodexAdapter / ClaudeCodeAdapter 真实 CLI 调用 | partial     | Adapter 边界已建立；需封装 headless CLI、schema 校验、超时重试。                                                                                                                     |
| Codex 测试设计复核                             | partial     | 已有派生 Test Matrix 真相源；需接 `CodexAdapter.designTests()` / `reviewTests()` 生成、复核并维护矩阵状态。                                                                          |
| 成本统计与熔断                                 | partial     | 已读取 `.loops/config.yaml` 的 token/call cap，提供 `GET /loops/cost` / `pnpm loops:cost`，超过阈值时暂停 Loop、写 `COST_TRIP` 并生成通知记录；真实 token 统计、外部告警发送待接入。 |
| Runner 执行层                                  | partial     | 已实现 Implementation Record 登记、测试命令运行、Test Record 与 Review Record 写入；agent 进程调度、超时重试、diff 自动回收待接入。                                                  |
| Shard 串行实施与审查闭环                       | partial     | 已支持人工/外部实施结果登记、测试执行与审查门禁，并可在 `TEST-PASS + Review PASS` 后推进 `IMPLEMENTED -> DONE`；真实 ClaudeCodeAdapter + 自动 Codex review 待接入。                  |
| 人工介入命令体系                               | partial     | 已实现 Web/API/CLI 的 pause、resume-loop、take，并写 `HUMAN_INTERVENE`；真实 agent 子进程暂停/接管、通知与审计策略待接入。                                                           |
| commit-per-shard                               | not-started | 需 GitAdapter 与审查 PASS 后提交策略。                                                                                                                                               |
| 回环、整体复查、终态标注                       | not-started | 属 M3 范围，本轮只完成基础标注骨架。                                                                                                                                                 |
| Feishu 入口与通知                              | partial     | 通知记录 MVP 已落地到 `.loops/notifications` 和 Web/CLI 查询；飞书入口、消息卡片审批、飞书反向发送仍按文档后置。                                                                     |

## 对路线图的准确标注

- M0：`partial`。产品骨架、`.loops`、Web/API 可用骨架、Adapter 抽象、CLI 运维命令已完成；真实 agent 调通仍未完成。
- M1：`partial`。Web Issue、审核台、基础拆解、状态恢复、Test Matrix 派生、Implementation Record 登记、Runner 测试证据、Review Record 门禁、标注骨架已完成；真实双 agent 串行实施、自动 Codex 审查、commit-per-shard 未完成。
- M2：`not-started`。
- M3：`not-started`。
- M4：`partial`。日志查询、doctor 状态、恢复入口、成本统计与 call/token 熔断骨架、通知记录 MVP、人工介入 pause/resume/take 已落地；真实 agent 进程暂停/接管、Web/飞书推送与 Git 集成未完成。
