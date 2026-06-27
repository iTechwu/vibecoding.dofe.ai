import { Injectable } from '@nestjs/common';
import type {
  LoopsRemoteRunnersLogSink,
  LoopsRemoteRunnersService,
  LoopsRemoteShardExecutionPort,
  LoopsRemoteShardExecutionJob,
  LoopsRemoteShardRuntimePort,
} from '@app/services/loops-remote-runners';
import type {
  LoopsAgentAdapter,
  LoopsClaudeAdapter,
  LoopsRunnerService,
} from '@app/services/loops-runners';
import type { LoopsDockerSandboxService } from '@app/services/loops-runtime';
import { LoopsRemoteShardStateAdapter } from './loops-remote-shard-state.adapter';
import { LoopsRemoteShardDetailAdapter } from './loops-remote-shard-detail.adapter';
import { LoopsRemoteRunnersLogAdapter } from './loops-remote-runners-log.adapter';

/**
 * API-layer adapter for remote shard runtime wiring.
 *
 * N7 owns the CLI/Docker/runner/review runtime callbacks here while the facade
 * still supplies the remaining loop-state mutations through a narrow bridge.
 */
@Injectable()
export class LoopsRemoteShardRuntimeAdapter {
  constructor(
    private readonly detailAdapter: LoopsRemoteShardDetailAdapter,
    private readonly logAdapter: LoopsRemoteRunnersLogAdapter,
    private readonly runner: LoopsRunnerService,
    private readonly claudeAdapter: LoopsClaudeAdapter,
    private readonly agentAdapter: LoopsAgentAdapter,
    private readonly stateAdapter: LoopsRemoteShardStateAdapter,
    private readonly dockerSandbox?: LoopsDockerSandboxService,
  ) {}

  get runtimePort(): LoopsRemoteShardRuntimePort {
    return {
      readDetail: (issueId: string) => this.detailAdapter.readDetail(issueId),
      runImplementation: (input) => this.runImplementation(input),
      persistImplementation: (issueId, shardId, record) =>
        this.stateAdapter.persistImplementation(issueId, shardId, record),
      runTests: (input) =>
        this.runner.runShardTests({
          issueId: input.issueId,
          shardId: input.shardId,
          round: input.round,
          cwd: input.cwd,
          request: {
            commands: input.command ? [input.command] : undefined,
            runner: `remote-runner:${input.runtimeBackend}`,
          },
          sandboxProfile:
            input.runtimeBackend === 'docker'
              ? {
                  network: input.sandboxProfile === 'strict' ? 'deny' : 'allowlist',
                  writeScope: 'repo',
                  shellEnforcement: 'allowlist',
                  secretMode: 'redacted',
                }
              : undefined,
        }),
      review: (input) => this.agentAdapter.review(input),
      applyReview: (issueId, shardId, request) =>
        this.stateAdapter.applyReview(issueId, shardId, request).then(() => undefined),
    };
  }

  get logSink(): LoopsRemoteRunnersLogSink {
    return {
      log: (level, message, meta) => this.logAdapter.log(level, message, meta),
    };
  }

  private async runImplementation(
    input: Parameters<LoopsRemoteShardRuntimePort['runImplementation']>[0],
  ): ReturnType<LoopsRemoteShardRuntimePort['runImplementation']> {
    if (input.runtimeBackend === 'docker' && this.dockerSandbox) {
      const dockerResult = await this.dockerSandbox.executeOrThrow({
        image: input.sandboxProfile ?? 'dofe-ai/sandbox:latest',
        command:
          input.command ?? `codex implement --shard ${input.shard.id} --issue ${input.issue.id}`,
        workdir: input.issue.targetRepo,
        mountPath: input.issue.targetRepo,
        networkMode: 'none',
        readonlyRootfs: false,
        capDrop: ['ALL'],
        capAdd: [],
        timeoutSec: 600,
        memoryLimitMb: 2048,
      });
      return {
        record: {
          id: `impl-record-${input.shard.id}-r${input.round}-${Date.now()}`,
          issueId: input.issue.id,
          shardId: input.shard.id,
          round: input.round,
          implementer: `remote-runner:docker`,
          status: dockerResult.exitCode === 0 ? ('IMPLEMENTED' as const) : ('NEEDS-WORK' as const),
          summary: `Docker sandbox execution: exit ${dockerResult.exitCode}`,
          changedFiles: [],
          notes: dockerResult.stdout.slice(0, 2000),
          tokens: 0,
          created: new Date().toISOString(),
        },
        logContent: dockerResult.stdout,
      };
    }

    const result = await this.claudeAdapter.run({
      issue: input.issue,
      shard: input.shard,
      round: input.round,
      cwd: input.issue.targetRepo,
    });
    return {
      record: {
        ...result.record,
        implementer: `remote-runner:${input.runtimeBackend as LoopsRemoteShardExecutionJob['runtimeBackend']}`,
      },
    };
  }
}

export function createRemoteShardExecutionPort(
  remoteRunners: LoopsRemoteRunnersService,
  runtimeAdapter: LoopsRemoteShardRuntimeAdapter,
): LoopsRemoteShardExecutionPort {
  return remoteRunners.createShardExecutionPort(runtimeAdapter.runtimePort, runtimeAdapter.logSink);
}

export function createRemoteShardRuntimeAdapter(input: {
  detailAdapter: LoopsRemoteShardDetailAdapter;
  logAdapter: LoopsRemoteRunnersLogAdapter;
  runner: LoopsRunnerService;
  claudeAdapter: LoopsClaudeAdapter;
  agentAdapter: LoopsAgentAdapter;
  stateAdapter: LoopsRemoteShardStateAdapter;
  dockerSandbox?: LoopsDockerSandboxService;
}): LoopsRemoteShardRuntimeAdapter {
  return new LoopsRemoteShardRuntimeAdapter(
    input.detailAdapter,
    input.logAdapter,
    input.runner,
    input.claudeAdapter,
    input.agentAdapter,
    input.stateAdapter,
    input.dockerSandbox,
  );
}
