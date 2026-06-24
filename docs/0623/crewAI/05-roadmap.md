# 05 · 30/60/90 天路线图

## 路线图原则

1. 不重造 CrewAI/LangGraph 底层 framework。
2. 不先做大而全 marketplace。
3. 优先把现有 Loops 底座包装为可理解、可复用、可治理的产品对象。
4. 每个阶段都要能产生用户可见价值和工程验收。

## 0-30 天：产品包装和质量门禁

目标：让 DofeAI 从“内部 loop 状态机”变成“软件交付 workforce”。

### 交付 1：Workforce Overview v1

状态：✅ 已完成（R1）。9 persona 映射 + Dashboard Workforce 区块 + Detail Agent Handoff Timeline。

### 交付 2：Runtime Backend Panel v1

状态：✅ 已实施。前端 Eval Plan v1 已上线；后端 Eval Suite / Eval Run contract v1 已上线；R13 已补齐 request-time evidence aggregation，可从现有 Loop evidence 派生 suite 计数、run checkResults 与 score。

范围：

- 将现有 agent-runtime detection 包装为 Runtime Backends；
- 显示 Codex/Claude、本地/Docker、版本、认证、健康、workspace mount；
- Detail 页显示 actual backend。

验收：

- backend unavailable 会出现在 Dashboard；v1 已能展示 ready/degraded/unavailable；
- runtime override 有 audit；
- backend health 可被用户手动刷新；现有 runtime detection retry 保留在 Agent Runtime 区块。

### 交付 3：Eval Plan v1

状态：已实施。

范围：

- 定义内置 Eval checks；
- 新建页显示 Eval Plan；
- Detail 页显示 Eval Results；
- 先接现有 test/review/global evidence。

验收：

- finalize 前能看到 hard gate；v1 已在 Dashboard 显示 hard gate；
- 架构规则检查可以作为 check result 展示；v1 已按现有 Loop evidence 给出 attention/blocked 派生结果；
- failed check 能进入 Exception Center；R14 已将 failed/attention eval hard gate 结构化接入 Dashboard Exception Center。

## 31-60 天：可复用自动化资产

目标：从“每次创建一个 issue”升级为“使用 blueprint 创建可治理 delivery loop”。

### 交付 4：Blueprint Marketplace v1

范围：

- Bugfix、API Endpoint、UI Feature、Refactor、Security Patch、Dependency Upgrade、Documentation；
- blueprint 包含 intake questions、persona sequence、runtime policy、eval suite、evidence template；
- `/loops/new` 支持选择 blueprint。

验收：

- 不同 blueprint 有不同默认 eval checks；
- blueprint version 写入 Loop baseline；R15 已通过 workflowRecipe.baselineEvidence 写入创建时蓝图基线；
- Dashboard 可按 blueprint 过滤成功率/失败率。

### 交付 5：Invent Delivery Loop v1

状态：✅ 已部分完成。`/loops/new` 已显示 Workforce / Runtime / Eval / Risk-Gate preview；Dashboard 已新增 Delivery Flow Pipeline（P1-1）把完整 Loops 状态机产品化为 10 步交付管道。R15 已将创建时 baseline evidence 写入 workflowRecipe，并在 Loop detail Delivery Controls 中展示。

范围：

- 用户输入一句话；
- 生成 Issue Summary、Workforce Plan、Runtime Plan、Tool Plan、Eval Plan、Risk/Gate Plan；
- preview 可编辑；
- 创建后写入 baseline evidence；R15 已完成 blueprint/runtime/eval/gate baseline evidence。

验收：

- 创建前用户知道谁做、用什么做、如何验收、哪里等人；
- 生成结果可回放；
- risk/gate 会影响后续流程。

### 交付 6：PR Evidence v1

状态：✅ v2 已完成。已提供 Delivery Evidence detail 区块、后端 getDeliveryEvidence endpoint，以及 finalize 后 PR evidence comment 自动发布。R10 已新增 CI Checks Registry 控制面；R17/R23 已接入 GitHub Checks API check-run 发布与 publication artifact。

范围：

- finalize 输出 `delivery-evidence.md`；
- PR provider 创建/更新 evidence comment；
- PR status 在 Loop detail 中成为一等信息。

验收：

- 每个 finalized Loop 有可审查 evidence；
- evidence 包含 spec、work packages、test、review、global verdict、risk、cost；
- PR comment 可追溯回 DofeAI Loop。

## 61-90 天：事件驱动和企业控制面

目标：从手动使用升级为团队级运行平台。

### 交付 7：Trigger Contract v2

范围：

- Manual trigger object；
- Webhook trigger；
- Schedule trigger；
- GitHub issue trigger；
- retry、replay、dead-letter、audit。

验收：

- webhook 签名校验；
- failed trigger 可重放；
- trigger 暂停后不再创建 Loop；
- trigger run 与 Loop 可双向追溯。

### 交付 8：Tool & Integration Registry v1

范围：

- Git、PR provider、test runner、browser、Docker、Codex CLI、Claude Code CLI、MCP；
- tool schema、permission、health、smoke test、audit；
- runtime compatibility。

验收：

- 创建 Loop 前能知道需要哪些工具；
- tool 不健康会阻止或警告执行；
- tool 使用记录可审计。

### 交付 9：Engineering Agent Control Plane v1

范围：

- fleet health；
- runtime spend；
- eval trend；
- trigger health；
- human gate inbox；
- audit explorer；
- rules center v1。

验收：

- 管理者能看到 24h/7d/30d 的交付健康；
- 能按 repo/blueprint/runtime/backend 查看失败；
- 能启用至少 3 条组织级 rules；
- cost/quota 超限能触发告警或暂停。

## 后续 90 天之后

| 方向                 | 内容                                                                                                            |
| -------------------- | --------------------------------------------------------------------------------------------------------------- |
| Remote Runner        | Pool/lease/job + artifact manifest provider v1 已完成；后续接分布式 queue、sandbox worker、外部 artifact upload |
| Enterprise RBAC      | SSO Asset Permissions v1 已完成；runtime backend/MCP/CI/Remote Runner 写操作已接硬门禁                          |
| Skills Ecosystem     | DofeAI Loops skills for Codex/Claude/Cursor                                                                     |
| Marketplace          | 内部 blueprint 分享、评分、版本、回滚                                                                           |
| Release Intelligence | merge 后质量、回滚、incident 关联                                                                               |
| Multi-repo Delivery  | 跨 repo spec、依赖图、PR 编排                                                                                   |

## 风险和缓解

| 风险                | 表现                            | 缓解                                         |
| ------------------- | ------------------------------- | -------------------------------------------- |
| 抽象过早膨胀        | schema 大改、页面复杂           | 前 30 天先推导展示，不强迁移                 |
| 误入通用 agent 平台 | 与 CrewAI/Relevance AI 正面竞争 | 坚持软件交付垂直指标                         |
| Runtime 不稳定      | Codex/Claude CLI 本地状态不可控 | Runtime Backend Registry + health + fallback |
| Eval 流于展示       | failed checks 不影响流程        | hard gate 必须阻止 finalize                  |
| PR 集成被延后       | 证据留在平台内                  | PR Evidence v1 放到 60 天内                  |
