# 06 · v1 后置项

## 目的

明确哪些能力不进入第一版，避免主线被非核心功能拖慢。v1 的唯一主线是：

> 无登录提交 Issue -> Issue 入库 -> 使用 Loop 完成开发闭环。

## 后置项列表

| 能力 | 后置原因 | 建议阶段 |
| --- | --- | --- |
| Dofe SSO 登录 | 用户已明确第一版先不加入登录 | v1.1 |
| 用户角色/权限 | 依赖 SSO，v1 用 targetRepo 白名单保护 | v1.1 |
| 飞书 Issue 入口 | Web 表单足够验证主流程 | v1.2 |
| 飞书审批卡片 | 依赖飞书入口和用户映射 | v1.2 |
| 飞书反向通知 | Web 通知记录已可替代 | v1.2 |
| 真实远端 PR 打开 | GitAdapter 已有记录和 push 骨架，provider API 后置 | v1.3 |
| 多 Loop 并行 | v1 先单 Loop 或手动推进 | v1.3 |
| 独立 worker 池 | 当前 API 内置 Runner 足够验证闭环 | v1.3 |
| 完整并发隔离 | 已有 max_parallel 骨架，真实并发后置 | v1.3 |
| 标注看板筛选 | detail 页已有标注展示，筛选后置 | v1.2 |
| 完整 E2E/build 矩阵 | v1 先用 regression_commands 和 lint 门禁 | v1.2 |
| 生产级 agent 告警 | v1 先保证失败落日志和状态 | v1.3 |

## 保留但不扩展的能力

这些能力当前已有骨架，v1 可以继续保留，但不作为主交付目标：

- reloop 自动回环。
- max_reloop / max_shard_redo。
- cost guard。
- commit-per-shard。
- convergence PR record。
- notifications record。
- pause/resume/take。

## 后置项进入条件

只有当以下 v1 条件全部满足后，再进入后置项：

- Issue 入库稳定。
- Issue 队列可恢复。
- Loop 可从 DB Issue 启动。
- 最小闭环能 CLOSED。
- doctor 能发现 DB/file 不一致。
- API/Web 基础检查通过或阻断已明确归因。

