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

/** Registry auth material for a private-registry pull. Never logged verbatim. */
interface RegistryAuth {
  username: string;
  password: string;
  serveraddress: string;
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
    const auth = this.registryAuth(image);
    try {
      if (auth) {
        await this.pullAuthenticated(image, auth, this.timeoutMs(PULL_TIMEOUT_MS));
      } else {
        await pullDockerImage(this.client(), image, this.timeoutMs(PULL_TIMEOUT_MS));
      }
      return { ok: true, message: `Image ${image} pulled successfully.` };
    } catch (error) {
      const raw = this.safeError(error);
      const message = this.redactAuth(raw, auth);
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
  }

  /**
   * Authenticated pull via Dockerode (`{ authconfig }`). Mirrors the
   * `@dofe/infra-docker` `pullImage` flow but attaches registry credentials,
   * which the shared util cannot do. Uses the same timeout envelope as the
   * unauthenticated path.
   */
  private pullAuthenticated(image: string, auth: RegistryAuth, timeoutMs: number): Promise<void> {
    const docker = this.client();
    const pull = new Promise<void>((resolve, reject) => {
      docker.pull(image, { authconfig: auth }, (err, stream) => {
        if (err) return reject(err);
        if (!stream) return resolve();
        docker.modem.followProgress(stream, (progressErr) =>
          progressErr ? reject(progressErr) : resolve(),
        );
      });
    });
    return this.withTimeout(pull, timeoutMs, 'docker pull (authenticated)');
  }

  /**
   * Build registry auth from env, but only for images that actually live on the
   * configured registry — sending credentials to an unrelated host is a leak
   * risk. Returns `undefined` when no credentials are configured (caller falls
   * back to the unauthenticated util path).
   */
  private registryAuth(image: string): RegistryAuth | undefined {
    const username = process.env.DOCKER_REGISTRY_USERNAME?.trim();
    const password = process.env.DOCKER_REGISTRY_PASSWORD?.trim();
    if (!username || !password) return undefined;
    const configuredServer = this.stripScheme(process.env.DOCKER_REGISTRY_SERVER?.trim() ?? '');
    const imageRegistry = this.registryFromImage(image);
    const target = configuredServer || imageRegistry;
    if (!target) return undefined;
    // When a server is configured, authenticate only images that actually come
    // from it — withholds creds for Docker Hub or unrelated registries (a
    // leak-risk guard). `imageRegistry` is `''` for Docker Hub library images.
    if (configuredServer && configuredServer !== imageRegistry) return undefined;
    return { username, password, serveraddress: this.normalizeServer(target) };
  }

  /** Extract the registry host from an image reference (first `/` segment). */
  private registryFromImage(image: string): string {
    const host = image.split('/')[0] ?? '';
    // A registry host contains `.` or `:` (or is `localhost`); a bare name is a
    // Docker Hub library path, not a private registry.
    return /[.:]/.test(host) ? host : '';
  }

  private stripScheme(server: string): string {
    return server.replace(/^https?:\/\//i, '');
  }

  private normalizeServer(server: string): string {
    if (!server) return '';
    return /^https?:\/\//i.test(server) ? server : `https://${server}`;
  }

  /** Replace any literal username/password occurrence before logging/returning. */
  private redactAuth(message: string, auth: RegistryAuth | undefined): string {
    if (!auth) return message;
    let out = message;
    if (auth.password) out = out.split(auth.password).join('***');
    if (auth.username) out = out.split(auth.username).join('***');
    return out;
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
