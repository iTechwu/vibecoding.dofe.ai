# 01 · 前端产品结构深度审查

## 审查对象

- `apps/web/app/loops/page.tsx`
- `apps/web/app/loops/new/simple-loop-issue-form.tsx`
- `apps/web/app/loops/[issueId]/page.tsx`
- `apps/web/app/loops/loops-dashboard-model.ts`
- `apps/web/locales/{en,zh-CN}/loops.json`
- `docs/0622/pm-opz/*`

## 信息架构现状

当前 Loops 前端由三条主路径组成：

| 路径               | 当前角色               | 用户心智                                                 |
| ------------------ | ---------------------- | -------------------------------------------------------- |
| `/loops`           | Dashboard / 控制平面   | 我有哪些 Loop 需要关注、推进或审阅                       |
| `/loops/new`       | 简单 Issue 录入        | 我用一句话提交目标，让系统生成结构化 Issue               |
| `/loops/[issueId]` | Loop 详情 / 证据工作台 | 当前 Loop 到哪一步、谁在执行、下一步是什么、证据是否完整 |

这套结构基本符合 0622 产品原则：用户不需要直接操作 shard 或内部 phase，而是围绕“提交意图、批准关键判断、获得证据”完成交付。

## 用户旅程审查

### 1. 新建 Issue

优点：

- 简单模式已成为默认入口；
- request 是唯一主输入；
- workspace/template 被压缩为辅助配置；
- preview 使用共享 normalise 逻辑，降低“创建后才知道系统理解错了”的风险；
- preview 已展示推荐 Agent 路径与建议测试策略，让用户在创建前理解系统将如何交付与验证；
- advanced settings 默认折叠，符合渐进披露。

主要断点：

- 创建按钮在 request 少于 10 字时禁用，但按钮附近缺少明确原因；
- request hint 在输入前后都相同，不能告诉用户“还差多少”或“现在可提交”；
- workspace 缺失有错误文案，但提交区没有统一的就绪状态。

### 2. Dashboard

优点：

- Action Queue 与 Review Inbox 已按 0622 P0 调整，不再把自动 resume/finalize 误呈现为人工接管；
- runtime detection、risk queue、aging queue、trace summary 已形成运维视角；
- metric cards 能快速回答活跃数、执行中、注意项、成本余量。
- Delivery Guide v1 已提供创建、审阅、异常、证据四步阅读路径；
- Performance Snapshot v1 已把通过率、返工率、平均调用、平均 tokens、trace 事件做成可扫描指标；
- Permission Profile v1 已把 agent/tool 权限压缩为 read/write/shell/network/approval 五类状态。

主要断点：

- Dashboard 已有新手引导 v1；后续仍可根据真实用户行为优化排序与个性化提示；
- `Resume Interrupted` 是全局动作，和每个 Loop 的 `Continue loop` 心智仍有轻微差异；
- risk queue 和 review inbox 的边界已变清晰，Exception Center v2 已统一异常卡片，并补齐 impact、retry action、evidence link 级阅读字段。

### 3. Detail

优点：

- 顶部清晰展示 issue/status/phase/round/spec/shard/cost；
- execution 区把 phase、agent、runtime、active shard 放在第一屏；
- Spec Review、requirements coverage、artifact workspace、trace timeline 形成完整证据链；
- next action 的判断逻辑已经收敛为单主动作。

主要断点：

- implementation/test/review/global review 记录已默认过滤到 current round；artifact workspace 已通过 artifact round 元数据默认过滤到当前轮；
- re-loop 后 Spec diff 已有 v1 摘要，用户可先查看当前版相对上一版的新增、删除、不变行数与示例行；
- Detail 页已提供单 issue 异常卡片 v1；Dashboard Exception Center 已补齐 impact、retry action、evidence link 级阅读字段。

## UIUX 优先问题分级

| 优先级 | 问题                                      | 影响                           | 本轮状态  |
| ------ | ----------------------------------------- | ------------------------------ | --------- |
| P0     | `/loops/new` 关键提交按钮禁用原因不够显性 | 新用户可能不知道为什么不能创建 | 已实施    |
| P0     | `/loops/new` 预览缺少交付与验证解释       | 用户无法在创建前判断执行路径   | 已实施    |
| P1     | Dashboard 缺少统一 exception card         | 阻塞原因、责任人与恢复动作分散 | 已实施 v1 |
| P1     | Dashboard 缺少性能快照                    | 难以快速判断交付健康度         | 已实施 v1 |
| P1     | Dashboard 缺少权限画像                    | agent/tool 权限不够可扫描      | 已实施 v1 |
| P1     | Detail 缺少单 issue 异常卡片              | 用户进入详情后难以快速定位阻塞 | 已实施 v1 |
| P1     | Spec diff review 缺失                     | re-loop 后审阅成本高           | 已实施 v1 |
| P1     | Evidence 缺少 current round 默认过滤      | 多轮后旧证据可能误导           | 已实施 v1 |
| P2     | Dashboard 新手引导弱                      | 信息密度高，首次使用成本偏高   | 已实施 v1 |
