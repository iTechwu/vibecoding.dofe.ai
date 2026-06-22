import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type {
  CreateLoopIssueRequest,
  CreateLoopIssueSimpleRequest,
  DetectLoopRuntimeResponse,
  LoopAgentRuntimeResponse,
  LoopAnnotation,
  LoopCapabilitiesResponse,
  LoopEvidenceArtifact,
  LoopGlobalReviewRecord,
  LoopImplementationRecord,
  LoopIntake,
  LoopInterventionRequest,
  LoopIssue,
  LoopIssuesQuery,
  LoopListResponse,
  LoopMetricsActionItem,
  LoopMetricsResponse,
  LoopMetricsRiskItem,
  PullLoopImageResponse,
  LoopRequirementCoverage,
  LoopRequirementCoverageItem,
  LoopRequirementCoverageSummary,
  LoopResumeSummary,
  LoopRuntimeDetection,
  LoopTraceSummary,
  LoopRecordShardImplementationRequest,
  LoopReviewRecord,
  LoopReviewShardRequest,
  LoopRunShardTestsRequest,
  LoopReviewSpecRequest,
  LoopShard,
  LoopPhase,
  LoopSpec,
  LoopStateItem,
  LoopSubmitter,
  LoopWorkspacesResponse,
  UpsertLoopWorkspaceRequest,
} from '@repo/contracts';
import { normaliseSimpleIssue } from '@repo/contracts';
import type { AuthUserInfo } from '@app/auth';
import { LoopsFileStoreService } from './loops-file-store.service';
import { LoopsCapabilityRegistry } from './loops-capability-registry';
import { AgentRuntimeDetectionService } from './agent-runtime-detection.service';
import { LoopsWorkspaceProfileService } from './loops-workspace-profile.service';
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
import type { LoopsPersistenceService } from './loops-persistence.service';
import { LOOPS_PERSISTENCE } from './loops-persistence.token';
import { resolveAllowedTargetRepo } from './loops-path-policy.util';
import { readLoopsRuntimeConfig } from './loops-runtime-config.util';
import { LoopsWorkLockService } from './loops-work-lock.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';

type LoopIssueDetail = Awaited<ReturnType<LoopsFileStoreService['readDetail']>>;
type LoopListItem = LoopListResponse['list'][number];

type AgentRuntimeDefinition = {
  id: string;
  label: string;
  phase: LoopPhase;
  supportedPhases: LoopPhase[];
};

const PHASE_LABELS: Record<string, string> = {
  PHASE_0_INTAKE: 'Intake',
  PHASE_1_SPEC: 'Spec',
  PHASE_2_REVIEW: 'Review',
  PHASE_3_DECOMPOSE: 'Decompose',
  PHASE_4_IMPLEMENT: 'Implement',
  PHASE_5_REVIEW: 'Shard Review',
  PHASE_6_CONVERGE: 'Converge',
  PHASE_7_GLOBAL_REVIEW: 'Global Review',
  PHASE_8_ANNOTATE: 'Annotate',
  CLOSED: 'Closed',
  PAUSED: 'Paused',
};

const AGENT_RUNTIME_DEFINITIONS: AgentRuntimeDefinition[] = [
  {
    id: 'spec-review-agent',
    label: 'Spec Review Agent',
    phase: 'PHASE_2_REVIEW',
    supportedPhases: ['PHASE_2_REVIEW'],
  },
  {
    id: 'implementation-agent',
    label: 'Implementation Agent',
    phase: 'PHASE_4_IMPLEMENT',
    supportedPhases: ['PHASE_4_IMPLEMENT'],
  },
  {
    id: 'shard-review-agent',
    label: 'Shard Review Agent',
    phase: 'PHASE_5_REVIEW',
    supportedPhases: ['PHASE_5_REVIEW'],
  },
  {
    id: 'global-review-agent',
    label: 'Global Review Agent',
    phase: 'PHASE_7_GLOBAL_REVIEW',
    supportedPhases: ['PHASE_7_GLOBAL_REVIEW'],
  },
];

@Injectable()
export class LoopsService {
  constructor(
    private readonly store: LoopsFileStoreService,
    private readonly runner: LoopsRunnerService,
    private readonly workLock: LoopsWorkLockService,
    @Inject(LOOPS_AGENT_ADAPTER)
    private readonly agentAdapter: LoopsAgentAdapter,
    @Inject(LOOPS_CLAUDE_ADAPTER)
    private readonly claudeAdapter: LoopsClaudeAdapter,
    @Inject(LOOPS_GIT_ADAPTER)
    private readonly gitAdapter: LoopsGitAdapter,
    // Persistence (DB index) is optional: the API server injects it via DI for
    // full DB + `.loops` dual-write; standalone CLI/scripts omit it and run
    // against the `.loops` file source of truth only. `.loops` remains the
    // authoritative source of truth in v1 either way. Injected by token + a
    // type-only import so the concrete `LoopsPersistenceService` (which imports
    // `@app/db`/Prisma) is only loaded when the NestJS module wires it, keeping
    // plain-`ts-node` standalone consumers DB-free.
    @Optional()
    @Inject(LOOPS_PERSISTENCE)
    private readonly persistence?: LoopsPersistenceService,
    // Capability registry extracted out of the service body (R14); pure data.
    @Optional()
    private readonly capabilityRegistry: LoopsCapabilityRegistry = new LoopsCapabilityRegistry(),
    @Optional()
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger?: Logger,
    // Agent runtime detection + workspace profile (0622 · B1/B2). Optional so
    // standalone file-only consumers (and the hermetic service spec) keep working
    // without shelling out; when absent, `agentRuntime()` omits `runtimes` and
    // the workspace/simple-issue methods throw with a clear message.
    @Optional()
    private readonly runtimeDetection?: AgentRuntimeDetectionService,
    @Optional()
    private readonly workspaceProfile?: LoopsWorkspaceProfileService,
  ) {}

  async list(query: LoopIssuesQuery): Promise<LoopListResponse> {
    return this.persistence?.list(query) ?? this.listFromFile(query);
  }

  private async listFromFile(query: LoopIssuesQuery): Promise<LoopListResponse> {
    const fallback = await this.store.list();
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const items = fallback.issues
      .map((issue) => ({
        issue,
        state: fallback.loops.find((state) => state.issueId === issue.id),
      }))
      .filter(
        (item) =>
          (!query.status || item.issue.status === query.status) &&
          (!query.phase || item.state?.phase === query.phase) &&
          (!query.priority || item.issue.priority === query.priority) &&
          (!query.targetRepo || item.issue.targetRepo === query.targetRepo),
      );
    const start = (page - 1) * limit;
    return {
      list: items.slice(start, start + limit),
      total: items.length,
      page,
      limit,
    };
  }

  async getIssue(issueId: string) {
    try {
      return this.withRequirementsCoverage(await this.readDetail(issueId));
    } catch (error) {
      // Surface the original failure (corrupted workspace vs. genuinely
      // missing issue are otherwise indistinguishable) before normalising to
      // a 404 for the client.
      this.log('warn', `[Loops] getIssue failed for ${issueId}`, {
        issueId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new NotFoundException(`Issue ${issueId} not found`);
    }
  }

  /** Winston-backed structured log; no-op for standalone (non-Nest) consumers. */
  private log(
    level: 'info' | 'warn' | 'error' | 'debug',
    message: string,
    meta?: Record<string, unknown>,
  ): void {
    this.logger?.[level](message, meta);
  }

  async createIssue(input: CreateLoopIssueRequest, authUser?: AuthUserInfo) {
    const now = new Date().toISOString();
    const issueId = this.createIssueId(now);
    const intakeId = this.store.intakeId(issueId);
    const rawPayloadRef = `.loops/intakes/${intakeId}.raw.json`;
    const targetRepo = await this.resolveTargetRepo(input.targetRepo);
    const submitter = this.normalizeSubmitter(input, authUser);
    const issue: LoopIssue = {
      id: issueId,
      title: input.title,
      status: 'OPEN',
      priority: input.priority,
      created: now,
      updated: now,
      sourceChannel: 'web',
      sourceKind: 'web_form',
      submitterId: submitter.userId,
      submitterName: submitter.name,
      targetRepo,
      body: input.body,
      acceptanceCriteria: input.acceptanceCriteria,
      rawPayloadRef,
    };
    const intake = {
      id: intakeId,
      issueId,
      sourceChannel: 'web' as const,
      sourceKind: 'web_form' as const,
      submitter,
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

    await this.writeIssueRecord({ issue, intake, state, rawPayload: input });
    return { issue, intake, state };
  }

  /**
   * Simple intake (0622 · B4): normalise a one-sentence request into a full
   * issue, then reuse `createIssue` so permissions, audit, submitter derivation
   * and persistence are identical to the full path. The SSO submitter stays
   * server-derived; the original `request` is preserved verbatim as `body`.
   */
  async createSimpleIssue(input: CreateLoopIssueSimpleRequest, authUser?: AuthUserInfo) {
    const targetRepo = await this.resolveSimpleTargetRepo(input);
    const normalised = normaliseSimpleIssue({
      request: input.request,
      template: input.template,
      title: input.title,
      priority: input.priority,
      acceptanceCriteria: input.acceptanceCriteria,
      targetRepo,
    });
    return this.createIssue(
      {
        title: normalised.title,
        targetRepo: normalised.targetRepo,
        body: normalised.body,
        priority: normalised.priority,
        acceptanceCriteria: normalised.acceptanceCriteria,
      },
      authUser,
    );
  }

  private async resolveSimpleTargetRepo(input: CreateLoopIssueSimpleRequest): Promise<string> {
    if (input.targetRepo && input.targetRepo.trim().length > 0) {
      return this.resolveTargetRepo(input.targetRepo);
    }
    if (this.workspaceProfile) {
      const workspace = await this.workspaceProfile.resolve(input.workspaceId);
      return this.resolveTargetRepo(workspace.root);
    }
    // Fallback for standalone consumers without a workspace profile: the repo
    // root discovered by the path policy.
    return this.resolveTargetRepo('.');
  }

  private normalizeSubmitter(
    input: CreateLoopIssueRequest,
    authUser?: AuthUserInfo,
  ): LoopSubmitter {
    // Authenticated HTTP path: the SSO user (set by AuthGuard) is the source of
    // truth — client-supplied submitter fields are ignored to prevent spoofing.
    if (authUser) {
      return {
        provider: 'dofe-sso',
        userId: authUser.id,
        name: authUser.nickname ?? authUser.code ?? authUser.id,
      };
    }
    // CLI / internal / unauthenticated path: fall back to request-provided or
    // deterministic dev defaults.
    return {
      provider: input.submitter?.provider ?? 'dev',
      userId: input.submitter?.userId ?? input.submitterId ?? 'dev-user',
      name: input.submitter?.name ?? input.submitterName ?? 'Developer',
    };
  }

  private async syncAndRead(issueId: string): Promise<LoopIssueDetail> {
    const detail = await this.store.readDetail(issueId);
    if (!this.persistence) {
      return this.withRequirementsCoverage(detail);
    }

    await this.persistence.syncState(detail.state, detail.issue.status);
    return this.withRequirementsCoverage(await this.persistence.readDetail(issueId));
  }

  private async readDetail(issueId: string): Promise<LoopIssueDetail> {
    return this.persistence?.readDetail(issueId) ?? this.store.readDetail(issueId);
  }

  private async writeIssueRecord(input: {
    issue: LoopIssue;
    intake: LoopIntake;
    state: LoopStateItem;
    rawPayload: unknown;
  }): Promise<void> {
    if (this.persistence) {
      await this.persistence.writeIssue(input);
      return;
    }

    await this.store.writeIssue(input);
  }

  async generateSpec(issueId: string) {
    const detail = await this.getIssue(issueId);
    if (detail.spec && detail.spec.status !== 'REVISION_REQUESTED') {
      throw new BadRequestException('Spec already exists and is not waiting for revision');
    }

    const now = new Date().toISOString();
    const version = this.nextSpecVersion(detail.state.specVersion);
    const plannedSpec = await this.agentAdapter.plan(detail.issue, now);
    const spec: LoopSpec = {
      ...plannedSpec,
      id:
        version === 'v1'
          ? plannedSpec.id
          : `spec-${detail.issue.id.replace('issue-', '')}-${version}`,
      version,
      status: 'DRAFT',
      body:
        version === 'v1'
          ? plannedSpec.body
          : `${plannedSpec.body}\n\n## 修订说明\n本版本由 ${detail.state.specVersion} 修订生成，等待人工重新审核。\n`,
    };
    const state: LoopStateItem = {
      ...detail.state,
      phase: 'PHASE_2_REVIEW',
      specVersion: version,
      updated: now,
    };

    await this.store.writeSpec(detail.issue, spec, await this.costGuardedState(state));
    return this.syncAndRead(issueId);
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
    return this.syncAndRead(issueId);
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
      updated: now,
    };
    const guardedState = await this.costGuardedState(state);

    await this.store.writeShards({
      issue: detail.issue,
      spec: detail.spec,
      shards,
      testMatrix,
      annotations,
      state: guardedState,
    });
    return this.syncAndRead(issueId);
  }

  async runLoop(issueId: string) {
    const detail = await this.getIssue(issueId);
    return this.workLock.withIssueAndRepoLock(
      { issueId, targetRepo: detail.issue.targetRepo },
      () => this.runLoopUnlocked(issueId, detail),
    );
  }

  private async runLoopUnlocked(issueId: string, detail: LoopIssueDetail) {
    if (detail.state.paused) {
      throw new BadRequestException('Paused loop cannot be advanced');
    }
    if (!detail.spec || detail.spec.status !== 'APPROVED') {
      throw new BadRequestException('Approved spec is required before running loop');
    }

    const { contextBudget, maxParallel } = await readLoopsRuntimeConfig();
    let currentDetail = detail;
    let advanced = 0;
    let blocked = 0;

    while (advanced < maxParallel) {
      const shard = this.findRunnableShard(currentDetail.shards);
      if (!shard) {
        break;
      }
      if (shard.estContext >= contextBudget) {
        await this.blockShardForContextBudget(issueId, currentDetail, shard, contextBudget);
        blocked += 1;
        currentDetail = await this.syncAndRead(issueId);
        continue;
      }
      await this.runRunnableShard(issueId, currentDetail, shard);
      advanced += 1;
      currentDetail = await this.syncAndRead(issueId);
      if (currentDetail.state.paused) {
        break;
      }
    }

    if (advanced > 0) {
      await this.store.appendLog({
        type: 'SCHEDULER_BATCH',
        loop: issueId,
        max_parallel: maxParallel,
        context_budget: contextBudget,
        advanced,
        blocked,
      });
      return this.syncAndRead(issueId);
    }

    if (blocked > 0) {
      await this.store.appendLog({
        type: 'SCHEDULER_BATCH',
        loop: issueId,
        max_parallel: maxParallel,
        context_budget: contextBudget,
        advanced,
        blocked,
      });
      return this.syncAndRead(issueId);
    }

    // Convergence must be judged against the freshest shard snapshot
    // (`currentDetail`, updated inside the loop above), not the stale
    // `detail` captured before the first advancement — otherwise a loop that
    // drives the final shard to DONE within this call could be mis-promoted
    // or, conversely, fail to promote to PHASE_6_CONVERGE.
    if (
      currentDetail.shards.length > 0 &&
      currentDetail.shards.every((item) => item.status === 'DONE')
    ) {
      const now = new Date().toISOString();
      await this.store.upsertState({
        ...currentDetail.state,
        phase: 'PHASE_6_CONVERGE',
        shardsDone: currentDetail.shards.length,
        shardsInProgress: 0,
        updated: now,
      });
      return this.syncAndRead(issueId);
    }
    throw new BadRequestException('No runnable shard is available');
  }

  async reviewGlobal(issueId: string) {
    const detail = await this.getIssue(issueId);
    const evidenceIssues = this.collectGlobalEvidenceIssues(detail);
    if (evidenceIssues.length > 0) {
      const now = new Date().toISOString();
      const record: LoopGlobalReviewRecord = {
        id: `global-review-${issueId}-r${detail.state.round}-${Date.now()}`,
        issueId,
        reviewer: 'system',
        round: detail.state.round,
        verdict: 'NEEDS-WORK',
        issues: evidenceIssues,
        fixInstructions: ['补齐当前 round 的 implementation/test/review 证据后重新整体复查。'],
        summary: 'Global review blocked: current-round evidence is incomplete.',
        created: now,
      };
      await this.store.writeGlobalReview({
        issueId,
        record,
        annotations: detail.annotations,
        state: {
          ...detail.state,
          phase: 'PHASE_4_IMPLEMENT',
          globalVerdict: 'NEEDS-WORK',
          updated: now,
        },
      });
      return this.syncAndRead(issueId);
    }

    const regressionRecord = await this.runGlobalRegression(detail);
    if (regressionRecord.status !== 'TEST-PASS') {
      const now = new Date().toISOString();
      const record: LoopGlobalReviewRecord = {
        id: `global-review-${issueId}-r${detail.state.round}-${Date.now()}`,
        issueId,
        reviewer: 'system',
        round: detail.state.round,
        verdict: 'NEEDS-WORK',
        issues: regressionRecord.failedTests.map((item) => ({
          severity: 'major' as const,
          desc: `Global regression failed: ${item.name}: ${item.reason}`,
        })),
        fixInstructions:
          regressionRecord.fixInstructions.length > 0
            ? regressionRecord.fixInstructions
            : ['修复全局回归失败后重新执行整体复查。'],
        summary: 'Global review blocked: regression tests failed.',
        created: now,
      };
      await this.store.writeGlobalReview({
        issueId,
        record,
        annotations: detail.annotations,
        state: {
          ...detail.state,
          phase: 'PHASE_4_IMPLEMENT',
          globalVerdict: 'NEEDS-WORK',
          updated: now,
        },
      });
      return this.syncAndRead(issueId);
    }

    const reviewDetail = await this.syncAndRead(issueId);
    const review = await this.agentAdapter.reviewGlobal({
      issue: reviewDetail.issue,
      spec: reviewDetail.spec,
      shards: reviewDetail.shards,
      implementationRecords: reviewDetail.implementationRecords,
      reviewRecords: reviewDetail.reviewRecords,
      testRecords: reviewDetail.testRecords,
      testMatrix: reviewDetail.testMatrix,
      annotations: reviewDetail.annotations,
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
    const nextAnnotations = reviewDetail.annotations.map((annotation) =>
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
    if (review.verdict !== 'PASS') {
      return this.autoReloopAfterGlobalReview({
        issueId,
        detail: reviewDetail,
        record,
        annotations: nextAnnotations,
        now,
      });
    }

    await this.store.writeGlobalReview({
      issueId,
      record,
      annotations: nextAnnotations,
      state: {
        ...reviewDetail.state,
        phase: 'PHASE_8_ANNOTATE',
        globalVerdict: review.verdict,
        updated: now,
      },
    });
    return this.syncAndRead(issueId);
  }

  async reloop(issueId: string, request: { reviewer?: string; notes?: string }) {
    const detail = await this.getIssue(issueId);
    const maxReloop = (await readLoopsRuntimeConfig()).maxReloop;
    if ((detail.state.reloopCount ?? 0) >= maxReloop) {
      throw new BadRequestException('Max re-loop count reached');
    }

    const now = new Date().toISOString();
    const nextRound = detail.state.round + 1;
    const reloopCount = detail.state.reloopCount + 1;
    const specVersion = this.nextSpecVersion(detail.state.specVersion);
    const spec = this.buildReloopSpec({
      detail,
      specVersion,
      now,
      reviewer: request.reviewer ?? 'human',
      notes: `notes: ${request.notes ?? '整体复查后进入下一轮修订。'}`,
    });
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

  private async autoReloopAfterGlobalReview(input: {
    issueId: string;
    detail: Awaited<ReturnType<LoopsService['getIssue']>>;
    record: LoopGlobalReviewRecord;
    annotations: LoopAnnotation[];
    now: string;
  }) {
    const maxReloop = (await readLoopsRuntimeConfig()).maxReloop;
    if ((input.detail.state.reloopCount ?? 0) >= maxReloop) {
      const pausedState: LoopStateItem = {
        ...input.detail.state,
        phase: 'PAUSED',
        paused: true,
        globalVerdict: input.record.verdict,
        updated: input.now,
      };
      await this.store.writeGlobalReview({
        issueId: input.issueId,
        record: input.record,
        annotations: input.annotations,
        state: pausedState,
      });
      await this.store.appendLog({
        type: 'RELOOP_LIMIT',
        loop: input.issueId,
        max_reloop: maxReloop,
        verdict: input.record.verdict,
        status: 'PAUSED',
      });
      await this.store.writeNotification({
        issueId: input.issueId,
        channel: 'web',
        kind: 'RELOOP_LIMIT',
        recipient: input.record.reviewer,
        title: `Re-loop limit reached: ${input.issueId}`,
        body: `Global review was ${input.record.verdict}, but max_reloop=${maxReloop} has been reached. The loop was paused for human intervention.`,
        actionHref: `/loops/${input.issueId}`,
      });
      return this.syncAndRead(input.issueId);
    }

    const nextRound = input.detail.state.round + 1;
    const reloopCount = input.detail.state.reloopCount + 1;
    const specVersion = this.nextSpecVersion(input.detail.state.specVersion);
    const spec = this.buildReloopSpec({
      detail: input.detail,
      specVersion,
      now: input.now,
      reviewer: input.record.reviewer,
      notes: [
        `global_verdict: ${input.record.verdict}`,
        `summary: ${input.record.summary}`,
        ...input.record.issues.map((item) => `issue(${item.severity}): ${item.desc}`),
        ...input.record.fixInstructions.map((item) => `fix: ${item}`),
      ].join('\n'),
    });
    const reloopState: LoopStateItem = {
      ...input.detail.state,
      phase: 'PHASE_2_REVIEW',
      round: nextRound,
      specVersion,
      shardsTotal: 0,
      shardsDone: 0,
      shardsInProgress: 0,
      reloopCount,
      globalVerdict: undefined,
      finalized: false,
      updated: input.now,
    };

    await this.store.writeGlobalReview({
      issueId: input.issueId,
      record: input.record,
      annotations: input.annotations,
      state: {
        ...input.detail.state,
        phase: 'PHASE_1_SPEC',
        globalVerdict: input.record.verdict,
        updated: input.now,
      },
    });
    await this.store.writeSpec(input.detail.issue, spec, reloopState);
    await this.store.appendLog({
      type: 'RELOOP',
      loop: input.issueId,
      reason: 'global review non-pass',
      verdict: input.record.verdict,
      new_spec_version: specVersion,
      round: nextRound,
      reloop_count: reloopCount,
      max_reloop: maxReloop,
    });
    return this.syncAndRead(input.issueId);
  }

  private buildReloopSpec(input: {
    detail: Awaited<ReturnType<LoopsService['getIssue']>>;
    specVersion: string;
    now: string;
    reviewer: string;
    notes: string;
  }): LoopSpec {
    const baseBody = input.detail.spec?.body ?? input.detail.issue.body;
    return {
      id: `spec-${input.detail.issue.id.replace('issue-', '')}-${input.specVersion}`,
      issueId: input.detail.issue.id,
      version: input.specVersion,
      status: 'DRAFT',
      created: input.now,
      contextBudget: input.detail.spec?.contextBudget ?? 24000,
      body: `${baseBody}\n\n## 自动回环修订 ${input.specVersion}\nreviewer: ${input.reviewer}\n${input.notes}\n`,
    };
  }

  async finalize(issueId: string) {
    const detail = await this.getIssue(issueId);
    if (detail.state.globalVerdict !== 'PASS') {
      throw new BadRequestException('Global review PASS is required before finalize');
    }
    const now = new Date().toISOString();
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
      annotations: detail.annotations,
      commits,
    });
    const annotations = await this.agentAdapter.annotateFinalize({
      issue: detail.issue,
      spec: detail.spec,
      shards: detail.shards,
      annotations: detail.annotations,
      globalVerdict: detail.state.globalVerdict,
      testMatrix: detail.testMatrix,
      globalReview: detail.globalReview,
      convergencePr,
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
    return this.syncAndRead(issueId);
  }

  async doctor() {
    return this.persistence?.doctor() ?? this.store.doctor();
  }

  async cost() {
    return this.store.readCost();
  }

  async metrics(): Promise<LoopMetricsResponse> {
    const [list, doctor, cost, logs] = await Promise.all([
      this.list({ page: 1, limit: 200 }),
      this.doctor(),
      this.cost(),
      this.store.readLogs({ limit: 200 }),
    ]);
    const coverageSummaries = await Promise.all(
      list.list.map(async (item) => this.readCoverageSummary(item.issue.id)),
    );
    const requirementsCoverage = this.aggregateCoverageSummaries(coverageSummaries);
    const active = list.list.filter(
      ({ issue }) => !['CLOSED', 'ARCHIVED', 'REJECTED'].includes(issue.status),
    );
    const paused = list.list.filter(({ state }) => state?.paused || state?.phase === 'PAUSED');
    const inLoop = list.list.filter(({ issue }) => issue.status === 'IN_LOOP');
    const closed = list.list.filter(({ issue }) => issue.status === 'CLOSED');
    const costTripped = cost.loops.filter((item) => item.tripped);
    const phaseCounts = list.list.reduce<Record<string, number>>((acc, item) => {
      const phase = item.state?.phase ?? 'PHASE_0_INTAKE';
      acc[phase] = (acc[phase] ?? 0) + 1;
      return acc;
    }, {});
    const attention =
      paused.length +
      costTripped.length +
      list.list.filter(
        ({ issue, state }) => issue.priority === 'P0' || state?.globalVerdict === 'FAIL',
      ).length +
      coverageSummaries.filter((summary) => summary.missing > 0 || summary.percent < 100).length;

    return {
      health: {
        ok: doctor.ok,
        root: doctor.root,
        loops: doctor.loops,
        issues: doctor.issues,
        problems: doctor.problems,
      },
      summary: {
        total: list.total,
        active: active.length,
        inLoop: inLoop.length,
        paused: paused.length,
        attention,
        closed: closed.length,
      },
      phaseDistribution: Object.entries(phaseCounts).map(([phase, count]) => ({
        phase,
        label: this.formatPhase(phase),
        count,
      })),
      costSummary: {
        loops: cost.loops.length,
        tripped: costTripped.length,
        totalCalls: cost.loops.reduce((sum, item) => sum + item.costCalls, 0),
        totalTokens: cost.loops.reduce((sum, item) => sum + item.costTokens, 0),
        minCallsRemaining: cost.loops.length
          ? Math.min(...cost.loops.map((item) => item.callsRemaining))
          : 0,
        minTokensRemaining: cost.loops.length
          ? Math.min(...cost.loops.map((item) => item.tokensRemaining))
          : 0,
      },
      riskQueue: this.buildRiskQueue(list.list, cost.loops, coverageSummaries),
      actionQueue: this.buildActionQueue(list.list),
      requirementsCoverage,
      traceSummary: this.buildTraceSummary(logs),
      resumeSummary: this.buildResumeSummary(list.list),
    };
  }

  async agentRuntime(): Promise<LoopAgentRuntimeResponse> {
    const [list, cost] = await Promise.all([this.list({ page: 1, limit: 200 }), this.cost()]);
    const costByIssue = new Map(cost.loops.map((item) => [item.issueId, item]));
    const activeItems = list.list.filter(
      ({ issue }) => !['CLOSED', 'ARCHIVED', 'REJECTED'].includes(issue.status),
    );

    const agents = AGENT_RUNTIME_DEFINITIONS.map((definition) => {
      const activeItem = activeItems.find((item) =>
        item.state ? definition.supportedPhases.includes(item.state.phase) : false,
      );
      if (!activeItem) {
        return {
          id: definition.id,
          label: definition.label,
          status: 'idle' as const,
          phase: definition.phase,
          supportedPhases: definition.supportedPhases,
          meta: this.formatPhase(definition.phase),
          diagnostics: [],
        };
      }

      const diagnostics = this.buildAgentDiagnostics(
        activeItem,
        costByIssue.get(activeItem.issue.id),
      );
      const state = activeItem.state;

      return {
        id: definition.id,
        label: definition.label,
        status: diagnostics.length ? ('attention' as const) : ('running' as const),
        phase: definition.phase,
        supportedPhases: definition.supportedPhases,
        issueId: activeItem.issue.id,
        issueTitle: activeItem.issue.title,
        href: `/loops/${activeItem.issue.id}`,
        meta: `${this.formatPhase(state?.phase ?? definition.phase)} · round ${state?.round ?? 1}`,
        diagnostics,
        updated: state?.updated ?? activeItem.issue.updated,
      };
    });

    const diagnostics = agents.flatMap((agent) => {
      if (!agent.issueId || !agent.issueTitle || !agent.href) return [];
      const issueId = agent.issueId;
      const title = agent.issueTitle;
      const href = agent.href;

      return agent.diagnostics.map((reason, index) => ({
        id: `${agent.id}-${issueId}-${index}`,
        agentId: agent.id,
        issueId,
        title,
        href,
        level: this.agentDiagnosticLevel(reason),
        reason,
        meta: agent.meta,
        updated: agent.updated,
      }));
    });

    const summary = agents.reduce<LoopAgentRuntimeResponse['summary']>(
      (acc, agent) => {
        acc[agent.status] += 1;
        acc.total += 1;
        return acc;
      },
      { running: 0, attention: 0, idle: 0, total: 0 },
    );

    // 0622 · B1: attach environment-derived runtime detection facts for the
    // current workspace, when a detection service is wired in. Best-effort: a
    // detection failure must never break the derived status view.
    const detection = await this.detectCurrentRuntimeSafe();
    return {
      summary,
      agents,
      diagnostics,
      ...(detection ? { runtimes: detection.runtimes, workspaceId: detection.workspaceId } : {}),
    };
  }

  private async detectCurrentRuntimeSafe():
    | Promise<{ workspaceId: string; runtimes: LoopRuntimeDetection[] } | undefined>
    | undefined {
    if (!this.runtimeDetection || !this.workspaceProfile) return undefined;
    try {
      const workspace = await this.workspaceProfile.resolve();
      const runtimes = await this.runtimeDetection.detectAll(workspace);
      return { workspaceId: workspace.workspaceId, runtimes };
    } catch (error) {
      this.log('warn', '[Loops] runtime detection failed; omitting runtimes from response', {
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  }

  // --------------------------------------------------------------------------
  // Workspace + runtime detection (0622 · B2)
  // --------------------------------------------------------------------------

  async listWorkspaces(): Promise<LoopWorkspacesResponse> {
    this.requireWorkspaceProfile('listWorkspaces');
    return this.workspaceProfile!.list();
  }

  async upsertWorkspace(input: UpsertLoopWorkspaceRequest): Promise<LoopWorkspacesResponse> {
    this.requireWorkspaceProfile('upsertWorkspace');
    return this.workspaceProfile!.upsert(input);
  }

  async setCurrentWorkspace(workspaceId: string): Promise<LoopWorkspacesResponse> {
    this.requireWorkspaceProfile('setCurrentWorkspace');
    return this.workspaceProfile!.setCurrent(workspaceId);
  }

  async detectWorkspaceRuntime(workspaceId: string): Promise<DetectLoopRuntimeResponse> {
    this.requireWorkspaceProfile('detectWorkspaceRuntime');
    if (!this.runtimeDetection) {
      throw new Error('Runtime detection is not configured on this instance');
    }
    const workspace = await this.workspaceProfile!.get(workspaceId);
    if (!workspace) {
      throw new NotFoundException(`Workspace ${workspaceId} not found`);
    }
    const runtimes = await this.runtimeDetection.detectAll(workspace);
    return {
      workspaceId: workspace.workspaceId,
      root: workspace.root,
      status: workspace.status,
      runtimes,
    };
  }

  async pullWorkspaceImage(
    workspaceId: string,
    agent: 'codex' | 'claude-code',
  ): Promise<PullLoopImageResponse> {
    this.requireWorkspaceProfile('pullWorkspaceImage');
    return this.workspaceProfile!.pullImage(workspaceId, agent);
  }

  private requireWorkspaceProfile(operation: string): void {
    if (!this.workspaceProfile) {
      throw new Error(
        `Workspace profile service is not configured; cannot run ${operation} on this instance`,
      );
    }
  }

  async capabilities(): Promise<LoopCapabilitiesResponse> {
    return this.capabilityRegistry.build();
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
      return this.syncAndRead(issueId);
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
      return this.syncAndRead(issueId);
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
    return this.syncAndRead(issueId);
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
    const shardStatus: LoopShard['status'] =
      effectiveVerdict === 'PASS' ? 'DONE' : effectiveVerdict === 'FAIL' ? 'FAILED' : 'NEEDS-WORK';
    const annotationVerdict: LoopAnnotation['verdict'] =
      effectiveVerdict === 'PASS' ? 'pass' : effectiveVerdict === 'FAIL' ? 'fail' : 'needs-work';
    const nextShards = detail.shards.map((item) =>
      item.id === shardId ? { ...item, status: shardStatus } : item,
    );
    const nextAnnotations = detail.annotations.map((annotation) =>
      annotation.target === shardId
        ? {
            ...annotation,
            implStatus:
              effectiveVerdict === 'PASS'
                ? ('done' as const)
                : effectiveVerdict === 'FAIL'
                  ? ('failed' as const)
                  : annotation.implStatus,
            testStatus:
              testRecord?.status === 'TEST-PASS' ? ('pass' as const) : annotation.testStatus,
            verdict: annotationVerdict,
            coverage: effectiveVerdict === 'PASS' ? ('full' as const) : annotation.coverage,
            notes:
              effectiveVerdict === 'PASS'
                ? `Review Record PASS：${record.summary}`
                : `Review Record ${effectiveVerdict}：${record.fixInstructions.join('；') || record.summary}`,
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
    // Account the review transition (agentAdapter.review + reviewTests) so the
    // cost guard sees review-only routes instead of being bypassed by them.
    const guardedState = await this.costGuardedState(nextState);

    await this.store.writeReviewRecord({
      issueId,
      shardId,
      record,
      annotations: nextAnnotations,
      shards: nextShards,
      state: guardedState,
    });

    if (redoLimitExceeded) {
      await this.store.appendLog({
        type: 'SHARD_REDO_LIMIT',
        loop: issueId,
        shard: shardId,
        max_shard_redo: config.maxShardRedo,
        needs_work_count: currentNeedsWorkCount + 1,
        status: 'FAILED',
      });
      await this.store.writeNotification({
        issueId,
        channel: 'web',
        kind: 'SHARD_REDO_LIMIT',
        recipient: request.reviewer,
        title: `Shard redo limit reached: ${shardId}`,
        body: `Shard ${shardId} exceeded max_shard_redo=${config.maxShardRedo} and was marked FAILED for convergence or re-loop decision.`,
        actionHref: `/loops/${issueId}`,
      });
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
    const nextState = await this.costGuardedState(
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
    return this.syncAndRead(issueId);
  }

  private collectGlobalEvidenceIssues(detail: Awaited<ReturnType<LoopsService['getIssue']>>) {
    const issues: Array<{ severity: 'minor' | 'major' | 'critical'; desc: string }> = [];
    const currentRound = detail.state.round;
    const requirementsCoverage =
      detail.requirementsCoverage ?? this.buildRequirementsCoverage(detail);
    const uncovered = requirementsCoverage.items.filter(
      (item) => item.status !== 'reviewed' && item.status !== 'accepted',
    );

    for (const item of uncovered) {
      issues.push({
        severity: item.status === 'missing' ? 'critical' : 'major',
        desc: `Initial requirement ${item.id} is ${item.status}: ${item.criterion}`,
      });
    }

    for (const shard of detail.shards) {
      const implementation = detail.implementationRecords.find(
        (record) => record.shardId === shard.id && record.round === currentRound,
      );
      const test = detail.testRecords.find(
        (record) => record.shardId === shard.id && record.round === currentRound,
      );
      const review = detail.reviewRecords.find(
        (record) => record.shardId === shard.id && record.round === currentRound,
      );

      if (shard.status !== 'DONE') {
        issues.push({ severity: 'major', desc: `${shard.id} is ${shard.status}, not DONE.` });
      }
      if (!implementation) {
        issues.push({
          severity: 'major',
          desc: `${shard.id} missing current-round implementation record.`,
        });
      }
      if (test?.status !== 'TEST-PASS') {
        issues.push({
          severity: 'major',
          desc: `${shard.id} missing current-round TEST-PASS record.`,
        });
      }
      if (review?.verdict !== 'PASS') {
        issues.push({
          severity: 'major',
          desc: `${shard.id} missing current-round PASS review record.`,
        });
      }
    }

    return issues;
  }

  private async runGlobalRegression(detail: LoopIssueDetail) {
    const config = await readLoopsRuntimeConfig();
    const record = await this.runner.runShardTests({
      issueId: detail.issue.id,
      shardId: '__global__',
      round: detail.state.round,
      cwd: detail.issue.targetRepo,
      request: {
        commands: config.tests.regressionCommands,
        runner: 'loops-regression-runner',
      },
    });
    const testStatus: LoopAnnotation['testStatus'] =
      record.status === 'TEST-PASS' ? 'pass' : 'fail';
    const verdict: LoopAnnotation['verdict'] =
      record.status === 'TEST-PASS' ? 'unreviewed' : 'needs-work';
    const nextAnnotations = detail.annotations.map((annotation) =>
      annotation.target === detail.issue.id
        ? {
            ...annotation,
            testStatus,
            verdict,
            notes:
              record.status === 'TEST-PASS'
                ? 'Global regression commands passed before global review.'
                : 'Global regression commands failed; global review is blocked.',
          }
        : annotation,
    );
    await this.store.writeTestRecord({
      issueId: detail.issue.id,
      shardId: '__global__',
      record,
      annotations: nextAnnotations,
      shards: detail.shards,
      state: {
        ...detail.state,
        phase: record.status === 'TEST-PASS' ? 'PHASE_7_GLOBAL_REVIEW' : 'PHASE_4_IMPLEMENT',
        updated: new Date().toISOString(),
      },
    });
    await this.store.appendLog({
      type: 'GLOBAL_REGRESSION',
      loop: detail.issue.id,
      status: record.status,
      commands: record.commands.map((item) => item.command),
    });
    return record;
  }

  private createIssueId(now: string) {
    const date = now.slice(0, 10).replace(/-/g, '');
    // Cryptographic suffix avoids the birthday-bound collision risk of the
    // previous `Math.random()` 6-char base36 suffix. 8 hex chars (32 bits)
    // scoped per day is ample for any realistic Loops deployment.
    const suffix = randomUUID().replace(/-/g, '').slice(0, 8);
    return `issue-${date}-${suffix}`;
  }

  /**
   * Apply a cost delta (LLM/agent calls + tokens) to a candidate state and
   * route it through the cost guard. Centralising this ensures every
   * cost-incurring transition is accounted consistently and can trip the
   * guard. Previously review/test paths wrote state without accounting, so
   * the cap could be bypassed by routes that only invoked reviews.
   *
   * The caller passes the desired next-state WITHOUT `costCalls`/`costTokens`
   * (this helper adds the delta); `updated` is refreshed here too so callers
   * don't have to.
   */
  private async costGuardedState(
    state: LoopStateItem,
    delta: { calls?: number; tokens?: number } = {},
  ): Promise<LoopStateItem> {
    const calls = delta.calls ?? 1;
    const tokens = delta.tokens ?? 0;
    return this.store.enforceCostGuard({
      ...state,
      costCalls: state.costCalls + calls,
      costTokens: state.costTokens + tokens,
      updated: new Date().toISOString(),
    });
  }

  private nextResumePhase(state: LoopStateItem): LoopStateItem['phase'] {
    if (state.shardsTotal > 0) return 'PHASE_4_IMPLEMENT';
    if (state.specVersion === 'v0') return 'PHASE_1_SPEC';
    return 'PHASE_2_REVIEW';
  }

  private nextSpecVersion(current: string) {
    if (current === 'v0') return 'v1';
    const currentNumber = Number(current.replace('v', ''));
    return `v${Number.isFinite(currentNumber) ? currentNumber + 1 : 1}`;
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

  private async blockShardForContextBudget(
    issueId: string,
    detail: LoopIssueDetail,
    shard: LoopShard,
    contextBudget: number,
  ): Promise<void> {
    const now = new Date().toISOString();
    const nextShards = detail.shards.map((item) =>
      item.id === shard.id ? { ...item, status: 'BLOCKED' as const } : item,
    );
    const nextAnnotations = detail.annotations.map((annotation) =>
      annotation.target === shard.id
        ? {
            ...annotation,
            implStatus: 'skipped' as const,
            testStatus: 'skipped' as const,
            verdict: 'needs-work' as const,
            coverage: 'none' as const,
            risk: 'high' as const,
            notes: `Shard est_context=${shard.estContext} exceeds context_budget=${contextBudget}; re-decompose before implementation.`,
          }
        : annotation,
    );
    await this.store.writeShardProgress({
      issueId,
      from: shard.status,
      to: 'BLOCKED',
      actor: 'loops-scheduler',
      shardId: shard.id,
      state: {
        ...detail.state,
        phase: 'PHASE_4_IMPLEMENT',
        shardsInProgress: 0,
        updated: now,
      },
      shards: nextShards,
      annotations: nextAnnotations,
    });
    await this.store.appendLog({
      type: 'CONTEXT_BUDGET_EXCEEDED',
      loop: issueId,
      shard: shard.id,
      est_context: shard.estContext,
      context_budget: contextBudget,
      status: 'BLOCKED',
    });
    await this.store.writeNotification({
      issueId,
      channel: 'web',
      kind: 'CONTEXT_BUDGET_EXCEEDED',
      recipient: 'human',
      title: `Shard blocked by context budget: ${shard.id}`,
      body: `Shard ${shard.id} est_context=${shard.estContext} exceeds context_budget=${contextBudget}. Re-decompose before implementation.`,
      actionHref: `/loops/${issueId}`,
    });
  }

  private async runRunnableShard(
    issueId: string,
    detail: LoopIssueDetail,
    shard: LoopShard,
  ): Promise<void> {
    const started = new Date().toISOString();
    const inProgressShards = detail.shards.map((item) =>
      item.id === shard.id ? { ...item, status: 'IN_PROGRESS' as const } : item,
    );
    await this.store.writeShardProgress({
      issueId,
      from: shard.status,
      to: 'IN_PROGRESS',
      actor: 'loops-scheduler',
      shardId: shard.id,
      state: {
        ...detail.state,
        phase: 'PHASE_4_IMPLEMENT',
        shardsInProgress: 1,
        updated: started,
      },
      shards: inProgressShards,
    });

    const { record } = await this.claudeAdapter.run({
      issue: detail.issue,
      shard,
      round: detail.state.round,
      cwd: detail.issue.targetRepo,
    });
    const implementationDetail = await this.persistImplementationRecord(issueId, shard.id, record);
    const testRecord = await this.runShardTests(issueId, shard.id, {
      commands: await this.store.readDefaultTestCommands(),
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
        verdict === review.verdict ? review.summary : `测试复核未通过：${testReview.summary}`,
      issues: verdict === review.verdict ? review.issues : testReview.issues,
      fixInstructions:
        verdict === review.verdict ? review.fixInstructions : testReview.fixInstructions,
    });
  }

  private async resolveTargetRepo(input: string) {
    try {
      return await resolveAllowedTargetRepo(input);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid targetRepo';
      throw new BadRequestException(message);
    }
  }

  private buildRiskQueue(
    items: LoopListItem[],
    costs: Awaited<ReturnType<LoopsFileStoreService['readCost']>>['loops'],
    coverageSummaries: LoopRequirementCoverageSummary[],
  ): LoopMetricsRiskItem[] {
    const costByIssue = new Map(costs.map((item) => [item.issueId, item]));
    const coverageByIssue = new Map(
      items.map((item, index) => [item.issue.id, coverageSummaries[index]]),
    );
    return items
      .flatMap((item): LoopMetricsRiskItem[] => {
        const base = {
          issueId: item.issue.id,
          title: item.issue.title,
          priority: item.issue.priority,
          status: item.issue.status,
          phase: item.state?.phase,
          href: `/loops/${item.issue.id}`,
        };
        const risks: LoopMetricsRiskItem[] = [];
        if (item.state?.paused) {
          risks.push({ ...base, level: 'critical', reason: 'Paused' });
        }
        if (costByIssue.get(item.issue.id)?.tripped) {
          risks.push({ ...base, level: 'critical', reason: 'Cost guard tripped' });
        }
        const coverage = coverageByIssue.get(item.issue.id);
        if (coverage && coverage.total > 0 && coverage.percent < 100) {
          risks.push({
            ...base,
            level: coverage.missing > 0 ? 'critical' : 'warning',
            reason: `Requirements coverage ${coverage.percent}%`,
          });
        }
        if (item.state?.globalVerdict && item.state.globalVerdict !== 'PASS') {
          risks.push({
            ...base,
            level: item.state.globalVerdict === 'FAIL' ? 'critical' : 'warning',
            reason: `Global ${item.state.globalVerdict}`,
          });
        }
        if (item.issue.priority === 'P0' || item.issue.priority === 'P1') {
          risks.push({
            ...base,
            level: item.issue.priority === 'P0' ? 'critical' : 'warning',
            reason: `${item.issue.priority} priority`,
          });
        }
        return risks;
      })
      .slice(0, 10);
  }

  private buildAgentDiagnostics(
    item: LoopListItem,
    cost?: Awaited<ReturnType<LoopsFileStoreService['readCost']>>['loops'][number],
  ): string[] {
    const diagnostics: string[] = [];
    if (item.state?.paused || item.state?.phase === 'PAUSED') {
      diagnostics.push('Agent execution is paused');
    }
    if (cost?.tripped) {
      diagnostics.push('Cost guard tripped');
    }
    if (item.state?.phase === 'PHASE_2_REVIEW') {
      diagnostics.push('Spec draft is waiting for human review');
    }
    if (item.state?.phase === 'PHASE_7_GLOBAL_REVIEW') {
      diagnostics.push('Global review is waiting to complete');
    }
    if (item.state?.globalVerdict && item.state.globalVerdict !== 'PASS') {
      diagnostics.push(`Global ${item.state.globalVerdict}`);
    }
    return diagnostics;
  }

  private agentDiagnosticLevel(reason: string): 'critical' | 'warning' | 'info' {
    if (reason === 'Cost guard tripped' || reason.includes('FAIL')) {
      return 'critical';
    }
    if (reason.includes('waiting') || reason.includes('paused')) {
      return 'warning';
    }
    return 'info';
  }

  private buildActionQueue(items: LoopListItem[]): LoopMetricsActionItem[] {
    return items
      .map((item) => {
        const action = this.resolveNextAction(item);
        return {
          issueId: item.issue.id,
          title: item.issue.title,
          action: action.action,
          label: action.label,
          priority: item.issue.priority,
          phase: item.state?.phase,
          href: `/loops/${item.issue.id}`,
        };
      })
      .filter((item) => item.action !== 'closed')
      .slice(0, 10);
  }

  private resolveNextAction(item: LoopListItem): Pick<LoopMetricsActionItem, 'action' | 'label'> {
    const { issue, state } = item;
    if (state?.paused) {
      return { action: 'resume', label: 'Resume loop' };
    }
    if (!state || state.specVersion === 'v0') {
      return { action: 'generate-spec', label: 'Generate spec' };
    }
    if (state.phase === 'PHASE_2_REVIEW') {
      return { action: 'review-spec', label: 'Review spec' };
    }
    if (state.phase === 'PHASE_3_DECOMPOSE') {
      return { action: 'decompose', label: 'Decompose' };
    }
    if (state.phase === 'PHASE_6_CONVERGE') {
      return { action: 'global-review', label: 'Global review' };
    }
    if (state.globalVerdict && state.globalVerdict !== 'PASS') {
      return { action: 'reloop', label: 'Start re-loop' };
    }
    if (state.globalVerdict === 'PASS' && !state.finalized) {
      return { action: 'finalize', label: 'Finalize' };
    }
    if (issue.status === 'CLOSED' || state.phase === 'CLOSED' || state.finalized) {
      return { action: 'closed', label: 'Closed' };
    }
    return { action: 'run-step', label: 'Run step' };
  }

  private formatPhase(phase: string) {
    return PHASE_LABELS[phase] ?? phase.replace('PHASE_', 'P').replaceAll('_', ' ');
  }

  private buildTraceSummary(
    logs: Awaited<ReturnType<LoopsFileStoreService['readLogs']>>,
  ): LoopTraceSummary {
    const eventCounts = logs.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.type] = (acc[entry.type] ?? 0) + 1;
      return acc;
    }, {});
    return {
      total: logs.length,
      recent: logs.slice(0, 20).length,
      lastEventAt: logs[0]?.ts,
      eventTypes: Object.entries(eventCounts)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type))
        .slice(0, 8),
    };
  }

  private buildResumeSummary(items: LoopListItem[]): LoopResumeSummary {
    const affected = new Set<string>();
    let resumableShards = 0;
    for (const item of items) {
      if (!item.state) continue;
      resumableShards += item.state.shardsInProgress;
      if (item.state.paused || item.state.phase === 'PAUSED' || item.state.shardsInProgress > 0) {
        affected.add(item.issue.id);
      }
    }
    return {
      resumableShards,
      affectedIssues: affected.size,
    };
  }

  private withRequirementsCoverage(detail: LoopIssueDetail): LoopIssueDetail {
    return {
      ...detail,
      requirementsCoverage: this.buildRequirementsCoverage(detail),
      evidenceArtifacts: this.buildEvidenceArtifacts(detail),
    };
  }

  private buildEvidenceArtifacts(detail: LoopIssueDetail): LoopEvidenceArtifact[] {
    const issueId = detail.issue.id;
    const artifacts: LoopEvidenceArtifact[] = [
      {
        id: `${issueId}-raw-payload`,
        label: 'Raw Payload',
        kind: 'raw-payload',
        path: detail.issue.rawPayloadRef,
        status: 'present',
        summary: `Original ${detail.issue.sourceChannel}/${detail.issue.sourceKind} request from ${detail.issue.submitterName ?? detail.issue.submitterId}.`,
      },
      {
        id: `${issueId}-issue`,
        label: 'Issue Record',
        kind: 'issue',
        path: `.loops/issues/${issueId}.json`,
        status: 'present',
        summary: `${detail.issue.priority} ${detail.issue.status} issue with ${detail.issue.acceptanceCriteria.length} initial acceptance criteria.`,
      },
      {
        id: `${issueId}-intake`,
        label: 'Intake Record',
        kind: 'intake',
        path: `.loops/intakes/${detail.intake.id}.json`,
        status: 'present',
        summary: `${detail.intake.status} intake normalized from ${detail.intake.sourceChannel}/${detail.intake.sourceKind}.`,
      },
      {
        id: `${issueId}-spec`,
        label: 'Spec',
        kind: 'spec',
        path: `.loops/specs/${issueId}/spec.${detail.state.specVersion}.json`,
        status: detail.spec ? 'present' : 'pending',
        summary: detail.spec
          ? `${detail.spec.status} spec ${detail.spec.version} maps ${detail.issue.acceptanceCriteria.length} initial acceptance criteria.`
          : `Spec ${detail.state.specVersion} has not been generated yet.`,
      },
      {
        id: `${issueId}-shards`,
        label: 'Shards',
        kind: 'shards',
        path: `.loops/shards/${issueId}/shards.json`,
        status: detail.shards.length > 0 ? 'present' : 'pending',
        count: detail.shards.length,
        summary:
          detail.shards.length > 0
            ? `${detail.shards.filter((shard) => shard.status === 'DONE').length}/${detail.shards.length} shards done; ${detail.shards.filter((shard) => shard.status === 'IN_PROGRESS').length} in progress.`
            : 'No implementation shards have been decomposed yet.',
      },
      {
        id: `${issueId}-test-matrix`,
        label: 'Test Matrix',
        kind: 'test-matrix',
        path: `.loops/tests/${issueId}/matrix.json`,
        status: detail.testMatrix ? 'present' : 'pending',
        count: detail.testMatrix?.requiredTests.length,
        summary: detail.testMatrix
          ? `${detail.testMatrix.requiredTests.length} required tests across ${detail.testMatrix.regressionScope.length} regression targets.`
          : 'Test matrix is pending until decomposition completes.',
      },
      {
        id: `${issueId}-annotations`,
        label: 'Annotations',
        kind: 'annotations',
        path: `.loops/annotations/${issueId}.json`,
        status: detail.annotations.length > 0 ? 'present' : 'pending',
        count: detail.annotations.length,
        summary:
          detail.annotations.length > 0
            ? `${detail.annotations.length} reviewer annotations captured for requirement coverage.`
            : 'No reviewer annotations have been recorded yet.',
      },
    ];

    artifacts.push(
      ...detail.implementationRecords.map((record) => ({
        id: record.id,
        label: `Implementation ${record.shardId}`,
        kind: 'implementation-record' as const,
        path: `.loops/runs/${issueId}/${record.shardId}/${record.round}/implementation.json`,
        status: 'present' as const,
        count: record.changedFiles.length,
        summary: `${record.status} implementation for ${record.shardId}; ${record.changedFiles.length} changed files recorded.`,
      })),
      ...detail.testRecords.map((record) => ({
        id: record.id,
        label: `Test ${record.shardId}`,
        kind: 'test-record' as const,
        path: `.loops/tests/${issueId}/records/${record.id}.json`,
        status: 'present' as const,
        count: record.commands.length,
        summary: `${record.status} test run for ${record.shardId}; ${record.commands.length} commands executed.`,
      })),
      ...detail.reviewRecords.map((record) => ({
        id: record.id,
        label: `Review ${record.shardId}`,
        kind: 'review-record' as const,
        path: `.loops/runs/${issueId}/${record.shardId}/${record.round}/review.json`,
        status: 'present' as const,
        count: record.issues.length,
        summary: `${record.verdict} review for ${record.shardId}; ${record.issues.length} issues recorded.`,
      })),
    );

    artifacts.push({
      id: `${issueId}-global-review`,
      label: 'Global Review',
      kind: 'global-review',
      path: `.loops/runs/${issueId}/global-review.json`,
      status: detail.globalReview ? 'present' : 'pending',
      summary: detail.globalReview
        ? `${detail.globalReview.verdict} global review with ${detail.globalReview.issues.length} cross-shard issues.`
        : 'Global review has not been run yet.',
    });
    artifacts.push({
      id: `${issueId}-convergence-pr`,
      label: 'Convergence PR',
      kind: 'convergence-pr',
      path: `.loops/runs/${issueId}/convergence-pr.json`,
      status: detail.convergencePr ? 'present' : 'pending',
      count: detail.convergencePr?.commits.length,
      summary: detail.convergencePr
        ? `Convergence package references ${detail.convergencePr.commits.length} commits.`
        : 'Convergence PR evidence is pending until finalization.',
    });

    return artifacts;
  }

  private async readCoverageSummary(issueId: string): Promise<LoopRequirementCoverageSummary> {
    try {
      const detail = await this.getIssue(issueId);
      return (detail.requirementsCoverage ?? this.buildRequirementsCoverage(detail)).summary;
    } catch {
      return this.emptyCoverageSummary();
    }
  }

  private buildRequirementsCoverage(detail: LoopIssueDetail): LoopRequirementCoverage {
    const items = detail.issue.acceptanceCriteria.map((criterion, index) => {
      const normalized = this.normalizeCoverageText(criterion);
      const shardIds = detail.shards
        .filter((shard) =>
          shard.acceptance.some((item) => this.coverageTextMatches(item, normalized)),
        )
        .map((shard) => shard.id);
      const testIds =
        detail.testMatrix?.requiredTests
          .filter(
            (test) =>
              shardIds.includes(test.shardId) || this.coverageTextMatches(test.title, normalized),
          )
          .map((test) => test.id) ?? [];
      const implementationRecordIds = detail.implementationRecords
        .filter((record) => shardIds.includes(record.shardId))
        .map((record) => record.id);
      const reviewRecordIds = detail.reviewRecords
        .filter((record) => shardIds.includes(record.shardId) && record.verdict === 'PASS')
        .map((record) => record.id);
      const inSpec = detail.spec ? this.coverageTextMatches(detail.spec.body, normalized) : false;
      const status = this.resolveRequirementStatus({
        inSpec,
        shardIds,
        testIds,
        implementationRecordIds,
        reviewRecordIds,
        globalVerdict: detail.state.globalVerdict,
      });

      return {
        id: `REQ-${index + 1}`,
        criterion,
        inSpec,
        shardIds,
        testIds,
        implementationRecordIds,
        reviewRecordIds,
        status,
      };
    });

    return {
      summary: this.summarizeRequirementsCoverage(items),
      items,
    };
  }

  private resolveRequirementStatus(input: {
    inSpec: boolean;
    shardIds: string[];
    testIds: string[];
    implementationRecordIds: string[];
    reviewRecordIds: string[];
    globalVerdict?: LoopStateItem['globalVerdict'];
  }): LoopRequirementCoverageItem['status'] {
    if (input.globalVerdict === 'PASS' && input.reviewRecordIds.length > 0) return 'accepted';
    if (input.reviewRecordIds.length > 0) return 'reviewed';
    if (input.testIds.length > 0 && input.implementationRecordIds.length > 0) return 'tested';
    if (input.implementationRecordIds.length > 0) return 'implemented';
    if (input.inSpec && input.shardIds.length > 0 && input.testIds.length > 0) return 'planned';
    return 'missing';
  }

  private summarizeRequirementsCoverage(
    items: LoopRequirementCoverageItem[],
  ): LoopRequirementCoverageSummary {
    const summary = this.emptyCoverageSummary(items.length);
    for (const item of items) {
      summary[item.status] += 1;
    }
    summary.percent =
      summary.total === 0 ? 100 : Math.round((summary.accepted / summary.total) * 100);
    return summary;
  }

  private aggregateCoverageSummaries(
    summaries: LoopRequirementCoverageSummary[],
  ): LoopRequirementCoverageSummary {
    const total = summaries.reduce((acc, item) => acc + item.total, 0);
    const summary = this.emptyCoverageSummary(total);
    for (const item of summaries) {
      summary.accepted += item.accepted;
      summary.reviewed += item.reviewed;
      summary.tested += item.tested;
      summary.implemented += item.implemented;
      summary.planned += item.planned;
      summary.missing += item.missing;
    }
    summary.percent = total === 0 ? 100 : Math.round((summary.accepted / total) * 100);
    return summary;
  }

  private emptyCoverageSummary(total = 0): LoopRequirementCoverageSummary {
    return {
      total,
      accepted: 0,
      reviewed: 0,
      tested: 0,
      implemented: 0,
      planned: 0,
      missing: 0,
      percent: total === 0 ? 100 : 0,
    };
  }

  private coverageTextMatches(text: string, normalizedNeedle: string) {
    const haystack = this.normalizeCoverageText(text);
    return Boolean(
      normalizedNeedle &&
      (haystack.includes(normalizedNeedle) || normalizedNeedle.includes(haystack)),
    );
  }

  private normalizeCoverageText(value: string) {
    return value
      .toLowerCase()
      .replace(/^-+\s*/, '')
      .replace(/\[[^\]]+\]/g, '')
      .replace(/[^\p{Letter}\p{Number}]+/gu, '');
  }
}
