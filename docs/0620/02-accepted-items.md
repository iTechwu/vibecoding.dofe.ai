# Accepted 项处理

## 当前 accepted 项

| ID    | 项                                             | 当前状态 | 下一步                      |
| ----- | ---------------------------------------------- | -------- | --------------------------- |
| OPT-5 | `apps/api/jest.config.ts` `process.cwd()` 依赖 | done     | 无后续动作；下一批进入 RBAC |

## OPT-5 · Jest config `process.cwd()` 依赖

状态：done（round 1 / 2026-06-20）。

### 背景

`apps/api/jest.config.ts` 当前通过 `process.cwd()` 读取 `apps/api/tsconfig.json`。此前复核结论：

- Jest 30 评估 `.ts` config 时，`__dirname` 在 ESM 语境不可用。
- `pnpm --filter @repo/api exec jest` 与 API 包内脚本均从 `apps/api` 工作目录运行。
- `jest --showConfig` 已验证 `cwd` / `rootDir` / `moduleNameMapper` 正常。

### 风险

- 若有人从 repo 根直接用非 filter 方式指定 API Jest config，`process.cwd()` 可能指向 repo 根，导致读取错误的 `tsconfig.json`。
- 若未来切换 Jest config 加载方式，当前注释约束可能失效。

### 可选方案

| 方案                                       | 说明                                   | 风险                                              |
| ------------------------------------------ | -------------------------------------- | ------------------------------------------------- |
| A. 保持 accepted                           | 保留当前写法与注释约束                 | 依赖命令入口规范                                  |
| B. 改为 `import.meta.url` 定位 config 文件 | 从 config 文件位置解析 `tsconfig.json` | 需验证 Jest 30 + ts-jest + CommonJS tsconfig 兼容 |
| C. 改为 `.cjs` Jest config                 | 回到 CommonJS `__dirname`              | 改配置文件格式，影响面略大                        |

### 建议执行

先做 B 方案 spike：

1. 临时分支或工作区小改 `apps/api/jest.config.ts`。
2. 运行：
   - `pnpm --filter @repo/api exec jest --showConfig --runInBand`
   - `(cd apps/api && pnpm test -- --showConfig --runInBand)`
   - `pnpm --filter @repo/api exec jest src/modules/loops --runInBand`
   - `pnpm --filter @repo/api type-check`
3. 若全部通过，再转为实施；否则保留 accepted 并在本文档记录失败原因。

### 实施结果

`apps/api/jest.config.ts` 已改为使用 `import.meta.url` + `fileURLToPath` 定位配置文件目录，并从该目录读取 `tsconfig.json`。这消除了对调用方 `process.cwd()` 的依赖，同时保留 Jest 30 `.ts` config 的 ESM 兼容性。

### 验收

- `pnpm --filter @repo/api exec jest --showConfig --runInBand`：通过。
- `(cd apps/api && pnpm exec jest --showConfig --runInBand)`：通过。
- `pnpm --filter @repo/api exec jest src/modules/loops --runInBand`：通过。
- `(cd apps/api && pnpm exec jest src/modules/loops --runInBand)`：通过。
- `pnpm --filter @repo/api type-check`：通过。
- `pnpm quality:gate`：通过。
- `pnpm loops:doctor` / `pnpm loops:db-doctor`：通过。

### 完成口径

- `done`：配置已改为不依赖 cwd，并通过回归。
- `accepted-closed`：明确不实施，保留当前约束，并记录验证命令。

当前采用 `done`。
