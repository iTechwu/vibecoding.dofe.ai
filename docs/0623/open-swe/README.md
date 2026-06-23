# Open SWE 竞品分析

项目：Open SWE  
GitHub：https://github.com/langchain-ai/open-swe  
定位：开源异步 coding agent / internal coding agent framework  
检索日期：2026-06-23

## 一句话判断

Open SWE 是 DofeAI Loops 最直接的竞品参照：它围绕“异步工程任务、计划、实现、测试、审阅、PR”构建，而不是单纯 IDE 内的聊天助手。

## 产品画像

Open SWE 的 GitHub 仓库描述为 “An Open-Source Asynchronous Coding Agent”。仓库由 LangChain 维护，截至本轮检索仍活跃，GitHub API 显示其主语言为 Python，star 量级约 10k。

它的产品心智接近：

- 从 GitHub issue 或 UI 触发任务；
- agent 异步研究代码库；
- 生成计划；
- 进入实现、测试、审阅；
- 输出 PR 或可审查变更。

## 与 DofeAI 的深度对比

| 维度      | Open SWE          | DofeAI 当前                     | 差距/机会                                          |
| --------- | ----------------- | ------------------------------- | -------------------------------------------------- |
| 默认入口  | GitHub issue / UI | Web issue intake / simple issue | DofeAI 需要补 GitHub issue 原生入口                |
| 人工 gate | plan approval     | Spec Review                     | 方向一致，DofeAI 可强化 diff/risk                  |
| 执行方式  | 异步 coding agent | 当前同步 `advance` 为主         | DofeAI 应迁移到队列 worker                         |
| 运行环境  | 云/沙箱倾向       | local CLI + Docker fallback     | DofeAI runtime 设计扎实，但缺 remote worker 产品化 |
| 交付物    | PR/patch          | `.loops` evidence + 可选 PR     | DofeAI 证据更强，但 PR 入口需更自然                |
| 团队协作  | issue/PR 驱动     | dashboard + detail              | DofeAI 应增强团队 inbox 和权限角色                 |

## 借鉴点

### 1. 异步优先

DofeAI 现在的 `advance` 已是正确接口，但仍偏同步。Open SWE 的定位说明市场会把“异步 coding agent”视为核心价值。

建议：

- 引入 `LoopAdvanceJob`；
- issue state changed 后自动 enqueue；
- worker 推进到 human gate / exception / final；
- UI 只展示状态和唤醒按钮。

### 2. Plan approval 需要变成高质量审阅体验

当前 Spec Review 可用，但二轮修改时用户仍需要读整份 Spec。

建议：

- Spec diff；
- risk summary；
- affected files/modules；
- changed acceptance criteria；
- approve with reviewer/version。

### 3. PR 是默认交付语言

DofeAI 的 `.loops` 证据是优势，但工程团队最终仍需要 PR。

建议：

- detail 页 Delivery 区把 PR 状态提升到一等位置；
- convergence record 与 PR checks 绑定；
- GitHub PR comment 自动写入 evidence summary。

## 对本项目的优化建议

| 优先级 | 建议                    | 验收                                                                              |
| ------ | ----------------------- | --------------------------------------------------------------------------------- |
| P0     | 队列化 `advance` worker | 后续 Epic：需要 BullMQ/锁/worker 重启恢复/SSE 设计                                |
| P0     | Spec diff review        | 已实施 v1：detail 页轻量 diff 摘要；结构化审批与完整上下文后续 Epic               |
| P1     | GitHub issue intake     | issue label/comment 可创建 Loop                                                   |
| P1     | PR evidence comment     | 后续 Epic：当前已有 convergence PR evidence，尚未自动写 PR comment                |
| P1     | Worker progress stream  | 已实施 v1：detail 页 Trace Timeline / Event Log 展示事件进度；SSE 实时流后续 Epic |

## 实施标注

2026-06-23 本轮已复核 detail 页进度可视化：`apps/web/app/loops/[issueId]/page.tsx` 已通过 Trace Timeline、Scope Summary 与 Event Log 展示现有 loop logs，`apps/web/app/loops/[issueId]/page.test.tsx` 已覆盖事件流渲染与重复事件 key 防护。因此 Worker progress stream 已闭合为文件态事件流 v1。另已确认 Spec diff review v1 基于现有 spec snapshots 展示当前版相对上一版的新增、删除、不变摘要和示例行；结构化 acceptance criteria diff、审批版本绑定与完整上下文展开属于后续增强。真正的异步 worker、SSE live stream、GitHub issue intake 和 PR evidence comment 仍需要跨后端队列、状态机、contract、git integration 的成套设计，标注为后续 Epic。

## 结论

Open SWE 验证了 DofeAI 的大方向：Spec gate + 异步 agent + PR 交付。DofeAI 的差异化应放在 evidence truth source、runtime 多后端、企业权限与异常决策中心。
