# 01 · Runtime 探测与执行方案

## 目标

为 Codex 与 Claude Code 建立统一 agent runtime 层，让 Loops 可以稳定判断：

- 本机是否存在可用 CLI；
- CLI 版本和执行能力是否满足当前任务；
- 本机 CLI 不可用时，是否可以用 Docker 镜像兜底；
- 当前 agent 的状态、诊断和下一步操作是什么。

## 设计原则

1. **编排层只面对 AgentRuntime 接口**  
   `LoopsService` 不直接拼 `codex` / `claude` / `docker run` 命令，而是调用 `AgentRuntimeProvider`。

2. **本机优先，Docker 兜底**  
   本机 CLI 可用时减少 Docker 启动成本；不可用时用镜像保证最低可运行能力。

3. **诊断可操作**  
   所有失败都要变成用户可理解的诊断，例如“未选择 workspace”“Docker daemon 未运行”“镜像拉取失败”“CLI 未登录”。

4. **能力事实由后端提供**  
   前端只消费 `agent-runtime` contract，不根据 phase 或本机状态自行推导。

## Runtime Provider 模型

建议新增内部接口：

```ts
type AgentKind = 'codex' | 'claude-code';
type RuntimeMode = 'local-cli' | 'docker';
type RuntimeStatus = 'ready' | 'missing' | 'misconfigured' | 'error';

interface AgentRuntimeProvider {
  detect(input: { agent: AgentKind; workspaceId?: string }): Promise<RuntimeDetection>;
  run(input: AgentRunRequest): Promise<AgentRunResult>;
}

interface RuntimeDetection {
  agent: AgentKind;
  preferredMode: RuntimeMode;
  local?: RuntimeCandidate;
  docker?: RuntimeCandidate;
  selected?: RuntimeCandidate;
  diagnostics: RuntimeDiagnostic[];
}

interface RuntimeCandidate {
  mode: RuntimeMode;
  status: RuntimeStatus;
  command?: string;
  version?: string;
  image?: string;
  workspaceRequired: boolean;
}
```

## 探测顺序

### Codex

1. 查找本机 CLI：
   - `command -v codex`
   - `codex --version`
   - 可选 smoke：`codex --help`
2. 若本机 CLI 可用，标记 `local-cli.ready`。
3. 若不可用，检查 Docker：
   - `docker version`
   - `docker image inspect uhub.service.ucloud.cn/techwu/codex-cli@sha256:d1305f92fab11e80f8e4e03641bd418905f3fc7a61d4337644c6c71333ea7be0`
   - 镜像不存在时允许后台拉取或提示用户拉取
4. Docker 可用且 workspace 已配置，则标记 `docker.ready`。

### Claude Code

1. 查找本机 CLI：
   - `command -v claude`
   - `claude --version` 或 `claude -v`
   - 可选 smoke：`claude --help`
2. 若本机 CLI 不可用，检查镜像：
   - `uhub.service.ucloud.cn/techwu/claude-code-cli@sha256:92e7e97ed507b1f9760f253b8dbe82bdd0ef9191f66aa93a86961b91b2f78a63`
3. Docker 模式必须绑定 workspace。

## 镜像兜底

固定镜像：

```yaml
codex:
  image: uhub.service.ucloud.cn/techwu/codex-cli@sha256:d1305f92fab11e80f8e4e03641bd418905f3fc7a61d4337644c6c71333ea7be0
claude-code:
  image: uhub.service.ucloud.cn/techwu/claude-code-cli@sha256:92e7e97ed507b1f9760f253b8dbe82bdd0ef9191f66aa93a86961b91b2f78a63
```

示意命令：

```bash
docker run --rm \
  -v "$WORKSPACE_ROOT:/workspace" \
  -w /workspace \
  -e CODEX_HOME=/workspace/.loops/runtime/codex \
  uhub.service.ucloud.cn/techwu/codex-cli@sha256:d1305f92fab11e80f8e4e03641bd418905f3fc7a61d4337644c6c71333ea7be0 \
  codex --version
```

```bash
docker run --rm \
  -v "$WORKSPACE_ROOT:/workspace" \
  -w /workspace \
  -e CLAUDE_CONFIG_DIR=/workspace/.loops/runtime/claude-code \
  uhub.service.ucloud.cn/techwu/claude-code-cli@sha256:92e7e97ed507b1f9760f253b8dbe82bdd0ef9191f66aa93a86961b91b2f78a63 \
  claude --version
```

具体 CLI flag 由 adapter 封装；文档只固定运行边界。

## Runtime Profile

建议每个 workspace 建一份 profile：

```json
{
  "workspaceId": "main-repo",
  "root": "/Users/example/project",
  "agents": {
    "codex": {
      "mode": "local-cli",
      "localCommand": "/usr/local/bin/codex",
      "dockerImage": "uhub.service.ucloud.cn/techwu/codex-cli@sha256:d1305f92fab11e80f8e4e03641bd418905f3fc7a61d4337644c6c71333ea7be0"
    },
    "claude-code": {
      "mode": "docker",
      "dockerImage": "uhub.service.ucloud.cn/techwu/claude-code-cli@sha256:92e7e97ed507b1f9760f253b8dbe82bdd0ef9191f66aa93a86961b91b2f78a63"
    }
  }
}
```

存储位置建议：

```text
.loops/runtime/profile.json
.loops/runtime/codex/
.loops/runtime/claude-code/
```

## 诊断输出

后端 `GET /loops/agent-runtime` 建议扩展 runtime diagnostics：

| code                      | level    | message                         | action                     |
| ------------------------- | -------- | ------------------------------- | -------------------------- |
| `LOCAL_CLI_MISSING`       | warning  | 本机未检测到 Codex/Claude CLI   | 使用 Docker 或查看安装指引 |
| `DOCKER_DAEMON_DOWN`      | critical | Docker 未运行                   | 打开 Docker 后重试         |
| `DOCKER_IMAGE_MISSING`    | warning  | 镜像未拉取                      | 拉取镜像                   |
| `WORKSPACE_REQUIRED`      | critical | Docker 模式必须先选择 workspace | 选择 workspace             |
| `WORKSPACE_NOT_MOUNTABLE` | critical | workspace 不可挂载或不存在      | 修正 workspace 路径        |
| `AUTH_REQUIRED`           | warning  | CLI 尚未登录或缺少 token        | 配置凭据                   |

前端诊断项要提供明确按钮：

- `Select workspace`
- `Use Docker`
- `Pull image`
- `Retry detection`
- `Open issue`

## v1 决策边界

- 本机 CLI 登录态由用户自己维护。Loops v1 不托管 token，也不触发 `AUTH_REQUIRED`，避免用不稳定 CLI 行为误判登录态。
- Docker 镜像已 pin digest。2026-06-22 核查：使用相邻 `agents.dofe.ai` 的 UCloud Hub 凭据在临时 Docker config 中执行 `docker login` + `docker manifest inspect --verbose`，确认 Codex digest 为 `sha256:d1305f92fab11e80f8e4e03641bd418905f3fc7a61d4337644c6c71333ea7be0`，Claude Code digest 为 `sha256:92e7e97ed507b1f9760f253b8dbe82bdd0ef9191f66aa93a86961b91b2f78a63`。
- Docker 容器网络策略沿用默认 Docker 网络；如需任务级 network policy，应在后续发布策略中作为显式配置项加入 profile。

## 实施状态（2026-06-22）

- ✅ Runtime Provider 模型：`LoopRuntimeDetection` / `LoopRuntimeCandidate` / `LoopRuntimeCheck` schema（`packages/contracts/src/schemas/loops.schema.ts`），后端 `AgentRuntimeDetectionService.detect()` 实现 `detect` 语义（`run` 由 adapter 内 `planAgentInvocation` 承担）。
- ✅ 探测顺序（Codex / Claude Code）：本机 `codex` / `claude --version` → Docker Engine daemon → image inspect，全部在 `AgentRuntimeDetectionService` + `LoopsDockerClient` 内。
- ✅ 镜像兜底：固定镜像在 `loops-runtime-images.ts`（后端专用），示意命令由 `buildDockerAgentCommand` 生成并通过 `-e CODEX_HOME=/workspace/.loops/runtime/codex`、`-e CLAUDE_CONFIG_DIR=...` 落实。
- ✅ Runtime Profile：`.loops/runtime/profile.json` 由 `LoopsWorkspaceProfileService` 读写；`LOOPS_WORKSPACE_ROOT` 决定 `.loops` 根。
- ✅ 诊断输出：`GET /loops/agent-runtime` 返回 `runtimes[]` + `workspaceId`；诊断码 `LOCAL_CLI_MISSING` / `DOCKER_DAEMON_DOWN` / `DOCKER_IMAGE_MISSING` / `WORKSPACE_REQUIRED` / `WORKSPACE_NOT_MOUNTABLE` 全部产出，并带稳定 `action` 键供前端按钮使用。
- ✅ 前端诊断按钮：Retry detection / Select workspace / Use Docker / Pull image / Open issue / View setup guide（`apps/web/app/loops/page.tsx`）。
- ✅ Docker 管理：`LoopsDockerClient` 已接入 `@dofe/infra-docker/docker.utils` + `dockerode`，通过 Docker Engine 执行 daemon probe、image inspect 与 pull；不再通过本地 `docker image inspect/pull` 子进程做探测和拉取。
  - **包选择说明**：`@dofe/infra-docker` 提供两层 API——上层 `DockerService` / `DockerImageService` 是与 gateway/openclaw bot 强绑定的领域服务（`onModuleInit` 构建 bot 镜像、分配端口、管理 sandbox），与 Loops「探测 daemon + inspect/pull 固定镜像」的诉求不匹配；下层 `docker.utils`（`getDockerConnectionOptions` / `getLocalImageId` / `pullImage`）是领域无关的纯函数，正好覆盖 Loops 需要。因此 `LoopsDockerClient` 只消费 `docker.utils`，保持 Loops 与 bot 领理解耦，也避免引入无谓的 `OnModuleInit` 副作用与配置依赖。
  - **执行边界**：Docker Engine 的 probe/inspect/pull 走 `docker.utils`；agent 实际执行仍由 `loops-runtime-command-builder.util.ts` 生成的 `docker run` 命令承载（只挂载 workspace root），不进入 `DockerService` 的容器生命周期管理。
- ✅ `AUTH_REQUIRED` 诊断码：schema 已预留，v1 按决策不触发；CLI 登录态仍由用户在本机或容器 profile 中自行维护。
- ✅ Docker digest / network policy 标注：digest pin 已完成；network policy 被归类为后续发布策略配置，不阻塞本轮 runtime v1。
