# 02 · UIUX 优化方案

## 设计目标

1. 降低首次创建 Loop 的认知成本；
2. 让每个禁用状态都能解释自己；
3. 保持 0622 已建立的产品语言：用户面对的是“可推进 / 需决策”，不是内部调度动作；
4. 用轻量改动获得可测试的 UX 改善，不扩大到后端 contract Epic。

## 本轮实施项

### P0 · 新建 Issue 提交状态可解释

状态：已实施。

问题：

- request 少于 10 字时，`Create Issue` 按钮禁用；
- 用户只能通过上方 hint 推断原因；
- 按钮区域没有统一告诉用户“现在还缺什么 / 已经可以提交”。

优化：

- 增加 `submitReadiness` 文案；
- 当 request 不足 10 字时显示剩余字符数；
- 当 workspace 缺失时显示 workspace 阻塞；
- 当输入和 workspace 都满足时显示 ready 状态；
- 用 `aria-live="polite"` 让状态变化可被辅助技术感知。

验收标准：

- request 为空或不足 10 字时，提交区显示明确原因；
- request 满足条件且 workspace 存在时，提交区显示 ready；
- workspace 缺失时，提交区显示 workspace 阻塞；
- 现有创建提交流程不变；
- 单元测试覆盖上述状态。

### P1 · Dashboard exception card

状态：已实施 v1。

已落地：

- `buildExceptionCenter` 统一输出 cost guard、paused、global verdict、runtime diagnostics、doctor problems；
- 每个异常包含 reason、owner、recommended action、evidence、source；
- capacity 汇总 running、queued、attention、failed、capacity；
- `/loops` dashboard 已新增 Exception Center 区块；
- 已用 `loops-dashboard-model.test.ts` 和 `page.test.tsx` 覆盖。

后续增强：

- 后端 contract 可进一步提供 impact、retry action、evidence links、权限模式、测试失败明细、re-loop limit 等结构化字段。

### P1 · Spec diff review

状态：后续 Epic。

理由：

- 需要保存上一版 spec snapshot；
- 前端才能展示新增、删除、变更的 acceptance criteria；
- 需要 approve 绑定 spec version 与 reviewer。

### P1 · Round-aware evidence view

状态：后续 Epic。

理由：

- 当前 artifact 缺少 round 元数据；
- UI 过滤前需要后端数据结构先可靠表达 current round。
