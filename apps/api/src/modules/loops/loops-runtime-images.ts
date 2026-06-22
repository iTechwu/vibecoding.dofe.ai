import type { LoopAgentKind } from '@repo/contracts';

/**
 * Fixed Docker fallback images for the agent runtime (0622 · B3).
 *
 * Backend-only — the orchestration layer and frontend never see these tags;
 * they consume the `LoopRuntimeDetection` surface instead. Pinned to `latest`
 * during development; pin a digest before production (see 04-implementation-plan
 * risk table).
 */
export const LOOPS_RUNTIME_IMAGES: Record<LoopAgentKind, string> = {
  codex: 'uhub.service.ucloud.cn/techwu/codex-cli:latest',
  'claude-code': 'uhub.service.ucloud.cn/techwu/claude-code-cli:latest',
};

/** Local CLI command name for each agent. */
export const LOOPS_RUNTIME_LOCAL_COMMAND: Record<LoopAgentKind, string> = {
  codex: 'codex',
  'claude-code': 'claude',
};

/** Per-agent CLI config directory env var (mounted under the workspace). */
export const LOOPS_RUNTIME_CONFIG_ENV: Record<LoopAgentKind, string> = {
  codex: 'CODEX_HOME',
  'claude-code': 'CLAUDE_CONFIG_DIR',
};

/** Per-agent config subdirectory under `.loops/runtime/`. */
export const LOOPS_RUNTIME_CONFIG_DIR: Record<LoopAgentKind, string> = {
  codex: 'codex',
  'claude-code': 'claude-code',
};
