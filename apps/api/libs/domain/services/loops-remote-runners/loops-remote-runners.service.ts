import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import type {
  LoopAnnotation,
  LoopDetail,
  LoopImplementationRecord,
  LoopRemoteRunner,
  LoopRemoteRunnerJob,
  LoopRemoteRunnerJobRequest,
  LoopRemoteRunnerLease,
  LoopRemoteRunnerLeaseRequest,
  LoopRemoteRunnerListResponse,
  LoopRemoteRunnerReleaseRequest,
  LoopReviewShardRequest,
  LoopShard,
  LoopTestRecord,
} from '@repo/contracts';
import { LoopsFileStoreService } from '@app/services/loops-store';
import type { LoopsReviewOutput } from '@app/services/loops-runners';

/**
 * Artifact storage port for remote runner job artifact upload (R36). Abstracts
 * the cross-tenant archive `fileStorage` so the remote-runners domain stays
 * decoupled from the API facade / object-storage wiring. When the port is
 * absent, artifacts remain in `.loops` only.
 */
export interface LoopsRemoteArtifactStoragePort {
  upload(vendor: string, bucket: string, storageKey: string, contentBase64: string): Promise<void>;
  privateDownloadUrl(
    vendor: string,
    bucket: string,
    storageKey: string,
    options: { expire: number },
  ): Promise<string>;
}

/** Optional log sink mirroring the `[RemoteRunner]` lifecycle logs the facade owned. */
export interface LoopsRemoteRunnersLogSink {
  log(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>): void;
}

/**
 * 结构优化 nextstep Step N4：remote shard execution port. job lifecycle 编排
 * 已迁入 `LoopsRemoteRunnersService.executeRemoteShardJob`；CLI adapter / Docker
 * sandbox / reviewShard 等重依赖经 `LoopsRemoteShardRuntimePort` 注入。
 */
export const LOOPS_REMOTE_SHARD_EXECUTION_PORT = 'LOOPS_REMOTE_SHARD_EXECUTION_PORT';

export interface LoopsRemoteShardExecutionJob {
  issueId: string;
  shardId: string;
  workerKind: 'implement' | 'test' | 'review';
  runtimeBackend: 'codex-cli' | 'claude-code-cli' | 'docker';
  artifactRoot: string;
  command?: string;
  sandboxProfile?: string;
}

export interface LoopsRemoteShardExecutionResult {
  status: 'completed' | 'failed';
  artifacts: Array<{ kind: string; ref: string; sha256?: string; sizeBytes?: number }>;
  error?: string;
  summary?: string;
  durationMs: number;
}

export interface LoopsRemoteShardExecutionPort {
  executeRemoteShardJob(
    job: LoopsRemoteShardExecutionJob,
  ): Promise<LoopsRemoteShardExecutionResult>;
}

export interface LoopsRemoteShardRuntimePort {
  readDetail(issueId: string): Promise<LoopDetail>;
  runImplementation(input: {
    issue: LoopDetail['issue'];
    shard: LoopShard;
    round: number;
    runtimeBackend: LoopsRemoteShardExecutionJob['runtimeBackend'];
    command?: string;
    sandboxProfile?: string;
  }): Promise<{ record: LoopImplementationRecord; logContent?: string }>;
  persistImplementation(
    issueId: string,
    shardId: string,
    record: LoopImplementationRecord,
  ): Promise<void>;
  runTests(input: {
    issueId: string;
    shardId: string;
    round: number;
    cwd: string;
    runtimeBackend: LoopsRemoteShardExecutionJob['runtimeBackend'];
    command?: string;
    sandboxProfile?: string;
  }): Promise<LoopTestRecord>;
  review(input: {
    shard: LoopShard;
    implementationRecord: LoopImplementationRecord;
    testRecord?: LoopTestRecord;
  }): Promise<LoopsReviewOutput>;
  applyReview(issueId: string, shardId: string, request: LoopReviewShardRequest): Promise<void>;
}

@Injectable()
export class LoopsRemoteRunnersService {
  constructor(private readonly store: LoopsFileStoreService) {}

  createShardExecutionPort(
    runtimePort: LoopsRemoteShardRuntimePort,
    logSink?: LoopsRemoteRunnersLogSink,
  ): LoopsRemoteShardExecutionPort {
    return {
      executeRemoteShardJob: (job) => this.executeRemoteShardJob(job, runtimePort, logSink),
    };
  }

  listRemoteRunners(query: { limit?: number; page?: number } = {}): LoopRemoteRunnerListResponse {
    const list = this.buildRemoteRunnerItems();
    const limit = query.limit ?? 20;
    const page = query.page ?? 1;
    const start = (page - 1) * limit;
    return {
      list: list.slice(start, start + limit),
      total: list.length,
      page,
      limit,
    };
  }

  acquireRemoteRunnerLease(
    id: string,
    request: LoopRemoteRunnerLeaseRequest,
  ): LoopRemoteRunnerLease {
    const runner = this.getRemoteRunnerItem(id);
    const leasedAt = new Date();
    const expiresAt = new Date(leasedAt.getTime() + runner.leaseTtlSec * 1000);
    return {
      id: `lease-${id}-${randomUUID()}`,
      runnerId: id,
      issueId: request.issueId,
      shardId: request.shardId,
      runtimeBackend: request.runtimeBackend,
      status: 'leased',
      leasedAt: leasedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      artifactRoot: `${runner.artifactRoot}/leases`,
      message:
        'Control-plane lease acquired; execution still runs through Codex CLI / Claude Code CLI adapters.',
    };
  }

  releaseRemoteRunnerLease(
    id: string,
    request: LoopRemoteRunnerReleaseRequest,
  ): LoopRemoteRunnerLease {
    const runner = this.getRemoteRunnerItem(id);
    const releasedAt = new Date();
    return {
      id: request.leaseId,
      runnerId: id,
      runtimeBackend: 'codex-cli',
      status: 'released',
      leasedAt: releasedAt.toISOString(),
      expiresAt: releasedAt.toISOString(),
      artifactRoot: `${runner.artifactRoot}/leases`,
      message: request.reason ?? 'Control-plane lease released.',
    };
  }

  async runRemoteRunnerJob(
    id: string,
    request: LoopRemoteRunnerJobRequest,
  ): Promise<LoopRemoteRunnerJob> {
    const runner = this.getRemoteRunnerItem(id);
    const queuedAt = new Date();
    const startedAt = new Date(queuedAt.getTime() + 1);
    const finishedAt = new Date(startedAt.getTime() + 1);
    const jobId = `rr-job-${id}-${randomUUID()}`;
    const job: LoopRemoteRunnerJob = {
      id: jobId,
      runnerId: id,
      leaseId: request.leaseId,
      issueId: request.issueId,
      shardId: request.shardId,
      runtimeBackend: request.runtimeBackend,
      workerKind: request.workerKind,
      status: 'succeeded',
      queuedAt: queuedAt.toISOString(),
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      artifactRoot: `${runner.artifactRoot}/jobs/${jobId}`,
      artifacts: [],
      message:
        request.reason ??
        'Remote runner worker job materialized artifact manifest for Codex/Claude runtime handoff.',
    };

    return this.store.writeRemoteRunnerJob(job);
  }

  buildRemoteRunnerItems(): LoopRemoteRunner[] {
    return [
      {
        id: 'remote-runner-primary',
        name: 'Primary Remote Runner Pool',
        status: 'ready',
        runtimeBackends: ['codex-cli', 'claude-code-cli', 'docker'],
        capacity: {
          maxConcurrent: 4,
          leased: 0,
          available: 4,
        },
        queue: {
          pending: 0,
          running: 0,
        },
        sandboxProfile: 'remote-sandbox',
        artifactRoot: '.loops/runs/remote-runner-primary',
        leaseTtlSec: 1800,
        health: {
          ok: true,
          message:
            'Worker artifact provider is connected; execution handoff remains governed by Codex/Claude CLI adapters.',
        },
        risks: ['Distributed queue scheduling and resumable sandbox execution remain future work.'],
      },
    ];
  }

  getRemoteRunnerItem(id: string): LoopRemoteRunner {
    const found = this.buildRemoteRunnerItems().find((item) => item.id === id);
    if (!found) throw new NotFoundException(`Remote runner ${id} not found`);
    return found;
  }

  /**
   * R36: Upload Remote Runner job artifacts (manifest / worker-receipt /
   * worker-log / trace) to external object storage. The local artifact content
   * is read from the `.loops` store; the actual upload goes through the narrow
   * `LoopsRemoteArtifactStoragePort`. Behaviour matches the legacy facade
   * `uploadRemoteRunnerArtifacts`.
   *
   * 结构优化 nextstep Step N4：artifact IO 已下沉到 domain；facade 仅做 port 适配。
   */
  async uploadRemoteRunnerArtifacts(
    runnerId: string,
    jobId: string,
    input: { vendor?: string; bucket?: string },
    storagePort?: LoopsRemoteArtifactStoragePort,
    logSink?: LoopsRemoteRunnersLogSink,
  ): Promise<{
    jobId: string;
    uploaded: number;
    artifacts: Array<{ kind: string; storageKey: string; uploadUrl?: string }>;
    message: string;
  }> {
    const artifacts: Array<{ kind: string; storageKey: string; uploadUrl?: string }> = [];
    let uploaded = 0;

    if (!storagePort) {
      return {
        jobId,
        uploaded,
        artifacts,
        message: 'External storage not configured — artifacts remain in .loops only',
      };
    }

    try {
      const vendor = input.vendor ?? (process.env['FILE_STORAGE_VENDOR'] as string) ?? 'oss';
      const bucket = input.bucket ?? 'dofe-public';
      const artifactKinds = ['manifest', 'worker-receipt', 'worker-log', 'trace'];

      for (const kind of artifactKinds) {
        const storageKey = `loops/runs/${runnerId}/jobs/${jobId}/${kind}.json`;
        try {
          const content = this.store.readRemoteRunnerArtifact(runnerId, jobId, kind);
          if (content) {
            await storagePort.upload(
              vendor,
              bucket,
              storageKey,
              Buffer.from(content).toString('base64'),
            );
            const uploadUrl = await storagePort.privateDownloadUrl(vendor, bucket, storageKey, {
              expire: 30 * 24 * 3600,
            });
            artifacts.push({ kind, storageKey, uploadUrl });
            uploaded++;
          }
        } catch {
          // Skip individual artifacts that can't be uploaded
        }
      }

      logSink?.log('info', `[RemoteRunner] Uploaded ${uploaded} artifacts to external storage`, {
        runnerId,
        jobId,
        uploaded,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logSink?.log('error', `[RemoteRunner] External artifact upload failed`, {
        runnerId,
        jobId,
        error: message,
      });
      return {
        jobId,
        uploaded,
        artifacts,
        message: `Upload partially failed: ${message}`,
      };
    }

    return {
      jobId,
      uploaded,
      artifacts,
      message:
        uploaded > 0
          ? `${uploaded} artifacts uploaded to external storage`
          : 'External storage not configured — artifacts remain in .loops only',
    };
  }

  async executeRemoteShardJob(
    job: LoopsRemoteShardExecutionJob,
    runtimePort: LoopsRemoteShardRuntimePort,
    logSink?: LoopsRemoteRunnersLogSink,
  ): Promise<LoopsRemoteShardExecutionResult> {
    const start = Date.now();
    const { issueId, shardId, workerKind, runtimeBackend, artifactRoot, command, sandboxProfile } =
      job;
    const artifacts: Array<{ kind: string; ref: string; sha256?: string; sizeBytes?: number }> = [];

    try {
      const detail = await runtimePort.readDetail(issueId);
      const shard = detail.shards.find((item) => item.id === shardId);
      if (!shard) {
        return {
          status: 'failed',
          artifacts,
          error: `Shard ${shardId} not found in issue ${issueId}`,
          durationMs: Date.now() - start,
        };
      }

      if (workerKind === 'implement') {
        return this.executeImplementationJob({
          detail,
          shard,
          job,
          runtimePort,
          logSink,
          artifacts,
          start,
        });
      }
      if (workerKind === 'test') {
        return this.executeTestJob({
          detail,
          job,
          runtimePort,
          logSink,
          artifacts,
          start,
        });
      }
      if (workerKind === 'review') {
        return this.executeReviewJob({
          detail,
          shard,
          job,
          runtimePort,
          logSink,
          artifacts,
          start,
        });
      }

      return {
        status: 'failed',
        artifacts,
        error: `Unknown workerKind: ${workerKind}`,
        durationMs: Date.now() - start,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logSink?.log('error', `[RemoteRunner] Job failed: ${workerKind} on ${shardId}`, {
        issueId,
        shardId,
        workerKind,
        error: message,
      });

      try {
        artifacts.push(
          this.writeArtifact(
            artifactRoot,
            'worker.log',
            `ERROR [${new Date().toISOString()}] ${workerKind} on ${shardId}: ${message}\n${error instanceof Error ? error.stack : ''}`,
            logSink,
          ),
        );
      } catch {
        // Best effort.
      }

      return {
        status: 'failed',
        artifacts,
        error: message,
        summary: `Execution failed: ${message.slice(0, 200)}`,
        durationMs: Date.now() - start,
      };
    }
  }

  private async executeImplementationJob(input: {
    detail: LoopDetail;
    shard: LoopShard;
    job: LoopsRemoteShardExecutionJob;
    runtimePort: LoopsRemoteShardRuntimePort;
    logSink?: LoopsRemoteRunnersLogSink;
    artifacts: Array<{ kind: string; ref: string; sha256?: string; sizeBytes?: number }>;
    start: number;
  }): Promise<LoopsRemoteShardExecutionResult> {
    const { detail, shard, job, runtimePort, logSink, artifacts, start } = input;
    const { issueId, shardId, runtimeBackend, artifactRoot, command, sandboxProfile } = job;
    logSink?.log(
      'info',
      `[RemoteRunner] Starting implementation: ${shardId} on ${runtimeBackend}`,
      {
        issueId,
        shardId,
        runtimeBackend,
      },
    );

    const inProgressShards = detail.shards.map((item) =>
      item.id === shardId ? { ...item, status: 'IN_PROGRESS' as const } : item,
    );
    await this.store.writeShardProgress({
      issueId,
      from: shard.status,
      to: 'IN_PROGRESS',
      actor: `remote-runner:${runtimeBackend}`,
      shardId,
      state: {
        ...detail.state,
        phase: 'PHASE_4_IMPLEMENT',
        shardsInProgress: 1,
        updated: new Date().toISOString(),
      },
      shards: inProgressShards,
    });

    const { record, logContent } = await runtimePort.runImplementation({
      issue: detail.issue,
      shard,
      round: detail.state.round,
      runtimeBackend,
      command,
      sandboxProfile,
    });
    if (logContent) {
      artifacts.push(this.writeArtifact(artifactRoot, 'worker.log', logContent, logSink));
    }
    await runtimePort.persistImplementation(issueId, shardId, record);

    artifacts.push(
      this.writeArtifact(
        artifactRoot,
        'handoff.json',
        JSON.stringify(
          {
            shardId,
            runtimeBackend,
            implementationId: record.id,
            status: record.status,
            summary: record.summary,
            changedFiles: record.changedFiles,
            executedAt: new Date().toISOString(),
          },
          null,
          2,
        ),
        logSink,
      ),
    );

    logSink?.log('info', `[RemoteRunner] Implementation completed: ${shardId}`, {
      issueId,
      shardId,
      runtimeBackend,
      status: record.status,
    });

    return {
      status: 'completed',
      artifacts,
      summary: record.summary,
      durationMs: Date.now() - start,
    };
  }

  private async executeTestJob(input: {
    detail: LoopDetail;
    job: LoopsRemoteShardExecutionJob;
    runtimePort: LoopsRemoteShardRuntimePort;
    logSink?: LoopsRemoteRunnersLogSink;
    artifacts: Array<{ kind: string; ref: string; sha256?: string; sizeBytes?: number }>;
    start: number;
  }): Promise<LoopsRemoteShardExecutionResult> {
    const { detail, job, runtimePort, logSink, artifacts, start } = input;
    const { issueId, shardId, runtimeBackend, artifactRoot, command, sandboxProfile } = job;
    logSink?.log('info', `[RemoteRunner] Starting tests: ${shardId}`, {
      issueId,
      shardId,
      runtimeBackend,
    });

    const testRecord = await runtimePort.runTests({
      issueId,
      shardId,
      round: detail.state.round,
      cwd: detail.issue.targetRepo,
      runtimeBackend,
      command,
      sandboxProfile,
    });

    const testStatus: LoopAnnotation['testStatus'] =
      testRecord.status === 'TEST-PASS' ? 'pass' : 'fail';
    const testVerdict: LoopAnnotation['verdict'] =
      testRecord.status === 'TEST-PASS' ? 'unreviewed' : 'needs-work';
    const nextAnnotations = detail.annotations.map((annotation) =>
      annotation.target === shardId
        ? {
            ...annotation,
            testStatus,
            verdict: testVerdict,
            notes:
              testRecord.failedTests.length > 0
                ? `Test failures: ${testRecord.failedTests.map((failure) => failure.name).join(', ')}`
                : 'Tests passed — awaiting review.',
          }
        : annotation,
    );
    const nextShards = detail.shards.map((item) =>
      item.id === shardId && testRecord.status === 'TEST-FAIL'
        ? { ...item, status: 'NEEDS-WORK' as const }
        : item,
    );
    await this.store.writeTestRecord({
      issueId,
      shardId,
      record: testRecord,
      annotations: nextAnnotations,
      shards: nextShards,
      state: {
        ...detail.state,
        phase: 'PHASE_5_REVIEW',
        updated: new Date().toISOString(),
      },
    });

    artifacts.push(
      this.writeArtifact(
        artifactRoot,
        'test-results.json',
        JSON.stringify(
          {
            shardId,
            runtimeBackend,
            testRecordId: testRecord.id,
            status: testRecord.status,
            commandCount: testRecord.commands.length,
            failedTests: testRecord.failedTests,
            coverage: testRecord.coverage,
            executedAt: new Date().toISOString(),
          },
          null,
          2,
        ),
        logSink,
      ),
    );

    logSink?.log('info', `[RemoteRunner] Tests ${testRecord.status}: ${shardId}`, {
      issueId,
      shardId,
      status: testRecord.status,
    });

    return {
      status: 'completed',
      artifacts,
      summary: `Tests ${testRecord.status}: ${testRecord.failedTests.length} failures`,
      durationMs: Date.now() - start,
    };
  }

  private async executeReviewJob(input: {
    detail: LoopDetail;
    shard: LoopShard;
    job: LoopsRemoteShardExecutionJob;
    runtimePort: LoopsRemoteShardRuntimePort;
    logSink?: LoopsRemoteRunnersLogSink;
    artifacts: Array<{ kind: string; ref: string; sha256?: string; sizeBytes?: number }>;
    start: number;
  }): Promise<LoopsRemoteShardExecutionResult> {
    const { detail, shard, job, runtimePort, logSink, artifacts, start } = input;
    const { issueId, shardId, runtimeBackend, artifactRoot } = job;
    logSink?.log('info', `[RemoteRunner] Starting review: ${shardId}`, {
      issueId,
      shardId,
      runtimeBackend,
    });

    const implementationRecord = detail.implementationRecords.find(
      (record) => record.shardId === shardId && record.round === detail.state.round,
    );
    if (!implementationRecord) {
      return {
        status: 'failed',
        artifacts,
        error: `No implementation record found for shard ${shardId} at round ${detail.state.round}`,
        durationMs: Date.now() - start,
      };
    }

    const testRecord = detail.testRecords.find(
      (record) => record.shardId === shardId && record.round === detail.state.round,
    );
    const review = await runtimePort.review({ shard, implementationRecord, testRecord });
    artifacts.push(
      this.writeArtifact(
        artifactRoot,
        'review-verdict.json',
        JSON.stringify(
          {
            shardId,
            runtimeBackend,
            verdict: review.verdict,
            issues: review.issues,
            fixInstructions: review.fixInstructions,
            summary: review.summary,
            reviewedAt: new Date().toISOString(),
          },
          null,
          2,
        ),
        logSink,
      ),
    );

    await runtimePort.applyReview(issueId, shardId, {
      reviewer: `remote-runner:${runtimeBackend}`,
      verdict: review.verdict,
      summary: review.summary,
      issues: review.issues,
      fixInstructions: review.fixInstructions,
    });

    logSink?.log('info', `[RemoteRunner] Review ${review.verdict}: ${shardId}`, {
      issueId,
      shardId,
      verdict: review.verdict,
    });

    return {
      status: 'completed',
      artifacts,
      summary: `Review ${review.verdict}: ${review.summary}`,
      durationMs: Date.now() - start,
    };
  }

  private writeArtifact(
    artifactRoot: string,
    filename: string,
    content: string,
    logSink?: LoopsRemoteRunnersLogSink,
  ): { kind: string; ref: string; sha256?: string; sizeBytes?: number } {
    const ref = `${artifactRoot}/${filename}`;
    const sha256 = createHash('sha256').update(content).digest('hex');
    const sizeBytes = Buffer.byteLength(content, 'utf8');
    try {
      this.store.writeRemoteRunnerArtifact(ref, content);
    } catch (error) {
      logSink?.log('warn', `[RemoteRunner] Failed to write artifact: ${ref}`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return { kind: filename.replace(/\.\w+$/, ''), ref, sha256, sizeBytes };
  }
}
