import { Inject, Injectable, Optional } from '@nestjs/common';
import type {
  LoopAgentKind,
  LoopRuntimeCandidate,
  LoopRuntimeDetection,
  LoopRuntimeCheck,
  LoopRuntimeStatus,
  LoopWorkspaceProfile,
} from '@repo/contracts';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';
import {
  buildRuntimeChecks,
  pickRuntimeCandidate,
  type RuntimeCheckMessages,
} from '@dofe/infra-runtime';
import { runProcess } from '@app/services/loops-runners';
import { LOOPS_RUNTIME_LOCAL_COMMAND } from '@app/services/loops-runtime';
import { LoopsDockerClient } from '@app/services/loops-runtime';

const AGENTS: LoopAgentKind[] = ['codex', 'claude-code'];
const DEFAULT_DETECT_TIMEOUT_MS = 8000;
const CHECK_MESSAGES: RuntimeCheckMessages = {
  LOCAL_CLI_MISSING: 'Local CLI not detected. Use Docker or view the setup guide.',
  DOCKER_DAEMON_DOWN: 'Docker is not running. Start Docker and retry detection.',
  DOCKER_IMAGE_MISSING:
    'The fallback image has not been pulled. Pull the image to enable Docker mode.',
  WORKSPACE_REQUIRED: 'Docker mode requires a workspace. Select a workspace first.',
  WORKSPACE_NOT_MOUNTABLE: 'The workspace path cannot be mounted. Fix the workspace root.',
  AUTH_REQUIRED: 'The CLI is not authenticated. Configure credentials.',
};

/**
 * Probes the host for agent runtime facts (0622 · B1).
 *
 * Local-CLI first, Docker fallback. Every failure becomes an actionable,
 * frontend-consumable `LoopRuntimeCheck` (never a thrown exception, never a
 * leaked CLI path / Docker command / image tag). Detection is best-effort and
 * resilient: a missing binary or a down daemon degrades to diagnostics rather
 * than breaking the `/agent-runtime` endpoint.
 *
 * Auth state is intentionally NOT probed in v1 (`AUTH_REQUIRED` is reserved in
 * the schema but not emitted — see docs/0622/agent-run-time/01-runtime-detection-and-execution.md
 * v1 decision boundaries).
 */
@Injectable()
export class AgentRuntimeDetectionService {
  constructor(
    @Optional()
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger?: Logger,
    @Optional()
    private readonly docker: LoopsDockerClient = new LoopsDockerClient(),
  ) {}

  async detectAll(workspace: LoopWorkspaceProfile): Promise<LoopRuntimeDetection[]> {
    return Promise.all(AGENTS.map((agent) => this.detect(agent, workspace)));
  }

  async detect(
    agent: LoopAgentKind,
    workspace: LoopWorkspaceProfile,
  ): Promise<LoopRuntimeDetection> {
    const image = workspace.agents[agent].dockerImage;
    const local = await this.detectLocalCli(agent);
    const docker = await this.detectDocker(agent, image);
    const preferredMode = workspace.agents[agent].mode;

    const selected = pickRuntimeCandidate(preferredMode, local, docker);
    const checks = buildRuntimeChecks({
      preferredMode,
      workspaceStatus: workspace.status,
      local,
      docker,
      selected,
      messages: CHECK_MESSAGES,
    }) as LoopRuntimeCheck[];

    return {
      agent,
      preferredMode,
      local,
      docker,
      selected,
      checks,
    };
  }

  // --------------------------------------------------------------------------
  // Local CLI
  // --------------------------------------------------------------------------

  private async detectLocalCli(agent: LoopAgentKind): Promise<LoopRuntimeCandidate> {
    const command = LOOPS_RUNTIME_LOCAL_COMMAND[agent];
    const result = await this.run({
      command,
      args: agent === 'claude-code' ? ['--version'] : ['--version'],
    });
    const status = this.localStatus(result);
    return {
      mode: 'local-cli',
      status,
      command,
      version: status === 'ready' ? this.parseVersion(result.stdout) : undefined,
      workspaceRequired: false,
    };
  }

  private localStatus(result: {
    exitCode: number;
    stdout: string;
    stderr: string;
  }): LoopRuntimeStatus {
    if (result.exitCode === 0) return 'ready';
    if (this.isMissing(result.stderr)) return 'missing';
    return 'misconfigured';
  }

  // --------------------------------------------------------------------------
  // Docker
  // --------------------------------------------------------------------------

  private async detectDocker(agent: LoopAgentKind, image: string): Promise<LoopRuntimeCandidate> {
    const daemon = await this.docker.probeDaemon();
    if (!daemon.ok) {
      return {
        mode: 'docker',
        status: 'error',
        image,
        workspaceRequired: true,
      };
    }

    const present = await this.docker.imagePresent(image);
    const status: LoopRuntimeStatus = present ? 'ready' : 'missing';
    return {
      mode: 'docker',
      status,
      image,
      version: status === 'ready' ? daemon.version : undefined,
      workspaceRequired: true,
    };
  }

  // --------------------------------------------------------------------------
  // Process helpers
  // --------------------------------------------------------------------------

  private async run(input: { command: string; args: string[] }) {
    try {
      return await runProcess({
        command: input.command,
        args: input.args,
        timeoutMs: this.detectTimeoutMs(),
        retries: 0,
      });
    } catch (error) {
      // runProcess swallows errors into a result, but guard defensively anyway.
      this.logger?.warn?.('Loops runtime detection subprocess threw', {
        command: input.command,
        error: error instanceof Error ? error.message : String(error),
      });
      return { exitCode: 1, stdout: '', stderr: String(error) };
    }
  }

  private detectTimeoutMs(): number {
    const parsed = Number(process.env.LOOPS_RUNTIME_DETECT_TIMEOUT_MS);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DETECT_TIMEOUT_MS;
  }

  private isMissing(stderr: string): boolean {
    const lower = stderr.toLowerCase();
    return (
      lower.includes('enoent') || lower.includes('not found') || lower.includes('no such file')
    );
  }

  private parseVersion(stdout: string): string | undefined {
    const line = stdout.split(/\r?\n/).find((item) => item.trim().length > 0);
    return line?.trim().slice(0, 120) || undefined;
  }
}
