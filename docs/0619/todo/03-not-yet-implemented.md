# 未落实项（not-yet-implemented / 后置）

> 明确不在 v1 范围、按路线图后置到 v1.1+ 的能力。与 [`docs/0619/loops设计/todo/TASK-09-deferred-items-registry.md`](../loops设计/todo/TASK-09-deferred-items-registry.md) 保持一致。原始长期设计文档中的相关叙事保留，仅在 v1 裁剪说明中标注「后置」——不得作为 v1 验收项或 CLOSED 门槛。

| 能力                | 后置原因                              | 建议阶段 | 当前骨架状态                                                                      |
| ------------------- | ------------------------------------- | -------- | --------------------------------------------------------------------------------- |
| Dofe SSO 真实登录   | 第一版明确不加入登录                  | v1.1     | submitter 由服务端默认 `dev`；无登录守卫                                          |
| 用户角色/权限       | 依赖 SSO                              | v1.1     | 用 targetRepo 白名单 + 本地开发身份，无角色门禁                                   |
| 飞书 Issue 入口     | Web 表单覆盖主流程                    | v1.2     | 仅 Web 入口                                                                       |
| 飞书审批卡片        | 依赖飞书入口与用户映射                | v1.2     | Web 审核台覆盖人工门禁                                                            |
| 飞书反向通知        | v1 用 Web/CLI 通知记录                | v1.2     | `.loops/notifications` + Web/CLI 查询，无真实飞书发送                             |
| 真实远端 PR 打开    | provider API 后置                     | v1.3     | `GitAdapter` 骨架 + convergence PR record，默认 `commit_per_shard=false` 安全跳过 |
| 多 Loop 并行队列    | v1 先单 Loop/手动推进                 | v1.3     | 同进程 `max_parallel` 调度，无独立队列                                            |
| 独立 worker 池      | API 内置 Runner 足够验证              | v1.3     | `LoopsRunnerService` 内置，无 worker 隔离                                         |
| 完整 E2E/build 矩阵 | v1 先做最小冒烟 + regression commands | v1.2     | 文件侧 + live-DB jest 冒烟、`.loops/config.yaml` `tests.regression_commands`      |
| 生产级 agent 告警   | v1 先保证失败落日志/状态/通知可见     | v1.3     | 失败落 `log.jsonl` + 状态 + 通知记录                                              |

## 额外未落实（生产化，非 TASK-09 清单但需在上线前推进）

| 能力                                  | 现状                                                                                                                                                        | 建议                                                                              |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 真实 Codex / Claude Code CLI 生产可用 | `LOOPS_AGENT_MODE=cli` 切换 CLI Adapter，输出经 Zod schema 校验 + `max_retry` 受控重试 + 失败 fallback deterministic；但真实 CLI 版本/权限/生产稳定性未固化 | 上线前用真实 `codex` / `claude` CLI 在目标仓库跑通端到端，固化参数与重试/告警策略 |
| 真实 diff 自动回收                    | Implementation Record 的 `changedFiles` 目前由 adapter 产出或人工登记                                                                                       | 接入真实 git diff 自动回收 changedFiles                                           |
| 成本真实统计与外部告警                | 已读 token/call cap，plan/decompose/runLoop 后熔断；真实 token 统计与外部告警未接                                                                           | 接入真实 token 计量与告警通道                                                     |

## 允许保留的骨架（不计入 v1 必需验收）

CLI Adapter、commit-per-shard、convergence PR record、notifications record、`max_parallel` / `context_budget` / `max_reloop` / `max_shard_redo` 等运行时配置——代码中已有骨架，可保留，但不作为 v1 完成条件。
