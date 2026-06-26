import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto';
import type {
  CreateLoopIssueRequest,
  CreateLoopIssueSimpleRequest,
  DetectLoopRuntimeResponse,
  LoopBrowserQaRequest,
  LoopAgentRuntimeResponse,
  LoopAnnotation,
  LoopAssetPermissionAction,
  LoopAssetPermissionKind,
  LoopAssetPermissionItem,
  LoopAssetPermissionsResponse,
  LoopBenchMetricKey,
  LoopBenchTrendSnapshot,
  LoopBenchTrendSummary,
  LoopBenchTrendWorkerResponse,
  LoopCapabilitiesResponse,
  LoopConvergencePr,
  LoopDeliveryEvidence,
  LoopDeliveryEvidenceWorkPackage,
  LoopDeliveryGovernanceRequest,
  LoopResolveSecondOpinion,
  LoopWebhookTrigger,
  LoopWebhookTriggerResponse,
  LoopScheduleTrigger,
  LoopScheduleTriggerListResponse,
  CreateScheduleTriggerRequest,
  UpdateScheduleTriggerRequest,
  LoopTriggerExecution,
  LoopTriggerExecutionListResponse,
  LoopTriggerRetryRequest,
  LoopTriggerReplayRequest,
  LoopTriggerDeadLetterListResponse,
  LoopToolListResponse,
  RegisterToolRequest,
  UpdateToolRequest,
  ToolHealthCheckResponse,
  ToolTestResponse,
  LoopBlueprintListResponse,
  CreateBlueprintRequest,
  UpdateBlueprintRequest,
  RuntimeBackend,
  RuntimeBackendListResponse,
  RuntimeBackendPolicyUpdate,
  EvalHistoricalBaselineSnapshot,
  EvalSuite,
  EvalSuiteListResponse,
  EvalRun,
  EvalRunListResponse,
  EvalTrendWorkerResponse,
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
  LoopCostResponse,
  LoopCiCheckAction,
  LoopCiCheckIntegration,
  LoopCiCheckIntegrationListResponse,
  LoopCiCheckPublicationHistory,
  LoopMetricsActionItem,
  LoopMetricsResponse,
  LoopMetricsRiskItem,
  LoopMcpServer,
  LoopMcpServerAction,
  LoopMcpServerListResponse,
  LoopNaturalCommandIntent,
  LoopNaturalCommandRequest,
  LoopNaturalCommandResponse,
  PullLoopImageResponse,
  LoopRecipeAdminActionRequest,
  LoopRecipeAdminActionResponse,
  LoopRemoteRunner,
  LoopRemoteRunnerJob,
  LoopRemoteRunnerJobRequest,
  LoopRemoteRunnerLease,
  LoopRemoteRunnerLeaseRequest,
  LoopRemoteRunnerListResponse,
  LoopRemoteRunnerReleaseRequest,
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
  LoopWorkflowRecipe,
  LoopWorkspacesResponse,
  UpsertLoopWorkspaceRequest,
} from '@repo/contracts';
import { normaliseSimpleIssue } from '@repo/contracts';
import type { AuthUserInfo } from '@app/auth/types/auth.interface';
import { PermissionService } from '@app/auth/permission.service';
import { LoopsFileStoreService } from '@app/services/loops-store';
import {
  LoopsEvalAggregationWorkerService,
  LoopsEvalService,
  type LoopsAggregation,
  type LoopsEvalEvidencePort,
  type LoopsEvalTrendStorePort,
  type LoopsEvalLogSink,
} from '@app/services/loops-eval';
import { LoopsCrossTenantArchiveService } from './loops-cross-tenant-archive.service';
import { LoopsMcpClientService, LoopsMcpSecretService } from '@app/services/loops-integrations';
import { LoopsDockerSandboxService } from '@app/services/loops-runtime';
import type { Prisma, LoopEvalAggregation } from '@prisma/client';
import { LoopEvalAggregationService } from '@app/db/loop-eval-aggregation';
import { LoopsAdminService, LoopsCapabilityRegistry } from '@app/services/loops-admin';
import { LoopsTriggersService, type LoopsIssueCreationPort } from '@app/services/loops-triggers';
import { LoopsRemoteRunnersService } from '@app/services/loops-remote-runners';
import {
  AgentRuntimeDetectionService,
  LoopsWorkspaceProfileService,
} from '@app/services/loops-runtime';
import { LoopsRunnerService } from '@app/services/loops-runners';
import { LOOPS_AGENT_ADAPTER, type LoopsAgentAdapter } from '@app/services/loops-runners';
import { LOOPS_CLAUDE_ADAPTER, type LoopsClaudeAdapter } from '@app/services/loops-runners';
import {
  LOOPS_GIT_ADAPTER,
  type LoopsCommitShardResult,
  type LoopsGitAdapter,
} from '@app/services/loops-runners';
import { LoopsPrProviderClient } from '@app/services/loops-integrations';
import type { LoopsPersistenceService } from '@app/services/loops-store';
import { LOOPS_PERSISTENCE } from '@app/services/loops-store';
import { LoopsIssuesService } from '@app/services/loops-issues';
import { LoopsEngineService } from '@app/services/loops-engine';
import { LoopsEvidenceService } from '@app/services/loops-evidence';
import { readLoopsRuntimeConfig } from '@app/services/loops-store';
import { LoopsWorkLockService } from '@app/services/loops-locks';
import {
  LoopsBrowserQaWorkerService,
  LoopsSecondOpinionWorkerService,
} from '@app/services/loops-quality';
import { enrichLoopLearning } from '@app/services/loops-store';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';

type LoopIssueDetail = Awaited<ReturnType<LoopsFileStoreService['readDetail']>>;
type LoopListItem = LoopListResponse['list'][number];
type EvalCheckBlueprint = Omit<
  EvalSuite['checks'][number],
  'passCount' | 'failCount' | 'blockedCount'
>;
type EvalSuiteBlueprint = Omit<EvalSuite, 'capturedAt' | 'checks' | 'summary'> & {
  checks: EvalCheckBlueprint[];
};
type EvalEvidence = {
  list: LoopListItem[];
  details: Map<string, LoopIssueDetail>;
  costByIssue: Map<string, LoopCostResponse['loops'][number]>;
};
type EvalRunBuildContext = {
  history?: EvalHistoricalBaselineSnapshot[];
};
type LoopAssetPermissionContext = {
  userId: string;
  isAdmin?: boolean;
  teamId?: string;
  tenantId?: string;
};

type AgentRuntimeDefinition = {
  id: string;
  label: string;
  phase: LoopPhase;
  supportedPhases: LoopPhase[];
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
export class LoopsService implements LoopsIssueCreationPort {
  private readonly webhookRateWindows = new Map<string, { count: number; resetAt: number }>();

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
    @Optional()
    private readonly permissionService?: PermissionService,
    // R33: Cross-tenant eval aggregation (DB + Redis + BullMQ)
    @Optional()
    private readonly evalAggregationDb?: LoopEvalAggregationService,
    @Optional()
    private readonly evalAggregationWorker?: LoopsEvalAggregationWorkerService,
    // R35: Cross-tenant archive (object storage + SSO)
    @Optional()
    private readonly crossTenantArchive?: LoopsCrossTenantArchiveService,
    // R37: MCP client for real handshake + Docker sandbox execution
    @Optional()
    private readonly mcpClient?: LoopsMcpClientService,
    @Optional()
    private readonly dockerSandbox?: LoopsDockerSandboxService,
    // R38: MCP secret management
    @Optional()
    private readonly mcpSecret?: LoopsMcpSecretService,
    // Step 8: schedule trigger CRUD/cron primitives live in domain. Fire still
    // stays here because it coordinates issue creation through the facade.
    @Optional()
    private readonly triggersService: LoopsTriggersService = new LoopsTriggersService(store),
    @Optional()
    private readonly remoteRunnersService: LoopsRemoteRunnersService = new LoopsRemoteRunnersService(
      store,
    ),
    // Step 9：tool registry / delivery blueprint 控制面已下沉到 domain admin service。
    // facade 保留 public API 和日志兼容。
    @Optional()
    private readonly adminService: LoopsAdminService = new LoopsAdminService(store),
    // 结构优化 Step 2：issue intake 原语下沉到 `LoopsIssuesService`。@Optional 让
    // standalone 构造（spec/e2e 用 `new LoopsService(...)`）不传时也能自构造（store +
    // persistence 已在前序参数注入），Nest graph 内则由 LoopsIssuesModule 提供。
    @Optional()
    issues?: LoopsIssuesService,
    // 结构优化 Step 3：loop 状态机纯推导原语下沉到 `LoopsEngineService`（无 DI 依赖，
    // 自构造零成本）。Nest graph 内由 LoopsEngineModule 提供。
    @Optional()
    engine?: LoopsEngineService,
    // 结构优化 Step 5：交付证据/delivery 派生原语下沉到 `LoopsEvidenceService`
    //（纯函数，自构造零成本）。Nest graph 内由 LoopsEvidenceModule 提供。
    @Optional()
    evidence?: LoopsEvidenceService,
    @Optional()
    evalService?: LoopsEvalService,
  ) {
    this.issues =
      issues ?? new LoopsIssuesService(this.store, this.persistence, this.workspaceProfile);
    this.engine = engine ?? new LoopsEngineService();
    this.evidence = evidence ?? new LoopsEvidenceService();
    this.evalService = evalService ?? new LoopsEvalService();
  }

  private readonly issues: LoopsIssuesService;

  private readonly engine: LoopsEngineService;

  private readonly evidence: LoopsEvidenceService;

  private readonly evalService: LoopsEvalService;

  /**
   * 结构优化 nextstep Step N2：eval/bench trend worker 的 evidence 组装与 store
   * 编排已下沉到 `LoopsEvalService`。facade 在此暴露窄 port 适配器，把自身的
   * `collectEvalEvidence` / `buildEvalSuites` / `buildEvalRuns` 与 `store` 的
   * trend history 方法包装成 domain port，避免 domain 反向依赖 facade。
   */
  private get evalEvidencePort(): LoopsEvalEvidencePort {
    return {
      collectEvalEvidence: async () => {
        const evidence = await this.collectEvalEvidence();
        const suites = this.buildEvalSuites(evidence);
        const runs = this.buildEvalRuns(evidence, suites, {}, { history: [] });
        return { suites, runs };
      },
      collectLoopBenchInputs: async () => {
        const [list, cost, recentLearnings] = await Promise.all([
          this.list({ page: 1, limit: 200 }),
          this.cost(),
          this.store.readRecentLearnings(1000, { recallScope: 'cross-workspace' }),
        ]);
        return { list: list.list, cost, recentLearnings };
      },
    };
  }

  private get evalTrendStorePort(): LoopsEvalTrendStorePort {
    return {
      readEvalTrendHistory: () => this.store.readEvalTrendHistory(),
      appendEvalTrendSnapshots: (snapshots) => this.store.appendEvalTrendSnapshots(snapshots),
      readLoopBenchTrendHistory: () => this.store.readLoopBenchTrendHistory(),
      appendLoopBenchTrendSnapshot: (snapshot) => this.store.appendLoopBenchTrendSnapshot(snapshot),
    };
  }

  private get evalLogSink(): LoopsEvalLogSink {
    return {
      log: (level, message, meta) => this.log(level, message, meta),
    };
  }

  async list(query: LoopIssuesQuery): Promise<LoopListResponse> {
    return this.issues.list(query, (result) => this.withDeliveryControlsList(result));
  }

  async getIssue(issueId: string) {
    try {
      return this.issues.getIssue(issueId, (detail: LoopIssueDetail) =>
        this.withRequirementsCoverage(detail),
      );
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

  private adminLogSink() {
    return {
      log: (level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>) =>
        this.log(level, message, meta),
    };
  }

  async createIssue(input: CreateLoopIssueRequest, authUser?: AuthUserInfo) {
    const now = new Date().toISOString();
    const issueId = this.issues.createIssueId(now);
    const intakeId = this.store.intakeId(issueId);
    const rawPayloadRef = `.loops/intakes/${intakeId}.raw.json`;
    const targetRepo = await this.issues.resolveTargetRepo(input.targetRepo);
    const submitter = this.issues.normalizeSubmitter(input, authUser);
    const sourceChannel = input.sourceChannel ?? 'web';
    const sourceKind = input.sourceKind ?? 'web_form';
    const issue: LoopIssue = {
      id: issueId,
      title: input.title,
      status: 'OPEN',
      priority: input.priority,
      created: now,
      updated: now,
      sourceChannel,
      sourceKind,
      submitterId: submitter.userId,
      submitterName: submitter.name,
      targetRepo,
      body: input.body,
      acceptanceCriteria: input.acceptanceCriteria,
      rawPayloadRef,
    };
    const ruleSnapshot = await this.issues.captureRuleSnapshot(targetRepo, now);
    const intake: LoopIntake = {
      id: intakeId,
      issueId,
      sourceChannel,
      sourceKind,
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
    const loopKind = this.evidence.inferWorkflowKind({ issue });
    const matchingDefault = workflowDefaults.find((entry) => entry.loopKind === loopKind);
    const workflowRecipe = {
      ...this.buildWorkflowRecipe({ issue, state }),
      ...(matchingDefault ? { id: matchingDefault.recipeId } : {}),
      capturedAt: now,
      source: matchingDefault ? ('workspace' as const) : ('loop-snapshot' as const),
    };

    await this.issues.writeIssueRecord({ issue, intake, state, rawPayload: input, workflowRecipe });
    return { issue, intake, state };
  }

  /**
   * Simple intake (0622 · B4): normalise a one-sentence request into a full
   * issue, then reuse `createIssue` so permissions, audit, submitter derivation
   * and persistence are identical to the full path. The SSO submitter stays
   * server-derived; the original `request` is preserved verbatim as `body`.
   */
  async createSimpleIssue(input: CreateLoopIssueSimpleRequest, authUser?: AuthUserInfo) {
    const targetRepo = await this.issues.resolveSimpleTargetRepo(input);
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

  // 结构优化 Step 2 + Loop 9：issue intake 全部原语（createIssueId /
  // normalizeSubmitter / resolveTargetRepo / writeIssueRecord / captureRuleSnapshot /
  // resolveSimpleTargetRepo）已下沉到 `LoopsIssuesService`（经 `this.issues.*` 委托）。

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

  async generateSpec(issueId: string) {
    const detail = await this.getIssue(issueId);
    if (detail.spec && detail.spec.status !== 'REVISION_REQUESTED') {
      throw new BadRequestException('Spec already exists and is not waiting for revision');
    }

    const now = new Date().toISOString();
    const version = this.engine.nextSpecVersion(detail.state.specVersion);
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
      let shard = this.engine.findRunnableShard(currentDetail.shards);
      if (!shard) {
        const recoveredDetail = await this.recoverInterruptedShards(issueId, currentDetail);
        if (recoveredDetail) {
          recovered += 1;
          currentDetail = recoveredDetail;
          shard = this.engine.findRunnableShard(currentDetail.shards);
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
    const specVersion = this.engine.nextSpecVersion(detail.state.specVersion);
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
    const specVersion = this.engine.nextSpecVersion(input.detail.state.specVersion);
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
        const finalizedDetail = await this.store.readDetail(issueId);
        const evidence = this.buildDeliveryEvidence(finalizedDetail);
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
    const secondOpinion = this.buildSecondOpinion(detail);
    const findingFingerprints = [
      ...(body.findingFingerprints ?? []),
      ...(body.findingFingerprint ? [body.findingFingerprint] : []),
    ].filter((fingerprint, index, values) => values.indexOf(fingerprint) === index);
    const resolvedFingerprints =
      findingFingerprints.length > 0
        ? findingFingerprints
        : secondOpinion.comparison.conflictFingerprints;
    const resolutionReason =
      body.reason ??
      (body.action === 'accept-primary'
        ? 'Accepted primary (Codex) findings; secondary findings overridden.'
        : body.action === 'accept-secondary'
          ? 'Accepted secondary (Claude Code) findings; primary findings overridden.'
          : body.action === 'request-changes'
            ? 'Second opinion conflict requires implementation changes before release.'
            : `Waived conflict at ${new Date().toISOString()}`);
    if (resolvedFingerprints.length > 0) {
      for (const fingerprint of resolvedFingerprints) {
        await this.store.governDelivery({
          issueId,
          request: {
            action: 'resolve-second-opinion-conflict',
            resolution: body.action,
            conflictFingerprint: fingerprint,
            actor: 'human',
            reason: resolutionReason,
          },
        });
      }
    } else {
      await this.store.governDelivery({
        issueId,
        request: {
          action: 'resolve-second-opinion-conflict',
          resolution: body.action,
          actor: 'human',
          reason: resolutionReason,
        },
      });
    }
    await this.store.governDelivery({
      issueId,
      request: {
        action: 'set-review-gate',
        gateKind: 'code',
        status:
          body.action === 'waive'
            ? 'waived'
            : body.action === 'request-changes'
              ? 'blocked'
              : 'passed',
        actor: 'human',
        reason: resolutionReason,
      },
    });
    this.log('info', `[Loops] Second opinion resolved for ${issueId}`, {
      issueId,
      action: body.action,
      fingerprints: resolvedFingerprints,
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
      environment?: string;
      environmentOwner?: string;
      rollbackNote?: string;
    },
  ): Promise<LoopIssueDetail> {
    if (input.riskLevel === 'high' && (!input.rollbackNote || !input.environmentOwner)) {
      throw new BadRequestException(
        'High-risk release canary requires both a rollback note and an environment owner.',
      );
    }

    const detail = await this.getIssue(issueId);
    const now = new Date().toISOString();
    const canarySteps: string[] = ['canary-start'];

    // Step 1: Run a Browser QA subset as the smoke check.
    if (input.targetUrl) {
      try {
        const reportId = `canary-${issueId}-${Date.now()}`;
        const paths = this.store.browserQaArtifactPaths(issueId, reportId);
        const report = await this.browserQaWorker.run({
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
        await this.store.writeBrowserQaReport(report);
        canarySteps.push('browser-qa');
        if (report.status !== 'passed') {
          canarySteps.push(`browser-qa-${report.status}`);
        }
      } catch (error) {
        canarySteps.push('browser-qa-failed');
        this.log('warn', `[Loops] Canary browser QA failed for ${issueId}`, {
          issueId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Step 2: gstack P0-2 — CI/CD deployment health check.
    const healthResult = await this.checkDeploymentHealth({
      issueId,
      targetUrl: input.targetUrl,
      environment: input.environment,
    });
    canarySteps.push(...healthResult.steps);

    // Step 3: Record the canary result via delivery governance.
    const canaryPassed = !canarySteps.some(
      (step) =>
        step === 'browser-qa-failed' ||
        step === 'browser-qa-blocked' ||
        step === 'health-check-failed',
    );
    const governanceRequest = {
      action: 'record-release-canary' as const,
      status: canaryPassed ? ('passed' as const) : ('failed' as const),
      environment: input.environment,
      environmentOwner: input.environmentOwner,
      targetUrl: input.targetUrl,
      rollbackNote: input.rollbackNote,
      actor: 'system',
      reason: `Canary worker executed ${canarySteps.length - 1} step(s) at ${now}. Risk: ${input.riskLevel}. Environment: ${input.environment ?? 'not provided'}. Owner: ${input.environmentOwner ?? 'not provided'}. Rollback: ${input.rollbackNote ?? 'not provided'}.`,
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
        environment: input.environment,
        environmentOwner: input.environmentOwner,
        rollbackNote: input.rollbackNote,
      },
    });

    return this.getIssue(issueId);
  }

  /**
   * gstack P0-2: Check deployment health for release canary.
   * Polls the target URL health endpoint and returns health check steps.
   * Supports standard /health, /api/health, and /_health endpoints.
   * Falls back gracefully when the health endpoint is unreachable.
   */
  private async checkDeploymentHealth(input: {
    issueId: string;
    targetUrl: string;
    environment?: string;
  }): Promise<{ steps: string[]; healthy: boolean }> {
    const steps: string[] = ['health-check-start'];
    if (!input.targetUrl) {
      steps.push('health-check-skipped');
      return { steps, healthy: true };
    }

    const healthEndpoints = ['/health', '/api/health', '/_health'];
    const timeoutMs = 10000;

    for (const endpoint of healthEndpoints) {
      try {
        const url = new URL(endpoint, input.targetUrl).href;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'DofeAI-Loops-ReleaseCanary/1.0' },
        });
        clearTimeout(timeout);

        if (response.ok) {
          steps.push(`health-check-passed:${endpoint}`);
          this.log('info', `[Loops] Canary health check passed for ${input.issueId}`, {
            issueId: input.issueId,
            endpoint: url,
            status: response.status,
            environment: input.environment,
          });
          return { steps, healthy: true };
        }
        steps.push(`health-check-non-ok:${endpoint}:${response.status}`);
      } catch {
        steps.push(`health-check-unreachable:${endpoint}`);
      }
    }

    steps.push('health-check-failed');
    this.log('warn', `[Loops] Canary health check failed for ${input.issueId}`, {
      issueId: input.issueId,
      targetUrl: input.targetUrl,
      environment: input.environment,
      endpointsTried: healthEndpoints,
    });
    return { steps, healthy: false };
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
   * Claude Code CLI; this surface is pure control-plane derivation.
   */
  async getDeliveryEvidence(issueId: string): Promise<LoopDeliveryEvidence> {
    const detail = await this.getIssue(issueId);
    return this.buildDeliveryEvidence(detail);
  }

  async assetPermissions(input: {
    userId: string;
    isAdmin?: boolean;
    teamId?: string;
    tenantId?: string;
  }): Promise<LoopAssetPermissionsResponse> {
    const snapshot =
      this.permissionService && !input.isAdmin
        ? await this.permissionService.getUserPermissionSnapshot(input.userId, input.teamId)
        : { permissions: [], roles: [] };
    const permissions = input.isAdmin
      ? [
          'vibecoding:loops:read',
          'vibecoding:loops:create',
          'vibecoding:loops:operate',
          'vibecoding:loops:admin',
        ]
      : snapshot.permissions;
    const assets = this.buildAssetPermissionItems(permissions, Boolean(input.isAdmin));

    return {
      identity: {
        userId: input.userId,
        teamId: input.teamId,
        tenantId: input.tenantId,
        isSuperAdmin: Boolean(input.isAdmin),
      },
      source: 'sso',
      permissions,
      roles: snapshot.roles,
      assets,
      summary: {
        total: assets.length,
        granted: assets.filter((asset) => asset.granted).length,
        blocked: assets.filter((asset) => !asset.granted).length,
      },
    };
  }

  async assertAssetPermission(
    input: LoopAssetPermissionContext & {
      assetKind: LoopAssetPermissionKind;
      action: LoopAssetPermissionAction;
    },
  ): Promise<void> {
    const snapshot = await this.assetPermissions(input);
    const permission = snapshot.assets.find(
      (asset) => asset.assetKind === input.assetKind && asset.requiredAction === input.action,
    );
    if (permission?.granted) {
      return;
    }
    throw new ForbiddenException(
      `SSO permission ${permission?.sourcePermission ?? `vibecoding:loops:${input.action}`} is required for ${input.assetKind}`,
    );
  }

  private buildAssetPermissionItems(
    permissions: string[],
    isSuperAdmin: boolean,
  ): LoopAssetPermissionItem[] {
    const hasAction = (action: LoopAssetPermissionAction) =>
      isSuperAdmin ||
      permissions.includes(`vibecoding:loops:${action}`) ||
      permissions.includes(`loops:${action}`);
    const canRead =
      hasAction('read') || hasAction('create') || hasAction('operate') || hasAction('admin');
    const canCreate = hasAction('create') || hasAction('operate') || hasAction('admin');
    const canOperate = hasAction('operate') || hasAction('admin');
    const canAdmin = hasAction('admin');
    const grantedByAction: Record<LoopAssetPermissionAction, boolean> = {
      read: canRead,
      create: canCreate,
      operate: canOperate,
      admin: canAdmin,
    };
    const defs: Array<Omit<LoopAssetPermissionItem, 'granted' | 'sourcePermission'>> = [
      {
        assetKind: 'workspace',
        assetId: 'loops-workspace',
        label: 'Workspace profiles',
        scope: 'workspace',
        requiredAction: 'operate',
      },
      {
        assetKind: 'blueprint',
        assetId: 'delivery-blueprints',
        label: 'Delivery blueprints',
        scope: 'tenant',
        requiredAction: 'create',
      },
      {
        assetKind: 'runtime-backend',
        assetId: 'codex-claude-runtime-backends',
        label: 'Codex / Claude Code runtime backends',
        scope: 'workspace',
        requiredAction: 'operate',
      },
      {
        assetKind: 'tool',
        assetId: 'tool-integration-registry',
        label: 'Tool & integration registry',
        scope: 'workspace',
        requiredAction: 'operate',
      },
      {
        assetKind: 'eval-suite',
        assetId: 'eval-suites',
        label: 'Eval suites and release gates',
        scope: 'tenant',
        requiredAction: 'operate',
      },
      {
        assetKind: 'trigger',
        assetId: 'trigger-contracts',
        label: 'Webhook and schedule triggers',
        scope: 'tenant',
        requiredAction: 'operate',
      },
      {
        assetKind: 'remote-runner',
        assetId: 'remote-runner-pool',
        label: 'Remote runner execution pool',
        scope: 'tenant',
        requiredAction: 'admin',
      },
      {
        assetKind: 'mcp-server',
        assetId: 'mcp-server-registry',
        label: 'MCP server registry',
        scope: 'tenant',
        requiredAction: 'admin',
      },
      {
        assetKind: 'ci-check',
        assetId: 'ci-checks',
        label: 'CI check integrations',
        scope: 'repo',
        requiredAction: 'operate',
      },
    ];

    return defs.map((def) => ({
      ...def,
      granted: grantedByAction[def.requiredAction],
      sourcePermission: `vibecoding:loops:${def.requiredAction}`,
    }));
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

  async runtimeBackendHealthCheck(
    id: string,
    permissionContext?: LoopAssetPermissionContext,
  ): Promise<RuntimeBackend> {
    if (permissionContext) {
      await this.assertAssetPermission({
        ...permissionContext,
        assetKind: 'runtime-backend',
        action: 'operate',
      });
    }
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
    permissionContext?: LoopAssetPermissionContext,
  ): Promise<RuntimeBackend> {
    if (permissionContext) {
      await this.assertAssetPermission({
        ...permissionContext,
        assetKind: 'runtime-backend',
        action: 'operate',
      });
    }
    await this.getRuntimeBackend(id);
    await (this.persistence?.patchRuntimeBackendPolicy(id, policy) ??
      this.store.patchRuntimeBackendPolicy(id, policy));
    return this.getRuntimeBackend(id);
  }

  async listRemoteRunners(
    query: { limit?: number; page?: number } = {},
  ): Promise<LoopRemoteRunnerListResponse> {
    return this.remoteRunnersService.listRemoteRunners(query);
  }

  async acquireRemoteRunnerLease(
    id: string,
    request: LoopRemoteRunnerLeaseRequest,
    permissionContext?: LoopAssetPermissionContext,
  ): Promise<LoopRemoteRunnerLease> {
    await this.assertOptionalAssetPermission(permissionContext, 'remote-runner', 'admin');
    return this.remoteRunnersService.acquireRemoteRunnerLease(id, request);
  }

  async releaseRemoteRunnerLease(
    id: string,
    request: LoopRemoteRunnerReleaseRequest,
    permissionContext?: LoopAssetPermissionContext,
  ): Promise<LoopRemoteRunnerLease> {
    await this.assertOptionalAssetPermission(permissionContext, 'remote-runner', 'admin');
    return this.remoteRunnersService.releaseRemoteRunnerLease(id, request);
  }

  async runRemoteRunnerJob(
    id: string,
    request: LoopRemoteRunnerJobRequest,
    permissionContext?: LoopAssetPermissionContext,
  ): Promise<LoopRemoteRunnerJob> {
    await this.assertOptionalAssetPermission(permissionContext, 'remote-runner', 'admin');
    return this.remoteRunnersService.runRemoteRunnerJob(id, request);
  }

  /**
   * R36: Upload Remote Runner job artifacts to external object storage.
   * Uses the cross-tenant archive infrastructure to push job artifacts
   * (manifest, worker receipt, logs, trace) to OSS/S3.
   */
  async uploadRemoteRunnerArtifacts(
    runnerId: string,
    jobId: string,
    input?: { vendor?: string; bucket?: string },
  ): Promise<{
    jobId: string;
    uploaded: number;
    artifacts: Array<{ kind: string; storageKey: string; uploadUrl?: string }>;
    message: string;
  }> {
    const artifacts: Array<{ kind: string; storageKey: string; uploadUrl?: string }> = [];
    let uploaded = 0;

    if (this.crossTenantArchive) {
      try {
        const vendor = input?.vendor ?? (process.env['FILE_STORAGE_VENDOR'] as string) ?? 'oss';
        const bucket = input?.bucket ?? 'dofe-public';
        const artifactKinds = ['manifest', 'worker-receipt', 'worker-log', 'trace'];

        for (const kind of artifactKinds) {
          const storageKey = `loops/runs/${runnerId}/jobs/${jobId}/${kind}.json`;
          try {
            // Read local artifact content
            const content = this.store.readRemoteRunnerArtifact(runnerId, jobId, kind);
            if (content) {
              // Upload via archive service's file storage
              const archive = this.crossTenantArchive as unknown as {
                fileStorage?: {
                  fileDataUploader(v: string, b: string, k: string, b64: string): Promise<void>;
                  getPrivateDownloadUrl(
                    v: string,
                    b: string,
                    k: string,
                    o: { expire: number },
                  ): Promise<string>;
                };
              };
              if (archive.fileStorage) {
                await archive.fileStorage.fileDataUploader(
                  vendor,
                  bucket,
                  storageKey,
                  Buffer.from(content).toString('base64'),
                );
                const uploadUrl = await archive.fileStorage.getPrivateDownloadUrl(
                  vendor,
                  bucket,
                  storageKey,
                  { expire: 30 * 24 * 3600 },
                );
                artifacts.push({ kind, storageKey, uploadUrl });
                uploaded++;
              }
            }
          } catch {
            // Skip individual artifacts that can't be uploaded
          }
        }

        this.log('info', `[RemoteRunner] Uploaded ${uploaded} artifacts to external storage`, {
          runnerId,
          jobId,
          uploaded,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.log('error', `[RemoteRunner] External artifact upload failed`, {
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

  async listMcpServers(
    query: { limit?: number; page?: number } = {},
  ): Promise<LoopMcpServerListResponse> {
    const list = this.buildMcpServerItems();
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

  async connectMcpServer(
    id: string,
    action: LoopMcpServerAction = {},
    permissionContext?: LoopAssetPermissionContext,
  ): Promise<LoopMcpServer> {
    await this.assertOptionalAssetPermission(permissionContext, 'mcp-server', 'admin');
    return this.withMcpServerLifecycleAudit(
      id,
      'connect',
      'connected',
      'MCP server config connected.',
      action.reason,
    );
  }

  async disconnectMcpServer(
    id: string,
    action: LoopMcpServerAction = {},
    permissionContext?: LoopAssetPermissionContext,
  ): Promise<LoopMcpServer> {
    await this.assertOptionalAssetPermission(permissionContext, 'mcp-server', 'admin');
    return this.withMcpServerLifecycleAudit(
      id,
      'disconnect',
      'disconnected',
      'MCP server config disconnected.',
      action.reason,
    );
  }

  async testMcpServer(
    id: string,
    action: LoopMcpServerAction = {},
    permissionContext?: LoopAssetPermissionContext,
  ): Promise<LoopMcpServer> {
    await this.assertOptionalAssetPermission(permissionContext, 'mcp-server', 'admin');
    const item = this.getMcpServerItem(id);
    const testedAt = new Date().toISOString();

    // R37: Attempt real MCP handshake when client is available
    let handshakeResult: {
      serverInfo: { name: string; version: string };
      tools: Array<{ name: string }>;
    } | null = null;
    let handshakeError: string | undefined;

    if (this.mcpClient && item.transport === 'stdio' && item.name) {
      try {
        const result = await this.mcpClient.handshake({
          transport: 'stdio',
          command: item.name,
          args: [],
          timeoutMs: 15000,
        });
        handshakeResult = {
          serverInfo: result.serverInfo,
          tools: result.tools.map((t) => ({ name: t.name })),
        };
        this.log('info', `[McpServer] Real MCP handshake succeeded for ${id}`, {
          serverInfo: result.serverInfo,
          toolCount: result.tools.length,
          durationMs: result.durationMs,
        });
      } catch (error) {
        handshakeError = error instanceof Error ? error.message : String(error);
        this.log(
          'warn',
          `[McpServer] Real MCP handshake failed for ${id} — falling back to control-plane test`,
          {
            error: handshakeError,
          },
        );
      }
    }

    const health = handshakeResult
      ? {
          ok: true,
          message: `MCP handshake OK: ${handshakeResult.serverInfo.name} v${handshakeResult.serverInfo.version}, ${handshakeResult.tools.length} tools`,
        }
      : {
          ok: !handshakeError,
          message: handshakeError
            ? `MCP handshake failed: ${handshakeError}`
            : 'Control-plane config test passed; provider handshake deferred.',
        };

    const executionAudit = await this.store.writeMcpExecutionAudit({
      auditRef: `mcp-audit-${id}-${randomUUID()}`,
      providerId: id,
      action: 'test',
      outcome: handshakeResult ? 'success' : handshakeError ? 'failed' : 'skipped',
      toolCount: handshakeResult?.tools.length ?? item.toolIds.length,
      toolIds: handshakeResult?.tools.map((t) => t.name) ?? item.toolIds,
      transport: item.transport,
      authStatus: item.authStatus,
      reason: action.reason,
      recordedAt: testedAt,
      health,
    });

    return {
      ...item,
      status: 'configured',
      lastTestedAt: testedAt,
      health,
      executionAudit: {
        auditRef: executionAudit.auditRef,
        artifactRef: executionAudit.artifactRef,
        providerId: id,
        action: 'test',
        outcome: 'success',
        toolCount: item.toolIds.length,
        recordedAt: testedAt,
      },
    };
  }

  async listCiChecks(
    query: { limit?: number; page?: number } = {},
  ): Promise<LoopCiCheckIntegrationListResponse> {
    const list = this.buildCiCheckItems();
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

  async listCiCheckPublications(id: string): Promise<LoopCiCheckPublicationHistory> {
    this.getCiCheckItem(id);
    const history = await this.store.readCiCheckPublications(id);
    return {
      integrationId: history.integrationId,
      latest: history.latest,
      entries: history.entries,
      updatedAt: history.updatedAt,
    };
  }

  async connectCiCheck(
    id: string,
    _action: LoopCiCheckAction = {},
    permissionContext?: LoopAssetPermissionContext,
  ): Promise<LoopCiCheckIntegration> {
    await this.assertOptionalAssetPermission(permissionContext, 'ci-check', 'operate');
    return this.withCiCheckStatus(id, 'connected', 'CI check integration connected.');
  }

  async disconnectCiCheck(
    id: string,
    _action: LoopCiCheckAction = {},
    permissionContext?: LoopAssetPermissionContext,
  ): Promise<LoopCiCheckIntegration> {
    await this.assertOptionalAssetPermission(permissionContext, 'ci-check', 'operate');
    return this.withCiCheckStatus(id, 'disconnected', 'CI check integration disconnected.');
  }

  async testCiCheck(
    id: string,
    action: LoopCiCheckAction = {},
    permissionContext?: LoopAssetPermissionContext,
  ): Promise<LoopCiCheckIntegration> {
    await this.assertOptionalAssetPermission(permissionContext, 'ci-check', 'operate');
    const item = this.getCiCheckItem(id);
    if (item.provider === 'github-checks' && action.headSha) {
      const publishedAt = new Date().toISOString();
      const publicationEvidence = await this.buildCiCheckPublicationEvidence(action);
      const result = await this.prProvider?.publishGithubCheckRun({
        headSha: action.headSha,
        name: action.name ?? item.name,
        title: action.title ?? 'DofeAI Delivery Evidence',
        summary:
          action.summary ?? 'Loops delivery evidence check published from CI Check Registry.',
        detailsUrl: publicationEvidence.detailsUrl,
        status: action.status,
        conclusion: action.conclusion,
      });
      const publication = await this.store.writeCiCheckPublication({
        integrationId: id,
        provider: result?.provider,
        headSha: action.headSha,
        checkRunId: result?.published ? result.id : undefined,
        url: result?.published ? result.url : undefined,
        outcome: result?.published ? 'published' : 'failed',
        reason: result?.published
          ? undefined
          : (result?.reason ?? 'GitHub Checks provider client is not configured.'),
        issueId: publicationEvidence.issueId,
        prId: publicationEvidence.prId,
        evidenceBacklink: publicationEvidence.evidenceBacklink,
        workPackageCommitMap: publicationEvidence.workPackageCommitMap,
        request: {
          name: action.name ?? item.name,
          title: action.title ?? 'DofeAI Delivery Evidence',
          summary:
            action.summary ?? 'Loops delivery evidence check published from CI Check Registry.',
          detailsUrl: publicationEvidence.detailsUrl,
          evidenceBacklink: publicationEvidence.evidenceBacklink,
          status: action.status,
          conclusion: action.conclusion,
        },
        publishedAt,
      });
      if (result?.published) {
        return {
          ...item,
          status: 'connected',
          lastPublishedAt: publishedAt,
          lastPublication: {
            artifactRef: publication.artifactRef,
            integrationId: publication.integrationId,
            provider: publication.provider,
            headSha: publication.headSha,
            checkRunId: publication.checkRunId,
            url: publication.url,
            outcome: publication.outcome,
            issueId: publication.issueId,
            prId: publication.prId,
            evidenceBacklink: publication.evidenceBacklink,
            workPackageCommitMap: publication.workPackageCommitMap ?? [],
            request: publication.request,
            publishedAt: publication.publishedAt,
          },
          health: {
            ok: true,
            message: `Published GitHub Check Run ${result.id}.`,
          },
        };
      }
      return {
        ...item,
        status: 'failed',
        lastPublishedAt: publishedAt,
        lastPublication: {
          artifactRef: publication.artifactRef,
          integrationId: publication.integrationId,
          provider: publication.provider,
          headSha: publication.headSha,
          outcome: publication.outcome,
          reason: publication.reason,
          issueId: publication.issueId,
          prId: publication.prId,
          evidenceBacklink: publication.evidenceBacklink,
          workPackageCommitMap: publication.workPackageCommitMap ?? [],
          request: publication.request,
          publishedAt: publication.publishedAt,
        },
        health: {
          ok: false,
          message: result?.reason ?? 'GitHub Checks provider client is not configured.',
        },
      };
    }

    return {
      ...item,
      status: 'configured',
      lastPublishedAt: new Date().toISOString(),
      health: {
        ok: item.provider !== 'github-checks',
        message:
          item.provider === 'github-checks'
            ? 'GitHub Checks API publish is ready; provide headSha to create a real check run.'
            : 'Generic CI integration config test passed.',
      },
    };
  }

  private async buildCiCheckPublicationEvidence(action: LoopCiCheckAction): Promise<{
    issueId?: string;
    prId?: string;
    detailsUrl?: string;
    evidenceBacklink?: string;
    workPackageCommitMap: Array<{
      workPackageId: string;
      title?: string;
      commitSha?: string;
      commitMessage?: string;
      branch?: string;
      files: string[];
    }>;
  }> {
    const evidenceBacklink = action.evidenceBacklink ?? action.detailsUrl;
    if (!action.issueId) {
      return {
        prId: action.prId,
        detailsUrl: action.detailsUrl ?? evidenceBacklink,
        evidenceBacklink,
        workPackageCommitMap: [],
      };
    }

    const detail = await this.store.readDetail(action.issueId);
    const evidence = this.buildDeliveryEvidence(detail);
    return {
      issueId: action.issueId,
      prId: action.prId ?? detail.convergencePr?.id,
      detailsUrl: action.detailsUrl ?? evidenceBacklink,
      evidenceBacklink,
      workPackageCommitMap: evidence.workPackages.map((workPackage) => ({
        workPackageId: workPackage.id,
        title: workPackage.title,
        commitSha: workPackage.commitSha,
        commitMessage: workPackage.commitMessage,
        branch: workPackage.branch,
        files: workPackage.files,
      })),
    };
  }

  async requestRecipeAdminAction(
    request: LoopRecipeAdminActionRequest,
    permissionContext: LoopAssetPermissionContext,
  ): Promise<LoopRecipeAdminActionResponse> {
    await this.assertAssetPermission({
      ...permissionContext,
      assetKind: 'blueprint',
      action: 'create',
    });
    const requestedAt = new Date().toISOString();
    const action = await this.store.writeRecipeAdminAction({
      id: `recipe-admin-${request.actionId}-${randomUUID()}`,
      actionId: request.actionId,
      status: 'requested',
      blueprintId: request.blueprintId,
      recipeKind: request.recipeKind,
      targetVersion: request.targetVersion,
      tenantId: permissionContext.tenantId,
      teamId: permissionContext.teamId,
      actorId: permissionContext.userId,
      sourcePermission: 'vibecoding:loops:create',
      requestedAt,
      reason: request.reason,
      evidenceRefs: request.evidenceRefs,
      message:
        'Recipe admin action request recorded for tenant-scoped approval or worker execution.',
    });
    return action;
  }

  private async assertOptionalAssetPermission(
    permissionContext: LoopAssetPermissionContext | undefined,
    assetKind: LoopAssetPermissionKind,
    action: LoopAssetPermissionAction,
  ): Promise<void> {
    if (!permissionContext) return;
    await this.assertAssetPermission({ ...permissionContext, assetKind, action });
  }

  private buildRemoteRunnerItems(): LoopRemoteRunner[] {
    return this.remoteRunnersService.buildRemoteRunnerItems();
  }

  private getRemoteRunnerItem(id: string): LoopRemoteRunner {
    return this.remoteRunnersService.getRemoteRunnerItem(id);
  }

  private buildMcpServerItems(): LoopMcpServer[] {
    return [
      {
        id: 'mcp-repo-tools',
        name: 'Repository Tools MCP',
        protocol: 'mcp',
        transport: 'stdio',
        status: 'configured',
        toolIds: ['repo-code-editor', 'trace-evidence-reader', 'test-runner'],
        permissionProfile: 'workspace-scoped read/write through approved Loops work packages',
        authStatus: 'not-required',
        health: {
          ok: true,
          message: 'Config is ready for local MCP client bootstrap.',
        },
        risks: ['Tool execution must stay inside target repo path policy.'],
      },
      {
        id: 'mcp-browser-qa',
        name: 'Browser QA MCP',
        protocol: 'mcp',
        transport: 'http',
        status: 'configured',
        toolIds: ['browser-qa-runner', 'visual-regression-reader'],
        permissionProfile: 'read target URLs and write browser QA artifacts only',
        authStatus: 'missing',
        health: {
          ok: false,
          message: 'Provider token is not configured; connect is gated by SSO admin permission.',
        },
        risks: ['External URL tests require SSRF-safe target allowlists before production.'],
      },
    ];
  }

  private getMcpServerItem(id: string): LoopMcpServer {
    const found = this.buildMcpServerItems().find((item) => item.id === id);
    if (!found) throw new NotFoundException(`MCP server ${id} not found`);
    return found;
  }

  private withMcpServerStatus(
    id: string,
    status: LoopMcpServer['status'],
    message: string,
  ): LoopMcpServer {
    return {
      ...this.getMcpServerItem(id),
      status,
      lastTestedAt: new Date().toISOString(),
      health: {
        ok: status !== 'failed',
        message,
      },
    };
  }

  private async withMcpServerLifecycleAudit(
    id: string,
    action: 'connect' | 'disconnect',
    status: LoopMcpServer['status'],
    message: string,
    reason?: string,
  ): Promise<LoopMcpServer> {
    const item = this.getMcpServerItem(id);
    const recordedAt = new Date().toISOString();
    const health = {
      ok: status !== 'failed',
      message,
    };
    const executionAudit = await this.store.writeMcpExecutionAudit({
      auditRef: `mcp-audit-${id}-${action}-${randomUUID()}`,
      providerId: id,
      action,
      outcome: health.ok ? 'success' : 'failed',
      toolCount: item.toolIds.length,
      toolIds: item.toolIds,
      transport: item.transport,
      authStatus: item.authStatus,
      reason,
      recordedAt,
      health,
    });

    return {
      ...item,
      status,
      lastTestedAt: recordedAt,
      health,
      executionAudit: {
        auditRef: executionAudit.auditRef,
        artifactRef: executionAudit.artifactRef,
        providerId: id,
        action,
        outcome: health.ok ? 'success' : 'failed',
        toolCount: item.toolIds.length,
        recordedAt,
      },
    };
  }

  private buildCiCheckItems(): LoopCiCheckIntegration[] {
    return [
      {
        id: 'github-delivery-evidence',
        provider: 'github-checks',
        name: 'GitHub Delivery Evidence Check',
        status: 'configured',
        requiredForRelease: true,
        checkSuites: ['delivery-readiness', 'runtime-safety', 'test-evidence'],
        targetRef: 'convergence-pr',
        health: {
          ok: true,
          message: 'Ready to publish derived delivery evidence when provider client is enabled.',
        },
        risks: ['GitHub Checks API token and repo installation are required for publish.'],
      },
      {
        id: 'generic-ci-regression',
        provider: 'generic-ci',
        name: 'Generic Regression CI',
        status: 'configured',
        requiredForRelease: false,
        checkSuites: ['test-evidence'],
        targetRef: 'loop-artifacts',
        health: {
          ok: true,
          message: 'Can mirror Loops test records into an external CI dashboard.',
        },
        risks: [],
      },
    ];
  }

  private getCiCheckItem(id: string): LoopCiCheckIntegration {
    const found = this.buildCiCheckItems().find((item) => item.id === id);
    if (!found) throw new NotFoundException(`CI check integration ${id} not found`);
    return found;
  }

  private withCiCheckStatus(
    id: string,
    status: LoopCiCheckIntegration['status'],
    message: string,
  ): LoopCiCheckIntegration {
    return {
      ...this.getCiCheckItem(id),
      status,
      lastPublishedAt: new Date().toISOString(),
      health: {
        ok: status !== 'failed',
        message,
      },
    };
  }

  private async buildRuntimeBackendItems(): Promise<RuntimeBackend[]> {
    const detection = await this.detectCurrentRuntimeSafe();
    if (!detection) return [];
    const persistedPolicies = await (this.persistence?.readRuntimeBackendPolicies() ??
      this.store.readRuntimeBackendPolicies());
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

      const id = `runtime-backend-${runtime.agent === 'codex' ? 'codex' : 'claude-code'}`;
      const persistedPolicy = persistedPolicies[id] ?? {};

      return {
        id,
        name,
        kind,
        mode,
        status,
        version: runtime.selected?.version ?? runtime.selected?.image,
        authStatus: 'unreported' as const,
        supportedStages,
        permissionProfile:
          persistedPolicy.permissionProfile ??
          (runtime.agent === 'codex'
            ? 'read/review/test design; write only Loops artifacts'
            : 'read/write/test within approved work package'),
        workspacePolicy:
          runtime.agent === 'codex'
            ? 'uses selected workspace profile and target repo scope'
            : 'requires approved workspace mount for Docker mode',
        costPolicy: persistedPolicy.costPolicy ?? 'shares per-loop call/token guard',
        fallbackPolicy:
          persistedPolicy.fallbackPolicy ??
          (runtime.agent === 'codex'
            ? 'Fallback to deterministic review gate'
            : 'Pause and ask for runtime recovery'),
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
    const list = this.buildEvalSuites(await this.collectEvalEvidence());
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
    const suites = this.buildEvalSuites(await this.collectEvalEvidence());
    const found = suites.find((suite) => suite.id === id);
    if (!found) throw new NotFoundException(`Eval suite ${id} not found`);
    return found;
  }

  private async collectEvalEvidence(): Promise<EvalEvidence> {
    const [list, cost] = await Promise.all([this.list({ page: 1, limit: 200 }), this.cost()]);
    const details = new Map<string, LoopIssueDetail>();
    await Promise.all(
      list.list.map(async (item) => {
        try {
          details.set(item.issue.id, await this.readDetail(item.issue.id));
        } catch (error) {
          this.log('warn', '[Loops] unable to read eval detail evidence', {
            issueId: item.issue.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }),
    );
    return {
      list: list.list,
      details,
      costByIssue: new Map(cost.loops.map((item) => [item.issueId, item])),
    };
  }

  private buildEvalSuites(evidence: EvalEvidence): EvalSuite[] {
    return this.evalService.buildEvalSuites(evidence);
  }

  private evalSuiteBlueprints(): EvalSuiteBlueprint[] {
    return this.evalService.evalSuiteBlueprints();
  }

  private materializeEvalSuite(
    suite: EvalSuiteBlueprint,
    evidence: EvalEvidence,
    capturedAt: string,
  ): EvalSuite {
    return this.evalService.materializeEvalSuite(suite, evidence, capturedAt);
  }

  private evaluateEvalCheck(
    checkId: string,
    item: LoopListItem,
    evidence: EvalEvidence,
  ): EvalSuite['checks'][number]['status'] {
    return this.evalService.evaluateEvalCheck(checkId, item, evidence);
  }

  private evalAggregateStatus(
    passCount: number,
    failCount: number,
    blockedCount: number,
  ): EvalSuite['checks'][number]['status'] {
    return this.evalService.evalAggregateStatus(passCount, failCount, blockedCount);
  }

  async listEvalRuns(
    query: { limit?: number; page?: number; suiteId?: string; loopId?: string } = {},
  ): Promise<EvalRunListResponse> {
    const evidence = await this.collectEvalEvidence();
    const suites = this.buildEvalSuites(evidence);
    const history = await this.store.readEvalTrendHistory();
    const runs = this.buildEvalRuns(evidence, suites, query, { history });

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

  async runLoopBenchTrendWorker(): Promise<LoopBenchTrendWorkerResponse> {
    return this.evalService.runLoopBenchTrendWorker({
      evidencePort: this.evalEvidencePort,
      storePort: this.evalTrendStorePort,
    });
  }

  private async readLoopBenchTrendSummary(): Promise<LoopBenchTrendSummary> {
    const history = await this.store.readLoopBenchTrendHistory();
    return {
      latest: history.at(-1),
      historyCount: history.length,
    };
  }

  private buildLoopBenchMetrics(
    items: LoopListItem[],
    options: {
      cost?: LoopCostResponse;
      recentLearnings?: LoopLearning[];
    } = {},
  ): Record<LoopBenchMetricKey, number> {
    return this.evalService.buildLoopBenchMetrics(items, options);
  }

  private diffLoopBenchMetrics(
    current: Record<LoopBenchMetricKey, number>,
    previous: Record<LoopBenchMetricKey, number>,
  ): Record<LoopBenchMetricKey, number> {
    return this.evalService.diffLoopBenchMetrics(current, previous);
  }

  private percent(numerator: number, denominator: number): number {
    return this.evalService.percent(numerator, denominator);
  }

  private buildEvalRuns(
    evidence: EvalEvidence,
    suites: EvalSuite[],
    query: { suiteId?: string; loopId?: string } = {},
    context: EvalRunBuildContext = {},
  ): EvalRun[] {
    return this.evalService.buildEvalRuns(evidence, suites, query, {
      ...context,
      inferWorkflowKind: (item) => this.evidence.inferWorkflowKind(item),
    });
  }

  async runEvalTrendWorker(): Promise<EvalTrendWorkerResponse> {
    return this.evalService.runEvalTrendWorker({
      evidencePort: this.evalEvidencePort,
      storePort: this.evalTrendStorePort,
      logSink: this.evalLogSink,
    });
  }

  async getEvalRun(id: string): Promise<EvalRun> {
    const runs = (await this.listEvalRuns({ limit: 500 })).list;
    const found = runs.find((r) => r.id === id);
    if (!found) throw new NotFoundException(`Eval run ${id} not found`);
    return found;
  }

  // =========================================================================
  // Cross-Tenant Eval Aggregation (R33: DB + Redis + BullMQ)
  // =========================================================================

  /**
   * Get cross-tenant eval quality aggregation with three-tier architecture:
   * 1. Redis cache (fast, TTL 5 min)
   * 2. DB query (durable, fallback)
   * 3. Request-time aggregation (slowest, last resort)
   */
  async getCrossTenantEvalAggregation(input: {
    tenantId?: string;
    suiteId?: string;
    period?: '7d' | '30d' | '90d' | 'all';
    blueprintId?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    aggregations: Array<{
      id: string;
      tenantId: string;
      workspaceId: string;
      suiteId: string;
      blueprintId?: string;
      totalChecks: number;
      passedChecks: number;
      failedChecks: number;
      blockedChecks: number;
      passRate: number;
      averageScore: number;
      loopCount: number;
      trendDelta?: number;
      period: string;
      capturedAt: string;
    }>;
    total: number;
    page: number;
    limit: number;
    source: 'redis-cache' | 'db-query' | 'request-time';
  }> {
    const {
      tenantId = 'default',
      suiteId,
      period = '30d',
      blueprintId,
      page = 1,
      limit = 20,
    } = input;

    // Tier 1: Redis cache
    if (tenantId && suiteId && !blueprintId && this.evalAggregationWorker) {
      const cached = await this.evalAggregationWorker.getCachedAggregation(
        tenantId,
        suiteId,
        period,
      );
      if (cached && Array.isArray(cached.aggregations)) {
        const aggs = cached.aggregations as Array<Record<string, unknown>>;
        const paged = aggs.slice((page - 1) * limit, page * limit);
        return {
          aggregations: paged.map((a) => ({
            id: a.id as string,
            tenantId: a.tenantId as string,
            workspaceId: a.workspaceId as string,
            suiteId: a.suiteId as string,
            blueprintId: a.blueprintId as string | undefined,
            totalChecks: a.totalChecks as number,
            passedChecks: a.passedChecks as number,
            failedChecks: a.failedChecks as number,
            blockedChecks: a.blockedChecks as number,
            passRate: a.passRate as number,
            averageScore: a.averageScore as number,
            loopCount: a.loopCount as number,
            trendDelta: a.trendDelta as number | undefined,
            period: a.period as string,
            capturedAt: a.capturedAt as string,
          })),
          total: aggs.length,
          page,
          limit,
          source: 'redis-cache',
        };
      }
    }

    // Tier 2: DB query (via LoopEvalAggregationService)
    if (this.evalAggregationDb) {
      try {
        const where: Record<string, unknown> = {};
        if (tenantId) where.tenantId = tenantId;
        if (suiteId) where.suiteId = suiteId;
        if (blueprintId) where.blueprintId = blueprintId;
        where.period = period;

        const dbResult = await this.evalAggregationDb.list(
          where as Prisma.LoopEvalAggregationWhereInput,
          {
            limit,
            page,
            orderBy: { capturedAt: 'desc' },
          },
        );

        const aggs = dbResult.list.map((a: LoopEvalAggregation) => ({
          id: a.id,
          tenantId: a.tenantId,
          workspaceId: a.workspaceId,
          suiteId: a.suiteId,
          blueprintId: a.blueprintId ?? undefined,
          totalChecks: a.totalChecks,
          passedChecks: a.passedChecks,
          failedChecks: a.failedChecks,
          blockedChecks: a.blockedChecks,
          passRate: a.passRate,
          averageScore: a.averageScore,
          loopCount: a.loopCount,
          trendDelta: a.trendDelta ?? undefined,
          period: a.period,
          capturedAt: a.capturedAt.toISOString(),
        }));

        // Warm Redis cache
        if (this.evalAggregationWorker && aggs.length > 0) {
          await this.evalAggregationWorker
            .setCachedAggregation(tenantId, suiteId ?? 'all', period, { aggregations: aggs })
            .catch(() => {});
        }

        return {
          aggregations: aggs,
          total: dbResult.total,
          page: dbResult.page,
          limit: dbResult.limit,
          source: 'db-query',
        };
      } catch (error) {
        this.log('warn', '[EvalAgg] DB query failed, falling back to request-time', { error });
      }
    }

    // Tier 3: Request-time fallback
    return this.buildRequestTimeAggregation(tenantId, suiteId, period, blueprintId, page, limit);
  }

  /**
   * Run the cross-tenant Eval aggregation worker: collect evidence, compute
   * aggregations, persist to DB, and warm Redis cache.
   */
  async runEvalAggregationWorker(input?: {
    tenantId?: string;
    period?: '7d' | '30d' | '90d' | 'all';
  }): Promise<{
    processed: number;
    persisted: number;
    cachedInRedis: boolean;
    period: string;
    generatedAt: string;
  }> {
    return this.evalService.runEvalAggregationWorker({
      tenantId: input?.tenantId,
      period: input?.period,
      evidencePort: this.evalEvidencePort,
      computeAggregation: (flat, period) =>
        this.evalAggregationWorker
          ? this.evalAggregationWorker.computeAggregation(flat, period)
          : [],
      persistAggregation: this.evalAggregationDb
        ? async (agg, period) => {
            await this.evalAggregationDb!.upsert({
              where: { id: agg.tenantId + '-' + agg.suiteId + '-' + period },
              create: {
                id: agg.tenantId + '-' + agg.suiteId + '-' + period,
                tenantId: agg.tenantId,
                workspaceId: agg.workspaceId,
                suiteId: agg.suiteId,
                blueprintId: agg.blueprintId ?? null,
                totalChecks: agg.totalChecks,
                passedChecks: agg.passedChecks,
                failedChecks: agg.failedChecks,
                blockedChecks: agg.blockedChecks,
                passRate: agg.passRate,
                averageScore: agg.averageScore,
                loopCount: agg.loopCount,
                trendDelta: agg.trendDelta ?? null,
                period: agg.period,
                capturedAt: new Date(agg.capturedAt),
              },
              update: {
                totalChecks: agg.totalChecks,
                passedChecks: agg.passedChecks,
                failedChecks: agg.failedChecks,
                blockedChecks: agg.blockedChecks,
                passRate: agg.passRate,
                averageScore: agg.averageScore,
                loopCount: agg.loopCount,
                trendDelta: agg.trendDelta ?? null,
                capturedAt: new Date(agg.capturedAt),
              },
            } as Prisma.LoopEvalAggregationUpsertArgs);
            return true;
          }
        : undefined,
      warmCache: this.evalAggregationWorker
        ? async (agg, period) => {
            await this.evalAggregationWorker!.setCachedAggregation(
              agg.tenantId,
              agg.suiteId,
              period,
              { aggregations: [agg as unknown as LoopsAggregation] },
            );
          }
        : undefined,
      logSink: this.evalLogSink,
    });
  }

  /**
   * R33+: Get Redis cache health for Eval aggregation layer.
   */
  async getEvalAggregationCacheHealth(): Promise<{
    available: boolean;
    cachedKeys: number;
    message: string;
  }> {
    if (this.evalAggregationWorker) {
      return this.evalAggregationWorker.cacheHealth();
    }
    return { available: false, cachedKeys: 0, message: 'Eval aggregation worker not configured' };
  }

  /**
   * R37: Check Docker sandbox availability.
   */
  async getDockerSandboxHealth(): Promise<{
    available: boolean;
    version?: string;
    message: string;
  }> {
    if (this.dockerSandbox) {
      return this.dockerSandbox.isDockerAvailable();
    }
    return { available: false, message: 'Docker sandbox service not configured' };
  }

  /**
   * R37: Perform a real MCP protocol handshake with a registered (or ad-hoc) MCP server.
   */
  async testMcpHandshake(
    serverId: string,
    input?: { command?: string; args?: string[]; reason?: string },
  ): Promise<{
    serverId: string;
    handshakeOk: boolean;
    serverInfo?: { name: string; version: string };
    protocolVersion?: string;
    toolCount?: number;
    tools?: Array<{ name: string }>;
    durationMs?: number;
    error?: string;
  }> {
    const item = this.getMcpServerItem(serverId);
    const command = input?.command ?? item.name;

    // R38: Resolve secrets for MCP authentication
    const env = this.mcpSecret?.buildEnv(
      item.secretRef ? { MCP_SECRET: item.secretRef } : undefined,
    );

    if (!this.mcpClient) {
      return { serverId, handshakeOk: false, error: 'MCP client service not configured' };
    }

    try {
      const result = await this.mcpClient.handshake({
        transport: item.transport as 'stdio' | 'sse',
        command,
        args: input?.args ?? [],
        env,
        timeoutMs: 15000,
      });

      this.log('info', `[McpHandshake] Real handshake succeeded for ${serverId}`, {
        serverInfo: result.serverInfo,
        toolCount: result.tools.length,
        durationMs: result.durationMs,
      });

      return {
        serverId,
        handshakeOk: true,
        serverInfo: result.serverInfo,
        protocolVersion: result.protocolVersion,
        toolCount: result.tools.length,
        tools: result.tools.map((t) => ({ name: t.name })),
        durationMs: result.durationMs,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log('warn', `[McpHandshake] Handshake failed for ${serverId}`, { error: message });
      return { serverId, handshakeOk: false, error: message };
    }
  }

  async getTriggerSchedulerStatus(): Promise<{
    running: boolean;
    intervalSeconds?: number;
    lastTickAt?: string;
    activeTriggers: number;
    totalFired: number;
    totalErrors: number;
  }> {
    const triggers = this.store.listScheduleTriggers();
    const activeTriggers = triggers.filter((t) => t.status === 'active').length;
    // Derive realistic metrics from trigger state:
    // - totalFired: triggers that have been executed at least once
    // - totalErrors: triggers that have non-zero failureCount
    // - lastTickAt: most recent lastRunAt across all triggers
    const totalFired = triggers.filter((t) => t.lastRunAt != null).length;
    const totalErrors = triggers.filter((t) => (t.failureCount ?? 0) > 0).length;
    const lastTickAt = triggers
      .filter((t) => t.lastRunAt != null)
      .map((t) => t.lastRunAt!)
      .sort()
      .reverse()[0];
    // Whether the scheduler is "running" is determined by whether there are
    // active triggers that a worker could pick up. The actual BullMQ worker
    // liveness is checked via the queue health endpoint.
    const running = activeTriggers > 0;
    return { running, activeTriggers, totalFired, totalErrors, lastTickAt };
  }

  // =========================================================================
  // Remote Runner Shard Execution (R34a: CLI adapter dispatch)
  // =========================================================================

  /**
   * Execute a single Remote Runner shard job via the appropriate CLI adapter
   * or runner service. This is the async execution path called by
   * LoopsRemoteRunnerProcessor, decoupled from the HTTP request lifecycle.
   *
   * Worker kinds:
   *   - implement: Run Claude/Codex adapter to implement a shard, persist record
   *   - test:      Run test commands via LoopsRunnerService, persist test record
   *   - review:    Run AI review via agent adapter, persist review verdict
   */
  async executeRemoteShardJob(job: {
    issueId: string;
    shardId: string;
    workerKind: 'implement' | 'test' | 'review';
    runtimeBackend: 'codex-cli' | 'claude-code-cli' | 'docker';
    artifactRoot: string;
    command?: string;
    sandboxProfile?: string;
  }): Promise<{
    status: 'completed' | 'failed';
    artifacts: Array<{
      kind: string;
      ref: string;
      sha256?: string;
      sizeBytes?: number;
    }>;
    error?: string;
    summary?: string;
    durationMs: number;
  }> {
    const start = Date.now();
    const { issueId, shardId, workerKind, runtimeBackend, artifactRoot, command, sandboxProfile } =
      job;
    const artifacts: Array<{
      kind: string;
      ref: string;
      sha256?: string;
      sizeBytes?: number;
    }> = [];

    try {
      const detail = await this.getIssue(issueId);
      const shard = detail.shards.find((s) => s.id === shardId);
      if (!shard) {
        return {
          status: 'failed',
          artifacts,
          error: `Shard ${shardId} not found in issue ${issueId}`,
          durationMs: Date.now() - start,
        };
      }

      switch (workerKind) {
        case 'implement': {
          // -------------------------------------------------------------------
          // PHASE 4: Run CLI adapter to implement the shard
          // -------------------------------------------------------------------
          this.log(
            'info',
            `[RemoteRunner] Starting implementation: ${shardId} on ${runtimeBackend}`,
            {
              issueId,
              shardId,
              runtimeBackend,
            },
          );

          // Mark shard IN_PROGRESS
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

          // Execute via the appropriate runtime backend
          let record: LoopImplementationRecord;
          if (runtimeBackend === 'docker' && this.dockerSandbox) {
            // Docker sandbox execution: wrap command in sandbox profile
            const dockerResult = await this.dockerSandbox.executeOrThrow({
              image: sandboxProfile ?? 'dofe-ai/sandbox:latest',
              command: command ?? `codex implement --shard ${shardId} --issue ${issueId}`,
              workdir: detail.issue.targetRepo,
              mountPath: detail.issue.targetRepo,
              networkMode: 'none',
              readonlyRootfs: false,
              capDrop: ['ALL'],
              capAdd: [],
              timeoutSec: 600,
              memoryLimitMb: 2048,
            });
            // Build implementation record from Docker output
            record = {
              id: `impl-record-${shardId}-r${detail.state.round}-${Date.now()}`,
              issueId,
              shardId,
              round: detail.state.round,
              implementer: `remote-runner:docker`,
              status: dockerResult.exitCode === 0 ? 'IMPLEMENTED' : 'NEEDS-WORK',
              summary: `Docker sandbox execution: exit ${dockerResult.exitCode}`,
              changedFiles: [],
              notes: dockerResult.stdout.slice(0, 2000),
              tokens: 0,
              created: new Date().toISOString(),
            };
            const logArtifact = this.writeArtifact(artifactRoot, 'worker.log', dockerResult.stdout);
            artifacts.push(logArtifact);
          } else {
            // Direct CLI adapter execution (Codex or Claude Code)
            const result = await this.claudeAdapter.run({
              issue: detail.issue,
              shard,
              round: detail.state.round,
              cwd: detail.issue.targetRepo,
            });
            record = {
              ...result.record,
              implementer: `remote-runner:${runtimeBackend}`,
            };
          }

          // Persist implementation record
          await this.persistImplementationRecord(issueId, shardId, record);

          // Write handoff artifact
          const handoff = this.writeArtifact(
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
          );
          artifacts.push(handoff);

          this.log('info', `[RemoteRunner] Implementation completed: ${shardId}`, {
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

        case 'test': {
          // -------------------------------------------------------------------
          // Run test commands via LoopsRunnerService
          // -------------------------------------------------------------------
          this.log('info', `[RemoteRunner] Starting tests: ${shardId}`, {
            issueId,
            shardId,
            runtimeBackend,
          });

          const testRecord = await this.runner.runShardTests({
            issueId,
            shardId,
            round: detail.state.round,
            cwd: detail.issue.targetRepo,
            request: {
              commands: command ? [command] : undefined,
              runner: `remote-runner:${runtimeBackend}`,
            },
            sandboxProfile:
              runtimeBackend === 'docker'
                ? {
                    network: sandboxProfile === 'strict' ? 'deny' : 'allowlist',
                    writeScope: 'repo',
                    shellEnforcement: 'allowlist',
                    secretMode: 'redacted',
                  }
                : undefined,
          });

          // Persist test record and update annotations/shards/state
          const testStatus: LoopAnnotation['testStatus'] =
            testRecord.status === 'TEST-PASS' ? 'pass' : 'fail';
          const testVerdict: LoopAnnotation['verdict'] =
            testRecord.status === 'TEST-PASS' ? 'unreviewed' : 'needs-work';
          const nextAnnotations = detail.annotations.map((a) =>
            a.target === shardId
              ? {
                  ...a,
                  testStatus,
                  verdict: testVerdict,
                  notes:
                    testRecord.failedTests.length > 0
                      ? `Test failures: ${testRecord.failedTests.map((f) => f.name).join(', ')}`
                      : 'Tests passed — awaiting review.',
                }
              : a,
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

          // Write test evidence artifact
          const testArtifact = this.writeArtifact(
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
          );
          artifacts.push(testArtifact);

          this.log('info', `[RemoteRunner] Tests ${testRecord.status}: ${shardId}`, {
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

        case 'review': {
          // -------------------------------------------------------------------
          // Run AI review via agent adapter
          // -------------------------------------------------------------------
          this.log('info', `[RemoteRunner] Starting review: ${shardId}`, {
            issueId,
            shardId,
            runtimeBackend,
          });

          const implRecord = detail.implementationRecords.find(
            (r) => r.shardId === shardId && r.round === detail.state.round,
          );
          if (!implRecord) {
            return {
              status: 'failed',
              artifacts,
              error: `No implementation record found for shard ${shardId} at round ${detail.state.round}`,
              durationMs: Date.now() - start,
            };
          }

          const testRecord = detail.testRecords.find(
            (r) => r.shardId === shardId && r.round === detail.state.round,
          );

          // Run agent review
          const review = await this.agentAdapter.review({
            shard,
            implementationRecord: implRecord,
            testRecord,
          });

          // Write review verdict artifact BEFORE applying state (preserve for evidence)
          const reviewArtifact = this.writeArtifact(
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
          );
          artifacts.push(reviewArtifact);

          // Apply review verdict via reviewShard (handles NEEDS-WORK redo limit, etc.)
          await this.reviewShard(issueId, shardId, {
            reviewer: `remote-runner:${runtimeBackend}`,
            verdict: review.verdict,
            summary: review.summary,
            issues: review.issues,
            fixInstructions: review.fixInstructions,
          });

          this.log('info', `[RemoteRunner] Review ${review.verdict}: ${shardId}`, {
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

        default:
          return {
            status: 'failed',
            artifacts,
            error: `Unknown workerKind: ${workerKind}`,
            durationMs: Date.now() - start,
          };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log('error', `[RemoteRunner] Job failed: ${workerKind} on ${shardId}`, {
        issueId: job.issueId,
        shardId: job.shardId,
        workerKind,
        error: message,
      });

      // Write error log artifact
      try {
        const errArtifact = this.writeArtifact(
          artifactRoot,
          'worker.log',
          `ERROR [${new Date().toISOString()}] ${workerKind} on ${job.shardId}: ${message}\n${error instanceof Error ? error.stack : ''}`,
        );
        artifacts.push(errArtifact);
      } catch {
        // Best effort
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

  /**
   * Write a job artifact to the file store and return its metadata.
   */
  private writeArtifact(
    artifactRoot: string,
    filename: string,
    content: string,
  ): {
    kind: string;
    ref: string;
    sha256?: string;
    sizeBytes?: number;
  } {
    const ref = `${artifactRoot}/${filename}`;
    const sha256 = createHash('sha256').update(content).digest('hex');
    const sizeBytes = Buffer.byteLength(content, 'utf8');
    try {
      this.store.writeRemoteRunnerArtifact(ref, content);
    } catch (err) {
      this.log('warn', `[RemoteRunner] Failed to write artifact: ${ref}`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return { kind: filename.replace(/\.\w+$/, ''), ref, sha256, sizeBytes };
  }

  // =========================================================================
  // Cross-Tenant Archive (R35: object storage delegation)
  // =========================================================================

  async archiveTenant(input: {
    tenantId: string;
    includeClosed?: boolean;
    period?: '7d' | '30d' | '90d' | 'all';
  }): Promise<{
    archiveId: string;
    tenantId: string;
    fileCount: number;
    totalSizeBytes: number;
    storageKey: string;
    downloadUrl?: string;
    archivedAt: string;
  }> {
    return this.adminService.archiveTenant(input, this.crossTenantArchive);
  }

  async listArchives(tenantId: string): Promise<{
    archives: Array<{
      archiveId: string;
      tenantId: string;
      storageKey: string;
      downloadUrl?: string;
      fileCount: number;
      totalSizeBytes: number;
      archivedAt: string;
    }>;
  }> {
    return this.adminService.listArchives(tenantId, this.crossTenantArchive);
  }

  async refreshArchiveUrl(
    tenantId: string,
    archiveId: string,
  ): Promise<{
    archiveId: string;
    downloadUrl?: string;
    message: string;
  }> {
    return this.adminService.refreshArchiveUrl(tenantId, archiveId, this.crossTenantArchive);
  }

  private async buildRequestTimeAggregation(
    tenantId: string,
    suiteId: string | undefined,
    period: '7d' | '30d' | '90d' | 'all',
    blueprintId: string | undefined,
    page: number,
    limit: number,
  ): Promise<ReturnType<LoopsService['getCrossTenantEvalAggregation']>> {
    const evidence = await this.collectEvalEvidence();
    const suites = this.buildEvalSuites(evidence);
    return this.evalService.buildRequestTimeAggregation({
      tenantId,
      blueprintId,
      suiteId,
      period,
      page,
      limit,
      suites,
    });
  }

  private evalBlueprintId(item: LoopListItem, evidence: EvalEvidence): string {
    return this.evalService.evalBlueprintId(item, evidence, (item) =>
      this.evidence.inferWorkflowKind(item),
    );
  }

  private latestEvalBaseline(
    history: EvalHistoricalBaselineSnapshot[],
    suiteId: string,
    blueprintId: string,
  ): EvalHistoricalBaselineSnapshot | undefined {
    return this.evalService.latestEvalBaseline(history, suiteId, blueprintId);
  }

  private evalBaselineVersion(blueprintId: string, suiteId: string, capturedAt: string): string {
    return this.evalService.evalBaselineVersion(blueprintId, suiteId, capturedAt);
  }

  private roundAverage(values: number[]): number {
    return this.evalService.roundAverage(values);
  }

  private safeId(value: string): string {
    return this.evalService.safeId(value);
  }

  /**
   * P0-2, R7: Receive an external webhook (GitHub/Linear/Jira/Slack/generic)
   * and create a Loop issue from it. Supports optional signature verification
   * (HMAC-SHA256). The webhook payload is normalised into an issue title/body
   * and fed through createIssue so SSO/audit/policy paths are identical.
   */
  async webhookTrigger(input: LoopWebhookTrigger): Promise<LoopWebhookTriggerResponse> {
    const now = new Date().toISOString();
    this.assertWebhookPayloadSize(input);
    this.verifyWebhookSignature(input);
    this.assertWebhookRateLimit(input);

    // R32a: GitHub label→Loop blueprint auto-mapping.
    // When a GitHub issue webhook carries labels, map known label patterns
    // to delivery blueprints and auto-enrich the issue body.
    const labelMapping = this.mapGitHubLabelsToBlueprint(input);
    if (labelMapping) {
      this.log('info', `[Loops] GitHub label→blueprint mapping applied`, {
        source: input.source,
        event: input.event,
        labels: labelMapping.labels,
        blueprint: labelMapping.blueprintId,
      });
    }

    try {
      const baseRequest = this.buildWebhookIssueRequest(input, now);
      const request = labelMapping
        ? {
            ...baseRequest,
            body: `${baseRequest.body}\n\n---\n🤖 Auto-mapped from GitHub labels: ${labelMapping.labels.join(', ')}\nBlueprint: ${labelMapping.blueprintId}\nPriority: ${labelMapping.priority}`,
            priority: labelMapping.priority,
          }
        : baseRequest;
      const result = await this.createIssue(request);

      this.log('info', `[Loops] Webhook trigger created issue`, {
        source: input.source,
        event: input.event,
        issueId: result.issue.id,
        blueprint: labelMapping?.blueprintId,
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

  private assertWebhookPayloadSize(input: LoopWebhookTrigger): void {
    const maxBytes = this.webhookMaxPayloadBytes();
    const bytes = Buffer.byteLength(JSON.stringify(input.payload), 'utf8');
    if (bytes > maxBytes) {
      throw new BadRequestException(`Webhook payload exceeds ${maxBytes} byte limit`);
    }
  }

  private webhookMaxPayloadBytes(): number {
    const configured = Number(process.env.LOOPS_WEBHOOK_MAX_PAYLOAD_BYTES);
    return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : 64 * 1024;
  }

  private assertWebhookRateLimit(input: LoopWebhookTrigger): void {
    const limit = this.webhookRateLimitPerMinute();
    if (limit <= 0) return;

    const now = Date.now();
    const key = `${input.source}:${input.event}`;
    const current = this.webhookRateWindows.get(key);
    const window =
      !current || current.resetAt <= now ? { count: 0, resetAt: now + 60_000 } : current;
    window.count += 1;
    this.webhookRateWindows.set(key, window);

    if (window.count > limit) {
      throw new BadRequestException(`Webhook rate limit exceeded for ${key}`);
    }
  }

  private webhookRateLimitPerMinute(): number {
    const configured = Number(process.env.LOOPS_WEBHOOK_RATE_LIMIT_PER_MINUTE);
    return Number.isFinite(configured) && configured >= 0 ? Math.floor(configured) : 60;
  }

  private verifyWebhookSignature(input: LoopWebhookTrigger): void {
    const providedSignature = this.extractWebhookSignature(
      input.signature ?? input.signatureHeader,
    );
    const secret =
      (input.secretRef ? process.env[input.secretRef] : undefined) ??
      process.env.LOOPS_WEBHOOK_SECRET;
    if (!providedSignature) {
      if (secret) {
        throw new BadRequestException(
          'Webhook signing secret is configured but no signature was provided',
        );
      }
      return;
    }

    if (!secret) {
      throw new BadRequestException(
        'Webhook signature provided but no signing secret is configured',
      );
    }

    const expectedSignature = createHmac('sha256', secret)
      .update(JSON.stringify(input.payload))
      .digest('hex');

    const provided = Buffer.from(providedSignature, 'hex');
    const expected = Buffer.from(expectedSignature, 'hex');
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      throw new BadRequestException('Webhook signature verification failed');
    }
  }

  private extractWebhookSignature(value?: string): string | undefined {
    if (!value) return undefined;
    const trimmed = value.trim();
    const prefixed = trimmed.match(/(?:^|[,;\s])sha256=([a-f0-9]{64})(?:$|[,;\s])/i);
    return (prefixed?.[1] ?? trimmed).toLowerCase();
  }

  private buildWebhookIssueRequest(
    input: LoopWebhookTrigger,
    receivedAt: string,
  ): CreateLoopIssueRequest {
    const payload = input.payload;

    // R36: Source-specific payload enrichment
    const enriched = this.enrichWebhookFromSource(input.source, input.event, payload);

    const redactedPayload = this.redactWebhookPayload(payload);
    const mappedTitle =
      enriched.title ??
      this.readWebhookString(payload, 'title') ??
      this.readWebhookPath(payload, ['issue', 'title']) ??
      this.readWebhookPath(payload, ['pull_request', 'title']) ??
      this.readWebhookPath(payload, ['data', 'title']) ??
      this.readWebhookPath(payload, ['resource', 'title']);
    const mappedBody =
      enriched.body ??
      this.readWebhookString(payload, 'body') ??
      this.readWebhookString(payload, 'description') ??
      this.readWebhookString(payload, 'text') ??
      this.readWebhookPath(payload, ['issue', 'body']) ??
      this.readWebhookPath(payload, ['pull_request', 'body']) ??
      this.readWebhookPath(payload, ['data', 'description']);
    const acceptanceCriteria = enriched.acceptanceCriteria ??
      this.readWebhookStringArray(payload, 'acceptanceCriteria') ??
      this.readWebhookStringArray(payload, 'acceptance_criteria') ?? [
        'Webhook event successfully mapped to issue',
      ];
    const targetRepo =
      enriched.targetRepo ??
      this.readWebhookString(payload, 'targetRepo') ??
      this.readWebhookString(payload, 'target_repo') ??
      process.env.LOOPS_WORKSPACE_ROOT ??
      '.';
    const priority = enriched.priority ?? this.mapWebhookPriority(payload);
    const title = this.truncateWebhookTitle(
      `[${input.source}:${input.event}] ${mappedTitle ?? `Webhook trigger at ${receivedAt}`}`,
    );
    const enrichmentNote = enriched.note
      ? `\n\n**${input.source} Context**:\n${enriched.note}`
      : '';
    const summary = mappedBody ? `\n\n**Mapped Summary**:\n${mappedBody.trim()}` : '';
    const body = `**Source**: ${input.source}\n**Event**: ${input.event}\n**Received At**: ${receivedAt}${enrichmentNote}${summary}\n\n**Payload**:\n\`\`\`json\n${JSON.stringify(redactedPayload, null, 2)}\n\`\`\``;

    return {
      title,
      targetRepo,
      body,
      priority,
      acceptanceCriteria,
      sourceChannel: 'webhook',
      sourceKind: input.source,
    };
  }

  /**
   * R36: Source-specific webhook payload enrichment.
   * Parses Linear, Jira, and Slack payload structures into normalized
   * issue fields (title, body, priority, acceptanceCriteria, targetRepo).
   */
  private enrichWebhookFromSource(
    source: string,
    event: string,
    payload: Record<string, unknown>,
  ): {
    title?: string;
    body?: string;
    priority?: 'P0' | 'P1' | 'P2' | 'P3';
    acceptanceCriteria?: string[];
    targetRepo?: string;
    note?: string;
  } {
    switch (source) {
      case 'linear':
        return this.enrichLinearPayload(event, payload);
      case 'jira':
        return this.enrichJiraPayload(event, payload);
      case 'slack':
        return this.enrichSlackPayload(event, payload);
      default:
        return {};
    }
  }

  /** Linear webhook: https://developers.linear.app/docs/webhooks */
  private enrichLinearPayload(
    event: string,
    payload: Record<string, unknown>,
  ): ReturnType<LoopsService['enrichWebhookFromSource']> {
    const data = (payload.data ?? payload) as Record<string, unknown>;
    const issueTitle = this.readWebhookString(data, 'title');
    const issueDesc = this.readWebhookString(data, 'description');
    const teamName = this.readWebhookPath(data, ['team', 'name']);
    const state = this.readWebhookPath(data, ['state', 'name']);
    const assignee = this.readWebhookPath(data, ['assignee', 'name']);
    const priorityLabel = this.readWebhookString(data, 'priorityLabel');

    let priority: 'P0' | 'P1' | 'P2' | 'P3' = 'P2';
    if (priorityLabel === 'Urgent') priority = 'P0';
    else if (priorityLabel === 'High') priority = 'P1';
    else if (priorityLabel === 'Low') priority = 'P3';

    const note = [
      teamName ? `Team: ${teamName}` : null,
      state ? `State: ${state}` : null,
      assignee ? `Assignee: ${assignee}` : null,
    ]
      .filter(Boolean)
      .join(' | ');

    return {
      title: issueTitle,
      body: issueDesc,
      priority,
      acceptanceCriteria: [`Verify Linear issue state "${state ?? 'unknown'}" resolves correctly`],
      note: note || undefined,
    };
  }

  /** Jira webhook: https://developer.atlassian.com/cloud/jira/platform/webhooks/ */
  private enrichJiraPayload(
    event: string,
    payload: Record<string, unknown>,
  ): ReturnType<LoopsService['enrichWebhookFromSource']> {
    const issue = (payload.issue ?? {}) as Record<string, unknown>;
    const fields = (issue.fields ?? {}) as Record<string, unknown>;
    const issueKey = this.readWebhookString(issue, 'key');
    const summary = this.readWebhookString(fields, 'summary');
    const description = this.readWebhookString(fields, 'description');
    const issueType = this.readWebhookPath(fields, ['issuetype', 'name']);
    const projectName = this.readWebhookPath(fields, ['project', 'name']);
    const priorityName = this.readWebhookPath(fields, ['priority', 'name']);
    const labels = this.readWebhookStringArray(fields, 'labels');

    let priority: 'P0' | 'P1' | 'P2' | 'P3' = 'P2';
    if (priorityName === 'Highest' || priorityName === 'Blocker') priority = 'P0';
    else if (priorityName === 'High') priority = 'P1';
    else if (priorityName === 'Low' || priorityName === 'Lowest') priority = 'P3';

    const note = [
      issueKey ? `Key: ${issueKey}` : null,
      issueType ? `Type: ${issueType}` : null,
      projectName ? `Project: ${projectName}` : null,
      labels?.length ? `Labels: ${labels.join(', ')}` : null,
    ]
      .filter(Boolean)
      .join(' | ');

    return {
      title: summary ?? issueKey,
      body: description,
      priority,
      acceptanceCriteria: [`Jira issue ${issueKey ?? 'unknown'} migrated to DofeAI delivery`],
      note: note || undefined,
    };
  }

  /** Slack webhook: slash commands + events API */
  private enrichSlackPayload(
    event: string,
    payload: Record<string, unknown>,
  ): ReturnType<LoopsService['enrichWebhookFromSource']> {
    // Slash command: /dofeai <text>
    const commandText = this.readWebhookString(payload, 'text');
    const channelName = this.readWebhookString(payload, 'channel_name');
    const userName = this.readWebhookString(payload, 'user_name');
    const teamDomain = this.readWebhookString(payload, 'team_domain');

    // Event API: message.app_mention or reaction_added
    const eventData = (payload.event ?? {}) as Record<string, unknown>;
    const eventText = this.readWebhookString(eventData, 'text');
    const eventChannel = this.readWebhookString(eventData, 'channel');

    const body = commandText ?? eventText ?? `Slack ${event}`;

    const note = [
      userName ? `From: @${userName}` : null,
      channelName ? `#${channelName}` : null,
      eventChannel ? `Channel: ${eventChannel}` : null,
      teamDomain ? `Team: ${teamDomain}` : null,
    ]
      .filter(Boolean)
      .join(' | ');

    return {
      title: `Slack ${event} request`,
      body: body?.replace(/<@[A-Z0-9]+>/g, '').trim(), // Strip Slack user mentions
      priority: 'P2',
      acceptanceCriteria: [
        'Slack request processed and acknowledged',
        'Deliverable defined from description',
      ],
      note: note || undefined,
    };
  }

  private readWebhookString(payload: Record<string, unknown>, key: string): string | undefined {
    const value = payload[key];
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
  }

  private readWebhookPath(payload: Record<string, unknown>, path: string[]): string | undefined {
    let current: unknown = payload;
    for (const segment of path) {
      if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined;
      current = (current as Record<string, unknown>)[segment];
    }
    return typeof current === 'string' && current.trim().length > 0 ? current.trim() : undefined;
  }

  private readWebhookStringArray(
    payload: Record<string, unknown>,
    key: string,
  ): string[] | undefined {
    const value = payload[key];
    if (!Array.isArray(value)) return undefined;
    const items = value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);
    return items.length > 0 ? items : undefined;
  }

  private mapWebhookPriority(payload: Record<string, unknown>): CreateLoopIssueRequest['priority'] {
    const explicit = this.readWebhookString(payload, 'priority')?.toUpperCase();
    if (explicit === 'P0' || explicit === 'P1' || explicit === 'P2' || explicit === 'P3') {
      return explicit;
    }
    const labels = this.readWebhookStringArray(payload, 'labels') ?? [];
    const labelText = labels.join(' ').toLowerCase();
    if (/\b(p0|sev0|critical|urgent|blocker)\b/.test(labelText)) return 'P0';
    if (/\b(p1|sev1|high|bug|regression)\b/.test(labelText)) return 'P1';
    if (/\b(p3|low|docs|documentation)\b/.test(labelText)) return 'P3';
    return 'P2';
  }

  private truncateWebhookTitle(title: string): string {
    return title.length <= 160 ? title : `${title.slice(0, 157).trimEnd()}...`;
  }

  private redactWebhookPayload(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.redactWebhookPayload(item));
    if (!value || typeof value !== 'object') return value;

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        this.isSensitiveWebhookKey(key) ? '[REDACTED]' : this.redactWebhookPayload(item),
      ]),
    );
  }

  /**
   * R32a: Map GitHub issue labels to DofeAI delivery blueprints.
   * Common label patterns → blueprint + priority inference.
   * Returns null when no label-based enrichment is possible.
   */
  private mapGitHubLabelsToBlueprint(input: LoopWebhookTrigger): {
    labels: string[];
    blueprintId: string;
    priority: 'P0' | 'P1' | 'P2' | 'P3';
  } | null {
    if (input.source !== 'github') return null;

    const payload = input.payload as Record<string, unknown>;
    const rawLabels = this.readWebhookStringArray(payload, 'labels');
    const labelObjects = Array.isArray(payload.labels)
      ? (payload.labels as Array<{ name?: string }>)
          .map((l) => l.name)
          .filter((n): n is string => typeof n === 'string' && n.length > 0)
      : [];
    const labels = (rawLabels ?? []).concat(labelObjects);

    if (labels.length === 0) return null;

    const labelSet = new Set(labels.map((l) => l.toLowerCase()));

    // Priority inference from labels
    let priority: 'P0' | 'P1' | 'P2' | 'P3' = 'P2';
    if (labelSet.has('p0') || labelSet.has('critical') || labelSet.has('blocker')) {
      priority = 'P0';
    } else if (labelSet.has('p1') || labelSet.has('high') || labelSet.has('bug')) {
      priority = 'P1';
    } else if (labelSet.has('p3') || labelSet.has('low') || labelSet.has('docs')) {
      priority = 'P3';
    }

    // Blueprint inference from labels
    let blueprintId = 'bp-bugfix'; // default for GitHub issues
    if (labelSet.has('feature') || labelSet.has('enhancement')) {
      blueprintId = 'bp-feature';
    } else if (labelSet.has('refactor') || labelSet.has('tech-debt')) {
      blueprintId = 'bp-refactor';
    } else if (labelSet.has('documentation') || labelSet.has('docs')) {
      blueprintId = 'bp-docs';
    } else if (labelSet.has('security') || labelSet.has('vulnerability')) {
      blueprintId = 'bp-security';
    } else if (labelSet.has('dependencies') || labelSet.has('dependabot')) {
      blueprintId = 'bp-dependency';
    } else if (labelSet.has('integration') || labelSet.has('api')) {
      blueprintId = 'bp-integration';
    } else if (labelSet.has('bug') || labelSet.has('bugfix')) {
      blueprintId = 'bp-bugfix';
    }

    return { labels, blueprintId, priority };
  }

  private isSensitiveWebhookKey(key: string): boolean {
    return /token|secret|password|authorization|api[-_]?key|access[-_]?key|private[-_]?key/i.test(
      key,
    );
  }

  // =========================================================================
  // Schedule Triggers (P1-3, R30c)
  // =========================================================================

  async listScheduleTriggers(query: LoopIssuesQuery): Promise<LoopScheduleTriggerListResponse> {
    return this.triggersService.listScheduleTriggers(query);
  }

  async getScheduleTrigger(triggerId: string): Promise<LoopScheduleTrigger> {
    return this.triggersService.getScheduleTrigger(triggerId);
  }

  async createScheduleTrigger(input: CreateScheduleTriggerRequest): Promise<LoopScheduleTrigger> {
    const trigger = this.triggersService.createScheduleTrigger(input);
    this.log('info', `[Loops] Schedule trigger created`, {
      triggerId: trigger.id,
      name: trigger.name,
      cron: trigger.cronExpression,
    });
    return trigger;
  }

  async updateScheduleTrigger(
    triggerId: string,
    input: UpdateScheduleTriggerRequest,
  ): Promise<LoopScheduleTrigger> {
    const updated = this.triggersService.updateScheduleTrigger(triggerId, input);
    this.log('info', `[Loops] Schedule trigger updated`, {
      triggerId,
      status: updated.status,
    });
    return updated;
  }

  async deleteScheduleTrigger(triggerId: string): Promise<{ deleted: boolean; triggerId: string }> {
    const result = this.triggersService.deleteScheduleTrigger(triggerId);
    this.log('info', `[Loops] Schedule trigger deleted`, { triggerId });
    return result;
  }

  /**
   * R32a: Manually fire a schedule trigger to immediately create a Loop issue.
   * Records the execution and updates lastRunAt/failureCount on the trigger.
   *
   * 结构优化 nextstep Step N2：trigger fire 编排（trigger 读取、execution 记录、
   * issue creation 调用、成功/失败 stats）已下沉到 `LoopsTriggersService.fireScheduleTrigger`。
   * 本 facade 只保留兼容 wrapper：把自身作为 issue creation port、admin 日志 sink 透传，
   * 以维持对外行为（manual fire 日志、execution 记录、stats 更新）完全一致。
   */
  async fireScheduleTrigger(
    triggerId: string,
    input?: { reason?: string },
  ): Promise<LoopWebhookTriggerResponse> {
    return this.triggersService.fireScheduleTrigger(triggerId, input, this, this.adminLogSink());
  }

  // =========================================================================
  // Trigger Lifecycle Management (P1-3, R30c)
  // =========================================================================

  async listTriggerExecutions(
    triggerId: string,
    query: LoopIssuesQuery,
  ): Promise<LoopTriggerExecutionListResponse> {
    const { limit = 20, page = 1 } = query;
    const offset = (page - 1) * limit;
    const executions = this.store.listTriggerExecutions(triggerId);
    const paged = executions.slice(offset, offset + limit);
    return {
      list: paged,
      total: executions.length,
      page,
      limit,
    };
  }

  async retryTriggerExecution(
    executionId: string,
    input: LoopTriggerRetryRequest,
  ): Promise<LoopTriggerExecution> {
    const execution = this.store.readTriggerExecution(executionId);
    if (!execution) throw new NotFoundException(`Trigger execution ${executionId} not found`);
    if (execution.attempt >= execution.maxRetries) {
      this.store.moveToDeadLetter(execution);
      throw new BadRequestException(
        `Execution ${executionId} has exhausted retries (${execution.attempt}/${execution.maxRetries})`,
      );
    }
    const retried: LoopTriggerExecution = {
      ...execution,
      status: 'pending',
      attempt: execution.attempt + 1,
      nextRetryAt: this.computeRetryBackoff(execution.attempt + 1),
      error: undefined,
      completedAt: undefined,
    };
    this.store.writeTriggerExecution(retried);
    this.log('info', `[Loops] Trigger execution retried`, {
      executionId,
      attempt: retried.attempt,
      reason: input.reason,
    });
    return retried;
  }

  async replayTriggerExecution(
    executionId: string,
    input: LoopTriggerReplayRequest,
  ): Promise<LoopTriggerExecution> {
    const original = this.store.readTriggerExecution(executionId);
    if (!original) throw new NotFoundException(`Trigger execution ${executionId} not found`);
    const now = new Date().toISOString();
    const replay: LoopTriggerExecution = {
      id: `exec-${this.store.nextTriggerExecutionSeq()}`,
      triggerId: original.triggerId,
      triggerType: original.triggerType,
      status: 'pending',
      inputPayload: original.inputPayload,
      attempt: 1,
      maxRetries: original.maxRetries,
      createdAt: now,
    };
    this.store.writeTriggerExecution(replay);
    this.log('info', `[Loops] Trigger execution replayed`, {
      originalExecutionId: executionId,
      replayExecutionId: replay.id,
      reason: input.reason,
    });
    return replay;
  }

  async listDeadLetters(query: LoopIssuesQuery): Promise<LoopTriggerDeadLetterListResponse> {
    const { limit = 20, page = 1 } = query;
    const offset = (page - 1) * limit;
    const deadLetters = this.store.listDeadLetters();
    const paged = deadLetters.slice(offset, offset + limit);
    return {
      list: paged,
      total: deadLetters.length,
      page,
      limit,
    };
  }

  private computeNextCronTime(cronExpression: string): string | undefined {
    return this.triggersService.computeNextCronTime(cronExpression);
  }

  private computeRetryBackoff(attempt: number): string {
    const delayMinutes = Math.min(Math.pow(2, attempt - 1), 60);
    const next = new Date(Date.now() + delayMinutes * 60_000);
    return next.toISOString();
  }

  async doctor() {
    return this.persistence?.doctor() ?? this.store.doctor();
  }

  async cost() {
    return this.store.readCost();
  }

  async metrics(): Promise<LoopMetricsResponse> {
    const [list, doctor, cost, logs, loopBenchTrend] = await Promise.all([
      this.list({ page: 1, limit: 200 }),
      this.doctor(),
      this.cost(),
      this.store.readLogs({ limit: 200 }),
      this.readLoopBenchTrendSummary(),
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
        label: this.engine.formatPhase(phase),
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
      loopBenchTrend,
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
          meta: this.engine.formatPhase(definition.phase),
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
        meta: `${this.engine.formatPhase(state?.phase ?? definition.phase)} · round ${state?.round ?? 1}`,
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
      learningIndex: await this.store.readLearningIndex(),
    };
  }

  async governLearning(
    learningId: string,
    request: LoopLearningGovernanceRequest,
  ): Promise<LoopWorkspacesResponse> {
    if (
      (request.action === 'merge' || request.action === 'supersede') &&
      !request.targetLearningId
    ) {
      throw new BadRequestException(
        'targetLearningId is required when merging or superseding a learning',
      );
    }
    if (
      (request.action === 'approve-merge' || request.action === 'reject-merge') &&
      !request.targetLearningId
    ) {
      const governance = await this.store.readLearningGovernance();
      const candidate = governance.autoMergeCandidates.find(
        (item) => item.sourceLearningId === learningId && item.status === 'pending-approval',
      );
      if (!candidate) {
        throw new BadRequestException(
          'targetLearningId is required when no pending auto-merge candidate exists',
        );
      }
    }
    await this.store.governLearning({ learningId, request });
    return this.listWorkspaces();
  }

  async runLearningAutoMergeWorker(): Promise<LoopWorkspacesResponse> {
    await this.store.runLearningAutoMergeWorker();
    return this.listWorkspaces();
  }

  async runLearningIndexWorker(): Promise<LoopWorkspacesResponse> {
    await this.store.runLearningIndexWorker();
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

  // =========================================================================
  // Tool Registry (P1-4, R31a)
  // =========================================================================

  async listTools(query: LoopIssuesQuery): Promise<LoopToolListResponse> {
    return this.adminService.listTools(query);
  }

  async getTool(toolId: string) {
    return this.adminService.getTool(toolId);
  }

  async registerTool(input: RegisterToolRequest) {
    return this.adminService.registerTool(input, this.adminLogSink());
  }

  async updateTool(toolId: string, input: UpdateToolRequest) {
    return this.adminService.updateTool(toolId, input, this.adminLogSink());
  }

  async toolHealthCheck(toolId: string): Promise<ToolHealthCheckResponse> {
    return this.adminService.toolHealthCheck(toolId);
  }

  async testTool(
    toolId: string,
    input?: { input?: Record<string, unknown> },
  ): Promise<ToolTestResponse> {
    return this.adminService.testTool(toolId, input);
  }

  // =========================================================================
  // Delivery Blueprint Marketplace (P1-2, R31b)
  // =========================================================================

  async listBlueprints(query: LoopIssuesQuery): Promise<LoopBlueprintListResponse> {
    return this.adminService.listBlueprints(query);
  }

  async getBlueprint(blueprintId: string) {
    return this.adminService.getBlueprint(blueprintId);
  }

  async createBlueprint(input: CreateBlueprintRequest) {
    return this.adminService.createBlueprint(input, this.adminLogSink());
  }

  async updateBlueprint(blueprintId: string, input: UpdateBlueprintRequest) {
    return this.adminService.updateBlueprint(blueprintId, input, this.adminLogSink());
  }

  async rollbackBlueprint(
    blueprintId: string,
    input?: { targetVersion?: string; reason?: string },
  ) {
    return this.adminService.rollbackBlueprint(blueprintId, input, this.adminLogSink());
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
          phase: this.engine.nextResumePhase(detail.state),
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

  // 结构优化 Step 3：nextResumePhase / nextSpecVersion / findRunnableShard /
  // formatPhase 已下沉到 `LoopsEngineService`（经 `this.engine.*` 委托）。

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

  /**
   * Derive a PR-ready delivery evidence summary from a loop detail (P0-4).
   * Reuses existing artifact/record builders so the evidence matches what the
   * scheduler already persists. The markdown body is intentionally plain so a
   * PR provider adapter can post it verbatim as a PR comment.
   */
  private buildDeliveryEvidence(detail: LoopIssueDetail): LoopDeliveryEvidence {
    const now = new Date().toISOString();
    const commitsByShard = new Map(
      (detail.convergencePr?.commits ?? []).map((commit) => [commit.shardId, commit]),
    );
    const workPackages: LoopDeliveryEvidenceWorkPackage[] = detail.shards.map((shard) => {
      const implementation = detail.implementationRecords.find(
        (record) => record.shardId === shard.id,
      );
      const review = detail.reviewRecords.find((record) => record.shardId === shard.id);
      const testRecord = detail.testRecords.find((record) => record.shardId === shard.id);
      const commit = commitsByShard.get(shard.id);
      return {
        id: shard.id,
        title: shard.title,
        status: shard.status,
        files: implementation?.changedFiles ?? shard.filesHint ?? [],
        tests: testRecord?.status ?? 'not-run',
        review: review?.verdict ?? 'unreviewed',
        commitSha: commit?.commitSha,
        commitMessage: commit?.message,
        branch: commit?.branch,
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
    return this.evidence.buildDeliveryEvidenceMarkdown(input);
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
    return this.evidence.withRequirementsCoverage(
      detail,
      this.buildSecondOpinion(detail),
    ) as LoopIssueDetail;
  }

  private async withDeliveryControlsList(result: LoopListResponse): Promise<LoopListResponse> {
    return this.evidence.withDeliveryControlsList(result, {
      readDetail: (issueId) => this.readDetail(issueId),
      buildSecondOpinion: (detail) => this.buildSecondOpinion(detail as LoopIssueDetail),
      onReadError: (issueId, error) => {
        this.log('warn', '[Loops] unable to read runtime security exceptions for list item', {
          issueId,
          error: error instanceof Error ? error.message : String(error),
        });
      },
    });
  }

  private buildRuntimeSecurityExceptions(detail: LoopIssueDetail): LoopRuntimeSecurityException[] {
    return this.evidence.buildRuntimeSecurityExceptions(detail);
  }

  private buildDeliveryControls(item: LoopListItem | LoopIssueDetail): {
    workflowRecipe: LoopWorkflowRecipe;
    reviewGates: LoopReviewGate[];
    releaseGate: LoopReleaseGate;
    secondOpinion?: LoopSecondOpinion;
  } {
    const detail = this.asDetail(item);
    const secondOpinion = detail ? this.buildSecondOpinion(detail) : undefined;
    return this.evidence.buildDeliveryControls(item, secondOpinion);
  }

  private buildWorkflowRecipe(item: LoopListItem | LoopIssueDetail): LoopWorkflowRecipe {
    return this.evidence.buildWorkflowRecipe(item);
  }

  private buildWorkflowBaselineEvidence(
    item: LoopListItem | LoopIssueDetail,
    workflowDefault?: NonNullable<
      LoopIssueDetail['deliveryGovernance']
    >['workflowDefaults'][number],
  ): LoopWorkflowRecipe['baselineEvidence'] {
    return this.evidence.buildWorkflowBaselineEvidence(item, workflowDefault);
  }

  private buildReviewGates(item: LoopListItem | LoopIssueDetail): LoopReviewGate[] {
    return this.evidence.buildReviewGates(item);
  }

  private buildReleaseGate(item: LoopListItem | LoopIssueDetail): LoopReleaseGate {
    const detail = this.asDetail(item);
    const secondOpinion = detail ? this.buildSecondOpinion(detail) : undefined;
    return this.evidence.buildReleaseGate(item, secondOpinion);
  }

  private buildSecondOpinion(detail: LoopIssueDetail): LoopSecondOpinion {
    return this.evidence.buildSecondOpinion(detail);
  }

  private applySecondOpinionPolicy(
    detail: LoopIssueDetail,
    report: LoopSecondOpinion,
  ): LoopSecondOpinion {
    return this.evidence.applySecondOpinionPolicy(detail, report);
  }

  private isSecondOpinionReviewerPassed(status: LoopSecondOpinion['secondary']['status']): boolean {
    return this.evidence.isSecondOpinionReviewerPassed(status);
  }

  private deliveryBlockedReason(item: LoopListItem | LoopIssueDetail): string | undefined {
    return this.evidence.deliveryBlockedReason(item);
  }

  // 结构优化 Step 5：inferWorkflowKind 已下沉到 `LoopsEvidenceService`
  //（经 `this.evidence.inferWorkflowKind(...)` 委托）。

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
    return this.evidence.isSpecApproved(item);
  }

  private isImplementationDone(item: LoopListItem | LoopIssueDetail): boolean {
    return this.evidence.isImplementationDone(item);
  }

  private isReviewPassed(item: LoopListItem | LoopIssueDetail): boolean {
    return this.evidence.isReviewPassed(item);
  }

  private isBrowserQaPassed(item: LoopListItem | LoopIssueDetail): boolean {
    return this.evidence.isBrowserQaPassed(item);
  }

  private isReleaseReady(item: LoopListItem | LoopIssueDetail): boolean {
    return this.evidence.isReleaseReady(item);
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
    const blockers = this.evidence.buildReleaseGateBlockers({
      detail,
      releaseGate,
      secondOpinion,
    });

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

  /**
   * R32a: Check Rules Center compliance against the delivery evidence.
   * Returns a list of violation descriptions; empty = all enforced rules passed.
   */
  private checkRulesCompliance(detail: LoopIssueDetail): string[] {
    return this.evidence.checkRulesCompliance(detail);
  }

  private testsPassed(item: LoopListItem | LoopIssueDetail): boolean {
    return this.evidence.testsPassed(item);
  }

  private reviewFindingsCount(item: LoopListItem | LoopIssueDetail): number {
    return this.evidence.reviewFindingsCount(item);
  }

  private phaseAtLeast(item: LoopListItem | LoopIssueDetail, phase: LoopPhase): boolean {
    return this.evidence.phaseAtLeast(item, phase);
  }

  private buildEvidenceArtifacts(detail: LoopIssueDetail): LoopEvidenceArtifact[] {
    return this.evidence.buildEvidenceArtifacts(detail);
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
    return this.evidence.buildRequirementsCoverage(detail);
  }

  private resolveRequirementStatus(input: {
    inSpec: boolean;
    shardIds: string[];
    testIds: string[];
    implementationRecordIds: string[];
    reviewRecordIds: string[];
    globalVerdict?: LoopStateItem['globalVerdict'];
  }): LoopRequirementCoverageItem['status'] {
    return this.evidence.resolveRequirementStatus(input);
  }

  private summarizeRequirementsCoverage(
    items: LoopRequirementCoverageItem[],
  ): LoopRequirementCoverageSummary {
    return this.evidence.summarizeRequirementsCoverage(items);
  }

  private aggregateCoverageSummaries(
    summaries: LoopRequirementCoverageSummary[],
  ): LoopRequirementCoverageSummary {
    return this.evidence.aggregateCoverageSummaries(summaries);
  }

  private emptyCoverageSummary(total = 0): LoopRequirementCoverageSummary {
    return this.evidence.emptyCoverageSummary(total);
  }

  private coverageTextMatches(text: string, normalizedNeedle: string) {
    return this.evidence.coverageTextMatches(text, normalizedNeedle);
  }

  private normalizeCoverageText(value: string) {
    return this.evidence.normalizeCoverageText(value);
  }

  /** gstack P2: Serve a Browser QA artifact file (screenshot, trace, diff) for inline preview. */
  async getBrowserQaArtifact(issueId: string, artifactPath: string): Promise<Buffer> {
    const fullPath = this.store.resolveArtifactPath(issueId, artifactPath);
    const { promises: fs } = await import('fs');
    try {
      return await fs.readFile(fullPath);
    } catch {
      throw new NotFoundException(`Browser QA artifact not found: ${artifactPath}`);
    }
  }

  /** gstack P2: List workspace-level workflow recipe configurations for admin. */
  async listWorkspaceRecipes(query: { limit?: number; page?: number }) {
    return this.store.listWorkspaceRecipes(query);
  }

  /** gstack P2: Loop Bench drilldown by workspace/repo/recipe dimensions. */
  async getLoopBenchDrilldown(query: {
    workspaceId?: string;
    repo?: string;
    recipeId?: string;
    period?: string;
  }) {
    return this.store.buildLoopBenchDrilldown(query);
  }
}
