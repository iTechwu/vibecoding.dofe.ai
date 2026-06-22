# 04 · 实施计划

## 总体顺序

建议按“诊断事实 → workspace → Docker 兜底 → issue 简化 → UI polish”的顺序做，避免先做复杂 UI 后发现后端事实不够。

## B1 · Runtime Detection Contract

目标：扩展现有 `GET /loops/agent-runtime`，让后端返回 CLI/Docker detection 事实。

关键改动：

- `packages/contracts/src/schemas/loops.schema.ts`
  - 增加 runtime mode、candidate、diagnostic code schema。
- `apps/api/src/modules/loops`
  - 新增 `AgentRuntimeDetectionService`。
  - 检测 `codex` / `claude` 本机 CLI。
  - 检测 Docker daemon 与镜像状态。

验收：

- 本机有 CLI 时返回 `local-cli.ready`。
- 本机无 CLI 且 Docker 可用时返回 Docker candidate。
- Docker 不可用时返回 `DOCKER_DAEMON_DOWN` 诊断。

## B2 · Workspace Profile

目标：为 Docker runtime 提供明确 workspace。

关键改动：

- `.loops/runtime/profile.json` 最小 profile。
- 可选：`GET/POST /loops/workspaces`。
- 前端 dashboard 顶部 workspace switcher。

验收：

- 未配置 workspace 时 Docker runtime 不执行。
- workspace 不存在时返回 `WORKSPACE_NOT_MOUNTABLE`。
- Docker run 只挂载 workspace root。

## B3 · Docker Fallback Runner

目标：Codex / Claude adapter 在本机 CLI 不可用时走 Docker。

关键改动：

- `CliLoopsAgentAdapter` / `CliLoopsClaudeAdapter` 不直接决定命令。
- 新增 command builder：
  - local command builder；
  - docker command builder。
- 镜像：
  - `uhub.service.ucloud.cn/techwu/codex-cli@sha256:d1305f92fab11e80f8e4e03641bd418905f3fc7a61d4337644c6c71333ea7be0`
  - `uhub.service.ucloud.cn/techwu/claude-code-cli@sha256:92e7e97ed507b1f9760f253b8dbe82bdd0ef9191f66aa93a86961b91b2f78a63`

验收：

- 本机 CLI 存在时优先本机。
- 本机 CLI 不存在时，Docker 镜像可执行 smoke。
- Docker 缺 workspace 时不运行，返回诊断。
- 运行日志不输出 token / secret。

## B4 · 简化 Issue API

目标：新增 `POST /loops/issues/simple`，让用户只填自然语言需求和 workspace。

关键改动：

- contracts 增加 simple request/response。
- API controller 新增 simple route。
- service 增加 `createSimpleIssue()`，归一化为现有 `createIssue()`。
- 保持 SSO submitter 后端派生。

验收：

- 只传 `request + workspaceId` 可创建 issue。
- 自动生成 title / priority / acceptance criteria。
- 高级字段覆盖自动生成结果。
- 现有 `POST /loops/issues` 不变。

## B5 · 前端提交体验重做

目标：把 `/loops/new` 改成简单模式优先。

关键改动：

- 默认表单只显示 request、workspace、template。
- 高级设置折叠。
- 创建前显示自动生成预览：
  - title；
  - priority；
  - acceptance criteria。
- workspace 不可用时提交按钮 disabled，并引导配置。

验收：

- 新用户 1 分钟内可以提交一个有效 issue。
- 高级用户仍可编辑完整字段。
- 表单错误为字段级，不用读后端堆栈。

## B6 · Runtime UI 操作闭环

目标：Agent Runtime 面板不只是显示状态，还能解决状态。

操作按钮：

- `Retry detection`
- `Select workspace`
- `Use Docker`
- `Pull image`
- `Open issue`
- `View setup guide`

验收：

- 每个 critical/warning 诊断至少有一个明确操作。
- 操作后相关 query 自动刷新。
- 空态、加载态、失败态都有可读文案。

## 风险与处理

| 风险                          | 处理                                                         |
| ----------------------------- | ------------------------------------------------------------ |
| Docker 镜像 `latest` 不可复现 | 已使用 UCloud Hub 凭据验证并 pin digest                      |
| CLI 登录态复杂                | 第一阶段只检测，不托管用户凭据                               |
| workspace 越界写入            | Docker 只挂载 workspace root；targetRepo 必须在 allowlist 内 |
| issue 自动生成不准确          | 高级设置可覆盖；detail 页保留原始 request                    |
| 前端过度复杂                  | 默认简单模式，高级字段折叠                                   |

## 建议退出条件

1. `agent-runtime` contract 可以反映 local/docker/workspace 三类事实。
2. Docker fallback 能在无本机 CLI 的机器上完成 smoke。
3. `/loops/new` 简单模式可以只用一句需求创建 issue。
4. 所有新增路径有 API service spec 和 web component spec。
5. `pnpm quality:gate` 通过。

## 实施状态（2026-06-22）

| 批次                          | 状态 | 关键产物                                                                                                                                                                                                                                                    |
| ----------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1 Runtime Detection Contract | ✅   | `loops.schema.ts`（runtime schemas）· `AgentRuntimeDetectionService` · `agentRuntime()` 扩展 `runtimes`+`workspaceId`                                                                                                                                       |
| B2 Workspace Profile          | ✅   | `LoopsWorkspaceProfileService` · `.loops/runtime/profile.json` · `GET/POST /loops/workspaces` · `detect-runtime`                                                                                                                                            |
| B3 Docker Fallback Runner     | ✅   | `planAgentInvocation` / `buildDockerAgentCommand` · `CliLoopsAgentAdapter` / `CliLoopsClaudeAdapter` 按工作区 mode 选 local/docker · `LoopsDockerClient` 接入 `@dofe/infra-docker`（私有 UCloud Hub 鉴权拉取走 Dockerode `{ authconfig }`，env 凭据不落盘） |
| B4 简化 Issue API             | ✅   | `POST /loops/issues/simple` · `createSimpleIssue()` · 共享归一化 `loops-simple-issue.ts`                                                                                                                                                                    |
| B5 前端提交体验重做           | ✅   | `SimpleLoopIssueForm`（request + workspace + template + 预览 + 高级折叠）                                                                                                                                                                                   |
| B6 Runtime UI 操作闭环        | ✅   | workspace switcher · Retry detection / Pull image / Use Docker / Select workspace / View setup guide · 操作后自动刷新                                                                                                                                       |

### 退出条件核对

1. ✅ `agent-runtime` 反映 local/docker/workspace 三类事实（`LoopRuntimeDetection`）。
2. ✅ Docker fallback smoke：command builder 单测验证 argv 正确（`loops-runtime-command-builder.spec.ts`）；Docker Engine probe/image/pull 适配层由 `loops-docker.client.spec.ts` mock `@dofe/infra-docker` 覆盖。真实 `docker run` 仍属本地环境 smoke，不作为 CI 阻断。
3. ✅ `/loops/new` 简单模式一句需求即可创建（`loops.service.spec.ts` createSimpleIssue + web 表单）。
4. ✅ 新增路径均有 spec：`agent-runtime-detection.service.spec.ts`、`loops-workspace-profile.service.spec.ts`、`loops-runtime-command-builder.spec.ts`、`loops-simple-issue.spec.ts`，并在 `loops.service.spec.ts` 扩展 createSimpleIssue/listWorkspaces/agentRuntime-runtimes；前端默认表单 `simple-loop-issue-form.test.tsx`（request ≥10 字 / 无 workspace 双门禁 + 实时预览 + 高级覆盖）。
5. ✅ `pnpm quality:gate` 通过；Loops 后端测试全绿（2026-06-22 实跑：63 passed / 3 skipped），前端 loops 测试 5 文件 / 19 passed（含新增 `simple-loop-issue-form.test.tsx`）。

### v1 决策边界

- `AUTH_REQUIRED` 探测：schema 保留，v1 决策为不托管 token、不探测登录态。
- Docker 镜像 pin digest：已完成；2026-06-22 使用相邻 `agents.dofe.ai` 的 UCloud Hub 凭据在临时 Docker config 中验证 manifest digest。
- Docker 管理：已接入 `@dofe/infra-docker`；`LoopsDockerClient` 保留为 Loops contract 适配层。
- 私有仓库鉴权拉取：`DOCKER_REGISTRY_USERNAME` / `DOCKER_REGISTRY_PASSWORD`（可选 `DOCKER_REGISTRY_SERVER`）配置后，`LoopsDockerClient.pull()` 走 Dockerode `{ authconfig }` 鉴权拉取；仅对归属配置 registry 的镜像附带凭据；凭据不落盘、错误脱敏、401 映射可操作文案。`loops-docker.client.spec.ts` 覆盖鉴权拉取、无关 registry 不附带凭据、401 脱敏三条路径。
