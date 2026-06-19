# Loops v1 Todo Plan

> 目标调整：第一版本先不加入登录。优先完成「提交 Issue 并存储到数据库，然后使用 Loop 完成对 Issue 的开发」。SSO、飞书、真实 PR 打开、完整并发 worker 等非核心能力后置。

## 文档索引

| 顺序 | 文档 | 目标 |
| --- | --- | --- |
| 00 | [00-v1-scope-and-decisions.md](00-v1-scope-and-decisions.md) | 固定 v1 范围、裁剪项、验收边界 |
| 01 | [01-database-persistence-plan.md](01-database-persistence-plan.md) | 设计 Issue/Intake/Loop 的数据库入库与 DB Service 边界 |
| 02 | [02-api-contract-service-plan.md](02-api-contract-service-plan.md) | 规划 contracts、API、service、文件真相源与 DB 索引的协作 |
| 03 | [03-web-issue-submit-plan.md](03-web-issue-submit-plan.md) | 规划无登录 Web 提交、队列、详情入口 |
| 04 | [04-loop-development-flow-plan.md](04-loop-development-flow-plan.md) | 规划从 DB Issue 启动 Loop 并完成开发闭环 |
| 05 | [05-verification-and-release-plan.md](05-verification-and-release-plan.md) | 规划验收、冒烟、回归与发布检查 |
| 06 | [06-deferred-non-core-items.md](06-deferred-non-core-items.md) | 明确后置项，避免污染 v1 主线 |

## v1 成功定义

- 用户无需登录即可在 Web 页面提交 Issue。
- Issue 与 Intake 至少写入数据库，并保留 `.loops` 原始 payload / 文档证据。
- Issue 队列与详情从 API 可查询，状态可反映 Loop 进展。
- 用户能从 Issue 详情启动或推进 Loop。
- Loop 能完成：Spec 生成、审核、拆解、实施、测试、审查、整体复查、终态标注、关闭 Issue。
- 失败时可见：错误落日志、状态不静默、可重新推进或人工介入。

## 当前实现基线

- 已有 `/loops` contract、NestJS Loops module、Next.js Loops 页面、`.loops` 文件真相源。
- 已有 runLoop / reviewGlobal / reloop / finalize 等编排骨架。
- 已有 Runner allowlist、coverage floor、targetRepo 白名单、max_parallel、context_budget、global regression 等保护。
- 主要缺口：Issue 尚未按产品化要求写入数据库；当前仍以 `.loops` 文件为主索引；登录/SSO 当前按 mock submitter 或后置处理。

