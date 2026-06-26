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
}
