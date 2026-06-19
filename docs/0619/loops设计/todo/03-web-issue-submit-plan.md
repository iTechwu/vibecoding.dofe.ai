# 03 · Web Issue 提交计划

## 目标

第一版 Web 不做登录，用户能直接提交 Issue，并能从队列进入详情、启动 Loop、查看开发进度。

## 页面范围

| 页面 | v1 行为 |
| --- | --- |
| `/loops` | Issue 队列、状态、phase、优先级、doctor 概览 |
| `/loops/new` | 无登录 Issue 表单 |
| `/loops/[issueId]` | Issue detail、Spec、Shards、records、logs、操作按钮 |

## 表单字段

必填：

- title
- targetRepo
- body
- priority
- acceptanceCriteria 至少 1 条

隐藏/默认：

```ts
submitterId = "dev-user"
submitterName = "Developer"
sourceChannel = "web"
sourceKind = "web_form"
```

## 表单校验

前后端都要校验：

- title 非空。
- targetRepo 非空且后端白名单通过。
- body 非空。
- acceptanceCriteria 至少一条非空。
- priority in `P0 | P1 | P2 | P3`。

## 用户流程

1. 打开 `/loops/new`。
2. 填写 Issue。
3. 提交。
4. 成功后跳转 `/loops/[issueId]`。
5. 页面显示：
   - Issue 原文。
   - DB 创建时间和提交人占位。
   - `.loops` raw payload ref。
   - 当前 phase。
   - 操作按钮：Generate Spec / Approve / Decompose / Run / Global Review / Finalize。

## v1 体验裁剪

- 不显示登录入口。
- 不显示 SSO 设置页。
- 不做用户角色判断。
- 提交人显示为 `Developer`。
- 飞书入口和附件上传不做。

## 状态反馈

提交成功：

- Toast: `Issue created`
- 跳转详情。

提交失败：

- 字段错误展示在表单旁。
- targetRepo 白名单错误展示为全局错误。

Loop 操作失败：

- 显示 API error message。
- 不吞错误；可去 logs 查看。

## 验收

- 无登录打开 `/loops/new` 可提交。
- 刷新 `/loops` 后新 Issue 仍存在。
- 详情页能看到 raw payload ref。
- 从详情页能推进 Loop。
- finalize 后队列里 Issue 状态变为 CLOSED。

