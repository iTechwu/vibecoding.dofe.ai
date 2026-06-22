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
   - `docker image inspect uhub.service.ucloud.cn/techwu/codex-cli:latest`
   - 镜像不存在时允许后台拉取或提示用户拉取
4. Docker 可用且 workspace 已配置，则标记 `docker.ready`。

### Claude Code

1. 查找本机 CLI：
   - `command -v claude`
   - `claude --version` 或 `claude -v`
   - 可选 smoke：`claude --help`
2. 若本机 CLI 不可用，检查镜像：
   - `uhub.service.ucloud.cn/techwu/claude-code-cli:latest`
3. Docker 模式必须绑定 workspace。

## 镜像兜底

固定镜像：

```yaml
codex:
  image: uhub.service.ucloud.cn/techwu/codex-cli:latest
claude-code:
  image: uhub.service.ucloud.cn/techwu/claude-code-cli:latest
```

示意命令：

```bash
docker run --rm \
  -v "$WORKSPACE_ROOT:/workspace" \
  -w /workspace \
  -e CODEX_HOME=/workspace/.loops/runtime/codex \
  uhub.service.ucloud.cn/techwu/codex-cli:latest \
  codex --version
```

```bash
docker run --rm \
  -v "$WORKSPACE_ROOT:/workspace" \
  -w /workspace \
  -e CLAUDE_CONFIG_DIR=/workspace/.loops/runtime/claude-code \
  uhub.service.ucloud.cn/techwu/claude-code-cli:latest \
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
      "dockerImage": "uhub.service.ucloud.cn/techwu/codex-cli:latest"
    },
    "claude-code": {
      "mode": "docker",
      "dockerImage": "uhub.service.ucloud.cn/techwu/claude-code-cli:latest"
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

## Open Questions

- 本机 CLI 登录态是否统一由用户自己维护，还是允许 Loops runtime profile 持有 token。
- Docker 镜像是否需要 pin digest，避免 `latest` 在生产中不可复现。
- Docker 容器是否允许网络访问；不同任务可能需要不同 network policy。
