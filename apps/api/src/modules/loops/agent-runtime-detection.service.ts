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
import { runProcess } from './adapters/loops-process.util';
import { LOOPS_RUNTIME_LOCAL_COMMAND } from './loops-runtime-images';
import { LoopsDockerClient } from './loops-docker.client';

const AGENTS: LoopAgentKind[] = ['codex', 'claude-code'];
const DEFAULT_DETECT_TIMEOUT_MS = 8000;

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
 * Open Questions).
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

    const selected = this.pickSelected(preferredMode, local, docker);
    const checks = this.buildChecks(agent, workspace, local, docker, selected);

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
  // Selection + diagnostics
  // --------------------------------------------------------------------------

  private pickSelected(
    preferred: LoopWorkspaceProfile['agents'][LoopAgentKind]['mode'],
    local: LoopRuntimeCandidate | undefined,
    docker: LoopRuntimeCandidate | undefined,
  ): LoopRuntimeCandidate | undefined {
    const preferredCandidate = preferred === 'docker' ? docker : local;
    if (preferredCandidate?.status === 'ready') return preferredCandidate;
    // Fall back to whichever candidate is ready (local-cli wins ties).
    if (local?.status === 'ready') return local;
    if (docker?.status === 'ready') return docker;
    return undefined;
  }

  private buildChecks(
    _agent: LoopAgentKind,
    workspace: LoopWorkspaceProfile,
    local: LoopRuntimeCandidate | undefined,
    docker: LoopRuntimeCandidate | undefined,
    selected: LoopRuntimeCandidate | undefined,
  ): LoopRuntimeCheck[] {
    const checks: LoopRuntimeCheck[] = [];
    const workspaceOk = workspace.status === 'VALIDATED';

    const dockerPreferred =
      workspace.agents[_agent].mode === 'docker' || selected?.mode === 'docker';

    if (!workspaceOk) {
      checks.push(
        workspace.status === 'ERROR'
          ? this.check('WORKSPACE_NOT_MOUNTABLE', 'critical', 'select-workspace')
          : this.check('WORKSPACE_REQUIRED', 'critical', 'select-workspace'),
      );
    }

    if (local && local.status !== 'ready') {
      // Only warn when Docker cannot cover for it.
      const dockerCovers = docker?.status === 'ready' && workspaceOk;
      checks.push(
        this.check(
          'LOCAL_CLI_MISSING',
          dockerCovers ? 'info' : 'warning',
          dockerCovers ? 'use-docker' : 'view-setup-guide',
        ),
      );
    }

    if (docker) {
      if (docker.status === 'error') {
        checks.push(this.check('DOCKER_DAEMON_DOWN', 'critical', 'open-docker'));
      } else if (docker.status === 'missing') {
        checks.push(this.check('DOCKER_IMAGE_MISSING', 'warning', 'pull-image'));
      }
    }

    // If the user wants Docker but the workspace blocks the mount, surface the
    // workspace check above as the critical blocker; no duplicate here.
    if (dockerPreferred && !workspaceOk && !checks.some((c) => c.code === 'WORKSPACE_REQUIRED')) {
      checks.push(this.check('WORKSPACE_REQUIRED', 'critical', 'select-workspace'));
    }

    return checks;
  }

  private check(
    code: LoopRuntimeCheck['code'],
    level: LoopRuntimeCheck['level'],
    action: string,
    message?: string,
  ): LoopRuntimeCheck {
    const messages: Record<LoopRuntimeCheck['code'], string> = {
      LOCAL_CLI_MISSING: 'Local CLI not detected. Use Docker or view the setup guide.',
      DOCKER_DAEMON_DOWN: 'Docker is not running. Start Docker and retry detection.',
      DOCKER_IMAGE_MISSING:
        'The fallback image has not been pulled. Pull the image to enable Docker mode.',
      WORKSPACE_REQUIRED: 'Docker mode requires a workspace. Select a workspace first.',
      WORKSPACE_NOT_MOUNTABLE: 'The workspace path cannot be mounted. Fix the workspace root.',
      AUTH_REQUIRED: 'The CLI is not authenticated. Configure credentials.',
    };
    return { code, level, action, message: message ?? messages[code] };
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
