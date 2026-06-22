import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  getDockerConnectionOptions,
  getLocalImageId,
  pullImage as pullDockerImage,
} from '@dofe/infra-docker/docker.utils';
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
 * Docker Engine operations (`ping`/`version`, local image inspect and pull) use
 * `@dofe/infra-docker` utilities. Agent execution still returns a spawnable
 * `docker run` command from `loops-runtime-command-builder.util.ts`, but all
 * host Docker probing and image management stays behind this typed adapter.
 *
 * Never logs raw Docker errors verbatim to callers — Docker output can echo
 * mounted env or image digests; only non-sensitive summaries are surfaced.
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
    try {
      const docker = this.client();
      await this.withTimeout(docker.ping(), DEFAULT_TIMEOUT_MS, 'docker ping');
      const version = (await this.withTimeout(
        docker.version(),
        DEFAULT_TIMEOUT_MS,
        'docker version',
      )) as { Version?: string; ServerVersion?: string };
      return {
        ok: true,
        version: (version.ServerVersion ?? version.Version)?.slice(0, 120),
      };
    } catch (error) {
      this.logger?.debug?.('Loops Docker daemon probe failed', {
        error: this.safeError(error),
      });
      return { ok: false };
    }
  }

  /** Whether a given image is present locally through Docker Engine inspect. */
  async imagePresent(image: string): Promise<boolean> {
    try {
      const imageId = await this.withTimeout(
        getLocalImageId(this.client(), image),
        DEFAULT_TIMEOUT_MS,
        'docker image inspect',
      );
      return imageId !== null;
    } catch (error) {
      this.logger?.debug?.('Loops Docker image inspect failed', {
        image,
        error: this.safeError(error),
      });
      return false;
    }
  }

  /** Pull an image through Docker Engine. Best-effort: failures return `ok:false`. */
  async pull(image: string): Promise<DockerPullOutcome> {
    try {
      await pullDockerImage(this.client(), image, this.timeoutMs(PULL_TIMEOUT_MS));
      return { ok: true, message: `Image ${image} pulled successfully.` };
    } catch (error) {
      const message = this.safeError(error);
      const dockerMissing = /not found|no such|not installed|enoent|connect|socket|daemon/i.test(
        message,
      );
      this.logger?.warn?.('Loops Docker image pull failed', {
        image,
        error: message,
      });
      return {
        ok: false,
        message: dockerMissing
          ? 'Docker is not available. Start Docker and try again.'
          : 'Docker image pull failed.',
      };
    }
  }

  private client(): Docker {
    if (!this.docker) {
      this.docker = new Docker(
        getDockerConnectionOptions(process.env.DOCKER_HOST ?? '/var/run/docker.sock'),
      );
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

  private safeError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    return message.slice(0, 240);
  }
}
