import * as path from 'path';
import type { LoopAgentKind, LoopRuntimeMode } from '@repo/contracts';
import { planRuntimeInvocation } from '@dofe/infra-runtime';
import {
  LOOPS_RUNTIME_CONFIG_DIR,
  LOOPS_RUNTIME_CONFIG_ENV,
  LOOPS_RUNTIME_IMAGES,
  LOOPS_RUNTIME_LOCAL_COMMAND,
} from '@app/services/loops-runtime';
import { resolveLoopsRuntimeDir } from '@app/services/loops-store';

/** Where the agent's config/cache lives inside the container. */
export const CONTAINER_WORKDIR = '/workspace';
const CONTAINER_CONFIG_BASE = '/workspace/.loops/runtime';

export interface LocalAgentCommand {
  command: string;
  args: string[];
  cwd: string;
}

export interface DockerAgentCommand {
  /** The `docker` binary itself. */
  command: string;
  /** Full argv, including `run ... <image> <agent-command> ...`. */
  args: string[];
  /** Host path to mount at `/workspace` and use as cwd. */
  workspaceRoot: string;
  /** Container workdir (always `/workspace`). */
  cwd: string;
  /** Extra env to set inside the container (e.g. CODEX_HOME). Never secrets. */
  env: Record<string, string>;
}

export interface BuildAgentCommandInput {
  agent: LoopAgentKind;
  /** Absolute host path of the bound workspace root. */
  workspaceRoot: string;
  /** The agent-specific argv that would follow the CLI binary locally. */
  agentArgs: string[];
}

/** A unified, spawnable invocation regardless of local-vs-docker mode. */
export interface AgentInvocation {
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export interface PlanAgentInvocationInput {
  mode: LoopRuntimeMode;
  agent: LoopAgentKind;
  /** Validated host workspace root. */
  hostWorkspaceRoot: string;
  /** Container workdir (e.g. `/workspace`). */
  containerWorkdir: string;
  /**
   * Builds the agent-specific argv given the effective workdir the agent will
   * see — the host root for local mode, the container path for Docker mode.
   * The binary itself is prepended by the planner.
   */
  buildAgentArgs: (effectiveWorkdir: string) => string[];
}

/**
 * Resolve a spawnable invocation for either runtime mode (0622 · B3).
 *
 * Local mode runs the CLI directly against the host workspace; Docker mode
 * wraps the same logical argv in a `docker run` that mounts only the workspace
 * root. The adapter supplies the per-agent flags via `buildAgentArgs`; this
 * planner owns the run boundary so adapters never assemble `docker` commands.
 */
export function planAgentInvocation(input: PlanAgentInvocationInput): AgentInvocation {
  const definition = runtimeAgentDefinition(input.agent);
  const invocation = planRuntimeInvocation({
    mode: input.mode,
    agent: definition,
    hostWorkspaceRoot: input.hostWorkspaceRoot,
    containerWorkdir: input.containerWorkdir,
    configHostRoot: path.resolve(resolveLoopsRuntimeDir()),
    configContainerRoot: CONTAINER_CONFIG_BASE,
    agentArgs: input.buildAgentArgs,
  });
  return input.mode === 'docker'
    ? { ...invocation, args: stripDefaultRwVolumeArgs(invocation.args) }
    : invocation;
}

/**
 * Build the local-CLI invocation (no Docker). The CLI runs directly against the
 * workspace root as cwd. Pure — no process spawn.
 */
export function buildLocalAgentCommand(input: BuildAgentCommandInput): LocalAgentCommand {
  const invocation = planRuntimeInvocation({
    mode: 'local-cli',
    agent: runtimeAgentDefinition(input.agent),
    hostWorkspaceRoot: input.workspaceRoot,
    containerWorkdir: CONTAINER_WORKDIR,
    agentArgs: () => [...input.agentArgs],
  });
  return {
    command: invocation.command,
    args: invocation.args,
    cwd: invocation.cwd ?? input.workspaceRoot,
  };
}

/**
 * Build the Docker fallback invocation. Only the workspace root is mounted (at
 * `/workspace`); the agent config dir is pointed at a controlled subdirectory
 * under `.loops/runtime` so per-workspace isolation holds and no global
 * `~/.config` or `~/.ssh` is exposed (see 02-workspace-policy · 挂载规则).
 *
 * The command shape is fixed here; per-agent CLI flags stay encapsulated in the
 * adapter that supplies `agentArgs`. Pure — no process spawn, no secret values.
 */
export function buildDockerAgentCommand(input: BuildAgentCommandInput): DockerAgentCommand {
  const configDirName = LOOPS_RUNTIME_CONFIG_DIR[input.agent];
  const configEnv = LOOPS_RUNTIME_CONFIG_ENV[input.agent];
  // The host config dir is created on demand by the workspace profile service;
  // the path passed to `-v` is deterministic regardless of existence.
  const containerConfigDir = `${CONTAINER_CONFIG_BASE}/${configDirName}`;
  const invocation = planRuntimeInvocation({
    mode: 'docker',
    agent: runtimeAgentDefinition(input.agent),
    hostWorkspaceRoot: input.workspaceRoot,
    containerWorkdir: CONTAINER_WORKDIR,
    configHostRoot: path.resolve(resolveLoopsRuntimeDir()),
    configContainerRoot: CONTAINER_CONFIG_BASE,
    agentArgs: () => [...input.agentArgs],
  });

  return {
    command: invocation.command,
    args: stripDefaultRwVolumeArgs(invocation.args),
    workspaceRoot: input.workspaceRoot,
    cwd: CONTAINER_WORKDIR,
    env: { [configEnv]: containerConfigDir },
  };
}

function runtimeAgentDefinition(agent: LoopAgentKind) {
  return {
    command: LOOPS_RUNTIME_LOCAL_COMMAND[agent],
    dockerImage: LOOPS_RUNTIME_IMAGES[agent],
    configDirName: LOOPS_RUNTIME_CONFIG_DIR[agent],
    configEnvName: LOOPS_RUNTIME_CONFIG_ENV[agent],
  };
}

function stripDefaultRwVolumeArgs(args: string[]): string[] {
  return args.map((arg) => (arg.endsWith(':rw') ? arg.slice(0, -3) : arg));
}
