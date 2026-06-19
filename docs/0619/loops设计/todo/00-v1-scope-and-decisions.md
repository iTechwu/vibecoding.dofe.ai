# 00 · v1 范围与决策

## 背景

原始设计把「Dofe SSO 登录 → Web 提交 Issue → Loop 闭环」作为早期目标。但当前第一版本目标调整为：

> 先不加入登录。先完成提交 Issue 并存储到数据库，然后使用 Loop 完成对 Issue 的开发。非核心功能放到下一步。

因此 v1 的实现顺序需要从「身份优先」改为「数据入库 + Loop 闭环优先」。

## v1 必做

- 无登录 Web Issue 表单。
- 后端接收 Issue，做字段校验与 targetRepo 白名单校验。
- Issue / Intake / Loop 顶层状态写入数据库。
- `.loops` 继续保留完整文档证据与运行产物。
- Issue 队列从数据库索引读取，必要时补充 `.loops` detail。
- Issue 详情可以启动并推进 Loop。
- Loop 可完成对 Issue 的开发闭环：生成 Spec、审核、拆解、实施、测试、审查、整体复查、终态标注、关闭。
- CLI / Web 的 doctor、logs、notifications、cost 继续可用。

## v1 明确后置

- Dofe SSO 登录、用户权限、角色配置。
- 飞书入口、飞书消息卡片审批、飞书反向通知。
- 真实远端 PR 打开与 provider API。
- 多 Loop 并发队列和独立 worker 池。
- 完整标注看板筛选。
- 完整 E2E / build 矩阵策略。
- 生产级 Codex / Claude CLI 参数固化和告警策略。

## v1 身份策略

v1 不做登录，但仍保留可追溯字段，使用开发期占位身份：

```yaml
submitter:
  provider: dev
  user_id: dev-user
  name: Developer
source_channel: web
source_kind: web_form
```

后续接入 SSO 时，只替换 submitter 解析来源，不改变 Issue / Intake / Loop 主流程。

## 架构决策

| 决策 | v1 选择 | 原因 |
| --- | --- | --- |
| Issue 查询索引 | 数据库为主 | 满足产品化队列、筛选、状态聚合 |
| 文档证据 | `.loops` 为真相源 | 保留现有 Loop 文档协议、可审计、可恢复 |
| 写入策略 | DB + `.loops` 双写 | v1 不重写整个 LoopsFileStore，降低风险 |
| 登录 | 不做 | 用户明确要求第一版先跳过 |
| 权限 | targetRepo 白名单 + runner allowlist | 用执行边界保护替代用户权限 |
| API contract | Zod-first / ts-rest | 遵守仓库规范 |
| DB 访问 | 通过 DB Service 层 | 禁止 service/controller 直接 Prisma |

## 验收

- 新建 Issue 后，数据库中存在 Issue 与 Intake 记录。
- `.loops/issues`、`.loops/intakes`、`.loops/state.json` 同步生成对应证据。
- 刷新页面后 Issue 队列仍可从数据库恢复。
- 点击进入详情后可推进 Loop。
- Loop CLOSED 后数据库 Issue 状态同步为 `CLOSED`。

