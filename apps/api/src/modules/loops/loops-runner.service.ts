import { Injectable } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { LoopRunShardTestsRequest, LoopTestRecord } from '@repo/contracts';

const execFileAsync = promisify(execFile);
const OUTPUT_LIMIT = 12000;

type CommandResult = LoopTestRecord['commands'][number];

@Injectable()
export class LoopsRunnerService {
  async runShardTests(input: {
    issueId: string;
    shardId: string;
    round: number;
    cwd: string;
    request?: LoopRunShardTestsRequest;
  }): Promise<LoopTestRecord> {
    const commands = input.request?.commands?.length ? input.request.commands : ['pnpm --version'];
    const results: CommandResult[] = [];

    for (const command of commands) {
      results.push(await this.runCommand(command, input.cwd));
    }

    const failed = results.filter((item) => item.exitCode !== 0);
    const status = failed.length === 0 ? 'TEST-PASS' : 'TEST-FAIL';
    const created = new Date().toISOString();

    return {
      id: `test-record-${input.shardId}-r${input.round}-${Date.now()}`,
      issueId: input.issueId,
      shardId: input.shardId,
      round: input.round,
      runner: input.request?.runner ?? 'loops-runner',
      reviewer: 'system',
      status,
      commands: results,
      failedTests: failed.map((item) => ({
        name: item.command,
        reason: item.stderr || item.stdout || `Command exited with ${item.exitCode}`,
      })),
      fixInstructions:
        failed.length > 0
          ? ['检查失败命令输出，修复实现或补齐测试环境后重新运行 shard tests。']
          : [],
      created,
    };
  }

  private async runCommand(command: string, cwd: string): Promise<CommandResult> {
    const started = Date.now();
    try {
      const result = await execFileAsync('/bin/sh', ['-lc', command], {
        cwd,
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
}
