import { Inject, Injectable, Optional } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';
import { randomUUID } from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type {
  LoopRunShardTestsRequest,
  LoopRuntimeSecurityPolicySnapshot,
  LoopTestRecord,
} from '@repo/contracts';
import { resolveAllowedTargetRepo } from '@app/services/loops-store';
import { readLoopsRuntimeConfig } from '@app/services/loops-store';
import {
  LoopsDockerSandboxService,
  type DockerSandboxRunOptions,
} from './loops-docker-sandbox.service';

const execFileAsync = promisify(execFile);
const OUTPUT_LIMIT = 12000;

type CommandResult = LoopTestRecord['commands'][number];
type Coverage = NonNullable<LoopTestRecord['coverage']>;
/**
 * gstack/0 P0-1: Per-workspace runtime sandbox profile.
 * Moves beyond command-pattern blocking toward structured execution profiles
 * that define enforcement levels for network, write, and shell operations.
 */
export interface LoopsSandboxProfile {
  network: 'deny' | 'allowlist' | 'open-with-approval';
  writeScope: 'workspace' | 'repo' | 'artifact-only';
  shellEnforcement: 'strict-allowlist' | 'allowlist' | 'open-with-approval';
  secretMode: 'redacted' | 'blocked';
  /** Per-profile allowed command set (overrides config default when set). */
  allowedCommands?: string[];
  /** Per-profile blocked network tools (extends config defaults). */
  extraBlockedTools?: string[];
  /** Per-profile blocked write patterns (extends config defaults). */
  extraBlockedPatterns?: string[];
}

type CommandPolicyDecision =
  | { allowed: true }
  | { allowed: false; reason: string; networkTool?: string; writePattern?: string };
type CanaryStatus = LoopRuntimeSecurityPolicySnapshot['canary']['status'];

const SHELL_CONTROL_OPERATOR_PATTERN = /(?:&&|\|\||[;|<>`]|[$][(]|\r|\n)/;
const NETWORK_COMMAND_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'curl', pattern: /\bcurl\b/ },
  { label: 'wget', pattern: /\bwget\b/ },
  { label: 'ssh', pattern: /\b(?:ssh|scp|sftp)\b/ },
  { label: 'netcat', pattern: /\b(?:nc|netcat|telnet)\b/ },
  { label: 'git-network', pattern: /\bgit\s+(?:clone|fetch|pull|push)\b/ },
  { label: 'package-install', pattern: /\b(?:pnpm|npm|yarn)\s+(?:add|install|i|dlx)\b/ },
  { label: 'npx', pattern: /\bnpx\b/ },
  { label: 'pip-install', pattern: /\bpip(?:3)?\s+install\b/ },
  { label: 'brew', pattern: /\bbrew\s+(?:install|update|upgrade)\b/ },
];
const WRITE_ESCAPE_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'parent-directory', pattern: /(^|\s)\.\.(?:\/|\\)/ },
  { label: 'absolute-write-command', pattern: /\b(?:rm|mv|cp|mkdir|touch)\s+(?:-[^\s]+\s+)*\// },
  {
    label: 'node-fs-outside-workspace',
    pattern: /\b(?:writeFileSync|appendFileSync|rmSync|mkdirSync)\s*[(]\s*['"`](?:\/|\.\.)/,
  },
];
const CANARY_REDACTION = '[LOOPS_RUNTIME_CANARY_REDACTED]';

@Injectable()
export class LoopsRunnerService {
  constructor(
    @Optional()
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger?: Logger,
    @Optional()
    private readonly dockerSandbox?: LoopsDockerSandboxService,
  ) {}

  /** Winston-backed structured log; no-op for standalone (non-Nest) consumers. */
  private log(
    level: 'info' | 'warn' | 'error' | 'debug',
    message: string,
    meta?: Record<string, unknown>,
  ): void {
    this.logger?.[level](message, meta);
  }

  async runShardTests(input: {
    issueId: string;
    shardId: string;
    round: number;
    cwd: string;
    request?: LoopRunShardTestsRequest;
    /** gstack/0 P0-1: Per-workspace sandbox profile for runtime enforcement. */
    sandboxProfile?: LoopsSandboxProfile;
  }): Promise<LoopTestRecord> {
    const config = await readLoopsRuntimeConfig();
    const commands = input.request?.commands?.length
      ? input.request.commands
      : config.tests.defaultCommands;
    const results: CommandResult[] = [];
    const canaryToken = this.createCanaryToken(input.issueId, input.shardId, input.round);
    const leakedCanaryCommands: string[] = [];
    const blockedNetworkTools: string[] = [];
    const blockedWritePatterns: string[] = [];
    let executedCommands = 0;
    const sandboxProfile = input.sandboxProfile;
    const effectiveAllowedCommands =
      sandboxProfile?.allowedCommands ?? config.tests.allowedCommands;

    for (const command of commands) {
      const policy = this.evaluateCommandPolicy(command, effectiveAllowedCommands, sandboxProfile);
      if (!policy.allowed) {
        if (policy.networkTool) blockedNetworkTools.push(policy.networkTool);
        if (policy.writePattern) blockedWritePatterns.push(policy.writePattern);
        results.push(this.blockedCommand(command, policy.reason));
        continue;
      }
      executedCommands += 1;
      const commandResult = await this.runCommand(command, input.cwd, canaryToken, sandboxProfile);
      const inspected = this.inspectCanary(commandResult, canaryToken);
      if (inspected.leaked) {
        leakedCanaryCommands.push(command);
      }
      results.push(inspected.result);
    }

    const coverage = this.extractCoverage(results);
    const coverageFailures = this.coverageFailures(coverage, config.tests.coverageFloor);
    const failed = results.filter((item) => item.exitCode !== 0);
    const canaryFailures = leakedCanaryCommands.map((command) => ({
      name: 'runtime-security:canary',
      reason: `Runtime canary was leaked by command "${command}". Output was redacted before persistence.`,
    }));
    const failedTests = [
      ...failed.map((item) => ({
        name: item.command,
        reason: item.stderr || item.stdout || `Command exited with ${item.exitCode}`,
      })),
      ...coverageFailures,
      ...canaryFailures,
    ];
    const status = failed.length === 0 ? 'TEST-PASS' : 'TEST-FAIL';
    const created = new Date().toISOString();
    const runtimeSecurityPolicy = this.buildPolicySnapshot(
      input.shardId,
      input.round,
      effectiveAllowedCommands,
      this.resolveCanaryStatus(executedCommands, leakedCanaryCommands),
      leakedCanaryCommands,
      blockedNetworkTools,
      blockedWritePatterns,
      created,
      sandboxProfile,
    );

    return {
      id: `test-record-${input.shardId}-r${input.round}-${Date.now()}`,
      issueId: input.issueId,
      shardId: input.shardId,
      round: input.round,
      runner: input.request?.runner ?? 'loops-runner',
      reviewer: 'system',
      status: failedTests.length === 0 ? status : 'TEST-FAIL',
      commands: results,
      coverage,
      failedTests,
      fixInstructions:
        failedTests.length > 0
          ? ['检查失败命令输出与覆盖率阈值，修复实现或补齐测试环境后重新运行 shard tests。']
          : [],
      runtimeSecurityPolicy,
      created,
    };
  }

  private buildPolicySnapshot(
    shardId: string,
    round: number,
    allowedCommands: string[],
    canaryStatus: CanaryStatus,
    leakedCanaryCommands: string[],
    blockedNetworkTools: string[],
    blockedWritePatterns: string[],
    capturedAt: string,
    sandboxProfile?: LoopsSandboxProfile,
  ): LoopRuntimeSecurityPolicySnapshot {
    const dockerActive = sandboxProfile?.shellEnforcement === 'strict-allowlist';
    return {
      id: `runtime-security-${shardId}-r${round}`,
      mode: 'test-command',
      sandboxBackend: dockerActive ? ('docker' as const) : ('local-shell' as const),
      shell: {
        strategy:
          sandboxProfile?.shellEnforcement === 'strict-allowlist'
            ? ('strict-allowlist' as const)
            : ('allowlist' as const),
        allowedCommands,
        blockedOperators: ['&&', '||', ';', '|', '<', '>', '`', '$(', 'newline'],
      },
      network: {
        strategy:
          sandboxProfile?.network === 'deny'
            ? ('deny-by-default' as const)
            : ('deny-by-default' as const),
        status:
          blockedNetworkTools.length > 0
            ? 'blocked'
            : sandboxProfile?.network === 'open-with-approval'
              ? ('allowed-by-override' as const)
              : ('not-requested' as const),
        blockedTools: [...new Set(blockedNetworkTools)],
        sandboxEnforced: dockerActive,
      },
      write: {
        strategy: 'workspace-scoped',
        scope: 'target-repo' as const,
        blockedPatterns: [...new Set(blockedWritePatterns)],
        sandboxEnforced: dockerActive && sandboxProfile?.writeScope === 'artifact-only',
      },
      approvals: {
        override: 'not-supported',
        requiredFor: [
          'shell-control-operator',
          'command-prefix-outside-allowlist',
          'network-command',
          'write-outside-workspace',
        ],
      },
      canary: {
        strategy: 'env-token',
        status: canaryStatus,
        leakedInCommands: leakedCanaryCommands,
      },
      capturedAt,
    };
  }

  private createCanaryToken(issueId: string, shardId: string, round: number): string {
    return `loops-canary:${issueId}:${shardId}:r${round}:${randomUUID()}`;
  }

  private resolveCanaryStatus(executedCommands: number, leakedCommands: string[]): CanaryStatus {
    if (executedCommands === 0) return 'not-run';
    return leakedCommands.length > 0 ? 'leaked' : 'armed';
  }

  private evaluateCommandPolicy(
    command: string,
    allowedCommands: string[],
    sandboxProfile?: LoopsSandboxProfile,
  ): CommandPolicyDecision {
    const normalized = command.trim();
    if (SHELL_CONTROL_OPERATOR_PATTERN.test(normalized)) {
      return {
        allowed: false,
        reason:
          'Command is blocked by runtime security policy: shell control operators are not allowed.',
      };
    }
    const prefixAllowed = allowedCommands.some((allowed) => {
      const prefix = allowed.trim();
      return normalized === prefix || normalized.startsWith(`${prefix} `);
    });
    if (!prefixAllowed) {
      return {
        allowed: false,
        reason: 'Command is not allowed by .loops/config.yaml tests.allowed_commands.',
      };
    }
    const networkPatterns = [
      ...NETWORK_COMMAND_PATTERNS,
      ...(sandboxProfile?.extraBlockedTools ?? []).map((tool) => ({
        label: tool,
        pattern: new RegExp(`\\b${this.escapeRegExp(tool)}\\b`),
      })),
    ];
    const networkMatch = networkPatterns.find((item) => item.pattern.test(normalized));
    if (networkMatch) {
      return {
        allowed: false,
        reason: `Command is blocked by runtime security policy: network access via ${networkMatch.label} requires an approved override.`,
        networkTool: networkMatch.label,
      };
    }
    const writePatterns = [
      ...WRITE_ESCAPE_PATTERNS,
      ...(sandboxProfile?.extraBlockedPatterns ?? []).map((pattern) => ({
        label: pattern,
        pattern: new RegExp(pattern),
      })),
    ];
    const writeMatch = writePatterns.find((item) => item.pattern.test(normalized));
    if (writeMatch) {
      return {
        allowed: false,
        reason: `Command is blocked by runtime security policy: write pattern ${writeMatch.label} escapes the target repo scope.`,
        writePattern: writeMatch.label,
      };
    }
    return { allowed: true };
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private blockedCommand(command: string, reason: string): CommandResult {
    this.log('warn', '[Loops] blocked test command by runtime security policy', {
      command,
      reason,
    });
    return {
      command,
      exitCode: 126,
      durationMs: 0,
      stdout: '',
      stderr: reason,
    };
  }

  private async runCommand(
    command: string,
    cwd: string,
    canaryToken: string,
    sandboxProfile?: LoopsSandboxProfile,
  ): Promise<CommandResult> {
    const useDocker = sandboxProfile?.shellEnforcement === 'strict-allowlist' && this.dockerSandbox;
    if (useDocker) {
      return this.runCommandInDocker(command, cwd, canaryToken, sandboxProfile!);
    }
    return this.runCommandLocal(command, cwd, canaryToken);
  }

  /** Execute a command inside a Docker container with the configured sandbox profile. */
  private async runCommandInDocker(
    command: string,
    cwd: string,
    canaryToken: string,
    sandboxProfile: LoopsSandboxProfile,
  ): Promise<CommandResult> {
    const started = Date.now();
    const sandbox = this.dockerSandbox!;
    const safeCwd = await resolveAllowedTargetRepo(cwd);

    const dockerOpts: DockerSandboxRunOptions = {
      image: 'node:22-alpine',
      command,
      workdir: '/workspace',
      mountPath: safeCwd,
      networkMode: sandboxProfile.network === 'deny' ? 'none' : 'bridge',
      readonlyRootfs: sandboxProfile.writeScope === 'artifact-only',
      capDrop: ['ALL'],
      capAdd: [],
      memoryLimitMb: 512,
      cpuLimit: 1,
      timeoutSec: 120,
      envVars: { LOOPS_RUNTIME_CANARY: canaryToken },
    };

    const validation = sandbox.validateProfile(dockerOpts);
    if (!validation.valid) {
      this.log('warn', '[Loops] Docker sandbox profile validation warnings', {
        command,
        warnings: validation.warnings,
      });
    }

    const { command: dockerCommand, args } = sandbox.buildSandboxedExec(dockerOpts);
    try {
      const result = await execFileAsync(dockerCommand, args, {
        cwd: safeCwd,
        timeout: (dockerOpts.timeoutSec ?? 120) * 1000,
        maxBuffer: 1024 * 1024 * 8,
      });
      return {
        command,
        exitCode: 0,
        durationMs: Date.now() - started,
        stdout: this.truncate(result.stdout),
        stderr: this.truncate(result.stderr),
      };
    } catch (error) {
      const err = error as {
        code?: number;
        signal?: string;
        stdout?: string;
        stderr?: string;
        message?: string;
      };
      this.log('warn', '[Loops] Docker sandbox command exited non-zero', {
        command,
        exitCode: typeof err.code === 'number' ? err.code : null,
        signal: err.signal,
      });
      return {
        command,
        exitCode: typeof err.code === 'number' ? err.code : null,
        durationMs: Date.now() - started,
        stdout: this.truncate(err.stdout ?? ''),
        stderr: this.truncate(err.stderr ?? err.message ?? err.signal ?? ''),
      };
    }
  }

  /** Execute a command locally via /bin/sh (existing behavior). */
  private async runCommandLocal(
    command: string,
    cwd: string,
    canaryToken: string,
  ): Promise<CommandResult> {
    const started = Date.now();
    try {
      const safeCwd = await resolveAllowedTargetRepo(cwd);
      const result = await execFileAsync('/bin/sh', ['-lc', command], {
        cwd: safeCwd,
        env: { ...process.env, LOOPS_RUNTIME_CANARY: canaryToken },
        timeout: 120000,
        maxBuffer: 1024 * 1024 * 8,
      });
      return {
        command,
        exitCode: 0,
        durationMs: Date.now() - started,
        stdout: this.truncate(result.stdout),
        stderr: this.truncate(result.stderr),
      };
    } catch (error) {
      const err = error as {
        code?: number;
        signal?: string;
        stdout?: string;
        stderr?: string;
        message?: string;
      };
      this.log('warn', '[Loops] test command exited non-zero', {
        command,
        exitCode: typeof err.code === 'number' ? err.code : null,
        signal: err.signal,
      });
      return {
        command,
        exitCode: typeof err.code === 'number' ? err.code : null,
        durationMs: Date.now() - started,
        stdout: this.truncate(err.stdout ?? ''),
        stderr: this.truncate(err.stderr ?? err.message ?? err.signal ?? ''),
      };
    }
  }

  private inspectCanary(
    result: CommandResult,
    canaryToken: string,
  ): { result: CommandResult; leaked: boolean } {
    const leaked = result.stdout.includes(canaryToken) || result.stderr.includes(canaryToken);
    if (!leaked) {
      return { result, leaked: false };
    }
    return {
      leaked: true,
      result: {
        ...result,
        stdout: this.redactCanary(result.stdout, canaryToken),
        stderr: this.redactCanary(result.stderr, canaryToken),
      },
    };
  }

  private redactCanary(value: string, canaryToken: string): string {
    return value.split(canaryToken).join(CANARY_REDACTION);
  }

  private truncate(value: string) {
    if (value.length <= OUTPUT_LIMIT) return value;
    return `${value.slice(0, OUTPUT_LIMIT)}\n[truncated ${value.length - OUTPUT_LIMIT} chars]`;
  }

  private extractCoverage(results: CommandResult[]): Coverage | undefined {
    const text = results.map((item) => `${item.stdout}\n${item.stderr}`).join('\n');
    const lines = this.matchCoverageMetric(text, /lines\s*[:|]\s*([0-9]+(?:\.[0-9]+)?)%?/i);
    const branches = this.matchCoverageMetric(text, /branches\s*[:|]\s*([0-9]+(?:\.[0-9]+)?)%?/i);
    const table = this.matchCoverageTable(text);
    const coverage = {
      lines: lines ?? table?.lines,
      branches: branches ?? table?.branches,
    };
    return coverage.lines === undefined && coverage.branches === undefined ? undefined : coverage;
  }

  private matchCoverageMetric(text: string, pattern: RegExp) {
    const match = text.match(pattern);
    if (!match?.[1]) return undefined;
    const value = Number(match[1]);
    return Number.isFinite(value) ? value : undefined;
  }

  private matchCoverageTable(text: string): Coverage | undefined {
    const row = text
      .split('\n')
      .map((line) => line.trim())
      .find((line) => /^all files\s*\|/i.test(line));
    if (!row) return undefined;
    const cells = row
      .split('|')
      .map((cell) => Number(cell.trim().replace('%', '')))
      .filter((value) => Number.isFinite(value));
    if (cells.length < 4) return undefined;
    return {
      branches: cells[1],
      lines: cells[3],
    };
  }

  private coverageFailures(
    coverage: Coverage | undefined,
    floor: { lines?: number; branches?: number },
  ) {
    const failures: LoopTestRecord['failedTests'] = [];
    if (floor.lines !== undefined && coverage?.lines === undefined) {
      failures.push({
        name: 'coverage:lines',
        reason: `Lines coverage is missing while floor ${floor.lines}% is configured.`,
      });
    }
    if (
      floor.lines !== undefined &&
      coverage?.lines !== undefined &&
      coverage.lines < floor.lines
    ) {
      failures.push({
        name: 'coverage:lines',
        reason: `Lines coverage ${coverage.lines}% is below floor ${floor.lines}%.`,
      });
    }
    if (floor.branches !== undefined && coverage?.branches === undefined) {
      failures.push({
        name: 'coverage:branches',
        reason: `Branches coverage is missing while floor ${floor.branches}% is configured.`,
      });
    }
    if (
      floor.branches !== undefined &&
      coverage?.branches !== undefined &&
      coverage.branches < floor.branches
    ) {
      failures.push({
        name: 'coverage:branches',
        reason: `Branches coverage ${coverage.branches}% is below floor ${floor.branches}%.`,
      });
    }
    return failures;
  }
}
