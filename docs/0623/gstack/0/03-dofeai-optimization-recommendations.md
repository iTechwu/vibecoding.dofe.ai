# DofeAI 优化建议

## 1. 当前实施判断

结合本项目现有代码和 `docs/0623/gstack` 既有标注，DofeAI Loops 已经具备以下基础：

| 能力              | 当前状态                                                                            | 产品判断                                                              |
| ----------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Workflow Recipe   | 已有 contract/list/detail 派生、per-loop snapshot、delivery governance default 基础 | 需要 workspace 管理 UI 和新建默认应用闭环                             |
| Multi-review Gate | 已有 gate 派生、Review Inbox、override/waiver 审计                                  | 需要 per-loop required gates 配置和 release hard gate UI              |
| Browser QA Worker | 已有 report-only、Playwright、trace、visual artifacts、handoff 基础                 | 需要 authenticated profile、高级 visual regression、QA bug regression |
| Learning Memory   | 已有 learning 生成/召回/治理/相似建议/pending approval                              | 需要跨 workspace 索引和审批 UI                                        |
| Second Opinion    | 已有 Claude Code secondary worker、fingerprint comparison、policy                   | 需要冲突队列和 release 阻断体验                                       |
| Release Gate      | 已有 release readiness、PR evidence、canary checklist                               | 需要真实 canary/rollback worker 和阻断执行                            |
| Runtime Security  | 已有 shell/network/write 命令策略、policy snapshot、canary、override audit          | 需要 OS/container 级隔离和审批拦截                                    |

这说明当前产品已不是“概念验证”，而是进入“可信交付闭环补齐期”。下一步应少做展示型能力，多做 worker、DB/API 持久化、审批和 runtime enforce。

## 2. P0：Runtime Security 真实隔离

### 为什么优先

只靠命令字符串阻断无法覆盖所有网络和写入路径。只要 agent 能执行脚本，就可能绕过简单 pattern。要让 DofeAI 成为团队级控制面，runtime security 必须从“策略展示/命令前检查”升级为“执行环境强约束”。

### 建议范围

- 为 Codex CLI / Claude Code CLI worker 增加受控执行 profile：
  - `network=deny|allowlist|open-with-approval`
  - `writeScope=workspace|repo|artifact-only`
  - `secretMode=redacted|blocked`
- 在 worker 层接入 Docker/容器或 OS sandbox。
- 所有 override 必须先写入审批记录，再进入执行。
- 每次 Loop run 保存 policy snapshot、sandbox backend、effective permissions、canary result。

### 验收标准

- network deny 在执行层生效，而不只是阻断 `curl/npm/pnpm` 字符串。
- 跨 workspace 写入在执行层失败，并产生 audit evidence。
- human override 有操作者、原因、scope、过期时间和审批状态。
- release gate 能引用 runtime security evidence。

## 3. P0：Release Gate 真实阻断与 Canary Worker

### 为什么优先

gstack 的 `/ship` 和 `/canary` 强在把“完成代码”推进到“可发布”。DofeAI 当前已有 release checklist，但如果不能阻断发布或执行 canary，就仍然是 readiness dashboard。

### 建议范围

- 增加 `runReleaseCanary` worker：
  - 输入 target environment、target URL、risk level、rollback note。
  - 执行 smoke checks、Browser QA subset、runtime canary 检查。
  - 产出 canary report artifact。
- release hard gate：
  - required review 未通过时禁止 finalize/merge。
  - second opinion conflict 未处理时禁止 ship。
  - runtime security high risk 未审批时禁止 ship。
- PR summary 自动嵌入 release gate 结果。

### 验收标准

- 一个 Loop 在 blocker 未清除时无法进入 Ready to Ship 或 finalize。
- canary worker 的通过/失败影响 `LoopReleaseGate.canaryPassed`。
- rollback note 缺失时，高风险变更不能发布。

## 4. P1：Browser QA Worker 升级为产品 QA

### 为什么重要

gstack 的浏览器能力代表 AI coding 从“代码 diff”走向“用户实际看到的结果”。DofeAI 要成为交付控制面，就必须把 Browser QA 做成可复用、可审计、可回归的 worker 能力。

### 建议范围

- Authenticated session profile：
  - 不直接导入个人 cookie。
  - 支持测试账号、短期 token、session ref。
  - session 使用范围和过期时间必须可审计。
- Multi-viewport visual regression：
  - desktop/tablet/mobile baseline。
  - 阈值按 route/flow 配置。
  - diff artifact 可在 detail 页查看。
- Browser handoff：
  - 保存 target URL、title、screenshot、trace、console/network、last DOM snapshot。
  - 支持人类 QA 接手复核。
- QA bug regression：
  - Browser QA fail 可以生成 regression test candidate。

### 验收标准

- 同一 Loop 可运行多个 viewport 的 visual regression。
- 登录态 QA 不泄露个人 cookie，且 evidence 中只出现 session ref。
- Browser handoff artifact 能让人类 reviewer 快速复现。

## 5. P1：Learning & Decision Memory 治理闭环

### 为什么重要

记忆不是“存越多越好”。没有去重、审批、过期和跨 workspace 策略，learning 会变成噪声。gstack 的 learnings 给了方向，DofeAI 的机会是把它治理成团队知识资产。

### 建议范围

- Cross-workspace learning index：
  - 支持 workspace/repo/source/template scope。
  - 默认只召回同 repo，同组织范围需显式授权。
- Approval UI：
  - auto-merge candidates 必须人工 approve/reject。
  - 展示 source、target、similarity reason、evidence。
- Aging policy：
  - 长期未使用或低 confidence 的 learning 降权。
  - 被 conflict/revert 的 learning 标记为 risky。
- Decision memory：
  - 区分 temporary workaround、accepted decision、deprecated rule。

### 验收标准

- 新建 Loop preview 能召回跨 workspace 但同 repo/tag 的 approved learning。
- pending auto-merge 不会自动污染 recall。
- reviewer 可以在 UI 里合并、驳回、废弃 learning。

## 6. P1：Second Opinion 进入 Human Gate

### 为什么重要

Second Opinion 的价值不在“多跑一次模型”，而在发现 primary reviewer 的盲区。真正有产品价值的是冲突处理流。

### 建议范围

- 建立 conflict queue：
  - secondary-only high severity。
  - primary/secondary 同文件同区域相反判断。
  - security/runtime/release 类冲突。
- Release hard gate：
  - policy 开启时，未处理冲突阻断 release。
- Reviewer workspace：
  - 展示 Codex primary finding、Claude Code secondary finding、fingerprint、evidence。
  - 支持 accept primary、accept secondary、waive、request changes。

### 验收标准

- 高风险冲突进入 Review Inbox。
- 冲突未处理时 release checklist 显示 blocker。
- 所有人类决策都生成 waiver/decision evidence。

## 7. P2：Workflow Pack 与 Recipe Marketplace

### 为什么不是 P0

gstack 的命令密度很有吸引力，但 DofeAI 已经有较多 gate 和 worker 基础。过早建设 marketplace 可能让配置复杂度超过用户收益。

### 建议范围

- Workspace recipe admin：
  - feature/bugfix/refactor/docs/ops 默认 recipe。
  - 每类 recipe 显示 required gates 和 runtime owner。
- Team workflow pack：
  - 内置 `fast fix`、`risky release`、`frontend visual change`、`security sensitive change`。
- Import/export：
  - recipe 以 JSON/Zod schema 管理。
  - 支持从 repo policy 文件导入，但最终进入 DB/API 管理。

### 验收标准

- 新建 Loop 自动应用 workspace default recipe。
- recipe 变更不影响历史 Loop snapshot。
- admin 可以看到 recipe 使用率、阻断率、平均 cycle time。

## 8. P2：Loop Bench 与质量指标

### 为什么需要

竞品会越来越多，单纯展示“跑了多少 Loop”没有说服力。DofeAI 需要证明 agent 交付质量在变好。

### 指标建议

| 指标                         | 含义                            |
| ---------------------------- | ------------------------------- |
| First-pass review rate       | 首轮 review 通过率              |
| Browser QA regression rate   | 浏览器回归失败率                |
| Second opinion conflict rate | 二次审查冲突率                  |
| Release blocker rate         | 发布阻断率                      |
| Runtime violation rate       | runtime security 违规率         |
| Learning reuse rate          | learning 被召回并带来通过的比例 |

### 验收标准

- Dashboard 能按 workspace/repo/recipe 展示质量趋势。
- PR summary 能引用关键质量指标。
- Learning 是否有效可以被量化，而不是靠感觉。

## 9. 不建议做

- 不建议直接复制 gstack 的命令数量。DofeAI 的优势是结构化治理，不是命令表。
- 不建议把底层 runtime 泛化为所有 host。当前应坚持 Codex CLI + Claude Code CLI。
- 不建议把 Browser QA 登录态建立在个人 cookie import 上。
- 不建议让 auto-merge learning 自动生效，必须有审批。
- 不建议只靠前端状态派生标记 worker/runtime 能力完成。

## 10. 推荐路线

| 阶段   | 优先事项                                               | 结果                                 |
| ------ | ------------------------------------------------------ | ------------------------------------ |
| 0-2 周 | Runtime Security 执行层隔离、Release hard gate         | 从展示型安全变成 enforce             |
| 2-4 周 | Canary Worker、Second Opinion conflict queue           | 从 readiness 变成 release governance |
| 4-6 周 | Browser QA auth profile、多 viewport visual regression | 从 report-only 变成产品 QA           |
| 6-8 周 | Learning approval UI、cross-workspace index            | 从记忆存储变成知识治理               |
| 8 周后 | Recipe marketplace、Loop Bench                         | 从内部能力变成平台产品               |
