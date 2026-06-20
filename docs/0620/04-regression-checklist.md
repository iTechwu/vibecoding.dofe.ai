# 回归与文档标注清单

每轮实施 accepted / 后置项后，必须执行本清单。

## 必跑质量门禁

```bash
pnpm quality:gate
```

若失败，需要拆开定位：

```bash
pnpm check:architecture
pnpm check:list-contracts
pnpm check:sensitive-logs
pnpm check:utils-hygiene
pnpm type-check
```

## 包级类型与测试

```bash
pnpm --filter @repo/api type-check
pnpm --filter @repo/web type-check
pnpm --filter @repo/contracts typecheck
pnpm --filter @repo/contracts test
pnpm --filter @repo/utils typecheck
pnpm --filter @repo/utils test
pnpm --filter @repo/validators test
pnpm --filter @repo/web test
```

## Loops 回归

```bash
pnpm --filter @repo/api exec jest src/modules/loops --runInBand
pnpm loops:doctor
pnpm loops:db-doctor
```

如涉及 live DB：

```bash
LOOPS_DB_SMOKE=1 pnpm --filter @repo/api exec jest src/modules/loops/loops-persistence.db.spec.ts --runInBand
```

## SSO / 浏览器 E2E

涉及真实登录、token、前端页面时追加：

```bash
pnpm --filter @repo/web test
```

真实 SSO 浏览器 E2E 需要环境变量与服务启动，按 `docs/0619/sso/09-implementation-status.md` 中的命令执行。

## 文档标注规则

每轮实施后更新：

1. `docs/0620/README.md`：总体状态。
2. 具体任务文档：把 `open` / `ready` / `in-progress` 改为 `done` / `accepted` / `blocked`。
3. 若影响 `docs/0619/todo` 的历史状态，仅追加“后续已在 docs/0620 推进”的说明，不重写历史事实。
4. 标注必须包含：
   - 具体代码文件；
   - 验收命令；
   - 仍未完成的边界；
   - 是否影响 Loops v1 CLOSED 门槛。

## 失败处理

| 失败类型          | 处理                                                      |
| ----------------- | --------------------------------------------------------- |
| architecture 失败 | 优先判断是否违反 DB Service / Logger / Console / Any 边界 |
| type-check 失败   | 先判断是否由并行 SSO/file 变更造成                        |
| Loops doctor 失败 | 区分 `.loops` 真相源问题、DB index 漂移、配置问题         |
| E2E 失败          | 保留 trace / screenshot，文档标 blocked，不得标 done      |
