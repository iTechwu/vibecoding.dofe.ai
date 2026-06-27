import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Inject, Optional } from '@nestjs/common';
import { Job } from 'bullmq';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';
import { RedisService } from '@dofe/infra-redis';
import {
  LOOPS_REMOTE_SHARD_EXECUTION_PORT,
  type LoopsRemoteShardExecutionPort,
} from '@app/services/loops-remote-runners';

/**
 * R34a: Remote Runner BullMQ distributed queue processor.
 *
 * Queue: `loops-remote-runner`
 * Replaces the control-plane-only lease system with real BullMQ-based job
 * distribution. Each job represents a Remote Runner work item that is picked
 * up by an available worker, executed via the Codex/Claude CLI adapter layer,
 * and tracked with durable status in Redis + file store.
 *
 * Job lifecycle:
 *   enqueued → active → executing shard job → completed/failed
 *   failed jobs retry 3× with exponential backoff (5s → 25s → 125s)
 *
 * The actual CLI execution is delegated to the `LOOPS_REMOTE_SHARD_EXECUTION_PORT`,
 * implemented by the remote-runners domain service with API/runtime adapters
 * injected for Claude/Codex CLI, Docker sandbox, and shard review.
 *
 * 结构优化 nextstep Step N4：processor 经 shard execution port 注入，不再依赖
 * `LoopsService` 类；job lifecycle 编排已迁入 domain。
 */
@Processor('loops-remote-runner', {
  concurrency: 2, // Allow 2 concurrent runner jobs per worker
  limiter: {
    max: 20,
    duration: 60000, // 20 jobs per minute max
  },
})
export class LoopsRemoteRunnerProcessor extends WorkerHost {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    @Inject(LOOPS_REMOTE_SHARD_EXECUTION_PORT)
    private readonly shardExecutionPort: LoopsRemoteShardExecutionPort,
    @Optional() private readonly redis?: RedisService,
  ) {
    super();
  }

  async process(
    job: Job<
      {
        runnerId: string;
        leaseId: string;
        issueId: string;
        shardId?: string;
        runtimeBackend: 'codex-cli' | 'claude-code-cli' | 'docker';
        workerKind: 'implement' | 'test' | 'review' | 'custom';
        command?: string;
        artifactRoot: string;
        sandboxProfile?: string;
      },
      {
        status: string;
        artifacts: Array<{ kind: string; ref: string; sha256?: string; sizeBytes?: number }>;
      },
      string
    >,
  ): Promise<{
    status: string;
    artifacts: Array<{ kind: string; ref: string; sha256?: string; sizeBytes?: number }>;
  }> {
    const {
      runnerId,
      leaseId,
      issueId,
      shardId,
      runtimeBackend,
      workerKind,
      command,
      artifactRoot,
      sandboxProfile,
    } = job.data;

    this.logger.info(
      `[RemoteRunner] Processing job ${job.id}: ${workerKind} on ${runtimeBackend}`,
      {
        jobId: job.id,
        runnerId,
        issueId,
        shardId,
        workerKind,
        attempt: job.attemptsMade + 1,
      },
    );

    // Persist job status in Redis for real-time dashboard visibility
    await this.updateRedisStatus(leaseId, 'active', {
      jobId: job.id!,
      startedAt: new Date().toISOString(),
      attempt: job.attemptsMade + 1,
    });

    const artifacts: Array<{
      kind: string;
      ref: string;
      sha256?: string;
      sizeBytes?: number;
    }> = [];

    try {
      if (!shardId) {
        throw new Error('shardId is required for Remote Runner job execution');
      }

      // Delegate execution to LoopsService which routes to the appropriate
      // CLI adapter (Claude/Codex), Docker sandbox, or agent adapter based
      // on workerKind and runtimeBackend.
      const result = await this.shardExecutionPort.executeRemoteShardJob({
        issueId,
        shardId,
        workerKind: workerKind === 'custom' ? 'implement' : workerKind,
        runtimeBackend,
        artifactRoot,
        command,
        sandboxProfile,
      });

      artifacts.push(...result.artifacts);

      if (result.status === 'completed') {
        await this.updateRedisStatus(leaseId, 'completed', {
          jobId: job.id!,
          completedAt: new Date().toISOString(),
          artifacts: artifacts.map((a) => a.ref),
          summary: result.summary,
          durationMs: result.durationMs,
        });

        this.logger.info(`[RemoteRunner] Job ${job.id} completed: ${workerKind} on ${shardId}`, {
          jobId: job.id,
          shardId,
          artifactCount: artifacts.length,
          durationMs: result.durationMs,
        });

        return { status: 'completed', artifacts };
      }

      // Execution returned "failed" status — throw to trigger BullMQ retry
      throw new Error(result.error ?? 'Remote shard job execution failed');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[RemoteRunner] Job ${job.id} failed: ${message}`, {
        jobId: job.id,
        runnerId,
        issueId,
        shardId,
        error: message,
        attempt: job.attemptsMade + 1,
      });

      await this.updateRedisStatus(leaseId, 'failed', {
        jobId: job.id!,
        error: message,
        failedAt: new Date().toISOString(),
        attempt: job.attemptsMade + 1,
      });

      throw error; // Let BullMQ handle retry
    }
  }

  private async updateRedisStatus(
    leaseId: string,
    status: string,
    meta: Record<string, unknown>,
  ): Promise<void> {
    if (!this.redis) return;
    try {
      const key = `loops:remote-runner:lease:${leaseId}`;
      const current = JSON.parse((await this.redis.get(key)) ?? '{}');
      await this.redis.set(
        key,
        JSON.stringify({ ...current, status, ...meta, updatedAt: new Date().toISOString() }),
        { EX: 3600 },
      );
    } catch {
      // Redis is optional — degrade gracefully
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job): void {
    this.logger.info(`[RemoteRunner] Job ${job.id} completed and acknowledged`, {
      jobId: job.id,
    });
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    this.logger.error(`[RemoteRunner] Job ${job?.id ?? 'unknown'} exhausted retries`, {
      jobId: job?.id,
      error: error.message,
    });
  }

  @OnWorkerEvent('active')
  onActive(job: Job): void {
    this.logger.info(`[RemoteRunner] Job ${job.id} active — worker picked up`, {
      jobId: job.id,
      data: job.data,
    });
  }
}
