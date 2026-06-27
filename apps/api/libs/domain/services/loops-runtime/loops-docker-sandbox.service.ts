import { Injectable, Inject, Optional } from '@nestjs/common';
import {
  buildDockerSandboxRunCommand,
  buildDockerSandboxedExec,
  describeDockerSandboxProfile,
  executeDockerSandbox,
  validateDockerSandboxProfile,
  type DockerSandboxProfile,
  type DockerSandboxRunOptions,
  type DockerSandboxRunResult,
} from '@dofe/infra-docker';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';

export type { DockerSandboxProfile, DockerSandboxRunOptions, DockerSandboxRunResult };

@Injectable()
export class LoopsDockerSandboxService {
  constructor(
    @Optional()
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger?: Logger,
  ) {}

  buildRunCommand(opts: DockerSandboxRunOptions): string[] {
    return buildDockerSandboxRunCommand(opts);
  }

  buildSandboxedExec(opts: DockerSandboxRunOptions): { command: string; args: string[] } {
    return buildDockerSandboxedExec(opts);
  }

  describeEffectiveProfile(opts: DockerSandboxRunOptions): DockerSandboxProfile {
    return describeDockerSandboxProfile(opts);
  }

  validateProfile(opts: DockerSandboxRunOptions): { valid: boolean; warnings: string[] } {
    return validateDockerSandboxProfile(opts);
  }

  /**
   * R37: Execute a command inside a Docker sandbox with OS-level security
   * hardening. This is the actual execution path — not just command building.
   *
   * Security profile:
   *   --network=none      → no network access
   *   --read-only         → immutable rootfs
   *   --cap-drop=ALL      → drop all Linux capabilities
   *   --security-opt=no-new-privileges → prevent privilege escalation
   *   --memory + --cpus   → resource limits
   *   --tmpfs /tmp        → ephemeral writable tmp only
   */
  async execute(opts: DockerSandboxRunOptions): Promise<DockerSandboxRunResult> {
    const validation = this.validateProfile(opts);
    if (!validation.valid) {
      this.logger?.warn('[DockerSandbox] Profile warnings', { warnings: validation.warnings });
    }
    const result = await executeDockerSandbox(opts);
    this.logger?.info(`[DockerSandbox] Execution completed`, {
      exitCode: result.exitCode,
      durationMs: result.durationMs,
      image: opts.image,
    });
    return result;
  }

  /**
   * R37: Execute a command inside a Docker sandbox, throwing on non-zero exit.
   */
  async executeOrThrow(opts: DockerSandboxRunOptions): Promise<DockerSandboxRunResult> {
    const result = await this.execute(opts);
    if (result.exitCode !== 0) {
      const msg = `Docker sandbox exited with code ${result.exitCode}: ${result.stderr.slice(0, 500)}`;
      this.logger?.error(`[DockerSandbox] ${msg}`);
      throw new Error(msg);
    }
    return result;
  }

  /**
   * R37: Check if Docker is available and functional on the host.
   */
  async isDockerAvailable(): Promise<{ available: boolean; version?: string; message: string }> {
    const { execSync } = await import('child_process');
    try {
      const version = execSync('docker --version', { encoding: 'utf8', timeout: 5000 }).trim();
      return { available: true, version, message: `Docker available: ${version}` };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { available: false, message: `Docker unavailable: ${msg}` };
    }
  }

  /**
   * R38: Build production sandbox options from environment configuration.
   * Reads resource limits, registry credentials, and security policy from
   * LOOPS_SANDBOX_* and DOCKER_REGISTRY_* env vars.
   */
  buildProductionOptions(overrides?: Partial<DockerSandboxRunOptions>): DockerSandboxRunOptions {
    const image =
      overrides?.image ??
      process.env.LOOPS_SANDBOX_IMAGE ??
      `${process.env.DOCKER_REGISTRY ?? 'alpine'}/dofeai-sandbox:latest`;

    return {
      image,
      command: overrides?.command ?? '/bin/sh',
      args: overrides?.args ?? [],
      workdir: overrides?.workdir ?? '/workspace',
      mountPath: overrides?.mountPath ?? process.cwd(),
      networkMode:
        (overrides?.networkMode as 'none' | 'host' | 'bridge') ??
        (process.env.LOOPS_SANDBOX_NETWORK as 'none' | 'host' | 'bridge') ??
        'none',
      readonlyRootfs: overrides?.readonlyRootfs ?? process.env.LOOPS_SANDBOX_READONLY !== 'false',
      capDrop: overrides?.capDrop ?? ['ALL'],
      capAdd: overrides?.capAdd ?? [],
      memoryLimitMb:
        overrides?.memoryLimitMb ??
        (process.env.LOOPS_SANDBOX_MEMORY_MB ? Number(process.env.LOOPS_SANDBOX_MEMORY_MB) : 512),
      cpuLimit:
        overrides?.cpuLimit ??
        (process.env.LOOPS_SANDBOX_CPU ? Number(process.env.LOOPS_SANDBOX_CPU) : 1),
      timeoutSec:
        overrides?.timeoutSec ??
        (process.env.LOOPS_SANDBOX_TIMEOUT_SEC
          ? Number(process.env.LOOPS_SANDBOX_TIMEOUT_SEC)
          : 300),
      envVars: overrides?.envVars ?? {
        ...(process.env.LOOPS_SANDBOX_EXTRA_ENV
          ? Object.fromEntries(
              process.env.LOOPS_SANDBOX_EXTRA_ENV.split(',').map((e) => e.split('=')),
            )
          : {}),
      },
    };
  }

  /**
   * R38: Login to Docker registry using credentials from env.
   * Returns true if login succeeded, false if no credentials configured.
   */
  async ensureRegistryLogin(): Promise<{ loggedIn: boolean; registry?: string; message: string }> {
    const server = process.env.DOCKER_REGISTRY_SERVER;
    const username = process.env.DOCKER_REGISTRY_USERNAME;
    const password = process.env.DOCKER_REGISTRY_PASSWORD;

    if (!server || !username || !password) {
      return { loggedIn: false, message: 'Docker registry credentials not configured' };
    }

    try {
      // docker login uses stdin for password
      const { spawnSync } = await import('child_process');
      const result = spawnSync('docker', ['login', server, '-u', username, '--password-stdin'], {
        input: password,
        encoding: 'utf8',
        timeout: 15000,
      });

      if (result.status === 0) {
        this.logger?.info(`[DockerSandbox] Logged into registry: ${server}`);
        return { loggedIn: true, registry: server, message: `Logged into ${server}` };
      }
      const errMsg = result.stderr?.trim() ?? result.stdout?.trim() ?? 'Unknown error';
      this.logger?.warn(`[DockerSandbox] Registry login failed: ${errMsg}`);
      return { loggedIn: false, registry: server, message: `Login failed: ${errMsg}` };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { loggedIn: false, message: `Registry login error: ${msg}` };
    }
  }
}
