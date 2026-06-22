import { Inject, Injectable, Optional } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';
import { runProcess } from './adapters/loops-process.util';

const DEFAULT_TIMEOUT_MS = 8000;
const PULL_TIMEOUT_MS = 300_000;

export interface DockerDaemonProbe {
  ok: boolean;
  /** Server version string when the daemon is reachable. */
  version?: string;
}

export interface DockerPullOutcome {
  ok: boolean;
  /** `failed` outcomes carry a human-readable, non-sensitive message. */
  message: string;
}

/**
 * Centralised Docker control for the Loops agent runtime (0622).
 *
 * All Docker subprocess operations (`docker version`, `docker image inspect`,
 * `docker pull`) live here so Docker is managed in exactly one place. The
 * `@dofe/infra-*` family has no Docker package today (infra-clients is for
 * third-party HTTP APIs), so this uses the local `docker` CLI via `runProcess`
 * — the same pattern the module already uses for `codex` / `claude` / `git`.
 *
 * If a future `@dofe/infra-docker` (Docker Engine HTTP API client) is published
 * from `infra.dofe.ai`, swap this single class; the `LoopRuntimeDetection` and
 * `PullLoopImageResponse` contracts stay unchanged because callers depend on
 * the typed results, not on `runProcess`.
 *
 * Never logs stdout/stderr verbatim — Docker output can echo mounted env or
 * image digests; only non-sensitive summaries are surfaced.
 */
@Injectable()
export class LoopsDockerClient {
  constructor(
    @Optional()
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger?: Logger,
  ) {}

  /** Probe the Docker daemon (`docker version`). */
  async probeDaemon(): Promise<DockerDaemonProbe> {
    const result = await this.run(
      ['version', '--format', '{{.Server.Version}}'],
      DEFAULT_TIMEOUT_MS,
    );
    if (result.exitCode !== 0) {
      return { ok: false };
    }
    const version = result.stdout
      .split(/\r?\n/)
      .find((line: string) => line.trim().length > 0)
      ?.trim();
    return { ok: true, version: version?.slice(0, 120) };
  }

  /** Whether a given image is present locally (`docker image inspect`). */
  async imagePresent(image: string): Promise<boolean> {
    const result = await this.run(['image', 'inspect', image], DEFAULT_TIMEOUT_MS);
    return result.exitCode === 0;
  }

  /** Pull an image (`docker pull`). Best-effort: failures return `ok:false`. */
  async pull(image: string): Promise<DockerPullOutcome> {
    const result = await this.run(['pull', image], PULL_TIMEOUT_MS);
    if (result.exitCode === 0) {
      return { ok: true, message: `Image ${image} pulled successfully.` };
    }
    const dockerMissing = /not found|no such|not installed|enoent/i.test(result.stderr);
    return {
      ok: false,
      message: dockerMissing
        ? 'Docker is not available. Start Docker and try again.'
        : `docker pull failed (exit ${result.exitCode}).`,
    };
  }

  private async run(args: string[], timeoutMs: number) {
    try {
      return await runProcess({
        command: 'docker',
        args,
        timeoutMs: this.timeoutMs(timeoutMs),
        retries: 0,
      });
    } catch (error) {
      this.logger?.warn?.('Loops Docker subprocess threw', {
        args: args[0],
        error: error instanceof Error ? error.message : String(error),
      });
      return { exitCode: 1, stdout: '', stderr: String(error) };
    }
  }

  private timeoutMs(defaultMs: number): number {
    const parsed = Number(process.env.LOOPS_RUNTIME_DETECT_TIMEOUT_MS);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultMs;
  }
}
