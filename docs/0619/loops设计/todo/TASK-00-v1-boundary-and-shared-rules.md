# TASK-00 · v1 边界与共享规则

## 任务目标

把所有后续 worktree 的共同边界固定下来，避免不同任务各自理解 v1 范围导致冲突。

## 背景

原始路线图偏向「SSO 登录 -> Web 提交 -> Loop 闭环」。当前 v1 调整为「先不加入登录，先完成提交 Issue 并存储到数据库，然后使用 Loop 完成开发」。

## 本任务范围

- 更新或补充文档中的 v1 统一口径。
- 明确 v1 主链路、后置项、共同验收标准。
- 不做业务代码实现。

## 应阅读文件

- `AGENTS.md`
- `CLAUDE.md`
- `docs/0619/loops设计/03-工作流设计.md`
- `docs/0619/loops设计/08-数据存储设计.md`
- `docs/0619/loops设计/09-实施路线图.md`
- `docs/0619/loops设计/IMPLEMENTATION-ANNOTATIONS.md`
- `docs/0619/loops设计/todo/README.md`

## 交付物

- 在本任务文档回填最终 v1 边界。
- 如发现原始设计文档存在明显冲突，在对应文档增加「v1 当前裁剪说明」，不要删除原始长期目标。

## 验收标准

- 所有 todo 任务都能引用同一条 v1 主链路。
- 文档明确写出 v1 不做登录/SSO/飞书/真实 PR。
- 文档明确 `.loops` 仍是文档真相源，DB 是查询索引与状态聚合来源。

## 禁止事项

- 不删除原始长期设计。
- 不把 SSO 或飞书作为任何 v1 任务的前置条件。
- 不把数据库改造成唯一真相源。

## 实施回填

- 状态：done
- 实施分支：main
- 关键改动：
  - 在 `03-工作流设计.md` 增加 v1 当前裁剪说明，明确 v1 主链路为无登录 Web Issue → DB 索引/状态聚合 + `.loops` 文档真相源 → Loop 开发 → 整体复查/终态标注 → CLOSED。
  - 在 Phase 0 / 0.5 补充 v1 不接入登录/SSO/飞书/CLI/API 多入口，提交人使用匿名或 mock submitter。
  - 在 `08-数据存储设计.md` 补充 v1 数据库存储边界，明确 DB 是查询索引与状态聚合来源，`.loops` 与 `log.jsonl` 仍为冲突裁决依据。
  - 在 `09-实施路线图.md` 补充 v1 裁剪主链路和 M1 验收调整，明确真实登录/SSO、权限角色、飞书、真实远端 PR、多 worker 生产级并发、生产级告警均后置。
- 验证命令：
  - `rg -n "v1 当前裁剪说明|无登录 Web|真实登录/SSO|数据库是查询索引|\\.loops" docs/0619/loops设计/03-工作流设计.md docs/0619/loops设计/08-数据存储设计.md docs/0619/loops设计/09-实施路线图.md docs/0619/loops设计/todo/TASK-00-v1-boundary-and-shared-rules.md`
- 验证结果：通过；相关文档均可检索到统一 v1 主链路、后置项、DB 与 `.loops` 真相源边界。
- 剩余风险：原始长期目标文档仍保留 SSO/飞书/PR 叙事，后续任务必须优先引用 v1 当前裁剪说明和 todo README，避免误把长期目标纳入 v1。
- 需要归档到 IMPLEMENTATION-ANNOTATIONS.md 的内容：
  - 2026-06-19 TASK-00 已完成 v1 边界固化：v1 不做真实登录/SSO/飞书/真实远端 PR；DB 只作为查询索引与状态聚合来源；`.loops` 和 `log.jsonl` 仍是文档真相源与冲突裁决依据。
