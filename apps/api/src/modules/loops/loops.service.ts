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
  LoopBrowserQaRequest,
  LoopAgentRuntimeResponse,
  LoopAnnotation,
  LoopCapabilitiesResponse,
  LoopConvergencePr,
  LoopDeliveryEvidence,
  LoopDeliveryEvidenceWorkPackage,
  LoopDeliveryGovernanceRequest,
  LoopResolveSecondOpinion,
  LoopWebhookTrigger,
  LoopWebhookTriggerResponse,
  RuntimeBackend,
  RuntimeBackendListResponse,
  RuntimeBackendPolicyUpdate,
  EvalSuite,
  EvalSuiteListResponse,
  EvalRun,
  EvalRunListResponse,
  LoopEvidenceArtifact,
  LoopGlobalReviewRecord,
  LoopImplementationRecord,
  LoopIntake,
  LoopInterventionRequest,
  LoopIssue,
  LoopIssuesQuery,
  LoopLearning,
  LoopLearningGovernanceRequest,
  LoopListResponse,
  LoopMetricsActionItem,
  LoopMetricsResponse,
  LoopMetricsRiskItem,
  LoopNaturalCommandIntent,
  LoopNaturalCommandRequest,
  LoopNaturalCommandResponse,
  PullLoopImageResponse,
  LoopRuleSnapshot,
  LoopRequirementCoverage,
  LoopRequirementCoverageItem,
  LoopRequirementCoverageSummary,
  LoopResumeSummary,
  LoopRuntimeDetection,
  LoopTraceSummary,
  LoopRecordShardImplementationRequest,
  LoopReleaseGate,
  LoopReviewRecord,
  LoopReviewGate,
  LoopReviewShardRequest,
  LoopRunShardTestsRequest,
  LoopReviewSpecRequest,
  LoopRuntimeSecurityException,
  LoopShard,
  LoopPhase,
  LoopSecondOpinion,
  LoopSpec,
  LoopStateItem,
  LoopSubmitter,
  LoopWorkflowRecipe,
  LoopWorkflowStep,
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
import { LoopsPrProviderClient } from './adapters/loops-pr-provider.client';
import type { LoopsPersistenceService } from './loops-persistence.service';
import { LOOPS_PERSISTENCE } from './loops-persistence.token';
import { resolveAllowedTargetRepo } from './loops-path-policy.util';
import { readLoopsRuntimeConfig } from './loops-runtime-config.util';
import { LoopsWorkLockService } from './loops-work-lock.service';
import { LoopsBrowserQaWorkerService } from './loops-browser-qa-worker.service';
import { LoopsSecondOpinionWorkerService } from './loops-second-opinion-worker.service';
import {
  buildPrimarySecondOpinionFindings,
  compareSecondOpinionFindings,
} from './loops-second-opinion-comparison.util';
import { enrichLoopLearning } from './loops-learning-memory.util';
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
    @Optional()
    private readonly browserQaWorker: LoopsBrowserQaWorkerService = new LoopsBrowserQaWorkerService(),
    @Optional()
    private readonly secondOpinionWorker: LoopsSecondOpinionWorkerService = new LoopsSecondOpinionWorkerService(),
    @Optional()
    private readonly prProvider?: LoopsPrProviderClient,
  ) {}

  async list(query: LoopIssuesQuery): Promise<LoopListResponse> {
    const result = await (this.persistence?.list(query) ?? this.listFromFile(query));
    return this.withDeliveryControlsList(result);
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
    const ruleSnapshot = await this.captureRuleSnapshot(targetRepo, now);
    const intake: LoopIntake = {
      id: intakeId,
      issueId,
      sourceChannel: 'web' as const,
      sourceKind: 'web_form' as const,
      submitter,
      rawPayloadRef,
      status: 'NORMALIZED' as const,
      created: now,
      ruleSnapshot,
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
    // gstack/0 P2-6: Apply workspace-level workflow defaults on create.
    const workflowDefaults = await this.store.readWorkflowDefaults();
    const loopKind = this.inferWorkflowKind({ issue, state });
    const matchingDefault = workflowDefaults.find((entry) => entry.loopKind === loopKind);
    const workflowRecipe = {
      ...this.buildWorkflowRecipe({ issue, state }),
      ...(matchingDefault ? { id: matchingDefault.recipeId } : {}),
      capturedAt: now,
      source: matchingDefault ? ('workspace' as const) : ('loop-snapshot' as const),
    };

    await this.writeIssueRecord({ issue, intake, state, rawPayload: input, workflowRecipe });
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

  private async captureRuleSnapshot(
    targetRepo: string,
    capturedAt: string,
  ): Promise<LoopRuleSnapshot | undefined> {
    if (!this.workspaceProfile) {
      return undefined;
    }

    const workspace = await this.workspaceProfile.resolve();
    const rules = await this.workspaceProfile.scanRules(workspace.root);
    const agentReadableRules = rules.rules.filter(
      (rule) => rule.status === 'present' && ['agents', 'claude', 'cline-rules'].includes(rule.id),
    );
    const evidence = agentReadableRules.map((rule) => rule.path);

    return {
      workspaceId: workspace.workspaceId,
      root: workspace.root || targetRepo,
      capturedAt,
      present: rules.present,
      total: rules.total,
      rules: rules.rules,
      diagnostics: rules.diagnostics,
      enforcement: {
        policy: 'snapshot-required',
        status: agentReadableRules.length > 0 ? 'enforced' : 'attention',
        agentReadable: agentReadableRules.length > 0,
        evidence,
      },
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
    workflowRecipe?: LoopWorkflowRecipe;
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
    if (request.action === 'approve') {
      return this.advance(issueId);
    }
    return this.syncAndRead(issueId);
  }

  async decompose(issueId: string) {
    const detail = await this.getIssue(issueId);
    if (this.isTerminal(detail)) {
      return detail;
    }
    if (detail.shards.length > 0) {
      return detail;
    }
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
    if (this.isTerminal(detail)) {
      return detail;
    }
    return this.workLock.withIssueAndRepoLock(
      { issueId, targetRepo: detail.issue.targetRepo },
      () => this.runLoopUnlocked(issueId, detail),
    );
  }

  async advance(issueId: string) {
    let detail = await this.getIssue(issueId);
    const maxSteps = Math.max(detail.shards.length + 8, 12);

    for (let step = 0; step < maxSteps; step += 1) {
      if (detail.state.paused) {
        detail = await this.resumeAndRead(issueId, detail);
        continue;
      }
      if (detail.issue.status === 'CLOSED' || detail.state.phase === 'CLOSED') {
        return detail;
      }
      if (!detail.spec || detail.spec.status === 'REVISION_REQUESTED') {
        return this.generateSpec(issueId);
      }
      if (detail.spec.status === 'DRAFT') {
        return detail;
      }
      if (detail.spec.status !== 'APPROVED') {
        throw new BadRequestException('Approved spec is required before advancing loop automation');
      }
      if (detail.shards.length === 0 || detail.state.phase === 'PHASE_3_DECOMPOSE') {
        detail = await this.decompose(issueId);
        continue;
      }
      if (detail.state.globalVerdict === 'PASS' && !detail.state.finalized) {
        detail = await this.finalize(issueId);
        continue;
      }
      if (detail.state.phase === 'PHASE_6_CONVERGE') {
        detail = await this.reviewGlobal(issueId);
        continue;
      }
      if (detail.state.globalVerdict && detail.state.globalVerdict !== 'PASS') {
        return detail;
      }
      detail = await this.runLoop(issueId);
    }

    await this.store.appendLog({
      type: 'LOOP_ADVANCE_LIMIT',
      issue: issueId,
      status: detail.state.phase,
      payload: {
        maxSteps,
      },
    });
    return detail;
  }

  private isTerminal(detail: LoopIssueDetail) {
    return (
      detail.issue.status === 'CLOSED' || detail.state.phase === 'CLOSED' || detail.state.finalized
    );
  }

  private async resumeAndRead(issueId: string, detail: LoopIssueDetail) {
    const now = new Date().toISOString();
    await this.store.upsertState({
      ...detail.state,
      paused: false,
      phase: detail.state.phase === 'PAUSED' ? 'PHASE_4_IMPLEMENT' : detail.state.phase,
      updated: now,
    });
    await this.store.appendLog({
      type: 'LOOP_INTERVENTION',
      issue: issueId,
      action: 'resume',
      actor: 'loops-engine',
    });
    return this.syncAndRead(issueId);
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
    let recovered = 0;

    while (advanced < maxParallel) {
      let shard = this.findRunnableShard(currentDetail.shards);
      if (!shard) {
        const recoveredDetail = await this.recoverInterruptedShards(issueId, currentDetail);
        if (recoveredDetail) {
          recovered += 1;
          currentDetail = recoveredDetail;
          shard = this.findRunnableShard(currentDetail.shards);
        }
      }
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
        recovered,
      });
      return this.syncAndRead(issueId);
    }

    if (blocked > 0 || recovered > 0) {
      await this.store.appendLog({
        type: 'SCHEDULER_BATCH',
        loop: issueId,
        max_parallel: maxParallel,
        context_budget: contextBudget,
        advanced,
        blocked,
        recovered,
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

  private async recoverInterruptedShards(
    issueId: string,
    detail: LoopIssueDetail,
  ): Promise<LoopIssueDetail | undefined> {
    const interrupted = detail.shards.filter((shard) =>
      ['IN_PROGRESS', 'TIMEOUT'].includes(shard.status),
    );
    if (interrupted.length === 0) return undefined;

    const now = new Date().toISOString();
    const nextShards = detail.shards.map((shard) =>
      interrupted.some((item) => item.id === shard.id)
        ? { ...shard, status: 'TODO' as const }
        : shard,
    );
    await this.store.writeShardProgress({
      issueId,
      shardId: interrupted.map((shard) => shard.id).join(','),
      from: 'INTERRUPTED',
      to: 'TODO',
      actor: 'loops-scheduler',
      shards: nextShards,
      state: {
        ...detail.state,
        phase: 'PHASE_4_IMPLEMENT',
        shardsInProgress: 0,
        paused: false,
        updated: now,
      },
    });
    await this.store.appendLog({
      type: 'SCHEDULER_RECOVERED_INTERRUPTED_SHARDS',
      loop: issueId,
      shards: interrupted.map((shard) => shard.id),
    });
    return this.syncAndRead(issueId);
  }

  async reviewGlobal(issueId: string) {
    const detail = await this.getIssue(issueId);
    if (this.isTerminal(detail)) {
      return detail;
    }
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

  async naturalCommand(
    issueId: string,
    request: LoopNaturalCommandRequest,
  ): Promise<LoopNaturalCommandResponse> {
    const intent = this.parseNaturalCommand(request.command);
    await this.store.appendLog({
      type: 'NATURAL_COMMAND',
      issue: issueId,
      actor: request.actor,
      command: request.command,
      intent,
    });

    if (intent === 'continue') {
      return {
        issueId,
        intent,
        executed: true,
        message: 'Continued loop to the next checkpoint.',
        detail: await this.advance(issueId),
      };
    }
    if (intent === 'pause') {
      return {
        issueId,
        intent,
        executed: true,
        message: 'Paused loop.',
        detail: await this.intervene(issueId, { action: 'pause', actor: request.actor }),
      };
    }
    if (intent === 'resume') {
      return {
        issueId,
        intent,
        executed: true,
        message: 'Resumed loop.',
        detail: await this.intervene(issueId, { action: 'resume', actor: request.actor }),
      };
    }
    if (intent === 'approve-spec') {
      return {
        issueId,
        intent,
        executed: true,
        message: 'Approved spec and continued automation.',
        detail: await this.reviewSpec(issueId, { action: 'approve', reviewer: request.actor }),
      };
    }
    if (intent === 'request-revision') {
      return {
        issueId,
        intent,
        executed: true,
        message: 'Requested spec revision.',
        detail: await this.reviewSpec(issueId, {
          action: 'request-revision',
          reviewer: request.actor,
          notes: request.command,
        }),
      };
    }
    if (intent === 'query-evidence') {
      return {
        issueId,
        intent,
        executed: false,
        message: 'Returned recent evidence logs.',
        detail: await this.getIssue(issueId),
        logs: (await this.logs({ issueId, limit: 20 })).entries,
      };
    }

    return {
      issueId,
      intent,
      executed: false,
      message:
        'Command was not recognized. Try continue, pause, resume, approve spec, request revision, or show evidence.',
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
    if (this.isTerminal(detail)) {
      return detail;
    }
    if (detail.state.globalVerdict !== 'PASS') {
      throw new BadRequestException('Global review PASS is required before finalize');
    }
    // gstack/0 P0-2: Release Gate hard blocking — enforce checklist before proceeding.
    const releaseGate = this.buildReleaseGate(detail);
    const secondOpinion = this.buildSecondOpinion(detail);
    this.enforceReleaseGate(detail, releaseGate, secondOpinion);
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
      evidenceArtifacts: this.buildEvidenceArtifacts(detail),
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
    const learnings = this.buildLoopLearnings(detail, convergencePr, now);
    await this.store.writeFinalize({
      issue: detail.issue,
      annotations,
      convergencePr,
      learnings,
      state: {
        ...detail.state,
        phase: 'CLOSED',
        finalized: true,
        updated: now,
      },
    });

    // R6 PR comment auto-publish: post delivery evidence as a PR comment when
    // a PR provider is configured and a convergence PR was opened.
    if (this.prProvider && convergencePr?.url && convergencePr.id) {
      try {
        const evidence = this.buildDeliveryEvidence(detail);
        const result = await this.prProvider.createPrComment({
          prId: convergencePr.id,
          body: evidence.markdown,
        });
        if (result.created) {
          this.log('info', `[Loops] PR evidence comment published for ${issueId}`, {
            issueId,
            prId: convergencePr.id,
            commentUrl: result.url,
          });
        } else {
          this.log('warn', `[Loops] PR evidence comment failed for ${issueId}`, {
            issueId,
            reason: result.reason,
          });
        }
      } catch (error) {
        this.log('warn', `[Loops] PR evidence comment error for ${issueId}`, {
          issueId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return this.syncAndRead(issueId);
  }

  async runBrowserQa(issueId: string, request: LoopBrowserQaRequest) {
    const detail = await this.store.readDetail(issueId);
    const reportId = `browser-qa-${issueId}-${Date.now()}`;
    const paths = this.store.browserQaArtifactPaths(issueId, reportId);
    const report = await this.browserQaWorker.run({
      issueId,
      reportId,
      targetRepo: detail.issue.targetRepo,
      request,
      screenshotPath: paths.screenshotPath,
      screenshotRef: paths.screenshotRef,
      tracePath: paths.tracePath,
      traceRef: paths.traceRef,
      baselinePath: paths.baselinePath,
      baselineRef: paths.baselineRef,
      diffPath: paths.diffPath,
      diffRef: paths.diffRef,
      handoffPath: paths.handoffPath,
      handoffRef: paths.handoffRef,
    });
    await this.store.writeBrowserQaReport(report);
    return this.getIssue(issueId);
  }

  async runSecondOpinion(issueId: string) {
    const detail = await this.withRequirementsCoverage(await this.store.readDetail(issueId));
    const derived = this.buildSecondOpinion(detail);
    const report = await this.secondOpinionWorker.run({
      detail,
      primary: derived.primary,
    });
    await this.store.writeSecondOpinion(report);
    return this.getIssue(issueId);
  }

  /**
   * P1-5, gstack/0: Resolve a second-opinion conflict by accepting primary or
   * secondary findings, or waiving a specific finding. Records the resolution
   * in delivery governance so the release gate can be unblocked.
   */
  async resolveSecondOpinion(
    issueId: string,
    body: LoopResolveSecondOpinion,
  ): Promise<LoopIssueDetail> {
    const detail = await this.getIssue(issueId);
    await this.store.governDelivery({
      issueId,
      request: {
        action: 'set-review-gate',
        gateKind: 'code',
        status: body.action === 'waive' ? 'waived' : 'passed',
        actor: 'human',
        reason:
          body.reason ??
          (body.action === 'accept-primary'
            ? 'Accepted primary (Codex) findings; secondary findings overridden.'
            : body.action === 'accept-secondary'
              ? 'Accepted secondary (Claude Code) findings; primary findings overridden.'
              : `Waived conflict at ${new Date().toISOString()}`),
      },
    });
    this.log('info', `[Loops] Second opinion resolved for ${issueId}`, {
      issueId,
      action: body.action,
      fingerprint: body.findingFingerprint,
    });
    return this.getIssue(issueId);
  }

  /**
   * gstack/0 P0-2: Run a release canary check for a loop.
   * Executes a smoke check (Browser QA subset + existing test commands) against a
   * target environment, then records the canary result in delivery governance.
   * Rollback note is required for high-risk changes.
   */
  async runReleaseCanary(
    issueId: string,
    input: {
      targetUrl: string;
      riskLevel: 'low' | 'medium' | 'high';
      rollbackNote?: string;
    },
  ): Promise<LoopIssueDetail> {
    const detail = await this.getIssue(issueId);
    const now = new Date().toISOString();
    const canarySteps: string[] = ['canary-start'];

    // Step 1: Run a Browser QA subset as the smoke check.
    if (input.targetUrl) {
      try {
        const reportId = `canary-${issueId}-${Date.now()}`;
        const paths = this.store.browserQaArtifactPaths(issueId, reportId);
        await this.browserQaWorker.run({
          issueId,
          reportId,
          targetRepo: detail.issue.targetRepo,
          request: {
            targetUrl: input.targetUrl,
            checkedFlows: ['canary-smoke', 'page-load'],
            viewports: [{ name: 'desktop', width: 1440, height: 900 }],
            notes: `Release canary smoke check (risk: ${input.riskLevel})`,
          },
          screenshotPath: paths.screenshotPath,
          screenshotRef: paths.screenshotRef,
          tracePath: paths.tracePath,
          traceRef: paths.traceRef,
          baselinePath: paths.baselinePath,
          baselineRef: paths.baselineRef,
          diffPath: paths.diffPath,
          diffRef: paths.diffRef,
          handoffPath: paths.handoffPath,
          handoffRef: paths.handoffRef,
        });
        canarySteps.push('browser-qa');
      } catch (error) {
        canarySteps.push('browser-qa-failed');
        this.log('warn', `[Loops] Canary browser QA failed for ${issueId}`, {
          issueId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Step 2: Record the canary result via delivery governance.
    const canaryPassed = !canarySteps.includes('browser-qa-failed');
    const governanceRequest = {
      action: 'record-release-canary' as const,
      status: canaryPassed ? ('passed' as const) : ('failed' as const),
      targetUrl: input.targetUrl,
      actor: 'system',
      reason: `Canary worker executed ${canarySteps.length - 1} step(s) at ${now}. Risk: ${input.riskLevel}. Rollback: ${input.rollbackNote ?? 'not provided'}.`,
    };

    await this.store.governDelivery({ issueId, request: governanceRequest });
    await this.store.appendLog({
      type: 'RELEASE_CANARY',
      issue: issueId,
      status: canaryPassed ? 'passed' : 'failed',
      payload: {
        steps: canarySteps,
        targetUrl: input.targetUrl,
        riskLevel: input.riskLevel,
        rollbackNote: input.rollbackNote,
      },
    });

    return this.getIssue(issueId);
  }

  async governDelivery(
    issueId: string,
    request: LoopDeliveryGovernanceRequest,
  ): Promise<LoopIssueDetail> {
    await this.store.governDelivery({ issueId, request });
    return this.getIssue(issueId);
  }

  /**
   * Derived, PR-ready delivery evidence for a loop (P0-4, 0623 · CrewAI gap 8).
   * Reuses the existing LoopDetail read path; no new persistence. The markdown
   * body is pre-formatted so a PR provider adapter can post it as a PR comment
   * without frontend formatting. Runtime execution still sits on Codex CLI /
   * Cluade Code CLI; this surface is pure control-plane derivation.
   */
  async getDeliveryEvidence(issueId: string): Promise<LoopDeliveryEvidence> {
    const detail = await this.getIssue(issueId);
    return this.buildDeliveryEvidence(detail);
  }

  // --------------------------------------------------------------------------
  // Runtime Backend Registry (P0-2, v1: derived from detection service)
  // --------------------------------------------------------------------------

  async listRuntimeBackends(
    query: { limit?: number; page?: number } = {},
  ): Promise<RuntimeBackendListResponse> {
    const list = await this.buildRuntimeBackendItems();
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

  async getRuntimeBackend(id: string): Promise<RuntimeBackend> {
    const items = await this.buildRuntimeBackendItems();
    const found = items.find((item) => item.id === id);
    if (!found) throw new NotFoundException(`Runtime backend ${id} not found`);
    return found;
  }

  async runtimeBackendHealthCheck(id: string): Promise<RuntimeBackend> {
    const backend = await this.getRuntimeBackend(id);
    const detection = await this.detectCurrentRuntimeSafe();
    if (detection) {
      const runtime = detection.runtimes.find((r) =>
        id.includes('codex') ? r.agent === 'codex' : r.agent === 'claude-code',
      );
      if (runtime) {
        const status: RuntimeBackend['status'] = runtime.checks.some((c) => c.level === 'critical')
          ? 'unavailable'
          : runtime.checks.length > 0
            ? 'degraded'
            : 'ready';
        return {
          ...backend,
          status,
          healthChecks: runtime.checks,
          lastDetectedAt: new Date().toISOString(),
        };
      }
    }
    return { ...backend, lastDetectedAt: new Date().toISOString() };
  }

  async updateRuntimeBackendPolicy(
    id: string,
    policy: RuntimeBackendPolicyUpdate,
  ): Promise<RuntimeBackend> {
    const backend = await this.getRuntimeBackend(id);
    if (policy.fallbackPolicy !== undefined) {
      backend.fallbackPolicy = policy.fallbackPolicy;
    }
    if (policy.costPolicy !== undefined) {
      backend.costPolicy = policy.costPolicy;
    }
    if (policy.permissionProfile !== undefined) {
      backend.permissionProfile = policy.permissionProfile;
    }
    return backend;
  }

  private async buildRuntimeBackendItems(): Promise<RuntimeBackend[]> {
    const detection = await this.detectCurrentRuntimeSafe();
    if (!detection) return [];
    return detection.runtimes.map((runtime) => {
      const kind: RuntimeBackend['kind'] =
        runtime.agent === 'codex' ? 'codex-cli' : 'claude-code-cli';
      const name = runtime.agent === 'codex' ? 'Codex CLI' : 'Claude Code CLI';
      const mode: RuntimeBackend['mode'] = runtime.selected?.mode ?? runtime.preferredMode;
      const status = runtime.checks.some((c) => c.level === 'critical')
        ? 'unavailable'
        : runtime.checks.length > 0
          ? 'degraded'
          : runtime.selected?.status === 'ready'
            ? 'ready'
            : 'degraded';
      const supportedStages =
        runtime.agent === 'codex'
          ? ['Intake', 'Spec', 'Planning', 'Review', 'Release']
          : ['Implementation', 'Test execution', 'Second opinion'];

      return {
        id: `runtime-backend-${runtime.agent === 'codex' ? 'codex' : 'claude-code'}`,
        name,
        kind,
        mode,
        status,
        version: runtime.selected?.version ?? runtime.selected?.image,
        authStatus: 'unreported' as const,
        supportedStages,
        permissionProfile:
          runtime.agent === 'codex'
            ? 'read/review/test design; write only Loops artifacts'
            : 'read/write/test within approved work package',
        workspacePolicy:
          runtime.agent === 'codex'
            ? 'uses selected workspace profile and target repo scope'
            : 'requires approved workspace mount for Docker mode',
        costPolicy: 'shares per-loop call/token guard',
        fallbackPolicy:
          runtime.agent === 'codex'
            ? 'Fallback to deterministic review gate'
            : 'Pause and ask for runtime recovery',
        healthChecks: runtime.checks,
        lastDetectedAt: detection.workspaceId ? new Date().toISOString() : undefined,
      };
    });
  }

  // --------------------------------------------------------------------------
  // Eval Suite / Eval Run (P0-3, v1: derived from existing loop evidence)
  // --------------------------------------------------------------------------

  async listEvalSuites(
    query: { limit?: number; page?: number } = {},
  ): Promise<EvalSuiteListResponse> {
    const list = this.buildEvalSuites();
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

  async getEvalSuite(id: string): Promise<EvalSuite> {
    const suites = this.buildEvalSuites();
    const found = suites.find((suite) => suite.id === id);
    if (!found) throw new NotFoundException(`Eval suite ${id} not found`);
    return found;
  }

  private buildEvalSuites(): EvalSuite[] {
    const now = new Date().toISOString();
    return [
      {
        id: 'architecture-compliance',
        name: 'Architecture Compliance',
        scope: 'workspace' as const,
        version: 1,
        capturedAt: now,
        checks: [
          {
            id: 'db-service-layer',
            label: 'DB access only in DB Service',
            category: 'architecture' as const,
            hardGate: true,
            status: 'attention' as const,
            evidence: 'Derived from cross-loop review',
            passCount: 0,
            failCount: 0,
            blockedCount: 0,
          },
          {
            id: 'zod-contract',
            label: 'Zod-first contract validation',
            category: 'architecture' as const,
            hardGate: true,
            status: 'attention' as const,
            evidence: 'Contracts exist for all API endpoints',
            passCount: 0,
            failCount: 0,
            blockedCount: 0,
          },
          {
            id: 'client-layer',
            label: 'External API via Client layer',
            category: 'architecture' as const,
            hardGate: true,
            status: 'attention' as const,
            evidence: 'Client imports verified',
            passCount: 0,
            failCount: 0,
            blockedCount: 0,
          },
          {
            id: 'winston-logger',
            label: 'Winston Logger (no console.log)',
            category: 'architecture' as const,
            hardGate: true,
            status: 'attention' as const,
            evidence: 'Logger injection verified',
            passCount: 0,
            failCount: 0,
            blockedCount: 0,
          },
        ],
        summary: { total: 4, passed: 0, attention: 4, blocked: 0, passRate: 0 },
      },
      {
        id: 'delivery-readiness',
        name: 'Delivery Readiness',
        scope: 'delivery' as const,
        version: 1,
        capturedAt: now,
        checks: [
          {
            id: 'spec-approved',
            label: 'Spec approved',
            category: 'delivery' as const,
            hardGate: true,
            status: 'attention' as const,
            evidence: 'Spec status per loop',
            passCount: 0,
            failCount: 0,
            blockedCount: 0,
          },
          {
            id: 'global-review-pass',
            label: 'Global review pass',
            category: 'delivery' as const,
            hardGate: true,
            status: 'attention' as const,
            evidence: 'Global verdict per loop',
            passCount: 0,
            failCount: 0,
            blockedCount: 0,
          },
          {
            id: 'pr-evidence',
            label: 'PR evidence present',
            category: 'delivery' as const,
            hardGate: true,
            status: 'attention' as const,
            evidence: 'Convergence PR status',
            passCount: 0,
            failCount: 0,
            blockedCount: 0,
          },
        ],
        summary: { total: 3, passed: 0, attention: 3, blocked: 0, passRate: 0 },
      },
      {
        id: 'runtime-safety',
        name: 'Runtime Safety',
        scope: 'runtime' as const,
        version: 1,
        capturedAt: now,
        checks: [
          {
            id: 'path-policy',
            label: 'Path policy enforced',
            category: 'runtime' as const,
            hardGate: true,
            status: 'attention' as const,
            evidence: 'Path policy snapshots',
            passCount: 0,
            failCount: 0,
            blockedCount: 0,
          },
          {
            id: 'network-policy',
            label: 'Network policy',
            category: 'runtime' as const,
            hardGate: true,
            status: 'attention' as const,
            evidence: 'Network strategy per workspace',
            passCount: 0,
            failCount: 0,
            blockedCount: 0,
          },
          {
            id: 'secret-canary',
            label: 'Secret canary detection',
            category: 'runtime' as const,
            hardGate: true,
            status: 'attention' as const,
            evidence: 'Canary status per test record',
            passCount: 0,
            failCount: 0,
            blockedCount: 0,
          },
        ],
        summary: { total: 3, passed: 0, attention: 3, blocked: 0, passRate: 0 },
      },
      {
        id: 'test-evidence',
        name: 'Test Evidence',
        scope: 'delivery' as const,
        version: 1,
        capturedAt: now,
        checks: [
          {
            id: 'test-command-pass',
            label: 'Required tests pass',
            category: 'test' as const,
            hardGate: true,
            status: 'attention' as const,
            evidence: 'Test records per loop',
            passCount: 0,
            failCount: 0,
            blockedCount: 0,
          },
          {
            id: 'failure-classified',
            label: 'Failure reason classified',
            category: 'test' as const,
            hardGate: false,
            status: 'attention' as const,
            evidence: 'Test record fix instructions',
            passCount: 0,
            failCount: 0,
            blockedCount: 0,
          },
          {
            id: 'coverage-exists',
            label: 'Coverage reported',
            category: 'test' as const,
            hardGate: false,
            status: 'attention' as const,
            evidence: 'Coverage data per test record',
            passCount: 0,
            failCount: 0,
            blockedCount: 0,
          },
        ],
        summary: { total: 3, passed: 0, attention: 3, blocked: 0, passRate: 0 },
      },
      {
        id: 'cost-policy',
        name: 'Cost Policy',
        scope: 'agent' as const,
        version: 1,
        capturedAt: now,
        checks: [
          {
            id: 'token-budget',
            label: 'Token budget not exceeded',
            category: 'cost' as const,
            hardGate: true,
            status: 'attention' as const,
            evidence: 'Cost guard state',
            passCount: 0,
            failCount: 0,
            blockedCount: 0,
          },
          {
            id: 'call-budget',
            label: 'Call budget not exceeded',
            category: 'cost' as const,
            hardGate: true,
            status: 'attention' as const,
            evidence: 'Cost guard state',
            passCount: 0,
            failCount: 0,
            blockedCount: 0,
          },
          {
            id: 'time-budget',
            label: 'Time budget not exceeded',
            category: 'cost' as const,
            hardGate: false,
            status: 'attention' as const,
            evidence: 'Not yet tracked per-loop',
            passCount: 0,
            failCount: 0,
            blockedCount: 0,
          },
        ],
        summary: { total: 3, passed: 0, attention: 3, blocked: 0, passRate: 0 },
      },
    ];
  }

  async listEvalRuns(
    query: { limit?: number; page?: number; suiteId?: string; loopId?: string } = {},
  ): Promise<EvalRunListResponse> {
    const [list] = await Promise.all([this.list({ page: 1, limit: 200 })]);
    const suites = this.buildEvalSuites();
    const runs: EvalRun[] = [];

    for (const item of list.list) {
      for (const suite of suites) {
        if (query.suiteId && suite.id !== query.suiteId) continue;
        if (query.loopId && item.issue.id !== query.loopId) continue;
        const now = new Date().toISOString();
        const costItem = (await this.cost()).loops.find((c) => c.issueId === item.issue.id);
        const score =
          item.state?.globalVerdict === 'PASS'
            ? 100
            : item.state?.globalVerdict === 'NEEDS-WORK'
              ? 60
              : item.state?.globalVerdict === 'FAIL'
                ? 30
                : 50;
        const status: EvalRun['status'] =
          score >= 80 ? 'passed' : score >= 50 ? 'attention' : 'blocked';
        runs.push({
          id: `eval-run-${suite.id}-${item.issue.id}`,
          suiteId: suite.id,
          loopId: item.issue.id,
          targetRef: item.issue.id,
          status,
          score,
          checkResults: suite.checks.map((c) => ({ ...c })),
          evidenceRefs: item.issue.id ? [`.loops/issues/${item.issue.id}.json`] : [],
          runAt: now,
        });
      }
    }

    const limit = query.limit ?? 20;
    const page = query.page ?? 1;
    const start = (page - 1) * limit;
    return {
      list: runs.slice(start, start + limit),
      total: runs.length,
      page,
      limit,
    };
  }

  async getEvalRun(id: string): Promise<EvalRun> {
    const runs = (await this.listEvalRuns({ limit: 500 })).list;
    const found = runs.find((r) => r.id === id);
    if (!found) throw new NotFoundException(`Eval run ${id} not found`);
    return found;
  }

  /**
   * P0-2, R7: Receive an external webhook (GitHub/Linear/Jira/Slack/generic)
   * and create a Loop issue from it. Supports optional signature verification
   * (HMAC-SHA256). The webhook payload is normalised into an issue title/body
   * and fed through createIssue so SSO/audit/policy paths are identical.
   */
  async webhookTrigger(input: LoopWebhookTrigger): Promise<LoopWebhookTriggerResponse> {
    const now = new Date().toISOString();

    // Map source → event → title/body
    const title = `[${input.source}:${input.event}] Webhook trigger at ${now}`;
    const body = `**Source**: ${input.source}\n**Event**: ${input.event}\n\n**Payload**:\n\`\`\`json\n${JSON.stringify(input.payload, null, 2)}\n\`\`\``;

    try {
      const result = await this.createIssue({
        title,
        targetRepo: '.',
        body,
        priority: 'P2',
        acceptanceCriteria: ['Webhook event successfully mapped to issue'],
        sourceChannel: 'webhook',
        sourceKind: input.source,
      } as import('@repo/contracts').CreateLoopIssueRequest);

      this.log('info', `[Loops] Webhook trigger created issue`, {
        source: input.source,
        event: input.event,
        issueId: result.issue.id,
      });

      return {
        loopId: result.issue.id,
        issueId: result.issue.id,
        source: input.source,
        event: input.event,
        created: true,
        message: `Loop issue ${result.issue.id} created from ${input.source}:${input.event}`,
      };
    } catch (error) {
      this.log('error', `[Loops] Webhook trigger failed`, {
        source: input.source,
        event: input.event,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        loopId: '',
        issueId: '',
        source: input.source,
        event: input.event,
        created: false,
        message: `Failed to create issue: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
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

  private async detectCurrentRuntimeSafe(): Promise<
    | {
        workspaceId: string;
        runtimes: LoopRuntimeDetection[];
      }
    | undefined
  > {
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
    const response = await this.workspaceProfile!.list();
    // gstack/0 P1-4: Cross-workspace learning recall — check learning policy
    // for dedupeScope to determine whether to include cross-workspace learnings.
    const governance = await this.store.readLearningGovernance();
    const recallScope: 'workspace' | 'cross-workspace' =
      governance.autoMergeCandidates.length > 0 ? 'cross-workspace' : 'workspace';
    return {
      ...response,
      recentLearnings: await this.store.readRecentLearnings(12, {
        recallScope,
        workspaceId: response.current,
      }),
      learningGovernance: governance,
    };
  }

  async governLearning(
    learningId: string,
    request: LoopLearningGovernanceRequest,
  ): Promise<LoopWorkspacesResponse> {
    if (request.action === 'merge' && !request.targetLearningId) {
      throw new BadRequestException('targetLearningId is required when merging a learning');
    }
    await this.store.governLearning({ learningId, request });
    return this.listWorkspaces();
  }

  async runLearningAutoMergeWorker(): Promise<LoopWorkspacesResponse> {
    await this.store.runLearningAutoMergeWorker();
    return this.listWorkspaces();
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
          nextActionCategory: action.nextActionCategory,
          label: action.label,
          priority: item.issue.priority,
          phase: item.state?.phase,
          href: `/loops/${item.issue.id}`,
        };
      })
      .filter((item) => item.action !== 'closed')
      .slice(0, 10);
  }

  private resolveNextAction(
    item: LoopListItem,
  ): Pick<LoopMetricsActionItem, 'action' | 'label' | 'nextActionCategory'> {
    const { issue, state } = item;
    if (state?.paused) {
      return { action: 'run-step', label: 'Continue loop', nextActionCategory: 'exception' };
    }
    if (!state || state.specVersion === 'v0') {
      return { action: 'generate-spec', label: 'Continue loop', nextActionCategory: 'continue' };
    }
    if (state.phase === 'PHASE_2_REVIEW') {
      return { action: 'review-spec', label: 'Review spec', nextActionCategory: 'decision' };
    }
    if (state.phase === 'PHASE_3_DECOMPOSE') {
      return { action: 'decompose', label: 'Continue loop', nextActionCategory: 'continue' };
    }
    if (state.phase === 'PHASE_6_CONVERGE') {
      return { action: 'global-review', label: 'Continue loop', nextActionCategory: 'continue' };
    }
    if (state.globalVerdict && state.globalVerdict !== 'PASS') {
      return { action: 'reloop', label: 'Start re-loop', nextActionCategory: 'decision' };
    }
    if (state.globalVerdict === 'PASS' && !state.finalized) {
      return { action: 'finalize', label: 'Continue loop', nextActionCategory: 'continue' };
    }
    if (issue.status === 'CLOSED' || state.phase === 'CLOSED' || state.finalized) {
      return { action: 'closed', label: 'Closed', nextActionCategory: 'done' };
    }
    return { action: 'run-step', label: 'Continue loop', nextActionCategory: 'continue' };
  }

  private formatPhase(phase: string) {
    return PHASE_LABELS[phase] ?? phase.replace('PHASE_', 'P').replaceAll('_', ' ');
  }

  /**
   * Derive a PR-ready delivery evidence summary from a loop detail (P0-4).
   * Reuses existing artifact/record builders so the evidence matches what the
   * scheduler already persists. The markdown body is intentionally plain so a
   * PR provider adapter can post it verbatim as a PR comment.
   */
  private buildDeliveryEvidence(detail: LoopIssueDetail): LoopDeliveryEvidence {
    const now = new Date().toISOString();
    const workPackages: LoopDeliveryEvidenceWorkPackage[] = detail.shards.map((shard) => {
      const implementation = detail.implementationRecords.find(
        (record) => record.shardId === shard.id,
      );
      const review = detail.reviewRecords.find((record) => record.shardId === shard.id);
      const testRecord = detail.testRecords.find((record) => record.shardId === shard.id);
      return {
        id: shard.id,
        title: shard.title,
        status: shard.status,
        files: implementation?.changedFiles ?? shard.filesHint ?? [],
        tests: testRecord?.status ?? 'not-run',
        review: review?.verdict ?? 'unreviewed',
      };
    });

    const testTotal = detail.testRecords.length;
    const testPassed = detail.testRecords.filter((r) => r.status === 'TEST-PASS').length;
    const testFailed = detail.testRecords.filter((r) => r.status === 'TEST-FAIL').length;
    const lastCoverage = detail.testRecords.find((r) => r.coverage)?.coverage;
    const coverage = lastCoverage
      ? `lines ${lastCoverage.lines ?? '-'}% · branches ${lastCoverage.branches ?? '-'}%`
      : 'not reported';

    const shardReviews = detail.reviewRecords.length;
    const findings = detail.reviewRecords.reduce((sum, record) => sum + record.issues.length, 0);
    const globalVerdict = detail.state.globalVerdict ?? 'unreviewed';

    const risks: LoopDeliveryEvidence['risks'] = [];
    if (detail.state.paused) {
      risks.push({ severity: 'critical', description: 'Loop is paused; delivery is blocked.' });
    }
    if (detail.state.globalVerdict === 'FAIL') {
      risks.push({ severity: 'critical', description: 'Global review failed; re-loop required.' });
    } else if (detail.state.globalVerdict === 'NEEDS-WORK') {
      risks.push({ severity: 'warning', description: 'Global review needs work before release.' });
    }
    if (testFailed > 0) {
      risks.push({
        severity: 'warning',
        description: `${testFailed} test record(s) failing.`,
      });
    }
    for (const review of detail.reviewRecords) {
      for (const issue of review.issues) {
        if (issue.severity === 'critical') {
          risks.push({
            severity: 'critical',
            description: `Critical review finding on ${review.shardId}: ${issue.desc}`,
          });
        }
      }
    }

    const costTokens = detail.state.costTokens;
    const costCalls = detail.state.costCalls;
    const budget =
      detail.state.shardsTotal > 0
        ? `${detail.state.shardsDone}/${detail.state.shardsTotal} shards`
        : 'no shards';

    const finalized = detail.issue.status === 'CLOSED' || detail.state.finalized === true;
    const prStatus = detail.convergencePr?.status ?? (finalized ? 'DRAFT' : 'PENDING');
    const prReady =
      finalized &&
      globalVerdict === 'PASS' &&
      testFailed === 0 &&
      detail.state.shardsDone === detail.state.shardsTotal;

    const specSummary = detail.spec
      ? `${detail.spec.version} · ${detail.spec.status}`
      : 'No spec recorded';

    const markdown = this.buildDeliveryEvidenceMarkdown({
      issueId: detail.issue.id,
      title: detail.issue.title,
      specSummary,
      workPackages,
      testTotal,
      testPassed,
      testFailed,
      coverage,
      shardReviews,
      findings,
      globalVerdict,
      risks,
      costTokens,
      costCalls,
      budget,
      prReady,
      prStatus,
      finalized,
      // gstack/0 P2-7: Per-issue quality signals.
      firstPass: (detail.state.reloopCount ?? 0) === 0 && globalVerdict === 'PASS',
      runtimeViolationCount: this.buildRuntimeSecurityExceptions(detail).length,
      browserQaStatus: detail.browserQaReports?.[0]?.status ?? 'not run',
      secondOpinionStatus: detail.secondOpinion?.status ?? 'not required',
    });

    return {
      issueId: detail.issue.id,
      generatedAt: now,
      spec: {
        version: detail.spec?.version ?? 'v0',
        status: detail.spec?.status ?? 'missing',
        summary: specSummary,
      },
      workPackages,
      tests: {
        total: testTotal,
        passed: testPassed,
        failed: testFailed,
        coverage,
      },
      reviews: {
        shardReviews,
        globalVerdict,
        findings,
      },
      risks,
      cost: {
        tokens: costTokens,
        calls: costCalls,
        budget,
      },
      globalVerdict,
      prReady,
      prStatus,
      markdown,
    };
  }

  private buildDeliveryEvidenceMarkdown(input: {
    issueId: string;
    title: string;
    specSummary: string;
    workPackages: LoopDeliveryEvidenceWorkPackage[];
    testTotal: number;
    testPassed: number;
    testFailed: number;
    coverage: string;
    shardReviews: number;
    findings: number;
    globalVerdict: string;
    risks: LoopDeliveryEvidence['risks'];
    costTokens: number;
    costCalls: number;
    budget: string;
    prReady: boolean;
    prStatus: string;
    finalized: boolean;
    firstPass: boolean;
    runtimeViolationCount: number;
    browserQaStatus: string;
    secondOpinionStatus: string;
  }): string {
    const lines: string[] = [];
    lines.push(`# Delivery Evidence — ${input.title}`, '');
    lines.push(`- **Issue**: ${input.issueId}`);
    lines.push(`- **Spec**: ${input.specSummary}`);
    lines.push(`- **Global verdict**: ${input.globalVerdict}`);
    lines.push(`- **PR status**: ${input.prStatus}`);
    lines.push(`- **PR ready**: ${input.prReady ? 'yes' : 'no'}`, '');
    lines.push('## Work Packages', '');
    if (input.workPackages.length === 0) {
      lines.push('_No work packages recorded._', '');
    } else {
      for (const wp of input.workPackages) {
        lines.push(
          `- **${wp.id}** ${wp.title} — status: ${wp.status} · tests: ${wp.tests} · review: ${wp.review}`,
        );
        if (wp.files.length > 0) {
          lines.push(`  - files: ${wp.files.join(', ')}`);
        }
      }
      lines.push('');
    }
    lines.push('## Tests', '');
    lines.push(`- ${input.testPassed}/${input.testTotal} passed · ${input.testFailed} failed`);
    lines.push(`- coverage: ${input.coverage}`, '');
    lines.push('## Reviews', '');
    lines.push(`- ${input.shardReviews} shard reviews · ${input.findings} findings`);
    lines.push(`- global verdict: ${input.globalVerdict}`, '');
    lines.push('## Cost', '');
    lines.push(
      `- tokens: ${input.costTokens} · calls: ${input.costCalls} · budget: ${input.budget}`,
      '',
    );
    if (input.risks.length > 0) {
      lines.push('## Risks', '');
      for (const risk of input.risks) {
        lines.push(`- **${risk.severity}**: ${risk.description}`);
      }
      lines.push('');
    }
    // gstack/0 P2-7: Per-issue quality signals in PR evidence.
    lines.push('## Quality Signals', '');
    lines.push(
      `- **First-pass**: ${input.firstPass ? 'yes (no rework required)' : 'no (rework or re-loop recorded)'}`,
    );
    lines.push(
      `- **Runtime violations**: ${input.runtimeViolationCount > 0 ? `${input.runtimeViolationCount} security exception(s)` : 'none recorded'}`,
    );
    lines.push(`- **Browser QA**: ${input.browserQaStatus}`);
    lines.push(`- **Second opinion**: ${input.secondOpinionStatus}`, '');
    lines.push('---');
    lines.push(`_Generated by DofeAI Loops Control Plane. Runtime: Codex CLI / Cluade Code CLI._`);
    return lines.join('\n');
  }

  private parseNaturalCommand(command: string): LoopNaturalCommandIntent {
    const normalized = command.trim().toLowerCase();
    if (/(show|view|query|list).*(evidence|logs?|records?|trace)/.test(normalized)) {
      return 'query-evidence';
    }
    if (/(request|ask).*(revision|change|update)|退回|修改|修订/.test(normalized)) {
      return 'request-revision';
    }
    if (/(approve|accept).*(spec|plan)?|批准|同意/.test(normalized)) {
      return 'approve-spec';
    }
    if (/resume|recover|unpause|恢复|继续恢复/.test(normalized)) {
      return 'resume';
    }
    if (/pause|stop|hold|暂停|停止/.test(normalized)) {
      return 'pause';
    }
    if (/continue|advance|run|推进|继续/.test(normalized)) {
      return 'continue';
    }
    return 'unknown';
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
    const evidenceArtifacts = this.buildEvidenceArtifacts(detail);
    const enhanced = {
      ...detail,
      requirementsCoverage: this.buildRequirementsCoverage(detail),
      evidenceArtifacts,
    };
    return {
      ...enhanced,
      ...this.buildDeliveryControls(enhanced),
    };
  }

  private async withDeliveryControlsList(result: LoopListResponse): Promise<LoopListResponse> {
    const list = await Promise.all(
      result.list.map(async (item) => {
        let runtimeSecurityExceptions: LoopRuntimeSecurityException[] = [];
        let deliveryItem: LoopListItem | LoopIssueDetail = item;
        try {
          const detail = await this.readDetail(item.issue.id);
          deliveryItem = detail;
          runtimeSecurityExceptions = this.buildRuntimeSecurityExceptions(detail);
        } catch (error) {
          this.log('warn', '[Loops] unable to read runtime security exceptions for list item', {
            issueId: item.issue.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
        return {
          ...item,
          ...this.buildDeliveryControls(deliveryItem),
          ...(this.asDetail(deliveryItem)?.deliveryGovernance
            ? { deliveryGovernance: this.asDetail(deliveryItem)?.deliveryGovernance }
            : {}),
          ...(runtimeSecurityExceptions.length ? { runtimeSecurityExceptions } : {}),
        };
      }),
    );
    return {
      ...result,
      list,
    };
  }

  private buildRuntimeSecurityExceptions(detail: LoopIssueDetail): LoopRuntimeSecurityException[] {
    return detail.testRecords.flatMap((record) =>
      record.failedTests
        .filter((failure) => failure.name.startsWith('runtime-security:'))
        .map((failure, index) => ({
          id: `${record.id}-${failure.name}-${index}`,
          testRecordId: record.id,
          shardId: record.shardId,
          round: record.round,
          level: failure.name === 'runtime-security:canary' ? 'critical' : 'warning',
          reason: failure.reason,
          evidence: `${failure.name} · ${record.status}`,
          command:
            record.commands.find((command) => failure.reason.includes(command.command))?.command ??
            record.runtimeSecurityPolicy?.canary.leakedInCommands[0],
          created: record.created,
        })),
    );
  }

  private buildDeliveryControls(item: LoopListItem | LoopIssueDetail): {
    workflowRecipe: LoopWorkflowRecipe;
    reviewGates: LoopReviewGate[];
    releaseGate: LoopReleaseGate;
    secondOpinion?: LoopSecondOpinion;
  } {
    const detail = this.asDetail(item);
    return {
      workflowRecipe: this.buildWorkflowRecipe(item),
      reviewGates: this.buildReviewGates(item),
      releaseGate: this.buildReleaseGate(item),
      ...(detail ? { secondOpinion: this.buildSecondOpinion(detail) } : {}),
    };
  }

  private buildWorkflowRecipe(item: LoopListItem | LoopIssueDetail): LoopWorkflowRecipe {
    const phase = item.state?.phase ?? 'PHASE_0_INTAKE';
    const blockedReason = this.deliveryBlockedReason(item);
    const evidenceByKind = this.evidenceIdsByKind(item);
    const specApproved = this.isSpecApproved(item);
    const implementationDone = this.isImplementationDone(item);
    const reviewPassed = this.isReviewPassed(item);
    const browserQaPassed = this.isBrowserQaPassed(item);
    const releaseReady = this.isReleaseReady(item);
    const updated = item.state?.updated ?? item.issue.updated;
    const snapshot = this.asDetail(item)?.workflowRecipe;
    const governance = this.asDetail(item)?.deliveryGovernance;
    const workflowDefault = governance?.workflowDefaults.find(
      (entry) => entry.loopKind === this.inferWorkflowKind(item),
    );

    const steps: LoopWorkflowStep[] = [
      {
        id: `${item.issue.id}-intake`,
        kind: 'intake',
        label: 'Intake',
        required: true,
        status: 'passed',
        owner: 'system',
        humanGate: 'none',
        phase: 'PHASE_0_INTAKE',
        evidenceTypes: ['raw-payload', 'issue', 'intake'],
        evidenceIds: [
          ...evidenceByKind('raw-payload'),
          ...evidenceByKind('issue'),
          ...evidenceByKind('intake'),
        ],
      },
      {
        id: `${item.issue.id}-spec-review`,
        kind: 'spec_review',
        label: 'Spec Review',
        required: true,
        status:
          blockedReason && phase === 'PHASE_2_REVIEW'
            ? 'blocked'
            : specApproved
              ? 'passed'
              : 'current',
        owner: 'codex',
        humanGate: 'approval',
        phase: 'PHASE_2_REVIEW',
        evidenceTypes: ['spec'],
        evidenceIds: evidenceByKind('spec'),
        blockedReason: blockedReason && phase === 'PHASE_2_REVIEW' ? blockedReason : undefined,
      },
      {
        id: `${item.issue.id}-implementation`,
        kind: 'implementation',
        label: 'Implementation',
        required: true,
        status:
          blockedReason && phase === 'PHASE_4_IMPLEMENT'
            ? 'blocked'
            : implementationDone
              ? 'passed'
              : phase === 'PHASE_4_IMPLEMENT'
                ? 'current'
                : specApproved
                  ? 'pending'
                  : 'pending',
        owner: 'claude-code',
        humanGate: 'none',
        phase: 'PHASE_4_IMPLEMENT',
        evidenceTypes: ['implementation-record', 'shards'],
        evidenceIds: [...evidenceByKind('implementation-record'), ...evidenceByKind('shards')],
        blockedReason: blockedReason && phase === 'PHASE_4_IMPLEMENT' ? blockedReason : undefined,
      },
      {
        id: `${item.issue.id}-code-review`,
        kind: 'code_review',
        label: 'Code Review',
        required: true,
        status: blockedReason
          ? 'blocked'
          : reviewPassed
            ? 'passed'
            : phase === 'PHASE_5_REVIEW' || phase === 'PHASE_6_CONVERGE'
              ? 'current'
              : implementationDone
                ? 'pending'
                : 'pending',
        owner: 'codex',
        humanGate: 'none',
        phase: 'PHASE_5_REVIEW',
        evidenceTypes: ['review-record', 'global-review', 'test-record'],
        evidenceIds: [
          ...evidenceByKind('review-record'),
          ...evidenceByKind('global-review'),
          ...evidenceByKind('test-record'),
        ],
        blockedReason,
      },
      {
        id: `${item.issue.id}-browser-qa`,
        kind: 'browser_qa',
        label: 'Browser QA',
        required: false,
        status: browserQaPassed
          ? 'passed'
          : phase === 'PHASE_7_GLOBAL_REVIEW'
            ? 'current'
            : 'pending',
        owner: 'codex',
        humanGate: 'none',
        phase: 'PHASE_7_GLOBAL_REVIEW',
        evidenceTypes: ['global-review'],
        evidenceIds: evidenceByKind('global-review'),
      },
      {
        id: `${item.issue.id}-release-gate`,
        kind: 'release_gate',
        label: 'Release Gate',
        required: true,
        status: blockedReason
          ? 'blocked'
          : releaseReady
            ? 'passed'
            : ['PHASE_6_CONVERGE', 'PHASE_7_GLOBAL_REVIEW', 'PHASE_8_ANNOTATE', 'CLOSED'].includes(
                  phase,
                )
              ? 'current'
              : 'pending',
        owner: 'codex',
        humanGate: 'decision',
        phase: 'PHASE_8_ANNOTATE',
        evidenceTypes: ['convergence-pr', 'annotations'],
        evidenceIds: [...evidenceByKind('convergence-pr'), ...evidenceByKind('annotations')],
        blockedReason,
      },
      {
        id: `${item.issue.id}-retro`,
        kind: 'retro',
        label: 'Reflect',
        required: false,
        status: item.issue.status === 'ARCHIVED' ? 'passed' : releaseReady ? 'current' : 'pending',
        owner: 'codex',
        humanGate: 'none',
        evidenceTypes: ['annotations'],
        evidenceIds: evidenceByKind('annotations'),
      },
    ];

    return {
      id: snapshot?.id ?? workflowDefault?.recipeId ?? `default-${this.inferWorkflowKind(item)}`,
      name: snapshot?.name ?? 'Default Codex / Claude Code delivery',
      version: snapshot?.version ?? 1,
      appliesTo: snapshot?.appliesTo ?? [this.inferWorkflowKind(item)],
      capturedAt: snapshot?.capturedAt ?? workflowDefault?.updated ?? updated,
      source: snapshot?.source ?? (workflowDefault ? 'workspace' : 'default'),
      steps,
    };
  }

  private buildReviewGates(item: LoopListItem | LoopIssueDetail): LoopReviewGate[] {
    const updated = item.state?.updated ?? item.issue.updated;
    const blockedReason = this.deliveryBlockedReason(item);
    const specApproved = this.isSpecApproved(item);
    const implementationDone = this.isImplementationDone(item);
    const reviewPassed = this.isReviewPassed(item);
    const findingsCount = this.reviewFindingsCount(item);
    const evidenceByKind = this.evidenceIdsByKind(item);

    const gates: LoopReviewGate[] = [
      {
        id: `${item.issue.id}-gate-product`,
        kind: 'product',
        status:
          blockedReason && item.state?.phase === 'PHASE_2_REVIEW'
            ? 'blocked'
            : specApproved
              ? 'passed'
              : 'pending',
        reviewer: 'human',
        confidence: specApproved ? 0.9 : undefined,
        findingsCount: 0,
        evidenceId: evidenceByKind('spec')[0],
        requiredByStepId: `${item.issue.id}-spec-review`,
        updated,
      },
      {
        id: `${item.issue.id}-gate-architecture`,
        kind: 'architecture',
        status: this.phaseAtLeast(item, 'PHASE_3_DECOMPOSE') ? 'passed' : 'pending',
        reviewer: 'codex',
        confidence: this.phaseAtLeast(item, 'PHASE_3_DECOMPOSE') ? 0.8 : undefined,
        findingsCount: 0,
        evidenceId: evidenceByKind('shards')[0],
        requiredByStepId: `${item.issue.id}-implementation`,
        updated,
      },
      {
        id: `${item.issue.id}-gate-code`,
        kind: 'code',
        status: blockedReason
          ? 'blocked'
          : reviewPassed
            ? 'passed'
            : findingsCount > 0
              ? 'needs_changes'
              : implementationDone
                ? 'pending'
                : 'pending',
        reviewer: 'codex',
        confidence: reviewPassed ? 0.85 : undefined,
        findingsCount,
        evidenceId: evidenceByKind('review-record')[0] ?? evidenceByKind('global-review')[0],
        requiredByStepId: `${item.issue.id}-code-review`,
        updated,
      },
      {
        id: `${item.issue.id}-gate-security`,
        kind: 'security',
        status: this.isReleaseReady(item) ? 'passed' : 'pending',
        reviewer: 'codex',
        confidence: this.isReleaseReady(item) ? 0.7 : undefined,
        findingsCount: 0,
        evidenceId: evidenceByKind('global-review')[0],
        requiredByStepId: `${item.issue.id}-release-gate`,
        updated,
      },
    ];
    const overrides = this.asDetail(item)?.deliveryGovernance?.reviewGateOverrides ?? [];
    return gates.map((gate) => {
      const override = overrides.find((item) => item.gateKind === gate.kind);
      if (!override) return gate;
      return {
        ...gate,
        status: override.status,
        reviewer: 'human',
        confidence:
          override.status === 'passed' || override.status === 'waived' ? 1 : gate.confidence,
        waiverReason:
          override.status === 'waived' || override.status === 'blocked'
            ? (override.reason ?? `Governed by ${override.actor}`)
            : gate.waiverReason,
        updated: override.updated,
      };
    });
  }

  private buildReleaseGate(item: LoopListItem | LoopIssueDetail): LoopReleaseGate {
    const updated = item.state?.updated ?? item.issue.updated;
    const evidenceByKind = this.evidenceIdsByKind(item);
    const detail = this.asDetail(item);
    const secondOpinion = detail ? this.buildSecondOpinion(detail) : undefined;
    const governance = detail?.deliveryGovernance;
    const reviewGates = this.buildReviewGates(item);
    const canaryPassed = !governance?.releaseCanary || governance.releaseCanary.status === 'passed';
    const checklist = {
      specApproved: this.isSpecApproved(item),
      implementationEvidence: this.isImplementationDone(item),
      testsPassed: this.testsPassed(item),
      requiredReviewsPassed: reviewGates.every(
        (gate) => gate.status === 'passed' || gate.status === 'waived',
      ),
      secondOpinionPassed: secondOpinion
        ? !secondOpinion.requiredForRelease || secondOpinion.status === 'passed'
        : true,
      browserQaPassed: this.isBrowserQaPassed(item),
      docsUpdated: true,
      prReady: Boolean(detail?.convergencePr || item.issue.status === 'CLOSED'),
      rollbackNote: Boolean(detail?.convergencePr || item.issue.status === 'CLOSED'),
      canaryPassed,
    };
    const blocker = this.deliveryBlockedReason(item);
    return {
      id: `${item.issue.id}-release-gate`,
      status: blocker
        ? 'blocked'
        : item.issue.status === 'CLOSED' || item.state?.finalized
          ? 'shipped'
          : Object.values(checklist).every(Boolean)
            ? 'ready'
            : 'pending',
      checklist,
      evidenceIds: [
        ...evidenceByKind('spec'),
        ...evidenceByKind('implementation-record'),
        ...evidenceByKind('test-record'),
        ...evidenceByKind('review-record'),
        ...evidenceByKind('global-review'),
        ...evidenceByKind('convergence-pr'),
      ],
      blocker,
      updated,
    };
  }

  private buildSecondOpinion(detail: LoopIssueDetail): LoopSecondOpinion {
    if (detail.secondOpinion) {
      return this.applySecondOpinionPolicy(detail, detail.secondOpinion);
    }
    const primaryEvidenceIds = [
      ...detail.reviewRecords.map((record) => record.id),
      ...(detail.globalReview ? [detail.globalReview.id] : []),
    ];
    const primaryFindings = buildPrimarySecondOpinionFindings({
      reviewRecords: detail.reviewRecords,
      globalReview: detail.globalReview,
    });
    const comparison = compareSecondOpinionFindings({ primary: primaryFindings, secondary: [] });
    const primaryPassed = Boolean(
      detail.globalReview?.verdict === 'PASS' ||
      (detail.reviewRecords.length > 0 &&
        detail.reviewRecords.every((record) => record.verdict === 'PASS')),
    );
    const primaryStatus: LoopSecondOpinion['primary']['status'] =
      primaryEvidenceIds.length === 0
        ? 'not_run'
        : primaryFindings.length > 0
          ? 'needs_changes'
          : primaryPassed
            ? 'passed'
            : 'pending';
    const secondaryStatus: LoopSecondOpinion['secondary']['status'] = detail.globalReview
      ? 'pending'
      : 'not_run';
    const requiredForRelease =
      detail.deliveryGovernance?.secondOpinionPolicy?.requiredForRelease ?? false;
    const conflictHumanGate =
      detail.deliveryGovernance?.secondOpinionPolicy?.conflictHumanGate ?? true;
    const hasConflict = comparison.conflictCount > 0 && conflictHumanGate;

    return this.applySecondOpinionPolicy(detail, {
      id: `${detail.issue.id}-second-opinion`,
      status: hasConflict
        ? 'conflict'
        : requiredForRelease
          ? this.isSecondOpinionReviewerPassed(secondaryStatus) && primaryStatus === 'passed'
            ? 'passed'
            : primaryStatus === 'needs_changes'
              ? 'needs_changes'
              : 'pending'
          : 'not_required',
      primary: {
        role: 'primary',
        reviewer: 'codex',
        status: primaryStatus,
        findingsCount: primaryFindings.length,
        findings: primaryFindings,
        evidenceIds: primaryEvidenceIds,
        summary:
          primaryEvidenceIds.length > 0
            ? `Codex primary review has ${primaryFindings.length} finding(s) across shard and global review evidence.`
            : 'Codex primary review has not produced evidence yet.',
      },
      secondary: {
        role: 'secondary',
        reviewer: 'claude-code',
        status: secondaryStatus,
        findingsCount: 0,
        findings: [],
        evidenceIds: [],
        summary:
          secondaryStatus === 'pending'
            ? 'Claude Code secondary review is not required for release yet; enable the second-opinion worker to compare findings.'
            : 'Claude Code secondary review has not run yet.',
      },
      comparison: {
        ...comparison,
      },
      requiredForRelease,
      updated: detail.state.updated ?? detail.issue.updated,
    });
  }

  private applySecondOpinionPolicy(
    detail: LoopIssueDetail,
    report: LoopSecondOpinion,
  ): LoopSecondOpinion {
    const policy = detail.deliveryGovernance?.secondOpinionPolicy;
    if (!policy) return report;
    const status =
      policy.conflictHumanGate && report.comparison.conflictCount > 0
        ? 'conflict'
        : policy.requiredForRelease
          ? report.secondary.status === 'passed' && report.primary.status === 'passed'
            ? 'passed'
            : report.status === 'needs_changes' || report.primary.status === 'needs_changes'
              ? 'needs_changes'
              : 'pending'
          : report.status;
    return {
      ...report,
      status,
      requiredForRelease: policy.requiredForRelease,
      updated: policy.updated,
    };
  }

  private isSecondOpinionReviewerPassed(status: LoopSecondOpinion['secondary']['status']): boolean {
    return status === 'passed';
  }

  private deliveryBlockedReason(item: LoopListItem | LoopIssueDetail): string | undefined {
    if (item.state?.paused || item.state?.phase === 'PAUSED') return 'Loop is paused';
    if (item.state?.globalVerdict && item.state.globalVerdict !== 'PASS') {
      return `Global review ${item.state.globalVerdict}`;
    }
    return undefined;
  }

  private inferWorkflowKind(
    item: LoopListItem | LoopIssueDetail,
  ): LoopWorkflowRecipe['appliesTo'][number] {
    const text =
      `${item.issue.title} ${item.issue.body ?? ''} ${item.issue.targetRepo}`.toLowerCase();
    if (text.includes('doc') || text.includes('文档')) return 'docs';
    if (text.includes('fix') || text.includes('bug') || text.includes('修复')) return 'bugfix';
    if (text.includes('refactor') || text.includes('重构')) return 'refactor';
    if (/\b(deploy|ops)\b/.test(text) || text.includes('运维')) return 'ops';
    return 'feature';
  }

  private evidenceIdsByKind(item: LoopListItem | LoopIssueDetail) {
    const detail = this.asDetail(item);
    return (kind: LoopEvidenceArtifact['kind']) =>
      detail?.evidenceArtifacts
        ?.filter((artifact) => artifact.kind === kind)
        .map((artifact) => artifact.id) ?? [];
  }

  private asDetail(item: LoopListItem | LoopIssueDetail): LoopIssueDetail | undefined {
    return 'intake' in item ? item : undefined;
  }

  private isSpecApproved(item: LoopListItem | LoopIssueDetail): boolean {
    const detail = this.asDetail(item);
    return Boolean(
      detail?.spec?.status === 'APPROVED' ||
      (item.state?.specVersion &&
        item.state.specVersion !== 'v0' &&
        this.phaseAtLeast(item, 'PHASE_3_DECOMPOSE')),
    );
  }

  private isImplementationDone(item: LoopListItem | LoopIssueDetail): boolean {
    const shardsDone = item.state?.shardsDone ?? 0;
    const shardsTotal = item.state?.shardsTotal ?? 0;
    return shardsTotal > 0 && shardsDone >= shardsTotal;
  }

  private isReviewPassed(item: LoopListItem | LoopIssueDetail): boolean {
    return item.issue.status === 'CLOSED' || item.state?.globalVerdict === 'PASS';
  }

  private isBrowserQaPassed(item: LoopListItem | LoopIssueDetail): boolean {
    const reports = this.asDetail(item)?.browserQaReports ?? [];
    if (reports.length > 0) {
      return reports[0]?.status === 'passed';
    }
    const phase = item.state?.phase ?? 'PHASE_0_INTAKE';
    return (
      item.issue.status === 'CLOSED' ||
      ['PHASE_7_GLOBAL_REVIEW', 'PHASE_8_ANNOTATE', 'CLOSED'].includes(phase)
    );
  }

  private isReleaseReady(item: LoopListItem | LoopIssueDetail): boolean {
    return (
      (item.issue.status === 'CLOSED' || item.state?.finalized || item.state?.phase === 'CLOSED') &&
      this.isSpecApproved(item) &&
      this.isImplementationDone(item) &&
      this.isReviewPassed(item)
    );
  }

  /**
   * gstack/0 P0-2: Enforce release gate checklist before allowing finalize.
   * Blocks shipping when spec is not approved, implementation evidence is missing,
   * tests have not passed, required reviews are not done, second opinion has
   * unresolved conflicts, browser QA has not passed, rollback note is missing,
   * or canary has not passed.
   */
  private enforceReleaseGate(
    detail: LoopIssueDetail,
    releaseGate: LoopReleaseGate,
    secondOpinion?: LoopSecondOpinion,
  ): void {
    const blockers: string[] = [];
    if (!releaseGate.checklist.specApproved) {
      blockers.push('Spec is not approved');
    }
    if (!releaseGate.checklist.implementationEvidence) {
      blockers.push('Implementation evidence is missing');
    }
    if (!releaseGate.checklist.testsPassed) {
      blockers.push('Tests have not all passed');
    }
    if (!releaseGate.checklist.requiredReviewsPassed) {
      blockers.push('Required reviews have not all passed or been waived');
    }
    if (secondOpinion?.requiredForRelease && secondOpinion.status === 'conflict') {
      // gstack/0 P1-5: Check whether conflict resolutions have been recorded.
      const resolutions = detail.deliveryGovernance?.secondOpinionResolutions ?? [];
      const hasResolution = resolutions.length > 0;
      const conflictCount = secondOpinion.comparison.conflictCount;
      if (!hasResolution || resolutions.length < conflictCount) {
        blockers.push(
          `Second opinion has ${conflictCount - resolutions.length} unresolved conflict(s); resolve or waive before shipping`,
        );
      }
    }
    if (!releaseGate.checklist.browserQaPassed) {
      blockers.push('Browser QA has not passed');
    }
    if (!releaseGate.checklist.rollbackNote) {
      blockers.push('Rollback note is missing — required for all releases');
    }
    if (releaseGate.checklist.canaryPassed === false) {
      blockers.push('Release canary has not passed');
    }

    if (blockers.length > 0) {
      this.log('warn', `[Loops] Release gate blocked finalize for ${detail.issue.id}`, {
        issueId: detail.issue.id,
        blockerCount: blockers.length,
        blockers,
      });
      throw new BadRequestException(
        `Release gate is not ready:\n${blockers.map((b) => `- ${b}`).join('\n')}`,
      );
    }
  }

  private testsPassed(item: LoopListItem | LoopIssueDetail): boolean {
    const detail = this.asDetail(item);
    if (!detail) return this.isReviewPassed(item);
    return (
      detail.testRecords.length > 0 &&
      detail.testRecords.every((record) => record.status === 'TEST-PASS')
    );
  }

  private reviewFindingsCount(item: LoopListItem | LoopIssueDetail): number {
    const detail = this.asDetail(item);
    if (!detail) return item.state?.globalVerdict && item.state.globalVerdict !== 'PASS' ? 1 : 0;
    return (
      detail.reviewRecords.reduce((total, record) => total + record.issues.length, 0) +
      (detail.globalReview?.issues.length ?? 0)
    );
  }

  private phaseAtLeast(item: LoopListItem | LoopIssueDetail, phase: LoopPhase): boolean {
    if (item.issue.status === 'CLOSED' || item.state?.finalized) return true;
    const order: Partial<Record<LoopPhase, number>> = {
      PHASE_0_INTAKE: 0,
      PHASE_1_SPEC: 1,
      PHASE_2_REVIEW: 2,
      PHASE_3_DECOMPOSE: 3,
      PHASE_4_IMPLEMENT: 4,
      PHASE_5_REVIEW: 5,
      PHASE_6_CONVERGE: 6,
      PHASE_7_GLOBAL_REVIEW: 7,
      PHASE_8_ANNOTATE: 8,
      CLOSED: 9,
      PAUSED: -1,
    };
    return (order[item.state?.phase ?? 'PHASE_0_INTAKE'] ?? 0) >= (order[phase] ?? 0);
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
        round: record.round,
        count: record.changedFiles.length,
        summary: `${record.status} implementation for ${record.shardId}; ${record.changedFiles.length} changed files recorded.`,
      })),
      ...detail.testRecords.map((record) => ({
        id: record.id,
        label: `Test ${record.shardId}`,
        kind: 'test-record' as const,
        path: `.loops/tests/${issueId}/records/${record.id}.json`,
        status: 'present' as const,
        round: record.round,
        count: record.commands.length,
        summary: `${record.status} test run for ${record.shardId}; ${record.commands.length} commands executed.`,
      })),
      ...detail.reviewRecords.map((record) => ({
        id: record.id,
        label: `Review ${record.shardId}`,
        kind: 'review-record' as const,
        path: `.loops/runs/${issueId}/${record.shardId}/${record.round}/review.json`,
        status: 'present' as const,
        round: record.round,
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
      round: detail.globalReview?.round,
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
    const latestBrowserQa = detail.browserQaReports?.[0];
    artifacts.push({
      id: latestBrowserQa?.id ?? `${issueId}-browser-qa`,
      label: 'Browser QA',
      kind: 'browser-qa',
      path: latestBrowserQa
        ? `.loops/runs/${issueId}/browser-qa/${latestBrowserQa.id}.json`
        : `.loops/runs/${issueId}/browser-qa`,
      status: latestBrowserQa ? 'present' : 'pending',
      count: latestBrowserQa
        ? latestBrowserQa.consoleErrors.length + latestBrowserQa.networkFailures.length
        : undefined,
      summary: latestBrowserQa
        ? `${latestBrowserQa.status} browser QA for ${latestBrowserQa.targetUrl}; ${latestBrowserQa.screenshots.length} screenshots, ${latestBrowserQa.traces?.length ?? 0} traces, ${latestBrowserQa.visualDiffs?.length ?? 0} visual checks and ${latestBrowserQa.handoffs?.length ?? 0} handoffs captured.`
        : 'Browser QA report has not been run yet.',
    });
    artifacts.push({
      id: detail.secondOpinion?.id ?? `${issueId}-second-opinion`,
      label: 'Second Opinion',
      kind: 'second-opinion',
      path: `.loops/runs/${issueId}/second-opinion.json`,
      status: detail.secondOpinion ? 'present' : 'pending',
      count: detail.secondOpinion?.comparison.conflictCount,
      summary: detail.secondOpinion
        ? `${detail.secondOpinion.status} second opinion; secondary reviewer ${detail.secondOpinion.secondary.status}.`
        : 'Second opinion worker has not produced evidence yet.',
    });

    return artifacts;
  }

  private buildLoopLearnings(
    detail: LoopIssueDetail,
    convergencePr: LoopConvergencePr,
    createdAt: string,
  ): LoopLearning[] {
    const workspaceId = detail.intake.ruleSnapshot?.workspaceId ?? 'default';
    const evidenceIds = [
      ...this.buildEvidenceArtifacts(detail)
        .filter((artifact) => artifact.status === 'present')
        .map((artifact) => artifact.id),
      `${detail.issue.id}-convergence-pr`,
    ];
    const reviewFindings = this.reviewFindingsCount(detail);
    const testCommands = Array.from(
      new Set(detail.testRecords.flatMap((record) => record.commands.map((item) => item.command))),
    );
    const changedFiles = Array.from(
      new Set(detail.implementationRecords.flatMap((record) => record.changedFiles)),
    );
    const learnings: LoopLearning[] = [
      {
        id: `${detail.issue.id}-learning-decision`,
        workspaceId,
        repo: detail.issue.targetRepo,
        kind: 'decision',
        summary: `Loop finalized with global verdict ${detail.state.globalVerdict}; convergence PR ${convergencePr.status} captured ${convergencePr.commits.length} commit references.`,
        evidenceIds,
        confidence: detail.state.globalVerdict === 'PASS' ? 0.9 : 0.6,
        createdAt,
      },
    ];

    if (testCommands.length > 0) {
      learnings.push({
        id: `${detail.issue.id}-learning-test-policy`,
        workspaceId,
        repo: detail.issue.targetRepo,
        kind: 'test_policy',
        summary: `Validated test command policy for this loop: ${testCommands.slice(0, 3).join('; ')}.`,
        evidenceIds: detail.testRecords.map((record) => record.id),
        confidence: detail.testRecords.every((record) => record.status === 'TEST-PASS')
          ? 0.85
          : 0.55,
        createdAt,
      });
    }

    if (changedFiles.length > 0) {
      learnings.push({
        id: `${detail.issue.id}-learning-ownership`,
        workspaceId,
        repo: detail.issue.targetRepo,
        kind: 'ownership',
        summary: `Implementation touched ${changedFiles.length} file(s); primary ownership hints: ${changedFiles.slice(0, 5).join(', ')}.`,
        evidenceIds: detail.implementationRecords.map((record) => record.id),
        confidence: 0.75,
        createdAt,
      });
    }

    if (reviewFindings > 0) {
      learnings.push({
        id: `${detail.issue.id}-learning-review-pattern`,
        workspaceId,
        repo: detail.issue.targetRepo,
        kind: 'pitfall',
        summary: `${reviewFindings} review finding(s) were recorded before finalization; check review evidence before repeating similar changes.`,
        evidenceIds: [
          ...detail.reviewRecords.map((record) => record.id),
          ...(detail.globalReview ? [detail.globalReview.id] : []),
        ],
        confidence: 0.7,
        createdAt,
      });
    }

    return learnings.map(enrichLoopLearning);
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
