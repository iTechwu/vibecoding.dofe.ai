# 03 · 简化 Issue 提交方案

## 当前问题

当前 Web issue 提交需要用户理解并填写：

- 标题；
- 目标仓库；
- 优先级；
- 需求正文；
- 验收标准。

这些字段对 Loops 后端是必要的，但对提交者不一定自然。用户经常只有一句话：“帮我修一下登录后跳转异常”或“给 agent runtime 加 Docker fallback”。字段过多会降低提交率，也会让用户把精力花在表单上，而不是表达真实意图。

## 推荐体验：简单模式优先

默认只展示三个输入：

| 字段                         | 必填 | 说明                                                    |
| ---------------------------- | ---- | ------------------------------------------------------- |
| `request`                    | 是   | 用户自然语言描述                                        |
| `workspaceId` / `targetRepo` | 是   | 默认使用当前 workspace，可切换                          |
| `template`                   | 否   | feature / bugfix / docs / refactor / integration / flow |

其余字段折叠到“高级设置”：

- 标题；
- 优先级；
- 验收标准；
- submitter；
- targetRepo 原始路径；
- context budget / agent preference。

## 前端表单结构

### 默认视图

```text
What do you want the agents to do?
[ 帮我为 Codex/Claude runtime 增加 Docker fallback，并在控制台显示诊断 ]

Workspace
[ vibecoding ▼ ]

Template
[ Auto ▼ ]

[Create issue]
```

### 高级设置

点击展开后展示：

```text
Title                 [自动生成，可编辑]
Priority              [P2 ▼]
Acceptance criteria   [自动生成，可编辑，多行]
Target repo           [当前 workspace root]
```

## 后端归一化

新增轻量请求 schema：

```ts
const CreateLoopIssueSimpleRequestSchema = z.object({
  request: z.string().trim().min(10).max(8000),
  workspaceId: z.string().trim().min(1).optional(),
  targetRepo: z.string().trim().min(1).optional(),
  template: z
    .enum(['auto', 'feature', 'bugfix', 'docs', 'refactor', 'integration', 'flow'])
    .default('auto'),
  priority: LoopPrioritySchema.optional(),
  title: z.string().trim().min(4).max(160).optional(),
  acceptanceCriteria: z.array(z.string().trim().min(1)).optional(),
});
```

后端归一化为现有 `CreateLoopIssueRequest`：

```ts
{
  title: generatedOrProvidedTitle,
  targetRepo: resolvedWorkspaceRoot,
  body: normalizedBody,
  priority: providedOrSuggestedPriority,
  acceptanceCriteria: generatedOrProvidedCriteria
}
```

## 标题生成规则

不必一开始调用 LLM；先用确定性规则：

1. 取第一行或第一句；
2. 去掉“帮我”“请”“需要”等口语前缀；
3. 超过 80 字截断；
4. 根据 template 补动词：
   - bugfix：`Fix ...`
   - feature：`Add ...`
   - docs：`Document ...`
   - refactor：`Refactor ...`

当用户展开高级设置时允许手动改。

## 验收标准生成规则

根据模板给默认草案，用户可编辑：

### bugfix

- 已复现并描述根因；
- 修复后复现路径通过；
- 增加或更新回归测试；
- 未改变无关行为。

### feature

- 核心路径可端到端使用；
- 覆盖加载、成功、错误状态；
- 后端/API contract 有测试；
- 前端页面易理解且可操作。

### integration

- 本机缺失依赖时有明确 fallback；
- 外部失败有可操作诊断；
- 敏感信息不进入日志；
- smoke check 覆盖成功和失败路径。

### flow

- 状态转换覆盖成功、暂停、失败、恢复；
- 人工介入点清晰可见；
- 运行状态和诊断可追踪；
- 恢复行为有证据记录。

## Template auto 推断

简单关键词即可，不需要复杂模型：

| 命中词                                | template    |
| ------------------------------------- | ----------- |
| 修复、bug、异常、失败、报错           | bugfix      |
| 文档、说明、方案、ADR                 | docs        |
| 重构、简化、清理                      | refactor    |
| 接入、集成、Docker、CLI、外部服务     | integration |
| workflow、状态机、恢复、agent runtime | flow        |
| 其他                                  | feature     |

## API 路径选择

推荐新增：

```http
POST /loops/issues/simple
```

原因：

- 不破坏现有 `POST /loops/issues`；
- 前端可以逐步切换；
- 后端仍复用 `createIssue()` 的权限、审计和落盘逻辑；
- 高级用户和 CLI 仍可用完整 schema。

## 前端校验

简单模式只阻止两类输入：

- request 太短；
- 没有可用 workspace / target repo。

其他缺失字段由后端归一化。

## 验收标准

- 用户只填一句需求 + workspace 即可提交 issue。
- 提交后 detail 页显示完整 title/body/acceptance criteria。
- 高级设置展开后可覆盖自动生成字段。
- 现有完整 issue API 不破坏。
- SSO submitter 仍由后端从登录用户派生，不能由前端伪造。
