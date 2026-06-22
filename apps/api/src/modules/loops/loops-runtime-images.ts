import type { LoopAgentKind } from '@repo/contracts';

/**
 * Fixed Docker fallback images for the agent runtime (0622 · B3).
 *
 * Backend-only — the orchestration layer and frontend never see these tags;
 * they consume the `LoopRuntimeDetection` surface instead. Pinned by digest
 * after verifying UCloud Hub manifests on 2026-06-22.
 */
export const LOOPS_RUNTIME_IMAGES: Record<LoopAgentKind, string> = {
  codex:
    'uhub.service.ucloud.cn/techwu/codex-cli@sha256:d1305f92fab11e80f8e4e03641bd418905f3fc7a61d4337644c6c71333ea7be0',
  'claude-code':
    'uhub.service.ucloud.cn/techwu/claude-code-cli@sha256:92e7e97ed507b1f9760f253b8dbe82bdd0ef9191f66aa93a86961b91b2f78a63',
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
