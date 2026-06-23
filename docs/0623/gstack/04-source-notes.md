# gstack 来源与证据记录

## 检索信息

检索日期：2026-06-23  
仓库：https://github.com/garrytan/gstack  
本地分析路径：`/tmp/gstack-analysis`  
Commit：`9fd03fae9e74f5daa7a138366aca8f86c7367c5c`  
Commit 时间：`2026-06-21T07:15:19-07:00`  
Commit 标题：`v1.58.4.0 fix: high-priority community bug wave + PTY plan-mode smoke gate (#2077)`  
Package version：`1.58.4.0`

GitHub API 快照：

| 字段           | 值                                                                                                                                              |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| full_name      | `garrytan/gstack`                                                                                                                               |
| description    | `Use Garry Tan's exact Claude Code setup: 23 opinionated tools that serve as CEO, Designer, Eng Manager, Release Manager, Doc Engineer, and QA` |
| stars          | `113191`                                                                                                                                        |
| forks          | `16796`                                                                                                                                         |
| open issues    | `722`                                                                                                                                           |
| license        | `MIT`                                                                                                                                           |
| default branch | `main`                                                                                                                                          |
| created_at     | `2026-03-11T21:22:45Z`                                                                                                                          |
| updated_at     | `2026-06-23T01:55:05Z`                                                                                                                          |
| pushed_at      | `2026-06-21T14:20:58Z`                                                                                                                          |

## 仓库结构观察

关键文件：

- `README.md`：产品叙事、安装、技能列表、GBrain、隐私与故障排查；
- `ARCHITECTURE.md`：browser daemon、安全、refs、logging、SKILL.md 生成体系；
- `CLAUDE.md`：开发命令、测试体系、项目结构、技能模板维护规范；
- `SKILL.md` 与各子目录 `*/SKILL.md`：生成后的 skills；
- `hosts/*.ts`：多宿主配置；
- `browse/`：浏览器 CLI/server；
- `extension/`：Chrome sidepanel/inspector；
- `bin/`：大量 workflow/state/security/brain 辅助 CLI；
- `lib/`：gbrain、memory、decision、redaction、worktree 等共享逻辑。

## Skill 数量

本次检索 `find -maxdepth 2 -name SKILL.md` 显示 54 个 skill 文件，包括：

- `office-hours`
- `plan-ceo-review`
- `plan-eng-review`
- `plan-design-review`
- `plan-devex-review`
- `autoplan`
- `review`
- `codex`
- `qa`
- `qa-only`
- `browse`
- `open-gstack-browser`
- `ship`
- `land-and-deploy`
- `canary`
- `benchmark`
- `cso`
- `investigate`
- `document-release`
- `document-generate`
- `learn`
- `spec`
- `pair-agent`
- `careful`
- `freeze`
- `guard`
- `setup-gbrain`
- `sync-gbrain`
- `ios-qa`

## Host 支持

`hosts/` 目录显示支持：

- `claude`
- `codex`
- `cursor`
- `factory`
- `gbrain`
- `hermes`
- `kiro`
- `openclaw`
- `opencode`
- `slate`

## 关键 README 事实

README 中将 gstack 定位为将 Claude Code 转为虚拟工程团队的工具，并列出：

- CEO / Founder review；
- Eng Manager；
- Senior Designer；
- Staff Engineer review；
- QA Lead；
- Chief Security Officer；
- Release Engineer；
- Technical Writer；
- Memory；
- Browser。

README 对 sprint 的定义是：

```text
Think -> Plan -> Build -> Review -> Test -> Ship -> Reflect
```

README 还强调：

- team mode 可把 gstack 引入共享 repo；
- `/autoplan` 自动运行 CEO/design/eng/DX review；
- `/qa` 会真实打开浏览器测试；
- `/codex` 用 OpenAI Codex CLI 做 second opinion；
- `/ship` 负责测试、coverage audit、push、PR；
- `/learn` 管理跨会话项目学习；
- GBrain 提供持久知识库；
- telemetry 默认关闭，只在用户 opt-in 后发送 usage metadata。

## 关键架构事实

`ARCHITECTURE.md` 表示浏览器采用 long-lived Chromium daemon：

- CLI 读取 `.gstack/browse.json`；
- 通过 localhost HTTP 调用 server；
- server 通过 CDP 操作 Chromium；
- 后续命令约 100-200ms；
- state file 使用 mode `0o600`；
- 随机端口 10000-60000；
- binary version mismatch 时自动重启 server。

安全相关事实：

- local listener 和 tunnel listener 物理分离；
- tunnel 只暴露 `/connect`、`/command`、`/sidebar-chat` 等 allowlist；
- scoped token、rate limiting、denial logs；
- cookie import 只读拷贝浏览器 cookie DB，不明文落盘；
- prompt injection 防护包括 content security、ML classifier、transcript classifier、canary token、ensemble combiner；
- page-derived strings 在 server egress 统一做 lone surrogate sanitization。

## 关键开发/测试事实

`CLAUDE.md` 表示：

- 使用 Bun；
- `bun test` 运行 free tests；
- `bun run test:evals` 运行付费 evals；
- E2E tests diff-based selection；
- gate/periodic 两级测试；
- SKILL.md 从 `.tmpl` 生成；
- 技能不应硬编码项目框架命令，应读项目 `CLAUDE.md` 或询问用户并持久化。

## 对本分析的可信度说明

本分析基于：

1. GitHub API 当前仓库元数据；
2. `git clone --depth 1 https://github.com/garrytan/gstack.git` 后的本地仓库文件；
3. `README.md`、`ARCHITECTURE.md`、`CLAUDE.md`、多个 `SKILL.md`、`package.json` 的直接阅读；
4. 本项目 `docs/0623` 既有竞品文档和 Loops 当前状态文档。

需要注意：

- GitHub stars/forks/open issues 会持续变化；
- gstack 更新频繁，本分析固定在 `v1.58.4.0` 附近；
- 未实际安装和运行 gstack，因此浏览器延迟、QA 效果、skills 执行稳定性来自仓库文档与源码结构判断，而非本地实测；
- 未访问私有/付费生态，例如 Conductor 真实并行体验。
