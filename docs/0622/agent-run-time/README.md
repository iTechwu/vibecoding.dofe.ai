# Agent Runtime 方案

## 背景

当前 Loops 已有 agent runtime contract 与前端可观测面板，但实际执行层还需要回答两个产品问题：

- 机器上是否已经安装可用的 `codex` / `claude` CLI；
- 如果没有本机 CLI，如何用 Docker 镜像稳定兜底，并且让 workspace、权限、状态诊断对用户可理解。

同时，Web issue 提交字段偏多，用户在“我只是想让 agent 做一件事”时会被标题、仓库、正文、优先级、验收标准等字段打断。需要降低提交门槛，同时保留 Loops 后端需要的结构化数据。

## 文档结构

| 文档                                                                           | 作用                                                            |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| [01-runtime-detection-and-execution.md](01-runtime-detection-and-execution.md) | CLI 探测、本机优先、Docker 镜像兜底、运行诊断模型               |
| [02-workspace-policy.md](02-workspace-policy.md)                               | Docker 模式下 workspace 选择、挂载、安全边界、多 workspace 策略 |
| [03-simple-issue-intake.md](03-simple-issue-intake.md)                         | 简化 issue 提交体验、渐进式字段、模板与智能归一化               |
| [04-implementation-plan.md](04-implementation-plan.md)                         | 分批实施计划、验收标准与风险                                    |

## 推荐总决策

1. Agent runner 采用“本机 CLI 优先、Docker 镜像兜底”的双模式。
2. Docker 镜像固定为：
   - Codex：`uhub.service.ucloud.cn/techwu/codex-cli:latest`
   - Claude Code：`uhub.service.ucloud.cn/techwu/claude-code-cli:latest`
3. 后端提供统一 runtime capability / diagnostics，不把 CLI 路径、Docker 命令、镜像细节泄漏给前端。
4. Docker 模式必须先选择 workspace；不同 workspace 使用独立 runtime profile，避免凭据、缓存、挂载和工作目录互相污染。
5. Issue 提交改成“简单模式优先”：用户只填一句需求和目标 workspace/repo；系统自动生成标题、优先级建议、验收标准草案，并允许高级用户展开编辑。

## 目标体验

用户进入 Loops 控制台时，应看到：

- Codex / Claude Code 是否可用；
- 当前使用本机 CLI 还是 Docker；
- Docker 镜像是否已拉取、是否需要配置 workspace；
- 哪些 agent 正在执行、等待、失败或需要用户操作；
- 点击诊断即可进入配置、重试、打开 issue 或切换 workspace。

用户创建 issue 时，应默认只看到：

- 需求描述；
- 目标 workspace/repo；
- 提交按钮。

其余字段由系统生成或折叠到“高级设置”。
