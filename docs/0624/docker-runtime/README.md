# Docker Runtime Sandbox 实施方案

日期：2026-06-24
目标：为 vibecoding.dofe.ai (Loops Remote Runner) 和 agents.dofe.ai (Bot Gateway Sandbox) 建立统一的 Docker 运行时沙箱镜像体系。

---

## 1. 现状分析

### 1.1 两个项目的沙箱需求对比

| 维度                           | vibecoding.dofe.ai (Loops)                                            | agents.dofe.ai (Bot Sandbox)                             |
| ------------------------------ | --------------------------------------------------------------------- | -------------------------------------------------------- |
| **生命周期**                   | 短生命周期（per-job），执行完即销毁                                   | 长生命周期（per-user session），有 TTL 过期              |
| **容器数**                     | 每个 Remote Runner job 一个容器                                       | 每个活跃 bot session 一个容器                            |
| **核心运行时**                 | Codex CLI + Claude Code CLI                                           | Bot Gateway + Tool Sandbox + Browser Sandbox             |
| **网络策略**                   | `--network=none`（默认阻断）                                          | 允许 VNC WebSocket + 特定 API 出站                       |
| **文件系统**                   | `--read-only` + tmpfs `/tmp`（默认）                                  | 可写 workspace，持久化 volume                            |
| **安全策略**                   | `--cap-drop=ALL`, `--security-opt=no-new-privileges`                  | 受控 cap-add，需 browser/network                         |
| **入口方式**                   | BullMQ processor → `LoopsService.executeRemoteShardJob`               | SandboxQueryService → Gateway → VNC Proxy                |
| **已有实现**                   | `LoopsDockerSandboxService` (buildRunCommand/execute/validateProfile) | `SandboxFileApi`, `SandboxProxyGateway`, `SandboxCron`   |
| **已有 Docker infrastructure** | 无（仅 `buildRunCommand` 拼接字符串）                                 | `@dofe/infra-docker/DockerModule` + `DockerImageService` |

### 1.2 关键发现

1. **agents.dofe.ai 已有完整的 Docker 管理层**：`DockerModule`（dockerode 连接）、`DockerImageService`（镜像拉取/构建）、`DockerOrphanCleanerService`（孤儿容器清理）
2. **vibecoding.dofe.ai 只有命令构建层**：`LoopsDockerSandboxService` 拼 `docker run` 参数，没有实际调用 Docker API
3. **两个项目可以共享基础 toolchain 镜像**：Codex CLI、Claude Code CLI、Node.js、Git 是两个项目都需要的
4. **agents.dofe.ai 的 sandbox 容器已经支持 VNC 桌面 + browser + tool 三种模式**，Loops 的 sandbox 需求是其子集

---

## 2. 分层镜像架构

```
┌──────────────────────────────────────────────────────────────┐
│                    dofe-ai/sandbox:latest                     │
│  (Loops Remote Runner — 最小化、短生命周期、强安全)           │
│  - codex CLI + claude CLI                                    │
│  - Node.js 22 + pnpm 10                                      │
│  - Git 2.x + basic build tools                              │
│  - 入口: /usr/local/bin/dofe-sandbox-entrypoint.sh           │
├──────────────────────────────────────────────────────────────┤
│                  dofe-ai/sandbox:full                         │
│  (agents.dofe.ai Bot Sandbox — 完整桌面环境)                  │
│  - 继承 :latest 全部内容                                      │
│  - XFCE4 桌面 + noVNC                                        │
│  - Chromium + Playwright                                     │
│  - 入口: supervisord (VNC + Gateway + Agent)                 │
├──────────────────────────────────────────────────────────────┤
│                   dofe-ai/sandbox:base                        │
│  (共享基础层 — common toolchain)                              │
│  - Node.js 22 + pnpm 10                                      │
│  - Git 2.x + openssh-client                                  │
│  - Python 3.12 + pip                                         │
│  - build-essential (gcc, make, etc.)                         │
│  - Debian Trixie-slim base                                   │
└──────────────────────────────────────────────────────────────┘
```

### 2.1 镜像复用策略

| 镜像                     | 构建位置                                                | 使用方              | 用途                       |
| ------------------------ | ------------------------------------------------------- | ------------------- | -------------------------- |
| `dofe-ai/sandbox:base`   | 共享 Dockerfile（两个项目引用同一份）                   | 两个项目            | 基础 toolchain，不直接使用 |
| `dofe-ai/sandbox:latest` | vibecoding.dofe.ai `apps/api/docker/sandbox.Dockerfile` | Loops Remote Runner | CLI 代码执行               |
| `dofe-ai/sandbox:full`   | agents.dofe.ai `docker/sandbox-full.Dockerfile`         | Bot Gateway Sandbox | 完整 bot 运行时            |

### 2.2 为什么不合并为一个镜像

- Loops 需要 `--network=none --read-only`，不需要 VNC/桌面/浏览器
- Bot Sandbox 需要网络、VNC、浏览器，体积 ~2-3x Loops 镜像
- 短生命周期 Loops job 受益于更小的镜像体积（冷启动更快）
- 安全面不同：Loops 追求最小攻击面，Bot Sandbox 需要完整桌面能力

---

## 3. 实施计划

### P0 · 共享基础镜像 `dofe-ai/sandbox:base`

**目标**：建立两个项目共享的 toolchain 基础层。

**实施步骤**：

1. **创建 `docker/sandbox-base.Dockerfile`**（放置在哪个项目？见 §3.1）
2. 基于 `node:22-slim`（与 agents.dofe.ai 生产 Dockerfile 一致）
3. 安装：git, openssh-client, python3, pip, build-essential, curl, jq
4. 安装 pnpm 10（与两个项目的 pnpm 版本一致）
5. 创建 `/workspace` 作为共享挂载点
6. 构建脚本：`docker/build-sandbox-base.sh`

**验收**：镜像构建成功，`docker run --rm dofe-ai/sandbox:base node -e "console.log('OK')"` 输出 OK

### P1 · Loops Sandbox 镜像 `dofe-ai/sandbox:latest`

**目标**：为 Loops Remote Runner 提供 Codex/Claude CLI 执行环境。

**实施步骤**：

1. 创建 `apps/api/docker/sandbox.Dockerfile`（vibecoding.dofe.ai 仓库内）
2. `FROM dofe-ai/sandbox:base`
3. 安装 Codex CLI：
   ```dockerfile
   RUN curl -fsSL https://codex.openai.com/install.sh | bash
   ```
4. 安装 Claude Code CLI：
   ```dockerfile
   RUN npm install -g @anthropic-ai/claude-code
   ```
5. 创建 `/workspace` 挂载点 + tmpfs `/tmp`
6. 非 root 用户 `dofe`（UID 1001）
7. 添加安全加固标签（`no-new-privileges` 默认）
8. 创建 `docker/build-sandbox.sh` 构建脚本

**验收**：

- `docker run --rm --network=none --read-only --tmpfs /tmp dofe-ai/sandbox:latest codex exec --version`
- `docker run --rm --network=none --read-only --tmpfs /tmp dofe-ai/sandbox:latest claude --version`
- 通过 `LoopsDockerSandboxService.execute()` E2E 测试

### P1 · Bot Sandbox 镜像 `dofe-ai/sandbox:full`

**目标**：为 agents.dofe.ai 提供完整 bot 运行时（桌面 + 浏览器 + CLI）。

**实施步骤**：

1. 创建 `docker/sandbox-full.Dockerfile`（agents.dofe.ai 仓库内）
2. `FROM dofe-ai/sandbox:base`
3. 安装 XFCE4 桌面 + TigerVNC + noVNC
4. 安装 Chromium + Playwright（与现有 `DockerImageService.TOOL_SANDBOX` 对齐）
5. 安装 supervisord 管理多进程
6. 端口暴露：6080 (noVNC), 5901 (VNC)
7. 创建 `docker/build-sandbox-full.sh` 构建脚本

**验收**：

- 容器启动后 noVNC 可访问
- Playwright Chromium 可启动
- Codex/Claude CLI 可在容器内执行
- 与现有 `SandboxProxyGateway` 兼容

### P2 · Loops Docker 管理升级

**目标**：将 `LoopsDockerSandboxService` 从命令拼接到 Docker API（dockerode）。

**实施步骤**：

1. 引入 `dockerode` 依赖（或复用 `@dofe/infra-docker`）
2. 重写 `execute()` 方法使用 Docker API 而非 `spawn('docker', ...)`
3. 添加容器生命周期管理（create → start → attach → inspect → remove）
4. 添加资源限制（memory, cpu, disk）通过 Docker API
5. 添加容器 health check 与超时强制 kill
6. 保持 `buildRunCommand()` 作为 CLI fallback（兼容本地 Docker 不可用场景）

**验收**：

- `executeRemoteShardJob` 通过 Docker API 创建并执行容器
- 容器执行完成后自动清理（`--rm` 等价）
- 超时容器被 SIGKILL 终止

### P2 · 统一沙箱配置 Schema

**目标**：定义跨项目共享的沙箱配置 schema，放在 `@repo/contracts` 或 `@dofe/infra-common`。

```typescript
// 建议位置: packages/contracts/src/schemas/sandbox.schema.ts
const SandboxProfileSchema = z.object({
  image: z.string().default('dofe-ai/sandbox:latest'),
  mode: z.enum(['cli', 'desktop', 'browser']).default('cli'),
  network: z.enum(['none', 'bridge', 'host']).default('none'),
  readonlyRootfs: z.boolean().default(true),
  memoryLimitMb: z.number().int().positive().default(2048),
  cpuLimit: z.number().positive().default(2),
  timeoutSec: z.number().int().positive().default(600),
  workspaceMount: z.string().optional(),
  envVars: z.record(z.string(), z.string()).optional(),
});
```

---

## 3.1 共享基础镜像的放置策略

**推荐方案**：基础镜像 Dockerfile 放在 **vibecoding.dofe.ai**（本项目），agents.dofe.ai 从本地 registry 或 Docker Hub 拉取。

理由：

- vibecoding.dofe.ai 是 Loops 的权威仓库，sandbox 镜像的定义更贴近 Loops 需求
- 基础镜像不包含任何业务逻辑，可以独立于两个项目构建和发布
- agents.dofe.ai 的 `DockerImageService` 已有镜像拉取/构建基础设施，只需添加一个 image config

**备选方案**：如果需要一个独立的 CI 构建流水线，可以抽取到 `infra.dofe.ai` 的 `packages/docker/images/` 下。

---

## 4. 文件清单

### vibecoding.dofe.ai 新增文件

```
apps/api/docker/
├── sandbox-base.Dockerfile       # 共享基础镜像（from node:22-slim）
├── sandbox.Dockerfile            # Loops sandbox（from sandbox:base, + Codex/Claude CLI）
├── build-sandbox-base.sh         # 构建脚本
├── build-sandbox.sh              # 构建脚本
└── sandbox-entrypoint.sh         # 容器入口（可选）
```

### agents.dofe.ai 新增/修改文件

```
docker/
├── sandbox-full.Dockerfile       # Bot sandbox（from sandbox:base, + Desktop + Browser）
└── build-sandbox-full.sh         # 构建脚本

# 修改现有文件
apps/api/src/modules/sandbox-file-api/sandbox-file-api.module.ts
  # 添加 LoopsSandboxConfig 类型引用（可选）
```

### infra.dofe.ai 修改（可选）

```
packages/docker/src/
├── docker-image.service.ts       # 新增 'LOOPS_SANDBOX' image config
└── types.ts                      # 新增 SandboxProfile type (如果放这里)
```

---

## 5. 构建流程

```
┌─────────────────┐
│   1. Build Base  │   docker build -f sandbox-base.Dockerfile -t dofe-ai/sandbox:base .
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌─────────┐ ┌──────────┐
│ 2. Loops│ │3. Bot    │
│ :latest │ │ :full    │
└────┬────┘ └────┬─────┘
    │            │
    ▼            ▼
┌─────────┐ ┌──────────┐
│ Loops   │ │ Bot      │
│ E2E Test│ │ Sandbox  │
│ Suite   │ │ VNC Test │
└─────────┘ └──────────┘
```

### CI 集成建议（后续）

```bash
# 构建全系列
docker/build-sandbox-base.sh
docker/build-sandbox.sh        # Loops :latest
# agents.dofe.ai 侧:
# docker/build-sandbox-full.sh   # Bot :full

# 冒烟测试
docker run --rm dofe-ai/sandbox:latest codex exec --version
docker run --rm dofe-ai/sandbox:latest claude --version

# 推送（需要 registry）
docker tag dofe-ai/sandbox:base registry.dofe.ai/dofe-ai/sandbox:base
docker push registry.dofe.ai/dofe-ai/sandbox:base
```

---

## 6. 风险与依赖

| 风险                             | 影响                      | 缓解措施                             |
| -------------------------------- | ------------------------- | ------------------------------------ |
| Codex CLI 安装方式变化           | :latest 构建失败          | 使用版本锁定 + 降级到 npm 安装       |
| Claude Code CLI 体积大（~500MB） | 镜像体积超标              | 分层缓存，生产使用多阶段构建         |
| 两个项目 Node.js 版本分化        | base 镜像需要兼容两个版本 | 使用 LTS 版本，定期同步              |
| Docker daemon 不可用             | Loops sandbox 无法执行    | fallback 到本地 CLI（现有 adapters） |
| 镜像 registry 网络不可达         | CI 构建失败               | 本地缓存 + offline fallback          |

---

## 7. 推荐推进顺序

```
本 sprint（本周）:
  ✅ 本方案评审通过
  → 创建 sandbox-base.Dockerfile + 构建脚本
  → 创建 sandbox.Dockerfile (Loops :latest)
  → Loops executeRemoteShardJob 用本地构建的镜像做 E2E 验证

下 sprint:
  → agents.dofe.ai 创建 sandbox-full.Dockerfile
  → Bot Sandbox VNC 集成测试
  → CI 构建流水线

后续 Epic:
  → LoopsDockerSandboxService 升级到 Docker API (dockerode)
  → 统一 SandboxProfile schema
  → 镜像 registry 推送 + 版本管理
```
