# Loops v1 Worktree Tasks

> 这些文档不是总体方案说明，而是可分发给多个 Codex worktree 的小任务包。每个 `TASK-xx` 都应能被一个独立 worktree 领取、实施、验证、回写状态，最后由 `TASK-08` 统一归档。

## v1 方向

第一版本先不加入登录。主线只保留：

```text
无登录 Web 提交 Issue
  -> Issue / Intake / LoopState 存储到数据库
  -> 使用现有 Loop 流程完成开发
  -> 整体复查与终态标注
  -> Issue CLOSED
```

SSO、权限角色、飞书、真实远端 PR 打开、多 worker 并发、完整 E2E/build 矩阵、生产级告警都不进入 v1 主交付。完整清单以 [TASK-09 后置项登记](TASK-09-deferred-items-registry.md) 为准。

## v1 后置项 Registry

以下能力允许在长期设计文档中保留，也允许代码中存在 MVP 骨架或本地记录，但不得作为 v1 前置条件、必需验收项或 CLOSED 门槛：

| 能力 | v1 处理口径 | 建议阶段 |
| --- | --- | --- |
| Dofe SSO 登录 | 使用无登录 Web 表单或 mock submitter；不要求真实 session/token | v1.1 |
| 用户角色/权限 | 使用 targetRepo 白名单和本地开发身份；不引入角色权限门禁 | v1.1 |
| 飞书 Issue 入口 | Web 表单覆盖主流程；飞书入口只保留长期目标 | v1.2 |
| 飞书审批卡片 | Web 审核台覆盖 v1 人工门禁 | v1.2 |
| 飞书反向通知 | Web/CLI 通知记录覆盖 v1 可观测需求 | v1.2 |
| 真实远端 PR 打开 | 可生成 convergence PR record；不要求 provider PR 创建 | v1.3 |
| 多 Loop 并行队列 | 先保证单 Loop 或手动推进闭环 | v1.3 |
| 独立 worker 池 | API 内置 Runner 骨架覆盖 v1 验证 | v1.3 |
| 完整 E2E/build 矩阵 | 使用最小冒烟与 `tests.regression_commands` | v1.2 |
| 生产级 agent 告警 | 失败落日志、状态和通知记录即可 | v1.3 |

## 任务分发顺序

| 任务 | 文档 | 建议 worktree | 依赖 | 目标 |
| --- | --- | --- | --- | --- |
| 00 | [TASK-00-v1-boundary-and-shared-rules.md](TASK-00-v1-boundary-and-shared-rules.md) | `loops-v1-boundary` | 无 | 固定所有任务共同边界与禁止事项 |
| 01 | [TASK-01-db-schema-and-db-service.md](TASK-01-db-schema-and-db-service.md) | `loops-v1-db` | 00 | 增加 Loops 数据库模型与 DB Service |
| 02 | [TASK-02-contract-and-api-surface.md](TASK-02-contract-and-api-surface.md) | `loops-v1-contract-api` | 00 | 调整 contract/API，使无登录 Issue 入库链路清晰 |
| 03 | [TASK-03-persistence-dual-write.md](TASK-03-persistence-dual-write.md) | `loops-v1-persistence` | 01, 02 | 封装 DB + `.loops` 双写和状态同步 |
| 04 | [TASK-04-web-no-login-issue-flow.md](TASK-04-web-no-login-issue-flow.md) | `loops-v1-web` | 02 | 优化 Web 无登录提交、队列、详情入口 |
| 05 | [TASK-05-loop-lifecycle-db-sync.md](TASK-05-loop-lifecycle-db-sync.md) | `loops-v1-lifecycle` | 03 | 让 Loop 关键阶段同步 DB 状态 |
| 06 | [TASK-06-doctor-and-consistency-checks.md](TASK-06-doctor-and-consistency-checks.md) | `loops-v1-doctor` | 03, 05 | 增加 DB 与 `.loops` 一致性诊断 |
| 07 | [TASK-07-smoke-tests-and-quality-gate.md](TASK-07-smoke-tests-and-quality-gate.md) | `loops-v1-tests` | 03, 04, 05, 06 | 补齐 v1 冒烟验证和质量门禁说明 |
| 08 | [TASK-08-final-doc-annotation-and-archive.md](TASK-08-final-doc-annotation-and-archive.md) | `loops-v1-archive` | 01-07 | 合并后统一标注文档与归档实现情况 |
| 09 | [TASK-09-deferred-items-registry.md](TASK-09-deferred-items-registry.md) | `loops-v1-deferred` | 00 | 记录后置项，避免误纳入 v1 |

## 并行建议

- 第一批：`TASK-00`、`TASK-09` 可先做，`TASK-01` 与 `TASK-02` 可并行。
- 第二批：`TASK-03` 依赖 `TASK-01/02`，`TASK-04` 依赖 `TASK-02`，两者可并行。
- 第三批：`TASK-05` 依赖 `TASK-03`，`TASK-06` 依赖 `TASK-03/05`。
- 第四批：`TASK-07` 做整体验证，`TASK-08` 做最终文档标注和归档。

## 每个 worktree 的交付格式

每个任务完成时，在对应 `TASK-xx` 文档末尾更新：

```markdown
## 实施回填

- 状态：done / partial / blocked
- 实施分支：
- 关键改动：
- 验证命令：
- 验证结果：
- 剩余风险：
- 需要归档到 IMPLEMENTATION-ANNOTATIONS.md 的内容：
```

## 全局工程规则

- API 请求/响应必须 Zod-first，经 `packages/contracts` contract 暴露。
- API/Service 层不得直接访问 Prisma；数据库访问只能在 DB Service 层。
- 外部 API 调用只能通过 Client/Adapter 层。
- 生产代码不得使用 `console.log` 或 NestJS 内置 Logger，统一使用项目 Winston logger。
- 不在 v1 引入真实登录、飞书入口、真实 provider PR 创建。
- 不破坏现有 `.loops` 文件真相源；v1 是 DB 索引 + `.loops` 文档证据并存。
