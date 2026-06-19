# 05 · 验证与发布计划

## 目标

为 v1 定义可执行的验收矩阵，避免只完成局部代码但无法证明「Issue 入库 + Loop 开发闭环」可用。

## 必跑检查

### 静态检查

- `pnpm --filter @repo/web type-check`
- `pnpm --filter @repo/api type-check`
- `pnpm loops:doctor`

注意：当前 API type-check 已有非 Loops 阻断。v1 实施时需要单独处理或明确记录剩余阻断，不应把新 Loops 改动混进既有问题里。

### DB 检查

- Prisma schema validate。
- DB migration 生成。
- DB service 生成或编译。
- 创建 Issue 后 DB 记录存在。
- finalize 后 DB 状态更新。

### File Store 检查

- 创建 Issue 后 `.loops/issues`、`.loops/intakes`、`.loops/state.json` 存在。
- runLoop 后 implementation/test/review records 存在。
- reviewGlobal 后 global review record 存在。
- finalize 后 convergence pr record 和终态 annotations 存在。

## v1 冒烟路径

### Smoke 1 · 无登录提交 Issue

1. 打开 `/loops/new`。
2. 填写最小 Issue。
3. 提交。
4. 断言：
   - DB 有 Issue。
   - `.loops` 有 Issue/Intake。
   - 页面跳转详情。

### Smoke 2 · Issue 队列可恢复

1. 重启 API/Web。
2. 打开 `/loops`。
3. 断言刚创建的 Issue 仍可见。

### Smoke 3 · Loop 手动闭环

1. Generate Spec。
2. Approve。
3. Decompose。
4. Run until shards DONE。
5. Global Review。
6. Finalize。
7. 断言：
   - Issue CLOSED。
   - DB LoopState CLOSED。
   - `.loops` finalized。
   - annotations 无明显遗漏。

### Smoke 4 · 失败可见

1. 配置一个失败测试命令。
2. Run Loop。
3. 断言：
   - Test Record 为 TEST-FAIL。
   - Shard 不进入 DONE。
   - logs 可见失败原因。

### Smoke 5 · DB/File 不一致检查

1. 手动删除测试 Issue 的某个 `.loops` 文件或 DB 记录。
2. `pnpm loops:doctor`。
3. 断言 doctor 报告不一致。

## 发布标准

v1 可交付必须满足：

- Web 无登录提交 Issue 可用。
- Issue 入库可查询。
- Loop 闭环可在本机跑通。
- 失败可见且可恢复。
- SSO/飞书/真实 PR 明确后置，不影响主流程。

## 交付记录

实施完成后需要更新：

- `docs/0619/loops设计/IMPLEMENTATION-ANNOTATIONS.md`
- 本 todo 目录中的对应文档状态。
- 如果调整范围，新增 ADR 到 `10-决策与开放问题.md` 或在 todo 中记录 v1 决策。

