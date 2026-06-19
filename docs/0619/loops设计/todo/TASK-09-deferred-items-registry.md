# TASK-09 · 后置项登记

## 任务目标

明确哪些能力不进入 v1，防止其他 worktree 在实施主线时误把非核心功能纳入范围。

## 依赖

- 依赖 `TASK-00` 的 v1 边界。

## v1 后置项

| 能力 | 后置原因 | 建议阶段 |
| --- | --- | --- |
| Dofe SSO 登录 | 用户已明确第一版先不加入登录 | v1.1 |
| 用户角色/权限 | 依赖 SSO，v1 先用 targetRepo 白名单和本地开发身份 | v1.1 |
| 飞书 Issue 入口 | Web 表单足够验证主流程 | v1.2 |
| 飞书审批卡片 | 依赖飞书入口与用户映射 | v1.2 |
| 飞书反向通知 | v1 可先用 Web/CLI 通知记录 | v1.2 |
| 真实远端 PR 打开 | GitAdapter 骨架可保留，provider API 后置 | v1.3 |
| 多 Loop 并行队列 | v1 先保证单 Loop 或手动推进闭环 | v1.3 |
| 独立 worker 池 | 当前 API 内置 Runner 足够验证闭环 | v1.3 |
| 完整 E2E/build 矩阵 | v1 先做最小冒烟与 regression commands | v1.2 |
| 生产级 agent 告警 | v1 先保证失败落日志和状态可见 | v1.3 |

## 允许保留的骨架

以下能力若代码中已有骨架，可以保留，但不得作为 v1 必须完成项：

- CLI Adapter。
- commit-per-shard。
- convergence PR record。
- notifications record。
- max_parallel / context_budget / max_reloop 等运行时配置。

## 验收标准

- 后置项在 todo 与最终归档中保持一致。
- 其他任务没有把后置项作为必需验收。
- 原始设计文档中的长期目标不被删除，只标明 v1 裁剪。

## 禁止事项

- 不在 v1 中新增 SSO 登录依赖。
- 不在 v1 中强制配置飞书。
- 不要求真实远端 PR 创建才能 CLOSED。

## 实施回填

- 状态：done
- 实施分支：main
- 关键改动：
  - 后置项清单明确列出 Dofe SSO、用户角色/权限、飞书入口/审批/通知、真实远端 PR、多 Loop 并行、独立 worker、完整 E2E/build 矩阵、生产级 agent 告警。
  - `03-工作流设计.md`、`08-数据存储设计.md`、`09-实施路线图.md` 已写入 v1 裁剪说明，避免误纳入 v1。
- 验证命令：
  - `rg -n "真实登录/SSO|飞书|真实远端 PR|多 worker|后置" docs/0619/loops设计 docs/0619/loops设计/todo/TASK-09-deferred-items-registry.md`
- 验证结果：通过；后置项在 todo 与设计文档 v1 裁剪说明中一致。
- 剩余风险：`10-决策与开放问题.md` 仍保留长期 ADR 叙事；阅读时必须结合 v1 裁剪说明和 TASK-09。
- 需要归档到 IMPLEMENTATION-ANNOTATIONS.md 的内容：
  - TASK-09 最终状态为 done：SSO、飞书、真实 PR、多 worker 等保持后置，不作为 v1 当前验收。
