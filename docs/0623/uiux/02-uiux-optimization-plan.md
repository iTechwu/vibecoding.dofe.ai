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
- preview 展示推荐 Agent 路径与建议测试策略；
- 现有创建提交流程不变；
- 单元测试覆盖上述状态。

### P0 · 新建 Issue 预览解释交付路径

状态：已实施。

问题：

- 原 preview 只展示标题、优先级、目标仓库和验收标准；
- 用户能看到“系统理解成什么 issue”，但不够清楚“系统会如何交付、用什么验证策略”。

优化：

- 为每个 simple template 绑定推荐 Agent 路径；
- 为每个 simple template 绑定建议测试策略；
- 在 preview 中展示 Agent path 与 test policy；
- feature 与 bugfix 路径已有组件测试覆盖。

### P1 · Dashboard exception card

状态：已实施 v2。

已落地：

- `buildExceptionCenter` 统一输出 cost guard、paused、global verdict、runtime diagnostics、doctor problems；
- 每个异常包含 reason、owner、recommended action、impact、retry action、evidence、evidence link、source；
- capacity 汇总 running、queued、attention、failed、capacity；
- `/loops` dashboard 已新增 Exception Center 区块；
- 已用 `loops-dashboard-model.test.ts` 和 `page.test.tsx` 覆盖。

后续增强：

- 后端 contract 可进一步提供权限模式、测试失败明细、re-loop limit 等更细结构化字段。

### P1 · Dashboard 性能快照

状态：已实施 v1。

已落地：

- `buildPerformanceSnapshot` 汇总 pass rate、redo rate、average calls、average tokens、trace events；
- `/loops` dashboard 已展示 Performance Snapshot 区块；
- 已用 `loops-dashboard-model.test.ts` 和 `page.test.tsx` 覆盖。

后续增强：

- 指标口径可在后端 contract 中固化；
- 可加入时间窗口、趋势变化和目标阈值。

### P1 · Dashboard 权限画像

状态：已实施 v1。

已落地：

- `buildPermissionProfile` 从 agent tool registry 汇总 agent、tool、active tool、planned compatibility；
- 权限模式按 read、write、shell/test、network、approval 展示；
- `/loops` dashboard 已展示 Permission Profile 区块；
- 已用 `loops-dashboard-model.test.ts` 和 `page.test.tsx` 覆盖。

后续增强：

- contract 可进一步提供环境级权限、审批策略和真实运行时限制；
- UI 可加入按 agent/tool 展开的详情视图。

### P1 · Detail 单 issue 异常卡片

状态：已实施 v1。

已落地：

- `LoopIssueDetailPage` 从现有 `detail.state` 与 runtime 匹配结果推导 issue-level exception；
- 暂停态展示 reason、owner、recommended action、phase/round evidence、runtime evidence；
- 异常卡片置于详情页行动侧栏顶部，和 Dashboard Exception Center 的阅读语言保持一致；
- 已用 `apps/web/app/loops/[issueId]/page.test.tsx` 覆盖。

后续增强：

- contract 可进一步提供真实 cost guard、权限异常、测试失败和 re-loop limit 分类；
- runtime diagnostics 可按 issue 聚合后展示多条异常来源。

### P1 · Spec diff review

状态：已实施 v1。

已落地：

- 后端 `LoopDetail` 已暴露 `specHistory`，读取 `.loops/specs/{issueId}/spec.*.json` 中已有的历史 snapshot；
- Detail 页在 Spec Review 中展示当前版相对上一版的 `added / removed / unchanged` 摘要；
- 摘要展示最多 3 条新增行与移除行，帮助 reviewer 快速判断 re-loop 后是否需要重读全文；
- contract schema、后端 revision smoke、前端 detail 组件测试均已覆盖。

后续增强：

- 可进一步按 acceptance criteria 结构化 diff；
- approve 可显式绑定 reviewer 审批的 spec version；
- diff 可支持展开完整上下文与文件级证据链接。

### P1 · Round-aware evidence view

状态：已实施 v1。

已落地：

- Detail 页的 implementation、review、test、global review 记录默认只展示当前 `detail.state.round`；
- Records 区显示当前轮次提示，并汇总被隐藏的历史记录数量；
- `LoopEvidenceArtifact` 已增加可选 `round` 元数据；
- 后端 evidence artifact 已为 implementation、test、review、global review 标注 round；
- Artifact Workspace 默认隐藏旧轮 artifact，并显示隐藏数量；
- 已用 `apps/web/app/loops/[issueId]/page.test.tsx` 覆盖旧轮次记录与旧轮 artifact 不会默认展示。

后续增强：

- requirements coverage 可进一步按 current round 与 historical trend 分开计算。
