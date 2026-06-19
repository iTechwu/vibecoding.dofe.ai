import { Injectable } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { LoopRunShardTestsRequest, LoopTestRecord } from '@repo/contracts';
import { resolveAllowedTargetRepo } from './loops-path-policy.util';
import { readLoopsRuntimeConfig } from './loops-runtime-config.util';

const execFileAsync = promisify(execFile);
const OUTPUT_LIMIT = 12000;

type CommandResult = LoopTestRecord['commands'][number];
type Coverage = NonNullable<LoopTestRecord['coverage']>;

@Injectable()
export class LoopsRunnerService {
  async runShardTests(input: {
    issueId: string;
    shardId: string;
    round: number;
    cwd: string;
    request?: LoopRunShardTestsRequest;
  }): Promise<LoopTestRecord> {
    const config = await readLoopsRuntimeConfig();
    const commands = input.request?.commands?.length
      ? input.request.commands
      : config.tests.defaultCommands;
    const results: CommandResult[] = [];

    for (const command of commands) {
      if (!this.isAllowedCommand(command, config.tests.allowedCommands)) {
        results.push(this.blockedCommand(command));
        continue;
      }
      results.push(await this.runCommand(command, input.cwd));
    }

    const coverage = this.extractCoverage(results);
    const coverageFailures = this.coverageFailures(coverage, config.tests.coverageFloor);
    const failed = results.filter((item) => item.exitCode !== 0);
    const failedTests = [
      ...failed.map((item) => ({
        name: item.command,
        reason: item.stderr || item.stdout || `Command exited with ${item.exitCode}`,
      })),
      ...coverageFailures,
    ];
    const status = failed.length === 0 ? 'TEST-PASS' : 'TEST-FAIL';
    const created = new Date().toISOString();

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
      created,
    };
  }

  private isAllowedCommand(command: string, allowedCommands: string[]) {
    const normalized = command.trim();
    return allowedCommands.some((allowed) => {
      const prefix = allowed.trim();
      return normalized === prefix || normalized.startsWith(`${prefix} `);
    });
  }

  private blockedCommand(command: string): CommandResult {
    return {
      command,
      exitCode: 126,
      durationMs: 0,
      stdout: '',
      stderr: 'Command is not allowed by .loops/config.yaml tests.allowed_commands.',
    };
  }

  private async runCommand(command: string, cwd: string): Promise<CommandResult> {
    const started = Date.now();
    try {
      const safeCwd = await resolveAllowedTargetRepo(cwd);
      const result = await execFileAsync('/bin/sh', ['-lc', command], {
        cwd: safeCwd,
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
      return {
        command,
        exitCode: typeof err.code === 'number' ? err.code : null,
        durationMs: Date.now() - started,
        stdout: this.truncate(err.stdout ?? ''),
        stderr: this.truncate(err.stderr ?? err.message ?? err.signal ?? ''),
      };
    }
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
