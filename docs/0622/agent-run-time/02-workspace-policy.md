# 02 · Workspace 与 Docker 策略

## 为什么 Docker 模式必须先选择 workspace

本机 CLI 可以直接在当前 repo 工作；Docker 模式不同，必须把宿主机目录挂载进容器。若没有明确 workspace，系统无法安全决定：

- 容器 `-v` 挂载哪个目录；
- 容器 `-w` 工作目录是什么；
- CLI 配置、缓存和输出写到哪里；
- agent 是否会越界修改不相关目录。

因此：**Docker 模式必须绑定 workspace，且 workspace 是 runtime profile 的核心维度。**

## 推荐策略

### 单 workspace 默认路径

如果用户只在当前仓库工作，默认 workspace 即当前 repo root：

```text
workspaceId: default
root: /Users/techwu/Documents/codes/dofe.ai/vibecoding.dofe.ai
containerWorkdir: /workspace
```

适合：

- 本项目自己的 Loops 任务；
- 单仓库开发；
- 开发者本机调试。

### 多 workspace 独立 profile

如果用户会让 agent 操作多个 repo，必须显式建多个 workspace：

```json
[
  {
    "workspaceId": "vibecoding",
    "root": "/Users/techwu/Documents/codes/dofe.ai/vibecoding.dofe.ai"
  },
  {
    "workspaceId": "scaffold",
    "root": "/Users/techwu/Documents/codes/dofe.ai/scaffold.dofe.ai"
  }
]
```

每个 workspace 独立保存：

- runtime mode；
- Docker image 拉取状态；
- CLI 登录/配置目录；
- 最近一次 detection 结果；
- 默认目标 repo；
- issue intake 默认值。

### 本地文件夹选择与路径唯一性

登录后的工作台通过侧栏工作区标题旁的文件夹选择器新建项目。用户只在
受限的本地目录树中逐层选择文件夹，不输入 `workspaceId` 或绝对路径。

- API 仅接受相对 `path`；`LOOPS_DIRECTORY_BROWSER_ROOT` 是可选的服务端
  配置根。未配置时，开发环境从当前 Loops workspace 推导到代码目录根。
  本机可显式设置为
  `LOOPS_DIRECTORY_BROWSER_ROOT=/Users/techwu/Documents/codes`。
- 服务端以 `realpath` 规范化被选目录，拒绝 `..`、绝对路径和逃逸到根目录
  外的符号链接。
- 规范化后的绝对目录是唯一键；重复选择同一目录会复用现有 workspace。
  `workspaceId` 由服务端根据目录名和路径指纹生成，仅作为稳定内部标识。
- 浏览接口只返回受限根下的相对目录项，不把任意服务器文件系统暴露给浏览器。

## 挂载规则

Docker 命令只允许挂载 workspace root：

```bash
docker run --rm \
  -v "$WORKSPACE_ROOT:/workspace" \
  -w /workspace \
  "$IMAGE" \
  "$AGENT_COMMAND"
```

禁止：

- 挂载用户 home 全目录；
- 挂载 `/`；
- 动态把 issue body 中的路径拼入 `-v`；
- 允许容器写 `.ssh`、系统级凭据目录。

## 配置目录

建议把容器内配置写入 workspace 内部受控目录：

```text
.loops/runtime/
  codex/
    config/
    cache/
  claude-code/
    config/
    cache/
  docker/
    image-status.json
```

优点：

- 可按 workspace 隔离；
- 可由 doctor 检查；
- 不污染宿主机全局配置；
- 用户删除 workspace profile 时容易清理。

风险：

- 若 repo 被提交，需要 `.gitignore` 覆盖 `.loops/runtime/`。
- CLI token 当前不由 Loops 托管；如果未来引入 token 落盘，必须标记敏感，doctor 不得输出原值。
- 私有仓库拉取凭据（`DOCKER_REGISTRY_USERNAME` / `DOCKER_REGISTRY_PASSWORD`）只在 `LoopsDockerClient.pull()` 拉取时从 env 读取并通过 Dockerode `{ authconfig }` 下发，**绝不写入** `.loops/runtime/`；错误信息在落日志/返回前先脱敏（见 01-runtime-detection-and-execution.md）。

## Workspace 状态机

```text
UNCONFIGURED
  -> SELECTED
  -> VALIDATED
  -> READY
  -> ERROR
```

| 状态           | 含义                     | 用户动作                |
| -------------- | ------------------------ | ----------------------- |
| `UNCONFIGURED` | 尚未选择 workspace       | 选择目录                |
| `SELECTED`     | 已选择但未校验           | 运行校验                |
| `VALIDATED`    | 目录存在且可读写         | 检测 CLI/Docker         |
| `READY`        | runtime 可执行           | 创建 issue / 运行 agent |
| `ERROR`        | 路径、权限或 Docker 异常 | 查看诊断并修复          |

## 前端体验建议

### 首次进入

如果没有 workspace：

- Loops dashboard 顶部显示阻塞 banner；
- Agent Runtime 面板显示 `Workspace required`；
- 主按钮：`Select workspace`；
- issue 创建入口仍可进入，但提交按钮 disabled，并提示先选 workspace。

### 多 workspace

在 Loops dashboard 顶部放 workspace switcher：

```text
Workspace: vibecoding  [Switch]
Runtime: Codex local · Claude Docker
```

切换 workspace 后：

- list / metrics / agent-runtime query 带 workspace context；
- issue 新建默认填入该 workspace；
- Docker 容器挂载该 workspace。

## 后端接口建议

后续可以新增：

```http
GET /loops/workspaces
POST /loops/workspaces
PATCH /loops/workspaces/:workspaceId
POST /loops/workspaces/:workspaceId/detect-runtime
```

本轮如果不想扩 API，可先用 `config.local.yaml` + `.loops/runtime/profile.json` 作为最小实现。

## 验收标准

- 未配置 workspace 时，Docker runtime 不会启动。
- workspace 不存在或不可写时，返回可操作诊断。
- 多 workspace 之间 runtime profile、缓存和配置互不污染。
- Docker 命令只挂载被选中的 workspace root。

## 实施状态（2026-06-22）

- ✅ 单 workspace 默认路径：`LoopsWorkspaceProfileService` 默认 workspace = `LOOPS_WORKSPACE_ROOT`（containerWorkdir `/workspace`）。
- ✅ 多 workspace 独立 profile：`POST /loops/workspaces`（upsert）+ `GET /loops/workspaces`（list）；每条 workspace 独立保存 mode / image / containerWorkdir / 状态。
- ✅ 挂载规则：`buildDockerAgentCommand` 只挂载 `workspaceRoot:/workspace` + 受控 config 目录，禁止 home/`/`/动态路径（见 `loops-runtime-command-builder.util.ts`）。
- ✅ 配置目录：`.loops/runtime/{codex,claude-code}/` 由 `LOOPS_RUNTIME_CONFIG_DIR` 决定；`.loops/runtime/` 已被 `.gitignore` 覆盖（仓库 `.gitignore:111`）。
- ✅ Workspace 状态机：`validate()`（存在 + 可写 → `VALIDATED`，否则 `ERROR`）；`UNCONFIGURED`/`SELECTED`/`READY` 由 detection + 前端组合呈现。
- ✅ 前端体验：dashboard 顶部 workspace switcher + Runtime 摘要（`apps/web/app/loops/page.tsx`）；issue 创建页 workspace 选择（`simple-loop-issue-form.tsx`）。
- ✅ 后端接口：`GET/POST /loops/workspaces`、`POST /loops/workspaces/:id/detect-runtime`、`POST /loops/workspaces/:id/pull-image` 已落地（超越「最小实现」）。
- ✅ CLI token redaction 边界：当前不托管 token，因此 doctor 无需输出或脱敏 token；若未来引入 token 托管，需要在同一轮补充敏感标记与 doctor redaction。

## 工作台闭环复审（2026-07-14）

### 已实施

- ✅ **工作区 URL 连续性**：侧栏选中的 `workspace` 会保留到“新建任务”“已安排”和“搜索”入口；会话与已安排列表将该工作区的规范化根目录映射为既有 `targetRepo` 查询，而“更多”中的运行时、审阅和管理页仍保持全局控制面。
- ✅ **创建路径一致性**：会话输入框创建简单 Issue 时携带选中的 `workspaceId`；服务端继续以 workspace profile 解析受限目录，而不是相信浏览器提供的路径。
- ✅ **规则快照一致性**：简单 Issue 的规则快照以请求工作区调用 profile `resolve(workspaceId)`。因此同时打开多个项目时，目标目录、agent 规则和运行时上下文来自同一个 workspace。
- ✅ **回归覆盖**：工作区选择回退、Issue 列表过滤、简单创建参数、侧栏链接连续性和规则快照解析均已有定向自动化测试；合成登录的 Playwright 用例进一步覆盖桌面、中文默认与移动侧栏在多个工作区状态下的 URL 连续性。

### 已知边界与下一步

- **唯一阻断项（外部）**：真实 SSO 租户验收仍等待 `sso.ixicai.cn` 为 OAuth 客户端放行 `openid profile email tenant offline_access`。该配置完成后，按 `docs/0712/uiux-opz/NEXT-STEPS.md` 重跑真实登录、工作区选择、Issue 创建、Continue Loop 和 Runtime 验收。
- **非阻断增强**：GitHub、Linear、Slack 等外部触发器的专用映射与告警仍需要各 provider 的 OAuth/webhook 设计；不以本地前端占位实现替代外部授权和审计边界。
