import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  createDockerClient,
  inspectDockerImage,
  probeDockerDaemon,
  pullDockerImage,
  redactDockerAuth,
  registryAuthFromEnv,
  safeDockerMessage,
} from '@dofe/infra-docker';
import Docker from 'dockerode';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';

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
 * Docker Engine operations (`ping`/`version`, local image inspect) use
 * `@dofe/infra-docker` utilities. Pulls of the pinned UCloud Hub images run
 * against a **private registry**, so when `DOCKER_REGISTRY_USERNAME` /
 * `DOCKER_REGISTRY_PASSWORD` are configured this adapter performs an
 * authenticated pull via Dockerode (`{ authconfig }`) — the shared
 * `@dofe/infra-docker` `pullImage` util is unauthenticated and only covers the
 * no-credentials path. Agent execution still returns a spawnable
 * `docker run` command from `loops-runtime-command-builder.util.ts`.
 *
 * Never logs raw Docker errors or registry credentials to callers — Docker
 * output can echo mounted env, image digests or auth material; only
 * non-sensitive summaries are surfaced and credentials are redacted from any
 * error string before it is logged or returned.
 */
@Injectable()
export class LoopsDockerClient {
  private docker?: Docker;

  constructor(
    @Optional()
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger?: Logger,
  ) {}

  /** Probe the Docker daemon through Docker Engine. */
  async probeDaemon(): Promise<DockerDaemonProbe> {
    const result = await probeDockerDaemon(this.client(), DEFAULT_TIMEOUT_MS);
    if (!result.ok) {
      this.logger?.debug?.('Loops Docker daemon probe failed', {
        error: result.message,
      });
    }
    return { ok: result.ok, version: result.version };
  }

  /** Whether a given image is present locally through Docker Engine inspect. */
  async imagePresent(image: string): Promise<boolean> {
    const result = await inspectDockerImage(this.client(), image, DEFAULT_TIMEOUT_MS);
    if (!result.present) {
      this.logger?.debug?.('Loops Docker image inspect failed', {
        image,
      });
    }
    return result.present;
  }

  /**
   * Pull an image through Docker Engine. Best-effort: failures return `ok:false`.
   *
   * The pinned Codex / Claude Code images live on a private UCloud Hub registry.
   * When `DOCKER_REGISTRY_USERNAME` / `DOCKER_REGISTRY_PASSWORD` are configured
   * (and the image belongs to that registry) the pull is authenticated via
   * Dockerode; otherwise it falls back to the shared unauthenticated
   * `@dofe/infra-docker` util. Credentials are never logged or returned.
   */
  async pull(image: string): Promise<DockerPullOutcome> {
    const auth = registryAuthFromEnv(image);
    const outcome = await pullDockerImage(this.client(), {
      image,
      registryAuth: auth,
      timeoutMs: this.timeoutMs(PULL_TIMEOUT_MS),
    });
    if (outcome.ok) return outcome;

    const message = redactDockerAuth(safeDockerMessage(outcome.message), auth);
    const dockerMissing = /not found|no such|not installed|enoent|connect|socket|daemon/i.test(
      message,
    );
    const unauthorized = /unauthorized|authentication required|\b401\b|forbidden|denied/i.test(
      message,
    );
    // `auth: auth ? 'present' : 'none'` — never log the auth object itself.
    this.logger?.warn?.('Loops Docker image pull failed', {
      image,
      auth: auth ? 'present' : 'none',
      error: message,
    });
    return {
      ok: false,
      message: dockerMissing
        ? 'Docker is not available. Start Docker and try again.'
        : unauthorized
          ? 'Registry authentication failed. Check the Docker registry credentials.'
          : 'Docker image pull failed.',
    };
  }

  private client(): Docker {
    if (!this.docker) {
      this.docker = createDockerClient({ dockerHost: process.env.DOCKER_HOST });
    }
    return this.docker;
  }

  private async withTimeout<T>(promise: Promise<T>, defaultMs: number, label: string): Promise<T> {
    const ms = this.timeoutMs(defaultMs);
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private timeoutMs(defaultMs: number): number {
    const parsed = Number(process.env.LOOPS_RUNTIME_DETECT_TIMEOUT_MS);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultMs;
  }
}
