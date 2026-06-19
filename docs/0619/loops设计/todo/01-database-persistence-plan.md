# 01 · 数据库入库计划

## 目标

为 v1 补齐 Issue 提交后的数据库持久化能力，让 Web 队列、状态查询、Loop 生命周期不只依赖 `.loops` 文件扫描。

## 当前状态

- Prisma schema 目前主要包含用户、认证、文件、国家码等基础模型。
- Loops 当前实现主要写 `.loops` 文件：issues、intakes、state、specs、shards、tests、runs、annotations、notifications。
- 设计文档 `08-数据存储设计.md` 已提出数据库辅助索引，但尚未落到 Loops Prisma 模型。
- API type-check 当前存在 generated DB 与 infra 导出问题，实施前需要避免扩大非 Loops 范围。

## v1 最小数据模型

优先只建查询和生命周期必需表，复杂产物仍存在 `.loops`。

### LoopIssue

```prisma
model LoopIssue {
  id                 String   @id
  title              String
  status             String
  priority           String
  sourceChannel      String
  submitterId        String
  submitterName      String
  targetRepo         String
  body               String
  acceptanceCriteria Json
  rawPayloadRef      String
  createdAt          DateTime
  updatedAt          DateTime

  intakes            LoopIssueIntake[]
  state              LoopState?
}
```

### LoopIssueIntake

```prisma
model LoopIssueIntake {
  id             String   @id
  issueId        String
  sourceChannel  String
  sourceKind     String
  submitter      Json
  rawPayloadRef  String
  status         String
  createdAt      DateTime

  issue          LoopIssue @relation(fields: [issueId], references: [id])
}
```

### LoopState

```prisma
model LoopState {
  issueId           String   @id
  phase             String
  round             Int
  specVersion       String
  shardsTotal       Int
  shardsDone        Int
  shardsInProgress  Int
  reloopCount       Int
  costTokens        Int
  costCalls         Int
  globalVerdict     String?
  finalized         Boolean
  paused            Boolean
  updatedAt         DateTime

  issue             LoopIssue @relation(fields: [issueId], references: [id])
}
```

## DB Service 边界

遵守仓库规则：业务 service 不直接使用 Prisma。

计划新增或生成：

- `LoopIssueDbService`
- `LoopIssueIntakeDbService`
- `LoopStateDbService`

如果现有 DB 生成器可支持，优先通过 Prisma schema + generator 生成 `@app/db` 服务；如果生成器当前被既有问题阻断，则先建立 Loops 专用 DB service，但仍把 Prisma 访问封装在 DB service 层，不让 controller / LoopsService 直接访问 Prisma。

## 写入策略

### createIssue

1. 校验 request schema。
2. 解析并校验 targetRepo。
3. 生成 Issue / Intake / State。
4. 写 DB：Issue、Intake、State。
5. 写 `.loops`：Issue、Intake、raw payload、state、log、notification。
6. 返回统一 contract response。

### 状态同步

Loop 流转中需要在这些点同步 DB `LoopState` / `LoopIssue.status`：

- `generateSpec`: phase/specVersion/cost。
- `reviewSpec`: spec status 后 phase。
- `decompose`: shardsTotal / phase。
- `runLoop`: shardsDone / phase / paused。
- `reviewGlobal`: globalVerdict / phase。
- `reloop`: round / reloopCount / specVersion。
- `finalize`: issue.status = CLOSED, phase = CLOSED, finalized = true。
- `intervene`: paused / phase。

## 查询策略

- Issue 队列优先查 DB。
- Issue 详情仍以 `.loops` detail 为主，DB 用于校验存在和补充列表字段。
- 若 DB 记录存在但 `.loops` detail 缺失，doctor 报告不一致。
- 若 `.loops` 存在但 DB 缺失，提供 backfill 命令或 doctor 修复建议。

## 迁移步骤

1. 增加 Prisma models。
2. 生成或手写 DB service 层。
3. 新增 LoopsPersistenceService，封装 DB + `.loops` 双写。
4. 改造 LoopsService.createIssue 使用 persistence。
5. 改造 list/detail 查询入口。
6. 在关键状态变更点同步 DB。
7. 增加 doctor DB/file 一致性检查。

## 验收

- 创建 Issue 后 DB 三张表都有记录。
- 重启 API 后 Issue 列表仍可显示。
- `.loops` 删除或 DB 删除任一侧时 doctor 能报告不一致。
- Loop finalize 后 DB Issue 为 CLOSED。

