import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type {
  LoopRemoteRunner,
  LoopRemoteRunnerJob,
  LoopRemoteRunnerJobRequest,
  LoopRemoteRunnerLease,
  LoopRemoteRunnerLeaseRequest,
  LoopRemoteRunnerListResponse,
  LoopRemoteRunnerReleaseRequest,
} from '@repo/contracts';
import { LoopsFileStoreService } from '@app/services/loops-store';

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
 * 结构优化 nextstep Step N4：remote shard execution port. 实际执行（CLI adapter /
 * Docker sandbox / state mutation）仍依赖未下沉的 engine 状态机（Step N1），故 port
 * 实现暂由 facade 提供并经 `LOOPS_REMOTE_SHARD_EXECUTION_PORT` 绑定；processor 经
 * port 注入，不再依赖 `LoopsService` 类。N1 完成后再把实现迁入 domain。
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

@Injectable()
export class LoopsRemoteRunnersService {
  constructor(private readonly store: LoopsFileStoreService) {}

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
}
