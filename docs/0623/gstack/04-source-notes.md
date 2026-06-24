# gstack 来源与证据记录

## 检索信息

检索日期：2026-06-24
仓库：https://github.com/garrytan/gstack
本地分析路径：`/tmp/gstack-analysis-current`
Commit：`9fd03fae9e74f5daa7a138366aca8f86c7367c5c`
Commit 时间：`2026-06-21T07:15:19-07:00`
Commit 标题：`v1.58.4.0 fix: high-priority community bug wave + PTY plan-mode smoke gate (#2077)`
Package version：`1.58.4.0`

## GitHub API 快照

| 字段           | 值                                                                                                                                              |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| full_name      | `garrytan/gstack`                                                                                                                               |
| description    | `Use Garry Tan's exact Claude Code setup: 23 opinionated tools that serve as CEO, Designer, Eng Manager, Release Manager, Doc Engineer, and QA` |
| stars          | `113988`                                                                                                                                        |
| forks          | `16876`                                                                                                                                         |
| open issues    | `725`                                                                                                                                           |
| license        | `MIT`                                                                                                                                           |
| language       | `TypeScript`                                                                                                                                    |
| default branch | `main`                                                                                                                                          |
| created_at     | `2026-03-11T21:22:45Z`                                                                                                                          |
| updated_at     | `2026-06-23T21:21:47Z`                                                                                                                          |
| pushed_at      | `2026-06-21T14:20:58Z`                                                                                                                          |

## 仓库结构观察

关键文件与目录：

- `README.md`：产品叙事、安装、技能列表、GBrain、隐私与故障排查。
- `ARCHITECTURE.md`：browser daemon、安全、refs、logging、SKILL.md 生成体系。
- `CLAUDE.md`：开发命令、测试体系、项目结构、技能模板维护规范。
- `SKILL.md` 与各子目录 `*/SKILL.md`：生成后的 skills。
- `hosts/*.ts`：多宿主配置。
- `browse/`：浏览器 CLI/server。
- `extension/`：Chrome sidepanel/inspector。
- `bin/`：workflow/state/security/brain 辅助 CLI。
- `lib/`：gbrain、memory、decision、redaction、worktree 等共享逻辑。

## Skill 数量与 Host 支持

本次检索 `find -maxdepth 2 -name SKILL.md` 显示 54 个 skill 文件。

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

README 中将 gstack 定位为把 Claude Code 转为虚拟工程团队的工具，并列出 CEO / Founder review、Eng Manager、Senior Designer、Staff Engineer review、QA Lead、Chief Security Officer、Release Engineer、Technical Writer、Memory、Browser 等能力。

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
- tunnel 只暴露 allowlist endpoint；
- scoped token、rate limiting、denial logs；
- cookie import 只读拷贝浏览器 cookie DB，不明文落盘；
- prompt injection 防护包括 content security、ML classifier、transcript classifier、canary token、ensemble combiner；
- page-derived strings 在 server egress 统一做 lone surrogate sanitization。

## 本项目参考路径

| 路径                                                                | 用途                                                                                                    |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `packages/contracts/src/schemas/loops.schema.ts`                    | Loop workflow/review/release/browser/learning/security contract                                         |
| `packages/contracts/src/api/loops.contract.ts`                      | Loops API contract，包括 `runBrowserQa`、`runSecondOpinion`、`resolveSecondOpinion`、`runReleaseCanary` |
| `apps/api/src/modules/loops/loops.service.ts`                       | Loops detail/list 派生、Release Gate enforce、Canary、Second Opinion resolve 与 resolution evidence     |
| `apps/api/src/modules/loops/loops-browser-qa-worker.service.ts`     | Playwright Browser QA worker、trace、visualDiffs、handoff                                               |
| `apps/api/src/modules/loops/loops-second-opinion-worker.service.ts` | Claude Code secondary reviewer worker                                                                   |
| `apps/api/src/modules/loops/loops-learning-memory.util.ts`          | learning fingerprint/tags/similarity                                                                    |
| `apps/api/src/modules/loops/loops-learning-governance.service.ts`   | cross-workspace index、approval queue、aging policy 服务基础                                            |
| `apps/api/src/modules/loops/loops-runner.service.ts`                | runtime command policy、sandbox profile allowlist/denylist、network/write 阻断、canary                  |
| `apps/api/src/modules/loops/loops-file-store.service.ts`            | file-backed evidence/governance                                                                         |
| `apps/web/app/loops/page.tsx`                                       | Loops dashboard，包括 Learning pending approval UI                                                      |
| `apps/web/app/loops/[issueId]/page.tsx`                             | Loop detail Delivery Controls                                                                           |
| `apps/web/app/loops/[issueId]/use-loop-operations.ts`               | Browser QA、Second Opinion、Release Canary、governance 操作                                             |

## 对本分析的可信度说明

本分析基于：

1. GitHub API 当前仓库元数据；
2. `git clone --depth 1 https://github.com/garrytan/gstack.git` 后的本地仓库文件；
3. `README.md`、`ARCHITECTURE.md`、`CLAUDE.md`、多个 `SKILL.md`、`package.json` 的直接阅读；
4. 本项目 `docs/0623/gstack` 既有竞品文档；
5. 本项目 Loops contract、API、worker、dashboard 相关代码路径。

需要注意：

- GitHub stars/forks/open issues 会持续变化；
- gstack 更新频繁，本分析固定在 `v1.58.4.0` 附近；
- 未实际安装和运行 gstack，因此浏览器延迟、QA 效果、skills 执行稳定性来自仓库文档与源码结构判断，而非本地实测；
- 未访问私有/付费生态，例如 Conductor 真实并行体验；
- 本项目工作区已有未提交改动，本轮只更新 `docs/0623/gstack` 文档，不回滚任何既有变更。
