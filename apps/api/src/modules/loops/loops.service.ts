import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateLoopIssueRequest,
  LoopAnnotation,
  LoopGlobalReviewRecord,
  LoopImplementationRecord,
  LoopInterventionRequest,
  LoopIssue,
  LoopRecordShardImplementationRequest,
  LoopReviewRecord,
  LoopReviewShardRequest,
  LoopRunShardTestsRequest,
  LoopReviewSpecRequest,
  LoopShard,
  LoopSpec,
  LoopStateItem,
  LoopTestMatrix,
} from '@repo/contracts';
import { LoopsFileStoreService } from './loops-file-store.service';
import { LoopsRunnerService } from './loops-runner.service';
import {
  LOOPS_AGENT_ADAPTER,
  type LoopsAgentAdapter,
} from './adapters/loops-agent-adapter.interface';
import {
  LOOPS_CLAUDE_ADAPTER,
  type LoopsClaudeAdapter,
} from './adapters/loops-claude-adapter.interface';
import {
  LOOPS_GIT_ADAPTER,
  type LoopsCommitShardResult,
  type LoopsGitAdapter,
} from './adapters/loops-git-adapter.interface';

@Injectable()
export class LoopsService {
  constructor(
    private readonly store: LoopsFileStoreService,
    private readonly runner: LoopsRunnerService,
    @Inject(LOOPS_AGENT_ADAPTER)
    private readonly agentAdapter: LoopsAgentAdapter,
    @Inject(LOOPS_CLAUDE_ADAPTER)
    private readonly claudeAdapter: LoopsClaudeAdapter,
    @Inject(LOOPS_GIT_ADAPTER)
    private readonly gitAdapter: LoopsGitAdapter,
  ) {}

  async list() {
    return this.store.list();
  }

  async getIssue(issueId: string) {
    try {
      return await this.store.readDetail(issueId);
    } catch {
      throw new NotFoundException(`Issue ${issueId} not found`);
    }
  }

  async createIssue(input: CreateLoopIssueRequest) {
    const now = new Date().toISOString();
    const issueId = this.createIssueId(now);
    const intakeId = this.store.intakeId(issueId);
    const rawPayloadRef = `.loops/intakes/${intakeId}.raw.json`;
    const issue: LoopIssue = {
      id: issueId,
      title: input.title,
      status: 'OPEN',
      priority: input.priority,
      created: now,
      updated: now,
      sourceChannel: 'web',
      sourceKind: 'web_form',
      submitterId: input.submitterId,
      submitterName: input.submitterName,
      targetRepo: input.targetRepo,
      body: input.body,
      acceptanceCriteria: input.acceptanceCriteria,
      rawPayloadRef,
    };
    const intake = {
      id: intakeId,
      issueId,
      sourceChannel: 'web' as const,
      sourceKind: 'web_form' as const,
      submitter: {
        provider: 'dofe-sso' as const,
        userId: input.submitterId,
        name: input.submitterName,
      },
      rawPayloadRef,
      status: 'NORMALIZED' as const,
      created: now,
    };
    const state: LoopStateItem = {
      issueId,
      phase: 'PHASE_1_SPEC',
      round: 1,
      specVersion: 'v0',
      shardsTotal: 0,
      shardsDone: 0,
      shardsInProgress: 0,
      reloopCount: 0,
      costTokens: 0,
      costCalls: 0,
      updated: now,
      paused: false,
    };

    await this.store.writeIssue({ issue, intake, state, rawPayload: input });
    return { issue, intake, state };
  }

  async generateSpec(issueId: string) {
    const detail = await this.getIssue(issueId);
    const now = new Date().toISOString();
    const spec = await this.agentAdapter.plan(detail.issue, now);
    const state: LoopStateItem = {
      ...detail.state,
      phase: 'PHASE_2_REVIEW',
      specVersion: 'v1',
      costCalls: detail.state.costCalls + 1,
      updated: now,
    };

    await this.store.writeSpec(detail.issue, spec, await this.store.enforceCostGuard(state));
    return this.store.readDetail(issueId);
  }

  async reviewSpec(issueId: string, request: LoopReviewSpecRequest) {
    const detail = await this.getIssue(issueId);
    if (!detail.spec) {
      throw new BadRequestException('Spec must be generated before review');
    }

    const now = new Date().toISOString();
    const nextStatus =
      request.action === 'approve'
        ? 'APPROVED'
        : request.action === 'reject'
          ? 'REJECTED'
          : 'REVISION_REQUESTED';
    const nextPhase =
      request.action === 'approve'
        ? 'PHASE_3_DECOMPOSE'
        : request.action === 'reject'
          ? 'CLOSED'
          : 'PHASE_1_SPEC';
    const spec: LoopSpec = {
      ...detail.spec,
      status: nextStatus,
      approvedBy: request.action === 'approve' ? request.reviewer : undefined,
      body: request.notes
        ? `${detail.spec.body}\n\n## 审核批注\n${request.notes}\n`
        : detail.spec.body,
    };
    const state: LoopStateItem = {
      ...detail.state,
      phase: nextPhase,
      updated: now,
    };

    await this.store.writeSpec(detail.issue, spec, state);
    await this.store.appendLog({
      type: 'SPEC_STATE',
      issue: issueId,
      spec: spec.id,
      to: spec.status,
      reviewer: request.reviewer,
    });
    return this.store.readDetail(issueId);
  }

  async decompose(issueId: string) {
    const detail = await this.getIssue(issueId);
    if (!detail.spec || detail.spec.status !== 'APPROVED') {
      throw new BadRequestException('Approved spec is required before decompose');
    }

    const now = new Date().toISOString();
    const { shards, annotations } = await this.agentAdapter.decompose(detail.issue, detail.spec);
    const testMatrix = await this.agentAdapter.designTests(detail.issue, detail.spec, shards, now);
    const state: LoopStateItem = {
      ...detail.state,
      phase: 'PHASE_4_IMPLEMENT',
      shardsTotal: shards.length,
      shardsDone: 0,
      shardsInProgress: 0,
      costCalls: detail.state.costCalls + 1,
      updated: now,
    };
    const guardedState = await this.store.enforceCostGuard(state);

    await this.store.writeShards({
      issue: detail.issue,
      spec: detail.spec,
      shards,
      testMatrix,
      annotations,
      state: guardedState,
    });
    return this.store.readDetail(issueId);
  }

  async runLoop(issueId: string) {
    const detail = await this.getIssue(issueId);
    if (detail.state.paused) {
      throw new BadRequestException('Paused loop cannot be advanced');
    }
    if (!detail.spec || detail.spec.status !== 'APPROVED') {
      throw new BadRequestException('Approved spec is required before running loop');
    }

    const shard = this.findRunnableShard(detail.shards);
    if (!shard) {
      if (detail.shards.length > 0 && detail.shards.every((item) => item.status === 'DONE')) {
        const now = new Date().toISOString();
        await this.store.upsertState({
          ...detail.state,
          phase: 'PHASE_6_CONVERGE',
          shardsDone: detail.shards.length,
          shardsInProgress: 0,
          updated: now,
        });
        return this.store.readDetail(issueId);
      }
      throw new BadRequestException('No runnable shard is available');
    }

    const started = new Date().toISOString();
    const inProgressShards = detail.shards.map((item) =>
      item.id === shard.id ? { ...item, status: 'IN_PROGRESS' as const } : item,
    );
    await this.store.writeIntervention({
      issueId,
      action: 'auto-run',
      actor: 'loops-scheduler',
      shardId: shard.id,
      state: {
        ...detail.state,
        phase: 'PHASE_4_IMPLEMENT',
        shardsInProgress: 1,
        updated: started,
      },
      shards: inProgressShards,
      notes: 'Loop scheduler started shard implementation.',
    });

    const { record } = await this.claudeAdapter.run({
      issue: detail.issue,
      shard,
      round: detail.state.round,
      cwd: detail.issue.targetRepo,
    });
    const implementationDetail = await this.persistImplementationRecord(issueId, shard.id, record);
    const testRecord = await this.runShardTests(issueId, shard.id, {
      commands: this.commandsForShard(shard),
      runner: 'loops-runner',
    });
    const testReview = await this.agentAdapter.reviewTests({
      matrix: implementationDetail.testMatrix,
      testRecord,
    });
    const review = await this.agentAdapter.review({
      shard,
      implementationRecord: record,
      testRecord,
    });

    const verdict =
      testReview.testVerdict === 'TEST-PASS' ? review.verdict : ('NEEDS-WORK' as const);
    await this.reviewShard(issueId, shard.id, {
      reviewer: 'codex',
      verdict,
      summary:
        verdict === review.verdict
          ? review.summary
          : `测试复核未通过：${testReview.summary}`,
      issues: verdict === review.verdict ? review.issues : testReview.issues,
      fixInstructions:
        verdict === review.verdict ? review.fixInstructions : testReview.fixInstructions,
    });

    return this.store.readDetail(issueId);
  }

  async reviewGlobal(issueId: string) {
    const detail = await this.getIssue(issueId);
    const review = await this.agentAdapter.reviewGlobal({
      issue: detail.issue,
      spec: detail.spec,
      shards: detail.shards,
      implementationRecords: detail.implementationRecords,
      reviewRecords: detail.reviewRecords,
      testRecords: detail.testRecords,
      testMatrix: detail.testMatrix,
      annotations: detail.annotations,
    });
    const now = new Date().toISOString();
    const record: LoopGlobalReviewRecord = {
      id: `global-review-${issueId}-r${detail.state.round}-${Date.now()}`,
      issueId,
      reviewer: 'codex',
      round: detail.state.round,
      verdict: review.verdict,
      issues: review.issues,
      fixInstructions: review.fixInstructions,
      summary: review.summary,
      created: now,
    };
    const nextAnnotations = detail.annotations.map((annotation) =>
      annotation.target === issueId
        ? {
            ...annotation,
            annotator: 'codex' as const,
            verdict:
              review.verdict === 'PASS'
                ? ('pass' as const)
                : review.verdict === 'FAIL'
                  ? ('fail' as const)
                  : ('needs-work' as const),
            notes: `整体复查 ${review.verdict}：${review.summary}`,
          }
        : annotation,
    );
    const nextState: LoopStateItem = {
      ...detail.state,
      phase: review.verdict === 'PASS' ? 'PHASE_8_ANNOTATE' : 'PHASE_1_SPEC',
      globalVerdict: review.verdict,
      updated: now,
    };

    await this.store.writeGlobalReview({
      issueId,
      record,
      annotations: nextAnnotations,
      state: nextState,
    });
    return this.store.readDetail(issueId);
  }

  async reloop(issueId: string, request: { reviewer?: string; notes?: string }) {
    const detail = await this.getIssue(issueId);
    const maxReloop = 3;
    if ((detail.state.reloopCount ?? 0) >= maxReloop) {
      throw new BadRequestException('Max re-loop count reached');
    }

    const now = new Date().toISOString();
    const nextRound = detail.state.round + 1;
    const reloopCount = detail.state.reloopCount + 1;
    const specVersion = `v${Number(detail.state.specVersion.replace('v', '') || 1) + 1}`;
    const baseBody = detail.spec?.body ?? detail.issue.body;
    const spec: LoopSpec = {
      id: `spec-${detail.issue.id.replace('issue-', '')}-${specVersion}`,
      issueId,
      version: specVersion,
      status: 'DRAFT',
      created: now,
      contextBudget: detail.spec?.contextBudget ?? 24000,
      body: `${baseBody}\n\n## 回环修订 ${specVersion}\nreviewer: ${request.reviewer ?? 'human'}\nnotes: ${request.notes ?? '整体复查后进入下一轮修订。'}\n`,
    };
    const state: LoopStateItem = {
      ...detail.state,
      phase: 'PHASE_2_REVIEW',
      round: nextRound,
      specVersion,
      shardsTotal: 0,
      shardsDone: 0,
      shardsInProgress: 0,
      reloopCount,
      globalVerdict: undefined,
      finalized: false,
      updated: now,
    };

    await this.store.writeSpec(detail.issue, spec, state);
    return {
      issueId,
      specVersion,
      round: nextRound,
      reloopCount,
      maxReloop,
      phase: state.phase,
      paused: state.paused,
    };
  }

  async finalize(issueId: string) {
    const detail = await this.getIssue(issueId);
    if (detail.state.globalVerdict !== 'PASS') {
      throw new BadRequestException('Global review PASS is required before finalize');
    }
    const now = new Date().toISOString();
    const annotations = await this.agentAdapter.annotateFinalize({
      issue: detail.issue,
      spec: detail.spec,
      shards: detail.shards,
      annotations: detail.annotations,
      globalVerdict: detail.state.globalVerdict,
    });
    const commits: LoopsCommitShardResult[] = [];
    for (const shard of detail.shards) {
      const record = detail.implementationRecords.find((item) => item.shardId === shard.id);
      commits.push(
        await this.gitAdapter.commitShard({
          issue: detail.issue,
          shard,
          changedFiles: record?.changedFiles ?? shard.filesHint,
        }),
      );
    }
    const convergencePr = await this.gitAdapter.createConvergencePr({
      issue: detail.issue,
      shards: detail.shards,
      annotations,
      commits,
    });
    await this.store.writeFinalize({
      issue: detail.issue,
      annotations,
      convergencePr,
      state: {
        ...detail.state,
        phase: 'CLOSED',
        finalized: true,
        updated: now,
      },
    });
    return this.store.readDetail(issueId);
  }

  async doctor() {
    return this.store.doctor();
  }

  async cost() {
    return this.store.readCost();
  }

  async logs(input: { issueId?: string; limit?: number }) {
    return {
      entries: await this.store.readLogs(input),
    };
  }

  async notifications(input: { issueId?: string; limit?: number }) {
    return {
      notifications: await this.store.readNotifications(input),
    };
  }

  async resume() {
    return this.store.resumeInterruptedLoops();
  }

  async intervene(issueId: string, request: LoopInterventionRequest) {
    const detail = await this.getIssue(issueId);
    const now = new Date().toISOString();

    if (request.action === 'pause') {
      await this.store.writeIntervention({
        issueId,
        action: request.action,
        actor: request.actor,
        notes: request.notes,
        state: {
          ...detail.state,
          phase: 'PAUSED',
          paused: true,
          updated: now,
        },
      });
      return this.store.readDetail(issueId);
    }

    if (request.action === 'resume') {
      await this.store.writeIntervention({
        issueId,
        action: request.action,
        actor: request.actor,
        notes: request.notes,
        state: {
          ...detail.state,
          phase: this.nextResumePhase(detail.state),
          paused: false,
          updated: now,
        },
      });
      return this.store.readDetail(issueId);
    }

    if (!request.shardId) {
      throw new BadRequestException('shardId is required for take intervention');
    }

    const shard = detail.shards.find((item) => item.id === request.shardId);
    if (!shard) {
      throw new NotFoundException(`Shard ${request.shardId} not found`);
    }
    if (shard.status === 'DONE') {
      throw new BadRequestException('DONE shard cannot be taken over');
    }

    const nextShards = detail.shards.map((item) =>
      item.id === request.shardId ? { ...item, status: 'IN_PROGRESS' as const } : item,
    );
    const nextAnnotations = detail.annotations.map((annotation) =>
      annotation.target === request.shardId
        ? {
            ...annotation,
            annotator: 'human' as const,
            implStatus: 'in-progress' as const,
            verdict: 'unreviewed' as const,
            notes: request.notes || 'Human took over this shard.',
          }
        : annotation,
    );

    await this.store.writeIntervention({
      issueId,
      action: request.action,
      actor: request.actor,
      shardId: request.shardId,
      notes: request.notes,
      shards: nextShards,
      annotations: nextAnnotations,
      state: {
        ...detail.state,
        phase: 'PHASE_4_IMPLEMENT',
        paused: false,
        shardsInProgress: nextShards.filter((item) => item.status === 'IN_PROGRESS').length,
        updated: now,
      },
    });
    return this.store.readDetail(issueId);
  }

  async runShardTests(issueId: string, shardId: string, request?: LoopRunShardTestsRequest) {
    const detail = await this.getIssue(issueId);
    const shard = detail.shards.find((item) => item.id === shardId);
    if (!shard) {
      throw new NotFoundException(`Shard ${shardId} not found`);
    }

    const record = await this.runner.runShardTests({
      issueId,
      shardId,
      round: detail.state.round,
      cwd: detail.issue.targetRepo,
      request,
    });
    const testStatus: LoopAnnotation['testStatus'] =
      record.status === 'TEST-PASS' ? 'pass' : 'fail';
    const verdict: LoopAnnotation['verdict'] =
      record.status === 'TEST-PASS' ? 'unreviewed' : 'needs-work';
    const nextAnnotations = detail.annotations.map((annotation) =>
      annotation.target === shardId
        ? {
            ...annotation,
            testStatus,
            verdict,
            notes:
              record.status === 'TEST-PASS'
                ? 'Runner 测试命令已通过，等待实现审查。'
                : 'Runner 测试命令失败，需修复后重跑。',
          }
        : annotation,
    );
    const nextShards = detail.shards.map((item) =>
      item.id === shardId && record.status === 'TEST-FAIL'
        ? { ...item, status: 'NEEDS-WORK' as const }
        : item,
    );
    const nextState: LoopStateItem = {
      ...detail.state,
      phase: 'PHASE_5_REVIEW',
      updated: new Date().toISOString(),
    };

    await this.store.writeTestRecord({
      issueId,
      shardId,
      record,
      annotations: nextAnnotations,
      shards: nextShards,
      state: nextState,
    });

    return record;
  }

  async recordShardImplementation(
    issueId: string,
    shardId: string,
    request: LoopRecordShardImplementationRequest,
  ) {
    const detail = await this.getIssue(issueId);
    const shard = detail.shards.find((item) => item.id === shardId);
    if (!shard) {
      throw new NotFoundException(`Shard ${shardId} not found`);
    }

    if (shard.status === 'DONE') {
      throw new BadRequestException('DONE shard cannot be overwritten by implementation record');
    }

    const now = new Date().toISOString();
    const record: LoopImplementationRecord = {
      id: `impl-record-${shardId}-r${detail.state.round}-${Date.now()}`,
      issueId,
      shardId,
      round: detail.state.round,
      implementer: request.implementer,
      status: 'IMPLEMENTED',
      summary: request.summary,
      changedFiles: request.changedFiles,
      notes: request.notes,
      created: now,
    };
    await this.persistImplementationRecord(issueId, shardId, record);
    return record;
  }

  async reviewShard(issueId: string, shardId: string, request: LoopReviewShardRequest) {
    const detail = await this.getIssue(issueId);
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

    const now = new Date().toISOString();
    const record: LoopReviewRecord = {
      id: `review-record-${shardId}-r${detail.state.round}-${Date.now()}`,
      issueId,
      shardId,
      round: detail.state.round,
      reviewer: request.reviewer,
      verdict: request.verdict,
      issues: request.issues,
      fixInstructions: request.fixInstructions,
      summary: request.summary,
      created: now,
    };
    const shardStatus: LoopShard['status'] =
      request.verdict === 'PASS' ? 'DONE' : request.verdict === 'FAIL' ? 'FAILED' : 'NEEDS-WORK';
    const annotationVerdict: LoopAnnotation['verdict'] =
      request.verdict === 'PASS' ? 'pass' : request.verdict === 'FAIL' ? 'fail' : 'needs-work';
    const nextShards = detail.shards.map((item) =>
      item.id === shardId ? { ...item, status: shardStatus } : item,
    );
    const nextAnnotations = detail.annotations.map((annotation) =>
      annotation.target === shardId
        ? {
            ...annotation,
            implStatus: request.verdict === 'PASS' ? ('done' as const) : annotation.implStatus,
            testStatus:
              testRecord?.status === 'TEST-PASS' ? ('pass' as const) : annotation.testStatus,
            verdict: annotationVerdict,
            coverage: request.verdict === 'PASS' ? ('full' as const) : annotation.coverage,
            notes:
              request.verdict === 'PASS'
                ? `Review Record PASS：${record.summary}`
                : `Review Record ${request.verdict}：${record.fixInstructions.join('；') || record.summary}`,
          }
        : annotation,
    );
    const shardsDone = nextShards.filter((item) => item.status === 'DONE').length;
    const nextState: LoopStateItem = {
      ...detail.state,
      phase: shardsDone === nextShards.length ? 'PHASE_6_CONVERGE' : 'PHASE_4_IMPLEMENT',
      shardsDone,
      shardsInProgress: 0,
      updated: now,
    };

    await this.store.writeReviewRecord({
      issueId,
      shardId,
      record,
      annotations: nextAnnotations,
      shards: nextShards,
      state: nextState,
    });

    return record;
  }

  private async persistImplementationRecord(
    issueId: string,
    shardId: string,
    record: LoopImplementationRecord,
  ) {
    const detail = await this.getIssue(issueId);
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
    await this.store.writeImplementationRecord({
      issueId,
      shardId,
      record,
      annotations: nextAnnotations,
      shards: nextShards,
      state: {
        ...detail.state,
        phase: 'PHASE_5_REVIEW',
        shardsInProgress: 0,
        costCalls: detail.state.costCalls + 1,
        costTokens: detail.state.costTokens + (record.tokens ?? 0),
        updated: new Date().toISOString(),
      },
    });
    return this.store.readDetail(issueId);
  }

  private createIssueId(now: string) {
    const date = now.slice(0, 10).replace(/-/g, '');
    const suffix = Math.random().toString(36).slice(2, 8);
    return `issue-${date}-${suffix}`;
  }

  private nextResumePhase(state: LoopStateItem): LoopStateItem['phase'] {
    if (state.shardsTotal > 0) return 'PHASE_4_IMPLEMENT';
    if (state.specVersion === 'v0') return 'PHASE_1_SPEC';
    return 'PHASE_2_REVIEW';
  }

  private findRunnableShard(shards: LoopShard[]) {
    return shards.find(
      (shard) =>
        (shard.status === 'TODO' || shard.status === 'NEEDS-WORK') &&
        shard.dependsOn.every((dependency) =>
          shards.some((candidate) => candidate.id === dependency && candidate.status === 'DONE'),
        ),
    );
  }

  private commandsForShard(_shard: LoopShard) {
    return ['pnpm --version'];
  }
}
