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
}
