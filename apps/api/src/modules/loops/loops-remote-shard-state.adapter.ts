import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  LoopAnnotation,
  LoopDetail,
  LoopImplementationRecord,
  LoopReviewRecord,
  LoopReviewShardRequest,
  LoopShard,
  LoopStateItem,
} from '@repo/contracts';
import { LoopsFileStoreService, readLoopsRuntimeConfig } from '@app/services/loops-store';
import { LoopsEngineService } from '@app/services/loops-engine';
import type { LoopsGitAdapter } from '@app/services/loops-runners';
import { LoopsRemoteShardDetailAdapter } from './loops-remote-shard-detail.adapter';

@Injectable()
export class LoopsRemoteShardStateAdapter {
  constructor(
    private readonly detailAdapter: LoopsRemoteShardDetailAdapter,
    private readonly store: LoopsFileStoreService,
    private readonly engine: LoopsEngineService,
    private readonly gitAdapter: LoopsGitAdapter,
  ) {}

  async persistImplementation(
    issueId: string,
    shardId: string,
    record: LoopImplementationRecord,
  ): Promise<void> {
    const detail = await this.detailAdapter.readDetail(issueId);
    const nextAnnotations = detail.annotations.map((annotation) =>
      annotation.target === shardId
        ? {
            ...annotation,
            implStatus: 'done' as const,
            verdict: 'unreviewed' as const,
            coverage: record.changedFiles.length > 0 ? ('partial' as const) : annotation.coverage,
            location: Array.from(new Set([...annotation.location, ...record.changedFiles])),
            notes: `Implementation Record 已登记：${record.summary}`,
          }
        : annotation,
    );
    const nextShards = detail.shards.map((item) =>
      item.id === shardId ? { ...item, status: 'IMPLEMENTED' as const } : item,
    );
    const nextState = await this.engine.applyCostGuard(
      {
        ...detail.state,
        phase: 'PHASE_5_REVIEW',
        shardsInProgress: 0,
        updated: new Date().toISOString(),
      },
      { calls: 1, tokens: record.tokens ?? 0 },
    );

    await this.store.writeImplementationRecord({
      issueId,
      shardId,
      record,
      annotations: nextAnnotations,
      shards: nextShards,
      state: nextState,
    });
  }

  async applyReview(
    issueId: string,
    shardId: string,
    request: LoopReviewShardRequest,
  ): Promise<LoopReviewRecord> {
    const detail = await this.detailAdapter.readDetail(issueId);
    const shard = detail.shards.find((item) => item.id === shardId);
    if (!shard) {
      throw new NotFoundException(`Shard ${shardId} not found`);
    }

    const implementationRecord = detail.implementationRecords.find(
      (record) => record.shardId === shardId && record.round === detail.state.round,
    );
    if (!implementationRecord) {
      throw new BadRequestException('Implementation Record is required before shard review');
    }

    const testRecord = detail.testRecords.find(
      (record) => record.shardId === shardId && record.round === detail.state.round,
    );
    if (request.verdict === 'PASS' && testRecord?.status !== 'TEST-PASS') {
      throw new BadRequestException('Shard cannot be DONE until latest round tests pass');
    }

    const config = await readLoopsRuntimeConfig();
    const currentNeedsWorkCount = detail.reviewRecords.filter(
      (record) => record.shardId === shardId && record.verdict === 'NEEDS-WORK',
    ).length;
    const redoLimitExceeded =
      request.verdict === 'NEEDS-WORK' && currentNeedsWorkCount >= config.maxShardRedo;
    const effectiveVerdict: LoopReviewShardRequest['verdict'] = redoLimitExceeded
      ? 'FAIL'
      : request.verdict;
    const effectiveFixInstructions = redoLimitExceeded
      ? [
          ...request.fixInstructions,
          `Shard exceeded max_shard_redo=${config.maxShardRedo}; escalate to FAILED and require convergence/reloop decision.`,
        ]
      : request.fixInstructions;

    const now = new Date().toISOString();
    const record: LoopReviewRecord = {
      id: `review-record-${shardId}-r${detail.state.round}-${Date.now()}`,
      issueId,
      shardId,
      round: detail.state.round,
      reviewer: request.reviewer,
      verdict: effectiveVerdict,
      issues: request.issues,
      fixInstructions: effectiveFixInstructions,
      summary: redoLimitExceeded
        ? `${request.summary} Shard exceeded max_shard_redo=${config.maxShardRedo}; escalated to FAILED.`
        : request.summary,
      created: now,
    };

    const nextShards = this.applyShardReviewStatus(detail.shards, shardId, effectiveVerdict);
    const nextAnnotations = this.applyShardReviewAnnotations(
      detail.annotations,
      shardId,
      effectiveVerdict,
      record,
      testRecord?.status === 'TEST-PASS',
    );
    const shardsDone = nextShards.filter((item) => item.status === 'DONE').length;
    const nextState: LoopStateItem = {
      ...detail.state,
      phase: shardsDone === nextShards.length ? 'PHASE_6_CONVERGE' : 'PHASE_4_IMPLEMENT',
      shardsDone,
      shardsInProgress: 0,
      updated: now,
    };
    const guardedState = await this.engine.applyCostGuard(nextState);

    await this.store.writeReviewRecord({
      issueId,
      shardId,
      record,
      annotations: nextAnnotations,
      shards: nextShards,
      state: guardedState,
    });

    if (redoLimitExceeded) {
      await this.writeRedoLimitSideEffects(
        issueId,
        shardId,
        request,
        config.maxShardRedo,
        currentNeedsWorkCount,
      );
    }

    if (effectiveVerdict === 'PASS') {
      const commit = await this.gitAdapter.commitShard({
        issue: detail.issue,
        shard,
        changedFiles: implementationRecord.changedFiles,
      });
      await this.store.appendLog({
        type: 'SHARD_COMMIT',
        loop: issueId,
        shard: shardId,
        committed: commit.committed,
        message: commit.message,
        branch: commit.branch,
      });
    }

    return record;
  }

  private applyShardReviewStatus(
    shards: LoopShard[],
    shardId: string,
    verdict: LoopReviewShardRequest['verdict'],
  ): LoopShard[] {
    const shardStatus: LoopShard['status'] =
      verdict === 'PASS' ? 'DONE' : verdict === 'FAIL' ? 'FAILED' : 'NEEDS-WORK';
    return shards.map((item) => (item.id === shardId ? { ...item, status: shardStatus } : item));
  }

  private applyShardReviewAnnotations(
    annotations: LoopAnnotation[],
    shardId: string,
    verdict: LoopReviewShardRequest['verdict'],
    record: LoopReviewRecord,
    testsPassed: boolean,
  ): LoopAnnotation[] {
    const annotationVerdict: LoopAnnotation['verdict'] =
      verdict === 'PASS' ? 'pass' : verdict === 'FAIL' ? 'fail' : 'needs-work';
    return annotations.map((annotation) =>
      annotation.target === shardId
        ? {
            ...annotation,
            implStatus:
              verdict === 'PASS'
                ? ('done' as const)
                : verdict === 'FAIL'
                  ? ('failed' as const)
                  : annotation.implStatus,
            testStatus: testsPassed ? ('pass' as const) : annotation.testStatus,
            verdict: annotationVerdict,
            coverage: verdict === 'PASS' ? ('full' as const) : annotation.coverage,
            notes:
              verdict === 'PASS'
                ? `Review Record PASS：${record.summary}`
                : `Review Record ${verdict}：${record.fixInstructions.join('；') || record.summary}`,
          }
        : annotation,
    );
  }

  private async writeRedoLimitSideEffects(
    issueId: string,
    shardId: string,
    request: LoopReviewShardRequest,
    maxShardRedo: number,
    currentNeedsWorkCount: number,
  ): Promise<void> {
    await this.store.appendLog({
      type: 'SHARD_REDO_LIMIT',
      loop: issueId,
      shard: shardId,
      max_shard_redo: maxShardRedo,
      needs_work_count: currentNeedsWorkCount + 1,
      status: 'FAILED',
    });
    await this.store.writeNotification({
      issueId,
      channel: 'web',
      kind: 'SHARD_REDO_LIMIT',
      recipient: request.reviewer,
      title: `Shard redo limit reached: ${shardId}`,
      body: `Shard ${shardId} exceeded max_shard_redo=${maxShardRedo} and was marked FAILED for convergence or re-loop decision.`,
      actionHref: `/loops/${issueId}`,
    });
  }
}

export function createRemoteShardStateAdapter(input: {
  detailAdapter: LoopsRemoteShardDetailAdapter;
  store: LoopsFileStoreService;
  engine: LoopsEngineService;
  gitAdapter: LoopsGitAdapter;
}): LoopsRemoteShardStateAdapter {
  return new LoopsRemoteShardStateAdapter(
    input.detailAdapter,
    input.store,
    input.engine,
    input.gitAdapter,
  );
}
