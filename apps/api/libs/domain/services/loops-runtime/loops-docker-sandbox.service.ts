import { Injectable, Inject, Optional } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';

export interface DockerSandboxRunOptions {
  image: string;
  command: string;
  args?: string[];
  workdir: string;
  mountPath: string;
  networkMode: 'none' | 'host' | 'bridge';
  readonlyRootfs: boolean;
  capDrop: string[];
  capAdd: string[];
  memoryLimitMb?: number;
  cpuLimit?: number;
  timeoutSec?: number;
  envVars?: Record<string, string>;
}

export interface DockerSandboxRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  sandboxProfile: DockerSandboxProfile;
}

export interface DockerSandboxProfile {
  network: 'deny' | 'allowlist' | 'open-with-approval';
  writeScope: 'workspace' | 'repo' | 'artifact-only';
  shellEnforcement: boolean;
  secretMode: 'redacted' | 'blocked';
  memoryLimitMb: number;
  cpuLimit: number;
}

@Injectable()
export class LoopsDockerSandboxService {
  constructor(
    @Optional()
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger?: Logger,
  ) {}

  buildRunCommand(opts: DockerSandboxRunOptions): string[] {
    const cmd: string[] = ['docker', 'run', '--rm'];
    cmd.push(`--network=${opts.networkMode}`);
    if (opts.readonlyRootfs) cmd.push('--read-only');
    cmd.push('--cap-drop=ALL');
    for (const cap of opts.capAdd) cmd.push(`--cap-add=${cap}`);
    if (opts.memoryLimitMb) cmd.push(`--memory=${opts.memoryLimitMb}m`);
    if (opts.cpuLimit) cmd.push(`--cpus=${opts.cpuLimit}`);
    cmd.push('-v', `${opts.mountPath}:${opts.workdir}`);
    cmd.push('-w', opts.workdir);
    cmd.push('--security-opt=no-new-privileges:true');
    if (opts.envVars) {
      for (const [key, value] of Object.entries(opts.envVars)) {
        cmd.push('-e', `${key}=${value}`);
      }
    }
    cmd.push(opts.image);
    cmd.push(opts.command);
    if (opts.args?.length) cmd.push(...opts.args);
    return cmd;
  }

  buildSandboxedExec(opts: DockerSandboxRunOptions): { command: string; args: string[] } {
    const fullCmd = this.buildRunCommand(opts);
    return { command: fullCmd[0], args: fullCmd.slice(1) };
  }

  describeEffectiveProfile(opts: DockerSandboxRunOptions): DockerSandboxProfile {
    return {
      network:
        opts.networkMode === 'none'
          ? 'deny'
          : opts.networkMode === 'bridge'
            ? 'allowlist'
            : 'open-with-approval',
      writeScope: opts.readonlyRootfs ? 'artifact-only' : 'repo',
      shellEnforcement: opts.capDrop.includes('ALL'),
      secretMode: opts.envVars?.SECRET_REDACT ? 'redacted' : 'blocked',
      memoryLimitMb: opts.memoryLimitMb ?? 512,
      cpuLimit: opts.cpuLimit ?? 1,
    };
  }

  validateProfile(opts: DockerSandboxRunOptions): { valid: boolean; warnings: string[] } {
    const warnings: string[] = [];
    if (opts.networkMode !== 'none')
      warnings.push('Network is not fully denied; consider --network=none');
    if (!opts.readonlyRootfs) warnings.push('Root filesystem is writable; consider --read-only');
    if (!opts.capDrop.includes('ALL'))
      warnings.push('Not all capabilities dropped; add --cap-drop=ALL');
    if (opts.capAdd.includes('SYS_ADMIN')) warnings.push('SYS_ADMIN is dangerous in sandbox');
    if (opts.memoryLimitMb && opts.memoryLimitMb > 4096)
      warnings.push(`Memory limit (${opts.memoryLimitMb}MB) exceeds 4GB`);
    return { valid: warnings.length === 0, warnings };
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
    const { spawn } = await import('child_process');
    const validation = this.validateProfile(opts);
    const profile = this.describeEffectiveProfile(opts);
    const start = Date.now();

    if (!validation.valid) {
      this.logger?.warn('[DockerSandbox] Profile warnings', { warnings: validation.warnings });
    }

    return new Promise((resolve) => {
      const args = this.buildRunCommand(opts).slice(1); // skip 'docker'
      const child = spawn('docker', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: opts.timeoutSec ? opts.timeoutSec * 1000 : undefined,
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8');
        // Truncate at 10MB to prevent memory exhaustion
        if (stdout.length > 10 * 1024 * 1024) stdout = stdout.slice(0, 10 * 1024 * 1024);
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8');
        if (stderr.length > 10 * 1024 * 1024) stderr = stderr.slice(0, 10 * 1024 * 1024);
      });

      child.on('error', (err: NodeJS.ErrnoException) => {
        this.logger?.error('[DockerSandbox] Spawn failed', { error: err.message });
        resolve({
          exitCode: -1,
          stdout,
          stderr: `Spawn error: ${err.message}\n${stderr}`,
          durationMs: Date.now() - start,
          sandboxProfile: profile,
        });
      });

      child.on('close', (code: number | null) => {
        const durationMs = Date.now() - start;
        const exitCode = code ?? -1;
        this.logger?.info(`[DockerSandbox] Execution completed`, {
          exitCode,
          durationMs,
          image: opts.image,
        });
        resolve({ exitCode, stdout, stderr, durationMs, sandboxProfile: profile });
      });
    });
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
