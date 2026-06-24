import { Inject, Injectable, Optional } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';
import { createHash, randomUUID } from 'crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { promises as fs } from 'fs';
import * as path from 'path';
import type {
  LoopAnnotation,
  LoopBenchTrendSnapshot,
  LoopBrowserQaReport,
  LoopConvergencePr,
  LoopCostItem,
  EvalHistoricalBaselineSnapshot,
  LoopDeliveryGovernance,
  LoopDeliveryGovernanceRequest,
  LoopDetail,
  LoopGlobalReviewRecord,
  LoopImplementationRecord,
  LoopIntake,
  LoopIssue,
  LoopLearning,
  LoopLearningGovernance,
  LoopLearningGovernanceRequest,
  LoopLearningIndex,
  LoopLogEntry,
  LoopNotification,
  LoopRecipeAdminActionResponse,
  LoopRemoteRunnerJob,
  LoopReviewRecord,
  LoopShard,
  LoopSecondOpinion,
  LoopSpec,
  LoopSpecHistoryItem,
  LoopStateItem,
  LoopTestMatrix,
  LoopTestRecord,
  LoopWorkflowRecipe,
  LoopScheduleTrigger,
  LoopTriggerExecution,
  LoopTriggerDeadLetter,
  LoopTool,
  LoopBlueprint,
  RuntimeBackendPolicyUpdate,
} from '@repo/contracts';
import { LoopsNotificationSender } from './loops-notification-sender.service';
import {
  enrichLoopLearning,
  withLearningSimilaritySuggestions,
} from './loops-learning-memory.util';
import { readLoopsRuntimeConfig } from './loops-runtime-config.util';

type StateFile = {
  loops: LoopStateItem[];
};

export type LoopMcpExecutionAuditRecord = {
  auditRef: string;
  artifactRef: string;
  providerId: string;
  action: 'connect' | 'disconnect' | 'test';
  outcome: 'success' | 'failed' | 'skipped';
  toolCount: number;
  toolIds: string[];
  transport: 'stdio' | 'sse' | 'http';
  authStatus: 'configured' | 'missing' | 'not-required';
  reason?: string;
  recordedAt: string;
  health: {
    ok: boolean;
    message: string;
  };
};

export type LoopCiCheckPublicationRecord = {
  artifactRef: string;
  integrationId: string;
  provider?: 'github' | 'gitlab' | 'gitea';
  headSha?: string;
  checkRunId?: string;
  url?: string;
  outcome: 'published' | 'failed';
  reason?: string;
  issueId?: string;
  prId?: string;
  evidenceBacklink?: string;
  workPackageCommitMap: Array<{
    workPackageId: string;
    title?: string;
    commitSha?: string;
    commitMessage?: string;
    branch?: string;
    files: string[];
  }>;
  request: {
    name?: string;
    title?: string;
    summary?: string;
    detailsUrl?: string;
    evidenceBacklink?: string;
    status?: 'queued' | 'in_progress' | 'completed';
    conclusion?:
      | 'success'
      | 'failure'
      | 'neutral'
      | 'cancelled'
      | 'skipped'
      | 'timed_out'
      | 'action_required';
  };
  publishedAt: string;
};

export type LoopCiCheckPublicationIndex = {
  integrationId: string;
  latest?: LoopCiCheckPublicationRecord;
  entries: LoopCiCheckPublicationRecord[];
  updatedAt?: string;
};

export type LoopRecipeAdminActionRecord = Omit<LoopRecipeAdminActionResponse, 'artifactRef'>;

export type LoopsDoctorResult = {
  ok: boolean;
  root: string;
  loops: number;
  issues: number;
  fileProblems: string[];
  dbProblems: string[];
  consistencyProblems: string[];
  problems: string[];
};

export type LoopsResumeResult = {
  resumed: number;
  updatedShards: Array<{
    issueId: string;
    shardId: string;
    from: string;
    to: string;
  }>;
};

@Injectable()
export class LoopsFileStoreService {
  constructor(
    @Optional()
    private readonly notificationSender: LoopsNotificationSender = new LoopsNotificationSender(),
    @Optional()
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger?: Logger,
  ) {}

  /** Winston-backed structured log; no-op for standalone (non-Nest) consumers. */
  private log(
    level: 'info' | 'warn' | 'error' | 'debug',
    message: string,
    meta?: Record<string, unknown>,
  ): void {
    this.logger?.[level](message, meta);
  }

  private readonly root = path.join(this.findWorkspaceRoot(), '.loops');

  async ensureInitialized() {
    await Promise.all(
      [
        'issues',
        'intakes',
        'specs',
        'shards',
        'tests',
        'runs',
        'annotations',
        'notifications',
        'archive',
        'eval-trends',
        'bench-trends',
        // Per-issue atomic state files (R7); each issue writes its own
        // `state/<issueId>.json` instead of rewriting a monolithic state file.
        'state',
      ].map((dir) => fs.mkdir(path.join(this.root, dir), { recursive: true })),
    );

    await this.writeJsonIfMissing('state.json', { loops: [] });
    await this.writeTextIfMissing('log.jsonl', '');
  }

  async readEvalTrendHistory(): Promise<EvalHistoricalBaselineSnapshot[]> {
    await this.ensureInitialized();
    return (
      (await this.readOptionalJson<EvalHistoricalBaselineSnapshot[]>('eval-trends/history.json')) ??
      []
    );
  }

  async appendEvalTrendSnapshots(
    snapshots: EvalHistoricalBaselineSnapshot[],
  ): Promise<EvalHistoricalBaselineSnapshot[]> {
    await this.ensureInitialized();
    const history = await this.readEvalTrendHistory();
    const next = [...history, ...snapshots].sort((a, b) =>
      a.capturedAt.localeCompare(b.capturedAt),
    );
    await this.writeJson('eval-trends/history.json', next);
    await this.writeJson('eval-trends/latest.json', snapshots);
    await this.appendLog({
      type: 'EVAL_TREND_WORKER',
      snapshots: snapshots.length,
      capturedAt: snapshots[0]?.capturedAt,
    });
    return next;
  }

  async readLoopBenchTrendHistory(): Promise<LoopBenchTrendSnapshot[]> {
    await this.ensureInitialized();
    return (
      (await this.readOptionalJson<LoopBenchTrendSnapshot[]>('bench-trends/history.json')) ?? []
    );
  }

  async appendLoopBenchTrendSnapshot(
    snapshot: LoopBenchTrendSnapshot,
  ): Promise<LoopBenchTrendSnapshot[]> {
    await this.ensureInitialized();
    const history = await this.readLoopBenchTrendHistory();
    const next = [...history, snapshot].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
    await this.writeJson('bench-trends/history.json', next);
    await this.writeJson('bench-trends/latest.json', snapshot);
    await this.writeJson(this.toLoopsStorePath(snapshot.artifactRef), snapshot);
    await this.appendLog({
      type: 'LOOP_BENCH_TREND_WORKER',
      snapshot: snapshot.id,
      capturedAt: snapshot.capturedAt,
      artifactRef: snapshot.artifactRef,
      loopCount: snapshot.loopCount,
    });
    return next;
  }

  async list() {
    await this.ensureInitialized();
    const state = await this.readState();
    const issues = await this.readAllIssues();
    return { issues, loops: state.loops };
  }

  async readDetail(issueId: string): Promise<LoopDetail> {
    await this.ensureInitialized();
    const issue = await this.readJson<LoopIssue>(`issues/${issueId}.json`);
    const intake = await this.readJson<LoopIntake>(`intakes/${this.intakeId(issueId)}.json`);
    const state = (await this.readState()).loops.find((item) => item.issueId === issueId);

    if (!state) {
      throw new Error(`Loop state not found for ${issueId}`);
    }

    const spec =
      state.specVersion === 'v0'
        ? undefined
        : await this.readOptionalJson<LoopSpec>(`specs/${issueId}/spec.${state.specVersion}.json`);
    const specHistory = await this.readSpecHistory(issueId);
    const shards =
      state.shardsTotal > 0
        ? await this.readOptionalJson<LoopShard[]>(`shards/${issueId}/shards.json`)
        : undefined;
    const testMatrix =
      state.shardsTotal > 0
        ? await this.readOptionalJson<LoopTestMatrix>(`tests/${issueId}/matrix.json`)
        : undefined;
    const annotations =
      state.shardsTotal > 0
        ? await this.readOptionalJson<LoopAnnotation[]>(`annotations/${issueId}.json`)
        : undefined;
    const implementationRecords = (await this.readImplementationRecords(issueId)).filter(
      (record) => record.round === state.round,
    );
    const reviewRecords = (await this.readReviewRecords(issueId)).filter(
      (record) => record.round === state.round,
    );
    const testRecords = (await this.readTestRecords(issueId)).filter(
      (record) => record.round === state.round,
    );
    const logs = await this.readLogs({ issueId, limit: 40 });
    const notifications = await this.readNotifications({ issueId, limit: 20 });
    const globalReview =
      state.globalVerdict || state.finalized
        ? await this.readOptionalJson<LoopGlobalReviewRecord>(`runs/${issueId}/global-review.json`)
        : undefined;
    const convergencePr =
      state.finalized || state.phase === 'CLOSED'
        ? await this.readOptionalJson<LoopConvergencePr>(`runs/${issueId}/convergence-pr.json`)
        : undefined;
    const workflowRecipe = await this.readOptionalJson<LoopWorkflowRecipe>(
      `runs/${issueId}/workflow-recipe.snapshot.json`,
    );
    const learnings =
      (await this.readOptionalJson<LoopLearning[]>(`learnings/${issueId}.json`)) ?? [];
    const browserQaReports = await this.readBrowserQaReports(issueId);
    const secondOpinion = await this.readOptionalJson<LoopSecondOpinion>(
      `runs/${issueId}/second-opinion.json`,
    );
    const deliveryGovernance = await this.readDeliveryGovernance(issueId);

    return {
      issue,
      intake,
      spec,
      specHistory,
      shards: shards ?? [],
      testMatrix,
      annotations: annotations ?? [],
      implementationRecords,
      reviewRecords,
      testRecords,
      logs,
      notifications,
      state,
      globalReview,
      convergencePr,
      workflowRecipe,
      learnings,
      browserQaReports,
      secondOpinion,
      deliveryGovernance,
    };
  }

  async readLogs(input: { issueId?: string; limit?: number } = {}) {
    await this.ensureInitialized();
    const content = await fs.readFile(path.join(this.root, 'log.jsonl'), 'utf8').catch(() => '');
    const entries = content
      .split('\n')
      .filter(Boolean)
      .map((line) => this.parseLogLine(line))
      .filter((entry): entry is LoopLogEntry => Boolean(entry))
      .filter((entry) => {
        if (!input.issueId) return true;
        return entry.loop === input.issueId || entry.issue === input.issueId;
      })
      .sort((a, b) => b.ts.localeCompare(a.ts));

    return entries.slice(0, input.limit ?? 50);
  }

  async readNotifications(input: { issueId?: string; limit?: number } = {}) {
    await this.ensureInitialized();
    const issueIds = input.issueId
      ? [input.issueId]
      : await fs
          .readdir(path.join(this.root, 'notifications'))
          .catch(() => [])
          .then((entries) => entries.filter((entry) => !entry.startsWith('.')));
    const notifications = await Promise.all(
      issueIds.map(async (issueId) => {
        const dir = path.join(this.root, 'notifications', issueId);
        const files = await fs.readdir(dir).catch(() => []);
        return Promise.all(
          files
            .filter((file) => file.endsWith('.json'))
            .map((file) => this.readJson<LoopNotification>(`notifications/${issueId}/${file}`)),
        );
      }),
    );

    return notifications
      .flat()
      .sort((a, b) => b.created.localeCompare(a.created))
      .slice(0, input.limit ?? 50);
  }

  async doctor(): Promise<LoopsDoctorResult> {
    await this.ensureInitialized();
    const state = await this.readState();
    const issues = await this.readAllIssues();
    const problems: string[] = [];

    for (const loop of state.loops) {
      const issue = issues.find((item) => item.id === loop.issueId);
      if (!issue) {
        problems.push(`state references missing issue ${loop.issueId}`);
        continue;
      }

      const intakePath = path.join(this.root, 'intakes', `${this.intakeId(loop.issueId)}.json`);
      if (!(await this.exists(intakePath))) {
        problems.push(`missing intake for ${loop.issueId}`);
      }

      if (loop.specVersion !== 'v0') {
        const specPath = path.join(
          this.root,
          'specs',
          loop.issueId,
          `spec.${loop.specVersion}.json`,
        );
        if (!(await this.exists(specPath))) {
          problems.push(`missing spec ${loop.specVersion} for ${loop.issueId}`);
        }
      }

      if (loop.shardsTotal > 0) {
        const shardPath = path.join(this.root, 'shards', loop.issueId, 'shards.json');
        if (!(await this.exists(shardPath))) {
          problems.push(`missing shards for ${loop.issueId}`);
        } else {
          const shards = await this.readOptionalJson<LoopShard[]>(
            `shards/${loop.issueId}/shards.json`,
          );
          if (!shards) {
            problems.push(`invalid shards json for ${loop.issueId}`);
          } else {
            this.inspectShardState(loop, shards, problems);
          }
        }

        const matrixPath = path.join(this.root, 'tests', loop.issueId, 'matrix.json');
        if (!(await this.exists(matrixPath))) {
          problems.push(`missing test matrix for ${loop.issueId}`);
        }

        const annotations = await this.readOptionalJson<LoopAnnotation[]>(
          `annotations/${loop.issueId}.json`,
        );
        if (!annotations) {
          problems.push(`missing annotations for ${loop.issueId}`);
        } else {
          await this.inspectAnnotationState(loop, annotations, problems);
        }
      }
    }

    return {
      ok: problems.length === 0,
      root: this.root,
      loops: state.loops.length,
      issues: issues.length,
      fileProblems: problems,
      dbProblems: [],
      consistencyProblems: [],
      problems,
    };
  }

  async readCost() {
    await this.ensureInitialized();
    const state = await this.readState();
    const config = (await readLoopsRuntimeConfig()).cost;
    const loops: LoopCostItem[] = state.loops.map((loop) => ({
      issueId: loop.issueId,
      costTokens: loop.costTokens,
      costCalls: loop.costCalls,
      tokenCap: config.tokenCapPerLoop,
      callCap: config.callCapPerLoop,
      tokensRemaining: Math.max(0, config.tokenCapPerLoop - loop.costTokens),
      callsRemaining: Math.max(0, config.callCapPerLoop - loop.costCalls),
      paused: loop.paused,
      tripped: loop.costTokens >= config.tokenCapPerLoop || loop.costCalls >= config.callCapPerLoop,
    }));
    return { loops };
  }

  async readRecentLearnings(
    limit = 12,
    options?: {
      /** Filter to specific workspace (default: all in current root). */
      workspaceId?: string;
      /** Filter to specific repo */
      repo?: string;
      /**
       * Scope governs recall behaviour:
       * - 'workspace' (default): only learnings from the current .loops root.
       * - 'cross-workspace': when dedupeScope policy is set, include all
       *   learnings regardless of workspaceId; the caller must still filter
       *   by repo/tag for precision.
       */
      recallScope?: 'workspace' | 'cross-workspace';
    },
  ): Promise<LoopLearning[]> {
    await this.ensureInitialized();
    const dir = path.join(this.root, 'learnings');
    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code !== 'ENOENT') {
        this.log('warn', '[Loops] unable to read learning memory index', {
          code,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return [];
    }

    const learnings = await Promise.all(
      entries
        .filter((entry) => entry.endsWith('.json'))
        .map((entry) => this.readOptionalJson<LoopLearning[]>(`learnings/${entry}`)),
    );
    const governance = await this.readLearningGovernance();
    const dismissedIds = new Set(governance.dismissed.map((item) => item.learningId));
    const mergedSourceIds = new Set(governance.merges.map((item) => item.sourceLearningId));
    const deprecatedIds = new Set((governance.deprecated ?? []).map((item) => item.learningId));
    const supersededSourceIds = new Set(
      (governance.superseded ?? []).map((item) => item.sourceLearningId),
    );

    let activeLearnings = learnings
      .flatMap((items) => items ?? [])
      .filter(
        (learning) =>
          !dismissedIds.has(learning.id) &&
          !mergedSourceIds.has(learning.id) &&
          !deprecatedIds.has(learning.id) &&
          !supersededSourceIds.has(learning.id),
      );

    // gstack/0 P1-4: Cross-workspace learning recall.
    // When recallScope is 'workspace', filter to matching workspaceId (or don't
    // filter if none provided — back-compat). When 'cross-workspace', include
    // all learnings. The caller should still apply repo/tag filters for relevance.
    if (options?.recallScope === 'cross-workspace') {
      // Include all learnings; caller filters by repo/tag externally.
    } else if (options?.workspaceId) {
      activeLearnings = activeLearnings.filter((l) => l.workspaceId === options.workspaceId);
    }
    if (options?.repo) {
      activeLearnings = activeLearnings.filter((l) => l.repo === options.repo);
    }

    activeLearnings = activeLearnings.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return withLearningSimilaritySuggestions(activeLearnings).slice(0, limit);
  }

  async readLearningGovernance(): Promise<LoopLearningGovernance> {
    const governance = await this.readOptionalJson<LoopLearningGovernance>(
      'learning-governance.json',
    );
    return {
      dismissed: [],
      merges: [],
      deprecated: [],
      superseded: [],
      autoMergeCandidates: [],
      ...governance,
    };
  }

  private upsertLearningGovernanceCandidate(
    candidates: LoopLearningGovernance['autoMergeCandidates'],
    input: {
      sourceLearningId: string;
      targetLearningId: string;
      status: LoopLearningGovernance['autoMergeCandidates'][number]['status'];
      reason: string;
      createdAt: string;
    },
  ) {
    return [
      ...candidates.filter(
        (item) =>
          !(
            item.sourceLearningId === input.sourceLearningId &&
            item.targetLearningId === input.targetLearningId
          ),
      ),
      input,
    ];
  }

  private addLearningMerge(
    governance: LoopLearningGovernance,
    input: {
      sourceLearningId: string;
      targetLearningId: string;
      actor: string;
      reason?: string;
      createdAt: string;
    },
  ): LoopLearningGovernance {
    return {
      ...governance,
      merges: [
        ...governance.merges.filter((item) => item.sourceLearningId !== input.sourceLearningId),
        {
          sourceLearningId: input.sourceLearningId,
          targetLearningId: input.targetLearningId,
          actor: input.actor,
          reason: input.reason,
          createdAt: input.createdAt,
        },
      ],
    };
  }

  /**
   * gstack/0 P2-6: Read shared workspace-level workflow defaults.
   * Stored at `.loops/workflow-defaults.json` so it applies across all loops
   * in the workspace without requiring per-issue governance.
   */
  async readWorkflowDefaults(): Promise<LoopDeliveryGovernance['workflowDefaults']> {
    const raw = await this.readOptionalJson<{
      workflowDefaults: LoopDeliveryGovernance['workflowDefaults'];
    }>('workflow-defaults.json');
    return raw?.workflowDefaults ?? [];
  }

  /**
   * gstack/0 P2-6: Persist workspace-level workflow defaults.
   */
  async writeWorkflowDefaults(defaults: LoopDeliveryGovernance['workflowDefaults']): Promise<void> {
    await this.writeJson('workflow-defaults.json', { workflowDefaults: defaults });
  }

  async readRuntimeBackendPolicies(): Promise<Record<string, RuntimeBackendPolicyUpdate>> {
    const raw = await this.readOptionalJson<{
      policies: Record<string, RuntimeBackendPolicyUpdate>;
    }>('runtime-backend-policies.json');
    return raw?.policies ?? {};
  }

  async patchRuntimeBackendPolicy(
    id: string,
    patch: RuntimeBackendPolicyUpdate,
  ): Promise<RuntimeBackendPolicyUpdate> {
    const policies = await this.readRuntimeBackendPolicies();
    const next = {
      ...(policies[id] ?? {}),
      ...patch,
    };
    await this.writeJson('runtime-backend-policies.json', {
      policies: {
        ...policies,
        [id]: next,
      },
    });
    return next;
  }

  async writeRemoteRunnerJob(job: LoopRemoteRunnerJob): Promise<LoopRemoteRunnerJob> {
    await this.ensureInitialized();
    const manifestPath = `${job.artifactRoot}/manifest.json`;
    const receiptPath = `${job.artifactRoot}/worker-receipt.json`;
    const logPath = `${job.artifactRoot}/worker.log`;
    const tracePath = `${job.artifactRoot}/trace.json`;
    const jobStoreRoot = this.toLoopsStorePath(job.artifactRoot);
    const manifestPayload = {
      jobId: job.id,
      runnerId: job.runnerId,
      leaseId: job.leaseId,
      issueId: job.issueId,
      shardId: job.shardId,
      runtimeBackend: job.runtimeBackend,
      workerKind: job.workerKind,
      status: job.status,
      queuedAt: job.queuedAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      message: job.message,
    };
    const receiptPayload = {
      jobId: job.id,
      runnerId: job.runnerId,
      workerKind: job.workerKind,
      runtimeBackend: job.runtimeBackend,
      sandboxProfile: 'remote-sandbox',
      handoff: {
        runtime:
          job.workerKind === 'claude-code-cli'
            ? 'claude-code'
            : job.workerKind === 'codex-cli'
              ? 'codex'
              : 'artifact-only',
        mode: job.workerKind === 'artifact-only' ? 'materialize-artifacts' : 'cli-handoff',
      },
      status: job.status,
      observedAt: job.finishedAt ?? job.startedAt ?? job.queuedAt,
      message: job.message,
    };
    const logPayload = [
      `${job.queuedAt} queued remote runner job ${job.id}`,
      `${job.startedAt ?? job.queuedAt} started ${job.workerKind} handoff on ${job.runtimeBackend}`,
      `${job.finishedAt ?? job.queuedAt} finished with status ${job.status}`,
      '',
    ].join('\n');
    const tracePayload = {
      jobId: job.id,
      spans: [
        { name: 'remote-runner.queue', at: job.queuedAt },
        { name: 'remote-runner.start', at: job.startedAt ?? job.queuedAt },
        { name: 'remote-runner.finish', at: job.finishedAt ?? job.queuedAt, status: job.status },
      ],
    };
    const manifestArtifact = this.remoteRunnerArtifact(manifestPath, 'manifest', manifestPayload);
    const receiptArtifact = this.remoteRunnerArtifact(receiptPath, 'evidence', receiptPayload);
    const logArtifact = this.remoteRunnerArtifact(logPath, 'log', logPayload);
    const traceArtifact = this.remoteRunnerArtifact(tracePath, 'trace', tracePayload);
    const next: LoopRemoteRunnerJob = {
      ...job,
      artifacts: [
        manifestArtifact,
        receiptArtifact,
        logArtifact,
        traceArtifact,
        ...job.artifacts.filter(
          (item) => ![manifestPath, receiptPath, logPath, tracePath].includes(item.path),
        ),
      ],
    };

    await this.writeJson(this.toLoopsStorePath(manifestPath), manifestPayload);
    await this.writeJson(this.toLoopsStorePath(receiptPath), receiptPayload);
    await this.writeText(this.toLoopsStorePath(logPath), logPayload);
    await this.writeJson(this.toLoopsStorePath(tracePath), tracePayload);
    await this.writeJson(`${jobStoreRoot}/job.json`, next);
    await this.writeJson(`runs/${job.runnerId}/jobs/${job.id}.json`, next);
    await this.appendLog({
      type: 'REMOTE_RUNNER_JOB_RECORDED',
      runner: job.runnerId,
      job: job.id,
      issue: job.issueId,
      shard: job.shardId,
      status: job.status,
      artifactRoot: job.artifactRoot,
    });
    return next;
  }

  private remoteRunnerArtifact(
    pathName: string,
    kind: LoopRemoteRunnerJob['artifacts'][number]['kind'],
    payload: unknown,
  ): LoopRemoteRunnerJob['artifacts'][number] {
    const bytes =
      typeof payload === 'string'
        ? Buffer.from(payload, 'utf8')
        : Buffer.from(`${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    return {
      path: pathName,
      kind,
      sizeBytes: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
  }

  async writeMcpExecutionAudit(
    record: Omit<LoopMcpExecutionAuditRecord, 'artifactRef'>,
  ): Promise<LoopMcpExecutionAuditRecord> {
    await this.ensureInitialized();
    const safeAuditRef = record.auditRef.replace(/[^a-zA-Z0-9._-]/g, '-');
    const artifactRef = `.loops/mcp-audits/${record.providerId}/${safeAuditRef}.json`;
    const next: LoopMcpExecutionAuditRecord = {
      ...record,
      artifactRef,
    };

    await this.writeJson(this.toLoopsStorePath(artifactRef), next);
    await this.appendLog({
      type: 'MCP_PROVIDER_EXECUTION_AUDIT',
      auditRef: record.auditRef,
      artifactRef,
      provider: record.providerId,
      action: record.action,
      outcome: record.outcome,
      toolCount: record.toolCount,
    });
    return next;
  }

  async writeCiCheckPublication(
    record: Omit<LoopCiCheckPublicationRecord, 'artifactRef'>,
  ): Promise<LoopCiCheckPublicationRecord> {
    await this.ensureInitialized();
    const safeHeadSha = (record.headSha ?? 'no-head-sha').replace(/[^a-zA-Z0-9._-]/g, '-');
    const safePublishedAt = record.publishedAt.replace(/[^a-zA-Z0-9._-]/g, '-');
    const artifactRef = `.loops/ci-checks/${record.integrationId}/publications/${safeHeadSha}-${safePublishedAt}.json`;
    const next: LoopCiCheckPublicationRecord = {
      ...record,
      artifactRef,
      workPackageCommitMap: record.workPackageCommitMap ?? [],
    };
    const indexRef = `.loops/ci-checks/${record.integrationId}/publications/index.json`;
    const existingIndex = (await this.readOptionalJson<LoopCiCheckPublicationIndex>(
      this.toLoopsStorePath(indexRef),
    )) ?? {
      integrationId: record.integrationId,
      latest: next,
      entries: [],
      updatedAt: record.publishedAt,
    };
    const entries = [
      next,
      ...existingIndex.entries.filter((entry) => entry.artifactRef !== next.artifactRef),
    ].slice(0, 50);
    const index: LoopCiCheckPublicationIndex = {
      integrationId: record.integrationId,
      latest: next,
      entries,
      updatedAt: record.publishedAt,
    };

    await this.writeJson(this.toLoopsStorePath(artifactRef), next);
    await this.writeJson(this.toLoopsStorePath(indexRef), index);
    await this.appendLog({
      type: 'CI_CHECK_PUBLICATION_RECORDED',
      integration: record.integrationId,
      provider: record.provider,
      headSha: record.headSha,
      checkRunId: record.checkRunId,
      outcome: record.outcome,
      artifactRef,
      indexRef,
    });
    return next;
  }

  async readCiCheckPublications(integrationId: string): Promise<LoopCiCheckPublicationIndex> {
    await this.ensureInitialized();
    const indexRef = `.loops/ci-checks/${integrationId}/publications/index.json`;
    const index = (await this.readOptionalJson<LoopCiCheckPublicationIndex>(
      this.toLoopsStorePath(indexRef),
    )) ?? {
      integrationId,
      entries: [],
    };
    const entries = index.entries.map((entry) => ({
      ...entry,
      workPackageCommitMap: entry.workPackageCommitMap ?? [],
    }));
    return {
      ...index,
      latest: index.latest
        ? {
            ...index.latest,
            workPackageCommitMap: index.latest.workPackageCommitMap ?? [],
          }
        : undefined,
      entries,
    };
  }

  async writeRecipeAdminAction(
    record: LoopRecipeAdminActionRecord,
  ): Promise<LoopRecipeAdminActionResponse> {
    await this.ensureInitialized();
    const safeTenant = (record.tenantId ?? record.teamId ?? 'workspace').replace(
      /[^a-zA-Z0-9._-]/g,
      '-',
    );
    const safeId = record.id.replace(/[^a-zA-Z0-9._-]/g, '-');
    const artifactRef = `.loops/recipe-admin/${safeTenant}/actions/${safeId}.json`;
    const next: LoopRecipeAdminActionResponse = {
      ...record,
      artifactRef,
    };

    await this.writeJson(this.toLoopsStorePath(artifactRef), next);
    await this.appendLog({
      type: 'RECIPE_ADMIN_ACTION_REQUESTED',
      action: record.actionId,
      request: record.id,
      artifactRef,
      tenant: record.tenantId,
      team: record.teamId,
      actor: record.actorId,
      blueprint: record.blueprintId,
      status: record.status,
    });
    return next;
  }

  private toLoopsStorePath(displayPath: string): string {
    return displayPath.replace(/^\.loops\//, '');
  }

  /**
   * gstack/0 P1-4: Read an arbitrary governance file for cross-workspace
   * learning index and approval workflow data.
   */
  async readGovernanceFile<T>(relativePath: string): Promise<T | undefined> {
    return this.readOptionalJson<T>(relativePath);
  }

  /**
   * gstack/0 P1-4: Write an arbitrary governance file for cross-workspace
   * learning index and approval workflow persistence.
   */
  async writeGovernanceFile(relativePath: string, data: unknown): Promise<void> {
    await this.writeJson(relativePath, data);
  }

  async readLearningIndex(): Promise<LoopLearningIndex | undefined> {
    return this.readOptionalJson<LoopLearningIndex>('learnings/cross-workspace-index.json');
  }

  async runLearningIndexWorker(generatedAt = new Date().toISOString()): Promise<LoopLearningIndex> {
    await this.ensureInitialized();
    const learnings = await this.readRecentLearnings(1000, { recallScope: 'cross-workspace' });
    const artifactRef = '.loops/learnings/cross-workspace-index.json';
    const fingerprintCounts = new Map<string, number>();
    for (const learning of learnings) {
      if (!learning.fingerprint) continue;
      fingerprintCounts.set(
        learning.fingerprint,
        (fingerprintCounts.get(learning.fingerprint) ?? 0) + 1,
      );
    }

    const index: LoopLearningIndex = {
      generatedAt,
      artifactRef,
      summary: {
        total: learnings.length,
        workspaces: new Set(learnings.map((learning) => learning.workspaceId)).size,
        repos: new Set(learnings.map((learning) => learning.repo).filter(Boolean)).size,
        duplicateFingerprints: [...fingerprintCounts.values()].filter((count) => count > 1).length,
        reusable: learnings.filter((learning) => Boolean(learning.lastUsedAt)).length,
      },
      entries: learnings.map((learning) => ({
        learningId: learning.id,
        workspaceId: learning.workspaceId,
        repo: learning.repo,
        kind: learning.kind,
        fingerprint: learning.fingerprint,
        tags: learning.tags ?? [],
        confidence: learning.confidence,
        evidenceIds: learning.evidenceIds,
        recallCount: learning.lastUsedAt ? 1 : 0,
        lastRecalledAt: learning.lastUsedAt,
        createdAt: learning.createdAt,
      })),
    };

    await this.writeJson('learnings/cross-workspace-index.json', index);
    await this.writeText('learnings/cross-workspace-index.md', this.renderLearningIndex(index));
    await this.appendLog({
      type: 'LEARNING_INDEX_WORKER',
      status: 'materialized',
      artifactRef,
      total: index.summary.total,
      workspaces: index.summary.workspaces,
      duplicateFingerprints: index.summary.duplicateFingerprints,
      generatedAt,
    });
    return index;
  }

  async runLearningAutoMergeWorker(createdAt = new Date().toISOString()) {
    const governance = await this.readLearningGovernance();
    const learnings = await this.readRecentLearnings(100);
    const existingKeys = new Set([
      ...governance.merges.map((item) => `${item.sourceLearningId}->${item.targetLearningId}`),
      ...(governance.autoMergeCandidates ?? []).map(
        (item) => `${item.sourceLearningId}->${item.targetLearningId}`,
      ),
    ]);
    const candidates = [...(governance.autoMergeCandidates ?? [])];

    for (const learning of learnings) {
      const targetLearningId = learning.similarLearningIds?.[0];
      if (!targetLearningId) continue;
      const key = `${learning.id}->${targetLearningId}`;
      if (existingKeys.has(key)) continue;
      existingKeys.add(key);
      candidates.push({
        sourceLearningId: learning.id,
        targetLearningId,
        status: 'pending-approval' as const,
        reason: `Similarity suggestion from fingerprint ${learning.fingerprint ?? 'unknown'}.`,
        createdAt,
      });
    }

    const agedLearningIds = new Set(
      learnings
        .filter((learning) => {
          const ageDays =
            (new Date(createdAt).getTime() - new Date(learning.createdAt).getTime()) / 86400000;
          return ageDays >= 90 && learning.confidence < 0.3;
        })
        .map((learning) => learning.id),
    );
    const deprecated = [
      ...(governance.deprecated ?? []).filter((item) => !agedLearningIds.has(item.learningId)),
      ...[...agedLearningIds].map((learningId) => ({
        learningId,
        actor: 'learning-aging-worker',
        reason:
          'Deprecated automatically by aging policy: older than 90 days and confidence below 0.3.',
        createdAt,
      })),
    ];

    const next = { ...governance, autoMergeCandidates: candidates, deprecated };
    await this.writeJson('learning-governance.json', next);
    await this.appendLog({
      type: 'LEARNING_AUTO_MERGE_WORKER',
      status: 'pending-approval',
      payload: {
        added: candidates.length - (governance.autoMergeCandidates ?? []).length,
        deprecated: agedLearningIds.size,
        total: candidates.length,
      },
    });
    return next;
  }

  async readDeliveryGovernance(issueId: string): Promise<LoopDeliveryGovernance> {
    return (
      (await this.readOptionalJson<LoopDeliveryGovernance>(
        `runs/${issueId}/delivery-governance.json`,
      )) ?? {
        workflowDefaults: [],
        reviewGateOverrides: [],
        runtimeOverrides: [],
        secondOpinionResolutions: [],
      }
    );
  }

  async governDelivery(input: {
    issueId: string;
    request: LoopDeliveryGovernanceRequest;
    createdAt?: string;
  }): Promise<LoopDeliveryGovernance> {
    const updated = input.createdAt ?? new Date().toISOString();
    const governance = await this.readDeliveryGovernance(input.issueId);
    const actor = input.request.actor || 'human';
    let next: LoopDeliveryGovernance;

    switch (input.request.action) {
      case 'set-workflow-default': {
        const request = input.request;
        next = {
          ...governance,
          workflowDefaults: [
            ...governance.workflowDefaults.filter((item) => item.loopKind !== request.loopKind),
            {
              loopKind: request.loopKind,
              recipeId: request.recipeId,
              actor,
              reason: request.reason,
              updated,
            },
          ],
        };
        // gstack/0 P2-6: Also persist to shared workspace-level defaults
        // so new loops pick up the default recipe on creation.
        await this.writeWorkflowDefaults(next.workflowDefaults);
        break;
      }
      case 'set-review-gate': {
        const request = input.request;
        next = {
          ...governance,
          reviewGateOverrides: [
            ...governance.reviewGateOverrides.filter((item) => item.gateKind !== request.gateKind),
            {
              gateKind: request.gateKind,
              status: request.status,
              actor,
              reason: request.reason,
              expiresAt: request.expiresAt,
              updated,
            },
          ],
        };
        break;
      }
      case 'set-required-review-gates': {
        const request = input.request;
        next = {
          ...governance,
          requiredReviewGates: {
            gateKinds: [...new Set(request.gateKinds)],
            actor,
            reason: request.reason,
            updated,
          },
        };
        break;
      }
      case 'set-second-opinion-policy':
        next = {
          ...governance,
          secondOpinionPolicy: {
            requiredForRelease: input.request.requiredForRelease,
            conflictHumanGate: input.request.conflictHumanGate,
            actor,
            reason: input.request.reason,
            updated,
          },
        };
        break;
      case 'record-release-canary':
        next = {
          ...governance,
          releaseCanary: {
            status: input.request.status,
            environment: input.request.environment,
            environmentOwner: input.request.environmentOwner,
            targetUrl: input.request.targetUrl,
            rollbackNote: input.request.rollbackNote,
            actor,
            reason: input.request.reason,
            updated,
          },
        };
        break;
      case 'record-runtime-override':
        next = {
          ...governance,
          runtimeOverrides: [
            ...governance.runtimeOverrides,
            {
              id: `runtime-override-${randomUUID()}`,
              scope: input.request.scope,
              actor,
              reason: input.request.reason,
              expiresAt: input.request.expiresAt,
              updated,
            },
          ],
        };
        break;
      case 'set-browser-qa-session-policy':
        next = {
          ...governance,
          browserQaSessionPolicy: {
            authMode: input.request.authMode,
            testAccountRef: input.request.testAccountRef,
            actor,
            reason: input.request.reason,
            updated,
          },
        };
        break;
      case 'set-learning-policy':
        next = {
          ...governance,
          learningPolicy: {
            dedupeScope: input.request.dedupeScope,
            autoMergeApproval: input.request.autoMergeApproval,
            actor,
            reason: input.request.reason,
            updated,
          },
        };
        break;
      // gstack/0 P1-5: Record second opinion conflict resolution with
      // audit evidence so every human decision is tracked.
      case 'resolve-second-opinion-conflict':
        next = {
          ...governance,
          secondOpinionResolutions: [
            ...(governance.secondOpinionResolutions ?? []),
            {
              id: `so-resolve-${input.issueId}-${Date.now()}`,
              resolution: input.request.resolution,
              conflictFingerprint: input.request.conflictFingerprint,
              actor,
              reason: input.request.reason,
              updated,
            },
          ],
        };
        break;
    }

    await this.writeJson(`runs/${input.issueId}/delivery-governance.json`, next);
    await this.writeText(
      `runs/${input.issueId}/delivery-governance.md`,
      this.renderDeliveryGovernance(next),
    );
    await this.appendLog({
      type: 'DELIVERY_GOVERNANCE',
      loop: input.issueId,
      action: input.request.action,
      actor,
    });
    return next;
  }

  async governLearning(input: {
    learningId: string;
    request: LoopLearningGovernanceRequest;
    createdAt?: string;
  }): Promise<LoopLearningGovernance> {
    const createdAt = input.createdAt ?? new Date().toISOString();
    const governance = await this.readLearningGovernance();
    const actor = input.request.actor || 'human';
    const reason = input.request.reason;
    let next: LoopLearningGovernance;

    switch (input.request.action) {
      case 'dismiss':
        next = {
          ...governance,
          dismissed: [
            ...governance.dismissed.filter((item) => item.learningId !== input.learningId),
            { learningId: input.learningId, actor, reason, createdAt },
          ],
        };
        break;
      case 'merge':
        next = this.addLearningMerge(governance, {
          sourceLearningId: input.learningId,
          targetLearningId: input.request.targetLearningId ?? input.learningId,
          actor,
          reason,
          createdAt,
        });
        break;
      case 'approve-merge': {
        const candidate = governance.autoMergeCandidates.find(
          (item) =>
            item.sourceLearningId === input.learningId &&
            (!input.request.targetLearningId ||
              item.targetLearningId === input.request.targetLearningId),
        );
        const targetLearningId =
          input.request.targetLearningId ?? candidate?.targetLearningId ?? input.learningId;
        const approvedCandidate = {
          sourceLearningId: input.learningId,
          targetLearningId,
          status: 'approved' as const,
          reason: reason ?? candidate?.reason ?? 'Approved from learning governance queue.',
          createdAt,
        };
        const withCandidate = {
          ...governance,
          autoMergeCandidates: this.upsertLearningGovernanceCandidate(
            governance.autoMergeCandidates,
            approvedCandidate,
          ),
        };
        next = this.addLearningMerge(withCandidate, {
          sourceLearningId: input.learningId,
          targetLearningId,
          actor,
          reason,
          createdAt,
        });
        break;
      }
      case 'reject-merge': {
        const candidate = governance.autoMergeCandidates.find(
          (item) =>
            item.sourceLearningId === input.learningId &&
            (!input.request.targetLearningId ||
              item.targetLearningId === input.request.targetLearningId),
        );
        next = {
          ...governance,
          autoMergeCandidates: this.upsertLearningGovernanceCandidate(
            governance.autoMergeCandidates,
            {
              sourceLearningId: input.learningId,
              targetLearningId:
                input.request.targetLearningId ?? candidate?.targetLearningId ?? input.learningId,
              status: 'rejected',
              reason: reason ?? candidate?.reason ?? 'Rejected from learning governance queue.',
              createdAt,
            },
          ),
        };
        break;
      }
      case 'deprecate':
        next = {
          ...governance,
          deprecated: [
            ...(governance.deprecated ?? []).filter((item) => item.learningId !== input.learningId),
            { learningId: input.learningId, actor, reason, createdAt },
          ],
        };
        break;
      case 'supersede':
        next = this.addLearningMerge(
          {
            ...governance,
            superseded: [
              ...(governance.superseded ?? []).filter(
                (item) => item.sourceLearningId !== input.learningId,
              ),
              {
                sourceLearningId: input.learningId,
                targetLearningId: input.request.targetLearningId ?? input.learningId,
                actor,
                reason,
                createdAt,
              },
            ],
          },
          {
            sourceLearningId: input.learningId,
            targetLearningId: input.request.targetLearningId ?? input.learningId,
            actor,
            reason,
            createdAt,
          },
        );
        break;
    }
    await this.writeJson('learning-governance.json', next);
    return next;
  }

  async readDefaultTestCommands() {
    const config = await readLoopsRuntimeConfig();
    return config.tests.defaultCommands;
  }

  async enforceCostGuard(loop: LoopStateItem): Promise<LoopStateItem> {
    const config = (await readLoopsRuntimeConfig()).cost;
    const tripped =
      loop.costTokens >= config.tokenCapPerLoop || loop.costCalls >= config.callCapPerLoop;
    if (!tripped) return loop;

    const next: LoopStateItem = {
      ...loop,
      phase: 'PAUSED',
      paused: true,
      updated: new Date().toISOString(),
    };
    await this.appendLog({
      type: 'COST_TRIP',
      loop: loop.issueId,
      cost_tokens: loop.costTokens,
      cost_calls: loop.costCalls,
      token_cap: config.tokenCapPerLoop,
      call_cap: config.callCapPerLoop,
    });
    await this.writeNotification({
      issueId: loop.issueId,
      channel: 'web',
      kind: 'COST_GUARD_TRIPPED',
      recipient: 'ops',
      title: `Cost guard tripped: ${loop.issueId}`,
      body: `Loop was paused after reaching ${loop.costCalls}/${config.callCapPerLoop} calls and ${loop.costTokens}/${config.tokenCapPerLoop} tokens.`,
      actionHref: `/loops/${loop.issueId}`,
    });
    return next;
  }

  async resumeInterruptedLoops(): Promise<LoopsResumeResult> {
    await this.ensureInitialized();
    const state = await this.readState();
    const updatedShards: LoopsResumeResult['updatedShards'] = [];

    for (const loop of state.loops) {
      const shards = await this.readOptionalJson<LoopShard[]>(`shards/${loop.issueId}/shards.json`);
      if (!shards?.length) continue;

      let changed = false;
      const nextShards = shards.map((shard) => {
        if (shard.status !== 'IN_PROGRESS' && shard.status !== 'TIMEOUT') {
          return shard;
        }
        changed = true;
        updatedShards.push({
          issueId: loop.issueId,
          shardId: shard.id,
          from: shard.status,
          to: 'TODO',
        });
        return { ...shard, status: 'TODO' as const };
      });

      if (!changed) continue;

      await this.writeJson(`shards/${loop.issueId}/shards.json`, nextShards);
      await this.writeText(`shards/${loop.issueId}/dag.yaml`, this.renderDag(nextShards));
      const nextState: LoopStateItem = {
        ...loop,
        shardsInProgress: 0,
        updated: new Date().toISOString(),
        paused: false,
      };
      await this.upsertState(nextState);
      await this.appendLog({
        type: 'HUMAN_INTERVENE',
        loop: loop.issueId,
        action: 'resume',
        reset_shards: updatedShards
          .filter((item) => item.issueId === loop.issueId)
          .map((item) => item.shardId),
      });
    }

    return {
      resumed: updatedShards.length,
      updatedShards,
    };
  }

  async writeIssue(input: {
    issue: LoopIssue;
    intake: LoopIntake;
    state: LoopStateItem;
    rawPayload: unknown;
    workflowRecipe?: LoopWorkflowRecipe;
  }) {
    await this.ensureInitialized();
    await this.writeJson(`issues/${input.issue.id}.json`, input.issue);
    await this.writeText(`issues/${input.issue.id}.md`, this.renderIssueMarkdown(input.issue));
    await this.writeJson(`intakes/${input.intake.id}.json`, input.intake);
    await this.writeText(
      `intakes/${input.intake.id}.md`,
      this.renderIntakeMarkdown(input.intake, input.issue),
    );
    await this.writeJson(`intakes/${input.intake.id}.raw.json`, input.rawPayload);
    if (input.workflowRecipe) {
      await this.writeJson(
        `runs/${input.issue.id}/workflow-recipe.snapshot.json`,
        input.workflowRecipe,
      );
    }
    await this.upsertState(input.state);
    await this.appendLog({
      type: 'INTAKE_RECEIVED',
      source: 'web',
      intake: input.intake.id,
      submitter: input.issue.submitterId,
    });
    await this.appendLog({
      type: 'ISSUE_NORMALIZED',
      issue: input.issue.id,
      intake: input.intake.id,
      target_repo: input.issue.targetRepo,
    });
    await this.writeNotification({
      issueId: input.issue.id,
      channel: 'web',
      kind: 'ISSUE_RECEIVED',
      recipient: input.issue.submitterId,
      title: `Issue received: ${input.issue.title}`,
      body: `Issue ${input.issue.id} has been normalized and queued for planning.`,
      actionHref: `/loops/${input.issue.id}`,
    });
  }

  async writeSpec(issue: LoopIssue, spec: LoopSpec, state: LoopStateItem) {
    await fs.mkdir(path.join(this.root, 'specs', issue.id), { recursive: true });
    await this.writeJson(`specs/${issue.id}/spec.${spec.version}.json`, spec);
    await this.writeText(`specs/${issue.id}/spec.${spec.version}.md`, spec.body);
    await this.writeJson(`issues/${issue.id}.json`, {
      ...issue,
      status: this.issueStatusForSpec(spec, state),
      updated: state.updated,
    });
    await this.upsertState(state);
    await this.appendLog({
      type: 'SPEC_STATE',
      issue: issue.id,
      spec: spec.id,
      to: spec.status,
    });
    if (spec.status === 'DRAFT') {
      await this.writeNotification({
        issueId: issue.id,
        channel: 'web',
        kind: 'SPEC_REVIEW_REQUESTED',
        recipient: issue.submitterId,
        title: `Spec review requested: ${issue.title}`,
        body: `Spec ${spec.version} is ready for human review before decomposition.`,
        actionHref: `/loops/${issue.id}`,
      });
    }
  }

  async writeShards(input: {
    issue: LoopIssue;
    spec: LoopSpec;
    shards: LoopShard[];
    testMatrix: LoopTestMatrix;
    annotations: LoopAnnotation[];
    state: LoopStateItem;
  }) {
    await fs.mkdir(path.join(this.root, 'shards', input.issue.id), {
      recursive: true,
    });
    await this.writeJson(`shards/${input.issue.id}/shards.json`, input.shards);
    await this.writeText(`shards/${input.issue.id}/dag.yaml`, this.renderDag(input.shards));
    await Promise.all(
      input.shards.map((shard) =>
        this.writeText(`shards/${input.issue.id}/${shard.id}.md`, this.renderShardMarkdown(shard)),
      ),
    );
    await this.writeJson(`tests/${input.issue.id}/matrix.json`, input.testMatrix);
    await this.writeText(
      `tests/${input.issue.id}/matrix.md`,
      this.renderTestMatrix(input.testMatrix),
    );
    await this.writeJson(`annotations/${input.issue.id}.json`, input.annotations);
    await this.writeText(
      `annotations/${input.issue.id}.yaml`,
      this.renderAnnotations(input.annotations),
    );
    await this.upsertState(input.state);
    await this.appendLog({
      type: 'TEST_MATRIX',
      issue: input.issue.id,
      spec: input.spec.id,
      required_count: input.testMatrix.requiredTests.length,
    });
    await this.appendLog({
      type: 'ANNOTATE',
      issue: input.issue.id,
      count: input.annotations.length,
    });
    await this.writeNotification({
      issueId: input.issue.id,
      channel: 'web',
      kind: 'LOOP_STARTED',
      recipient: input.issue.submitterId,
      title: `Loop implementation started: ${input.issue.title}`,
      body: `${input.shards.length} shards have been generated and are ready for implementation.`,
      actionHref: `/loops/${input.issue.id}`,
    });
  }

  async writeTestRecord(input: {
    issueId: string;
    shardId: string;
    record: LoopTestRecord;
    annotations: LoopAnnotation[];
    shards: LoopShard[];
    state: LoopStateItem;
  }) {
    const recordDir = `tests/${input.issueId}/records`;
    await this.writeJson(`${recordDir}/${input.record.id}.json`, input.record);
    await this.writeText(`${recordDir}/${input.record.id}.md`, this.renderTestRecord(input.record));
    await this.writeJson(`annotations/${input.issueId}.json`, input.annotations);
    await this.writeText(
      `annotations/${input.issueId}.yaml`,
      this.renderAnnotations(input.annotations),
    );
    await this.writeJson(`shards/${input.issueId}/shards.json`, input.shards);
    await this.writeText(`shards/${input.issueId}/dag.yaml`, this.renderDag(input.shards));
    await this.upsertState(input.state);
    await this.appendLog({
      type: 'TEST_RUN',
      loop: input.issueId,
      shard: input.shardId,
      status: input.record.status,
      commands: input.record.commands.map((item) => item.command),
    });
  }

  async writeImplementationRecord(input: {
    issueId: string;
    shardId: string;
    record: LoopImplementationRecord;
    annotations: LoopAnnotation[];
    shards: LoopShard[];
    state: LoopStateItem;
  }) {
    const recordDir = `runs/${input.issueId}/${input.shardId}/round-${input.record.round}`;
    await this.writeJson(`${recordDir}/implementation.json`, input.record);
    await this.writeText(
      `${recordDir}/implementation.md`,
      this.renderImplementationRecord(input.record),
    );
    await this.writeJson(`annotations/${input.issueId}.json`, input.annotations);
    await this.writeText(
      `annotations/${input.issueId}.yaml`,
      this.renderAnnotations(input.annotations),
    );
    await this.writeJson(`shards/${input.issueId}/shards.json`, input.shards);
    await this.writeText(`shards/${input.issueId}/dag.yaml`, this.renderDag(input.shards));
    await this.upsertState(input.state);
    await this.appendLog({
      type: 'IMPLEMENTATION_RECORD',
      loop: input.issueId,
      shard: input.shardId,
      status: input.record.status,
      implementer: input.record.implementer,
      changed_files: input.record.changedFiles,
    });
  }

  async writeReviewRecord(input: {
    issueId: string;
    shardId: string;
    record: LoopReviewRecord;
    annotations: LoopAnnotation[];
    shards: LoopShard[];
    state: LoopStateItem;
  }) {
    const recordDir = `runs/${input.issueId}/${input.shardId}/round-${input.record.round}`;
    await this.writeJson(`${recordDir}/review.json`, input.record);
    await this.writeText(`${recordDir}/review.md`, this.renderReviewRecord(input.record));
    await this.writeJson(`${recordDir}/reviews/${input.record.id}.json`, input.record);
    await this.writeText(
      `${recordDir}/reviews/${input.record.id}.md`,
      this.renderReviewRecord(input.record),
    );
    await this.writeJson(`annotations/${input.issueId}.json`, input.annotations);
    await this.writeText(
      `annotations/${input.issueId}.yaml`,
      this.renderAnnotations(input.annotations),
    );
    await this.writeJson(`shards/${input.issueId}/shards.json`, input.shards);
    await this.writeText(`shards/${input.issueId}/dag.yaml`, this.renderDag(input.shards));
    await this.upsertState(input.state);
    await this.appendLog({
      type: 'REVIEW_RECORD',
      loop: input.issueId,
      shard: input.shardId,
      verdict: input.record.verdict,
      reviewer: input.record.reviewer,
    });
    if (input.state.phase === 'PHASE_6_CONVERGE') {
      await this.writeNotification({
        issueId: input.issueId,
        channel: 'web',
        kind: 'CONVERGENCE_READY',
        recipient: input.record.reviewer,
        title: `Loop ready to converge: ${input.issueId}`,
        body: 'All shards are marked DONE and the loop is ready for convergence review.',
        actionHref: `/loops/${input.issueId}`,
      });
    }
  }

  async writeShardProgress(input: {
    issueId: string;
    shardId: string;
    from?: string;
    to: string;
    actor: string;
    shards: LoopShard[];
    state: LoopStateItem;
    annotations?: LoopAnnotation[];
  }) {
    await this.writeJson(`shards/${input.issueId}/shards.json`, input.shards);
    await this.writeText(`shards/${input.issueId}/dag.yaml`, this.renderDag(input.shards));
    if (input.annotations) {
      await this.writeJson(`annotations/${input.issueId}.json`, input.annotations);
      await this.writeText(
        `annotations/${input.issueId}.yaml`,
        this.renderAnnotations(input.annotations),
      );
    }
    await this.upsertState(input.state);
    await this.appendLog({
      type: 'SHARD_STATE',
      loop: input.issueId,
      shard: input.shardId,
      from: input.from,
      to: input.to,
      actor: input.actor,
    });
  }

  async writeGlobalReview(input: {
    issueId: string;
    record: LoopGlobalReviewRecord;
    annotations: LoopAnnotation[];
    state: LoopStateItem;
  }) {
    await this.writeJson(`runs/${input.issueId}/global-review.json`, input.record);
    await this.writeText(
      `runs/${input.issueId}/global-review.md`,
      this.renderGlobalReviewRecord(input.record),
    );
    await this.writeJson(`annotations/${input.issueId}.json`, input.annotations);
    await this.writeText(
      `annotations/${input.issueId}.yaml`,
      this.renderAnnotations(input.annotations),
    );
    await this.upsertState(input.state);
    await this.appendLog({
      type: 'GLOBAL_REVIEW',
      loop: input.issueId,
      verdict: input.record.verdict,
      reviewer: input.record.reviewer,
    });
  }

  async writeFinalize(input: {
    issue: LoopIssue;
    annotations: LoopAnnotation[];
    state: LoopStateItem;
    convergencePr: LoopConvergencePr;
    learnings?: LoopLearning[];
  }) {
    await this.writeJson(`annotations/${input.issue.id}.json`, input.annotations);
    await this.writeText(
      `annotations/${input.issue.id}.yaml`,
      this.renderAnnotations(input.annotations),
    );
    await this.writeJson(`runs/${input.issue.id}/convergence-pr.json`, input.convergencePr);
    await this.writeText(`runs/${input.issue.id}/convergence-pr.md`, input.convergencePr.prBody);
    if (input.learnings?.length) {
      const learnings = input.learnings.map(enrichLoopLearning);
      await this.writeJson(`learnings/${input.issue.id}.json`, learnings);
      await this.writeText(`learnings/${input.issue.id}.md`, this.renderLearnings(learnings));
    }
    await this.writeJson(`issues/${input.issue.id}.json`, {
      ...input.issue,
      status: 'CLOSED',
      updated: input.state.updated,
    });
    await this.upsertState(input.state);
    await this.appendLog({
      type: 'FINAL_ANNOTATE',
      loop: input.issue.id,
      status: input.convergencePr.status,
      pr: input.convergencePr.id,
    });
  }

  browserQaArtifactPaths(issueId: string, reportId: string) {
    const relativeDir = `runs/${issueId}/browser-qa/${reportId}`;
    const baselineRef = `.loops/runs/${issueId}/browser-qa/baseline-page-load.png`;
    return {
      screenshotRef: `.loops/${relativeDir}/screenshot.png`,
      screenshotPath: path.join(this.root, relativeDir, 'screenshot.png'),
      traceRef: `.loops/${relativeDir}/trace.zip`,
      tracePath: path.join(this.root, relativeDir, 'trace.zip'),
      baselineRef,
      baselinePath: path.join(this.root, 'runs', issueId, 'browser-qa', 'baseline-page-load.png'),
      diffRef: `.loops/${relativeDir}/visual-diff.png`,
      diffPath: path.join(this.root, relativeDir, 'visual-diff.png'),
      handoffRef: `.loops/${relativeDir}/handoff.json`,
      handoffPath: path.join(this.root, relativeDir, 'handoff.json'),
    };
  }

  async readBrowserQaReports(issueId: string): Promise<LoopBrowserQaReport[]> {
    await this.ensureInitialized();
    const dir = path.join(this.root, 'runs', issueId, 'browser-qa');
    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
        this.log('warn', '[Loops] unable to read browser QA reports', {
          issueId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return [];
    }
    const reports = await Promise.all(
      entries
        .filter((entry) => entry.endsWith('.json'))
        .map((entry) =>
          this.readOptionalJson<LoopBrowserQaReport>(`runs/${issueId}/browser-qa/${entry}`),
        ),
    );
    return reports
      .filter((report): report is LoopBrowserQaReport => Boolean(report))
      .sort((a, b) => b.created.localeCompare(a.created));
  }

  async writeBrowserQaReport(report: LoopBrowserQaReport): Promise<void> {
    const base = `runs/${report.issueId}/browser-qa/${report.id}`;
    await this.writeJson(`${base}.json`, report);
    await this.writeText(`${base}.md`, this.renderBrowserQaReport(report));
    await this.appendLog({
      type: 'BROWSER_QA',
      loop: report.issueId,
      status: report.status,
      payload: {
        reportId: report.id,
        targetUrl: report.targetUrl,
        screenshotCount: report.screenshots.length,
        traceCount: report.traces?.length ?? 0,
        traces: report.traces ?? [],
        visualDiffs: report.visualDiffs ?? [],
        handoffs: report.handoffs ?? [],
      },
    });
  }

  async writeSecondOpinion(report: LoopSecondOpinion): Promise<void> {
    const issueId = report.id.replace(/-second-opinion$/, '');
    await this.writeJson(`runs/${issueId}/second-opinion.json`, report);
    await this.writeText(`runs/${issueId}/second-opinion.md`, this.renderSecondOpinion(report));
    await this.appendLog({
      type: 'SECOND_OPINION',
      loop: issueId,
      status: report.status,
      payload: {
        primary: report.primary.status,
        secondary: report.secondary.status,
        conflicts: report.comparison.conflictCount,
      },
    });
  }

  async writeIntervention(input: {
    issueId: string;
    action: string;
    actor: string;
    state: LoopStateItem;
    shards?: LoopShard[];
    annotations?: LoopAnnotation[];
    shardId?: string;
    notes?: string;
  }) {
    if (input.shards) {
      await this.writeJson(`shards/${input.issueId}/shards.json`, input.shards);
      await this.writeText(`shards/${input.issueId}/dag.yaml`, this.renderDag(input.shards));
    }
    if (input.annotations) {
      await this.writeJson(`annotations/${input.issueId}.json`, input.annotations);
      await this.writeText(
        `annotations/${input.issueId}.yaml`,
        this.renderAnnotations(input.annotations),
      );
    }
    await this.upsertState(input.state);
    await this.appendLog({
      type: 'HUMAN_INTERVENE',
      loop: input.issueId,
      action: input.action,
      actor: input.actor,
      shard: input.shardId,
      notes: input.notes,
    });
    await this.writeNotification({
      issueId: input.issueId,
      channel: 'web',
      kind: 'HUMAN_INTERVENTION',
      recipient: input.actor,
      title: `Human intervention: ${input.action}`,
      body: input.shardId
        ? `${input.actor} performed ${input.action} on ${input.shardId}.`
        : `${input.actor} performed ${input.action} on the loop.`,
      actionHref: `/loops/${input.issueId}`,
    });
  }

  async writeNotification(input: Omit<LoopNotification, 'id' | 'created' | 'status'>) {
    const created = new Date().toISOString();
    let notification: LoopNotification = {
      ...input,
      id: `notification-${input.issueId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      status: 'RECORDED',
      created,
    };
    notification = {
      ...notification,
      status: await this.notificationSender.send(notification),
    };
    await this.writeJson(`notifications/${input.issueId}/${notification.id}.json`, notification);
    await this.writeText(
      `notifications/${input.issueId}/${notification.id}.md`,
      this.renderNotification(notification),
    );
    await this.appendLog({
      type: 'NOTIFICATION_RECORDED',
      issue: input.issueId,
      channel: input.channel,
      kind: input.kind,
      recipient: input.recipient,
      status: notification.status,
    });
    return notification;
  }

  async appendLog(payload: Record<string, unknown>) {
    const entry = {
      ts: new Date().toISOString(),
      ...payload,
    };
    await fs.appendFile(path.join(this.root, 'log.jsonl'), `${JSON.stringify(entry)}\n`, 'utf8');
  }

  async upsertState(next: LoopStateItem) {
    await this.ensureInitialized();
    // Per-issue atomic write (temp + rename). This removes the lost-update
    // race the monolithic `state.json` had: two issues mutated concurrently
    // each did read-modify-write on the whole file, so the second writer
    // clobbered the first. Each issue now owns its own file.
    await this.atomicWriteJson(`state/${next.issueId}.json`, next);
  }

  intakeId(issueId: string) {
    return issueId.replace('issue-', 'intake-') + '-a';
  }

  private async readAllIssues() {
    const dir = path.join(this.root, 'issues');
    const files = await fs.readdir(dir).catch(() => []);
    const issues = await Promise.all(
      files
        .filter((file) => file.endsWith('.json'))
        .map((file) => this.readJson<LoopIssue>(`issues/${file}`)),
    );
    return issues.sort((a, b) => b.created.localeCompare(a.created));
  }

  private async readTestRecords(issueId: string) {
    const dir = path.join(this.root, 'tests', issueId, 'records');
    const files = await fs.readdir(dir).catch(() => []);
    const records = await Promise.all(
      files
        .filter((file) => file.endsWith('.json'))
        .map((file) => this.readJson<LoopTestRecord>(`tests/${issueId}/records/${file}`)),
    );
    return records.sort((a, b) => b.created.localeCompare(a.created));
  }

  private async readImplementationRecords(issueId: string) {
    return this.readRunRecords<LoopImplementationRecord>(issueId, 'implementation.json');
  }

  private async readReviewRecords(issueId: string) {
    return this.readRunRecords<LoopReviewRecord>(issueId, 'review.json', 'reviews');
  }

  private async readRunRecords<T extends { created: string; id?: string }>(
    issueId: string,
    filename: string,
    historyDir?: string,
  ) {
    const issueDir = path.join(this.root, 'runs', issueId);
    const shardIds = await fs.readdir(issueDir).catch(() => []);
    const recordPaths: string[] = [];

    for (const shardId of shardIds) {
      const shardDir = path.join(issueDir, shardId);
      const rounds = await fs.readdir(shardDir).catch(() => []);
      for (const round of rounds.filter((item) => item.startsWith('round-'))) {
        const recordPath = path.join(shardDir, round, filename);
        if (await this.exists(recordPath)) {
          recordPaths.push(`runs/${issueId}/${shardId}/${round}/${filename}`);
        }
        if (historyDir) {
          const historyPath = path.join(shardDir, round, historyDir);
          const historyFiles = await fs.readdir(historyPath).catch(() => []);
          recordPaths.push(
            ...historyFiles
              .filter((file) => file.endsWith('.json'))
              .map((file) => `runs/${issueId}/${shardId}/${round}/${historyDir}/${file}`),
          );
        }
      }
    }

    const records = await Promise.all(
      recordPaths.map((recordPath) => this.readJson<T>(recordPath)),
    );
    const deduped = new Map<string, T>();
    for (const record of records) {
      deduped.set(record.id ?? `${record.created}-${deduped.size}`, record);
    }
    return [...deduped.values()].sort((a, b) => b.created.localeCompare(a.created));
  }

  private async readState(): Promise<StateFile> {
    await this.ensureInitialized();
    const byIssue = new Map<string, LoopStateItem>();
    // Source of truth: per-issue state files.
    const files = await fs.readdir(path.join(this.root, 'state')).catch(() => [] as string[]);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const loop = await this.readOptionalJson<LoopStateItem>(`state/${file}`);
      if (loop?.issueId) {
        byIssue.set(loop.issueId, loop);
      }
    }
    // Lazy migration: legacy monolithic `state.json` entries are included only
    // for issues that have not yet been written as a per-issue file. Once an
    // issue is upserted it lives in `state/<id>.json` and shadows the legacy
    // entry.
    const legacy = await this.readOptionalJson<StateFile>('state.json');
    if (legacy?.loops) {
      for (const loop of legacy.loops) {
        if (loop.issueId && !byIssue.has(loop.issueId)) {
          byIssue.set(loop.issueId, loop);
        }
      }
    }
    return { loops: [...byIssue.values()] };
  }

  private inspectShardState(loop: LoopStateItem, shards: LoopShard[], problems: string[]) {
    if (shards.length !== loop.shardsTotal) {
      problems.push(
        `shard count mismatch for ${loop.issueId}: state=${loop.shardsTotal}, file=${shards.length}`,
      );
    }

    const done = shards.filter((shard) => shard.status === 'DONE').length;
    if (done !== loop.shardsDone) {
      problems.push(
        `shardsDone mismatch for ${loop.issueId}: state=${loop.shardsDone}, file=${done}`,
      );
    }

    const inProgress = shards.filter((shard) => shard.status === 'IN_PROGRESS').length;
    if (inProgress !== loop.shardsInProgress) {
      problems.push(
        `shardsInProgress mismatch for ${loop.issueId}: state=${loop.shardsInProgress}, file=${inProgress}`,
      );
    }
  }

  private async inspectAnnotationState(
    loop: LoopStateItem,
    annotations: LoopAnnotation[],
    problems: string[],
  ) {
    const shards =
      (await this.readOptionalJson<LoopShard[]>(`shards/${loop.issueId}/shards.json`)) ?? [];
    const spec =
      loop.specVersion === 'v0'
        ? undefined
        : await this.readOptionalJson<LoopSpec>(
            `specs/${loop.issueId}/spec.${loop.specVersion}.json`,
          );
    const requiredTargets = new Set([loop.issueId, ...shards.map((shard) => shard.id)]);
    if (spec) requiredTargets.add(spec.id);

    for (const target of requiredTargets) {
      if (!annotations.some((annotation) => annotation.target === target)) {
        problems.push(`missing annotation target ${target} for ${loop.issueId}`);
      }
    }

    if (loop.finalized || loop.phase === 'CLOSED') {
      await this.inspectFinalAnnotations(loop, annotations, problems);
    }
  }

  private async inspectFinalAnnotations(
    loop: LoopStateItem,
    annotations: LoopAnnotation[],
    problems: string[],
  ) {
    const matrix = await this.readOptionalJson<LoopTestMatrix>(`tests/${loop.issueId}/matrix.json`);
    const globalReview = await this.readOptionalJson<LoopGlobalReviewRecord>(
      `runs/${loop.issueId}/global-review.json`,
    );
    const convergencePr = await this.readOptionalJson<LoopConvergencePr>(
      `runs/${loop.issueId}/convergence-pr.json`,
    );
    const finalTargets = [matrix?.id, globalReview?.id, convergencePr?.id].filter(
      (target): target is string => Boolean(target),
    );

    if (!globalReview) {
      problems.push(`missing global review for finalized loop ${loop.issueId}`);
    }
    if (!convergencePr) {
      problems.push(`missing convergence PR record for finalized loop ${loop.issueId}`);
    }
    for (const target of finalTargets) {
      const annotation = annotations.find((item) => item.target === target);
      if (!annotation) {
        problems.push(`missing final annotation target ${target} for ${loop.issueId}`);
      } else if (
        annotation.verdict !== 'pass' ||
        annotation.coverage !== 'full' ||
        annotation.testStatus !== 'pass'
      ) {
        problems.push(`incomplete final annotation target ${target} for ${loop.issueId}`);
      }
    }

    const unfinished = annotations.filter(
      (annotation) =>
        annotation.verdict === 'unreviewed' ||
        annotation.coverage === 'partial' ||
        annotation.testStatus === 'missing',
    );
    if (unfinished.length > 0) {
      problems.push(
        `finalized loop ${loop.issueId} has unfinished annotations: ${unfinished
          .map((annotation) => annotation.target)
          .join(', ')}`,
      );
    }
  }

  private async readJson<T>(relativePath: string): Promise<T> {
    const content = await fs.readFile(path.join(this.root, relativePath), 'utf8');
    return JSON.parse(content) as T;
  }

  private async readSpecHistory(issueId: string): Promise<LoopSpecHistoryItem[]> {
    const specDir = path.join(this.root, 'specs', issueId);
    const entries = await fs.readdir(specDir).catch((error) => {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code !== 'ENOENT') {
        this.log('warn', `[Loops] unable to read spec history directory: ${issueId}`, {
          issueId,
          code,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return [];
    });
    const jsonFiles = entries.filter((entry) => /^spec\.[^.]+\.json$/.test(entry));
    const specs = await Promise.all(
      jsonFiles.map((entry) => this.readOptionalJson<LoopSpec>(`specs/${issueId}/${entry}`)),
    );

    return specs
      .filter((spec): spec is LoopSpec => Boolean(spec))
      .map((spec) => ({
        id: spec.id,
        issueId: spec.issueId,
        version: spec.version,
        status: spec.status,
        created: spec.created,
        approvedBy: spec.approvedBy,
        body: spec.body,
      }))
      .sort((a, b) => this.compareSpecVersions(a.version, b.version));
  }

  private compareSpecVersions(a: string, b: string) {
    const aNumber = /^v(\d+)$/.exec(a)?.[1];
    const bNumber = /^v(\d+)$/.exec(b)?.[1];
    if (aNumber && bNumber) {
      return Number(aNumber) - Number(bNumber);
    }
    return a.localeCompare(b);
  }

  private parseLogLine(line: string): LoopLogEntry | undefined {
    try {
      const raw = JSON.parse(line) as Record<string, unknown>;
      const ts = typeof raw.ts === 'string' ? raw.ts : '';
      const type = typeof raw.type === 'string' ? raw.type : '';
      if (!ts || !type) return undefined;
      return {
        ts,
        type,
        loop: typeof raw.loop === 'string' ? raw.loop : undefined,
        issue: typeof raw.issue === 'string' ? raw.issue : undefined,
        shard: typeof raw.shard === 'string' ? raw.shard : undefined,
        action: typeof raw.action === 'string' ? raw.action : undefined,
        status: typeof raw.status === 'string' ? raw.status : undefined,
        verdict: typeof raw.verdict === 'string' ? raw.verdict : undefined,
        payload: raw,
      };
    } catch {
      return undefined;
    }
  }

  private async exists(target: string) {
    try {
      await fs.access(target);
      return true;
    } catch {
      return false;
    }
  }

  private async readOptionalJson<T>(relativePath: string): Promise<T | undefined> {
    try {
      return await this.readJson<T>(relativePath);
    } catch (error) {
      // A genuinely missing file (ENOENT) is normal for a fresh issue; any
      // other failure means the file exists but is corrupt/unreadable, which
      // is otherwise indistinguishable from "missing" and silently degrades
      // the loop. Surface it so it can be diagnosed.
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code !== 'ENOENT') {
        this.log('warn', `[Loops] corrupt or unreadable state file: ${relativePath}`, {
          relativePath,
          code,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return undefined;
    }
  }

  private async writeJson(relativePath: string, data: unknown) {
    const target = path.join(this.root, relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  }

  /**
   * Atomic JSON write: write to a uniquely-named temp file then rename. On a
   * single filesystem `rename` is atomic, so a crash mid-write never leaves a
   * truncated state file (a reader sees either the old or the new version,
   * never a half-written one). Used for per-issue state so concurrent writers
   * on different issues cannot corrupt each other.
   */
  private async atomicWriteJson(relativePath: string, data: unknown) {
    const target = path.join(this.root, relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    const tmp = `${target}.${randomUUID().slice(0, 8)}.tmp`;
    await fs.writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    await fs.rename(tmp, target);
  }

  private async writeText(relativePath: string, content: string) {
    const target = path.join(this.root, relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content, 'utf8');
  }

  private async writeJsonIfMissing(relativePath: string, data: unknown) {
    try {
      await fs.access(path.join(this.root, relativePath));
    } catch {
      await this.writeJson(relativePath, data);
    }
  }

  private async writeTextIfMissing(relativePath: string, content: string) {
    try {
      await fs.access(path.join(this.root, relativePath));
    } catch {
      await this.writeText(relativePath, content);
    }
  }

  private renderIssueMarkdown(issue: LoopIssue) {
    return `---\nid: ${issue.id}\ntitle: ${issue.title}\nstatus: ${issue.status}\npriority: ${issue.priority}\ncreated: ${issue.created}\nsource_channel: ${issue.sourceChannel}\nsubmitter_id: ${issue.submitterId}\ntarget_repo: ${issue.targetRepo}\n---\n\n${issue.body}\n\n## Acceptance Criteria\n${issue.acceptanceCriteria.map((item) => `- [ ] ${item}`).join('\n')}\n`;
  }

  private renderBrowserQaReport(report: LoopBrowserQaReport) {
    const screenshots = report.screenshots
      .map((item) => `- ${item.label}: ${item.path}`)
      .join('\n');
    const consoleErrors = report.consoleErrors.map((item) => `- ${item}`).join('\n');
    const traces = (report.traces ?? []).map((item) => `- ${item.label}: ${item.path}`).join('\n');
    const visualDiffs = (report.visualDiffs ?? [])
      .map(
        (item) =>
          `- ${item.label}: ${item.status}${item.changedPixels === undefined ? '' : `, changedPixels ${item.changedPixels}`} (${item.actualPath}, baseline ${item.baselinePath}${item.diffPath ? `, diff ${item.diffPath}` : ''})`,
      )
      .join('\n');
    const handoffs = (report.handoffs ?? [])
      .map((item) => `- ${item.label}: ${item.path}`)
      .join('\n');
    const networkFailures = report.networkFailures
      .map((item) => `- ${item.status ?? 'unknown'} ${item.url}`)
      .join('\n');
    return `---\nid: ${report.id}\nissue: ${report.issueId}\nrunner: ${report.runner}\nstatus: ${report.status}\ntarget_url: ${report.targetUrl}\ncreated: ${report.created}\n---\n\n## Browser QA Summary\n- title: ${report.title ?? 'unknown'}\n- checked flows: ${report.checkedFlows.join(', ')}\n- command: ${report.command}\n- durationMs: ${report.durationMs}\n${report.blockedReason ? `- blocked: ${report.blockedReason}\n` : ''}\n## Screenshots\n${screenshots || 'none'}\n\n## Playwright Traces\n${traces || 'none'}\n\n## Visual Regression\n${visualDiffs || 'none'}\n\n## Browser Handoff\n${handoffs || 'none'}\n\n## Console Errors\n${consoleErrors || 'none'}\n\n## Network Failures\n${networkFailures || 'none'}\n`;
  }

  private renderSecondOpinion(report: LoopSecondOpinion) {
    const primaryFindings = report.primary.findings
      .map((item) => `- ${item.severity} ${item.fingerprint}: ${item.desc}`)
      .join('\n');
    const secondaryFindings = report.secondary.findings
      .map((item) => `- ${item.severity} ${item.fingerprint}: ${item.desc}`)
      .join('\n');
    return `---\nid: ${report.id}\nstatus: ${report.status}\nupdated: ${report.updated}\nrequired_for_release: ${report.requiredForRelease}\n---\n\n## Primary\n- reviewer: ${report.primary.reviewer}\n- status: ${report.primary.status}\n- findings: ${report.primary.findingsCount}\n- summary: ${report.primary.summary ?? 'none'}\n\n${primaryFindings || 'No primary findings.'}\n\n## Secondary\n- reviewer: ${report.secondary.reviewer}\n- status: ${report.secondary.status}\n- findings: ${report.secondary.findingsCount}\n- summary: ${report.secondary.summary ?? 'none'}\n\n${secondaryFindings || 'No secondary findings.'}\n\n## Comparison\n- agreement: ${report.comparison.agreementCount} (${report.comparison.agreementFingerprints.join(', ') || 'none'})\n- primaryOnly: ${report.comparison.primaryOnlyCount} (${report.comparison.primaryOnlyFingerprints.join(', ') || 'none'})\n- secondaryOnly: ${report.comparison.secondaryOnlyCount} (${report.comparison.secondaryOnlyFingerprints.join(', ') || 'none'})\n- conflict: ${report.comparison.conflictCount} (${report.comparison.conflictFingerprints.join(', ') || 'none'})\n`;
  }

  private renderDeliveryGovernance(governance: LoopDeliveryGovernance) {
    const workflowDefaults = governance.workflowDefaults
      .map((item) => `- ${item.loopKind}: ${item.recipeId} by ${item.actor} at ${item.updated}`)
      .join('\n');
    const reviewOverrides = governance.reviewGateOverrides
      .map(
        (item) =>
          `- ${item.gateKind}: ${item.status} by ${item.actor} at ${item.updated}${item.reason ? ` (${item.reason})` : ''}`,
      )
      .join('\n');
    const runtimeOverrides = governance.runtimeOverrides
      .map((item) => `- ${item.scope}: ${item.reason} by ${item.actor}; expires ${item.expiresAt}`)
      .join('\n');
    const requiredReviewGates = governance.requiredReviewGates
      ? `- gates: ${governance.requiredReviewGates.gateKinds.join(', ')}\n- actor: ${governance.requiredReviewGates.actor}\n- updated: ${governance.requiredReviewGates.updated}`
      : 'none';
    const secondOpinionResolutions = (governance.secondOpinionResolutions ?? [])
      .map(
        (item) =>
          `- ${item.resolution}${item.conflictFingerprint ? ` ${item.conflictFingerprint}` : ''} by ${item.actor} at ${item.updated}: ${item.reason}`,
      )
      .join('\n');
    return `---\nkind: delivery-governance\n---\n\n## Workflow Defaults\n${workflowDefaults || 'none'}\n\n## Review Gate Overrides\n${reviewOverrides || 'none'}\n\n## Required Review Gates\n${requiredReviewGates}\n\n## Second Opinion Policy\n- requiredForRelease: ${governance.secondOpinionPolicy?.requiredForRelease ?? false}\n- conflictHumanGate: ${governance.secondOpinionPolicy?.conflictHumanGate ?? false}\n- updated: ${governance.secondOpinionPolicy?.updated ?? 'none'}\n\n## Second Opinion Resolutions\n${secondOpinionResolutions || 'none'}\n\n## Release Canary\n- status: ${governance.releaseCanary?.status ?? 'not_run'}\n- environment: ${governance.releaseCanary?.environment ?? 'none'}\n- environmentOwner: ${governance.releaseCanary?.environmentOwner ?? 'none'}\n- targetUrl: ${governance.releaseCanary?.targetUrl ?? 'none'}\n- rollbackNote: ${governance.releaseCanary?.rollbackNote ?? 'none'}\n- updated: ${governance.releaseCanary?.updated ?? 'none'}\n\n## Runtime Overrides\n${runtimeOverrides || 'none'}\n\n## Browser QA Session Policy\n- authMode: ${governance.browserQaSessionPolicy?.authMode ?? 'none'}\n- testAccountRef: ${governance.browserQaSessionPolicy?.testAccountRef ?? 'none'}\n- updated: ${governance.browserQaSessionPolicy?.updated ?? 'none'}\n\n## Learning Policy\n- dedupeScope: ${governance.learningPolicy?.dedupeScope ?? 'workspace'}\n- autoMergeApproval: ${governance.learningPolicy?.autoMergeApproval ?? 'manual-only'}\n- updated: ${governance.learningPolicy?.updated ?? 'none'}\n`;
  }

  private issueStatusForSpec(spec: LoopSpec, state: LoopStateItem): LoopIssue['status'] {
    if (state.phase === 'CLOSED') {
      return spec.status === 'REJECTED' ? 'REJECTED' : 'CLOSED';
    }
    return 'IN_LOOP';
  }

  private renderIntakeMarkdown(intake: LoopIntake, issue: LoopIssue) {
    return `---\nid: ${intake.id}\nissue: ${issue.id}\nsource_channel: ${intake.sourceChannel}\nsource_kind: ${intake.sourceKind}\nraw_payload_ref: ${intake.rawPayloadRef}\nstatus: ${intake.status}\n---\n\n## 原始消息摘要\n${issue.title}\n\n## 归一化结果\n- target_repo: ${issue.targetRepo}\n- priority: ${issue.priority}\n\n## 追问与补充\n暂无\n`;
  }

  private renderShardMarkdown(shard: LoopShard) {
    return `---\nid: ${shard.id}\nspec: ${shard.specId} / v1\ntitle: ${shard.title}\nstatus: ${shard.status}\npriority: ${shard.priority}\ndepends_on: [${shard.dependsOn.join(', ')}]\nest_context: ${shard.estContext}\nest_effort: ${shard.estEffort}\n---\n\n## 目标\n${shard.title}\n\n## 实施要求\n${shard.acceptance.map((item) => `- [ ] ${item}`).join('\n')}\n\n## 测试要求\n${[...shard.testRequirements.unit, ...shard.testRequirements.integration, ...shard.testRequirements.e2e].map((item) => `- ${item}`).join('\n')}\n`;
  }

  private renderDag(shards: LoopShard[]) {
    return shards
      .map(
        (shard) =>
          `${shard.id}:\n  depends_on: [${shard.dependsOn.join(', ')}]\n  status: ${shard.status}`,
      )
      .join('\n');
  }

  private renderAnnotations(annotations: LoopAnnotation[]) {
    return annotations
      .map(
        (item) =>
          `- target: ${item.target}\n  annotator: ${item.annotator}\n  round: ${item.round}\n  impl_status: ${item.implStatus}\n  test_status: ${item.testStatus}\n  verdict: ${item.verdict}\n  coverage: ${item.coverage}\n  risk: ${item.risk}\n  notes: ${JSON.stringify(item.notes)}`,
      )
      .join('\n');
  }

  private renderTestRecord(record: LoopTestRecord) {
    const commands = record.commands
      .map(
        (item) =>
          `- \`${item.command}\` exit=${item.exitCode ?? 'null'} duration=${item.durationMs}ms`,
      )
      .join('\n');
    const coverage = record.coverage
      ? [
          record.coverage.lines !== undefined ? `- lines: ${record.coverage.lines}%` : undefined,
          record.coverage.branches !== undefined
            ? `- branches: ${record.coverage.branches}%`
            : undefined,
        ]
          .filter(Boolean)
          .join('\n')
      : '未解析到覆盖率摘要';
    const failures =
      record.failedTests.length > 0
        ? record.failedTests.map((item) => `- ${item.name}: ${item.reason}`).join('\n')
        : '无';
    const runtimeSecurityPolicy = record.runtimeSecurityPolicy
      ? [
          `- id: ${record.runtimeSecurityPolicy.id}`,
          `- shell: ${record.runtimeSecurityPolicy.shell.strategy} (${record.runtimeSecurityPolicy.shell.allowedCommands.join(', ') || 'none'})`,
          `- blocked operators: ${record.runtimeSecurityPolicy.shell.blockedOperators.join(', ')}`,
          `- network: ${record.runtimeSecurityPolicy.network.strategy}`,
          `- write: ${record.runtimeSecurityPolicy.write.strategy}/${record.runtimeSecurityPolicy.write.scope}`,
          `- approvals: ${record.runtimeSecurityPolicy.approvals.override}`,
          `- canary: ${record.runtimeSecurityPolicy.canary.strategy}/${record.runtimeSecurityPolicy.canary.status}`,
          `- canary leaks: ${record.runtimeSecurityPolicy.canary.leakedInCommands.join(', ') || 'none'}`,
        ].join('\n')
      : '未记录 runtime security policy snapshot';
    return `---\nid: ${record.id}\nscope: ${record.shardId}\nround: ${record.round}\nrunner: ${record.runner}\nreviewer: ${record.reviewer}\nstatus: ${record.status}\ncreated: ${record.created}\n---\n\n## 测试执行摘要\n${commands}\n\n## Runtime Security Policy\n${runtimeSecurityPolicy}\n\n## 覆盖率摘要\n${coverage}\n\n## 失败归因\n${failures}\n\n## 修复指令\n${record.fixInstructions.map((item) => `- ${item}`).join('\n') || '无'}\n`;
  }

  private renderTestMatrix(matrix: LoopTestMatrix) {
    const requiredTests = matrix.requiredTests
      .map(
        (item) =>
          `- [${item.required ? 'x' : ' '}] ${item.id} (${item.level}) ${item.shardId}: ${item.title}${item.command ? `\n  - command: \`${item.command}\`` : ''}`,
      )
      .join('\n');
    return `---\nid: ${matrix.id}\nissue: ${matrix.issueId}\nspec: ${matrix.specId}\nowner: ${matrix.owner}\nstatus: ${matrix.status}\ncreated: ${matrix.created}\n---\n\n## 测试矩阵说明\n${requiredTests || '无'}\n\n## 回归范围\n${matrix.regressionScope.map((item) => `- ${item}`).join('\n') || '无'}\n\n## 暂不自动化的人工验收项\n${matrix.manualAcceptance.map((item) => `- ${item}`).join('\n') || '无'}\n`;
  }

  private renderImplementationRecord(record: LoopImplementationRecord) {
    return `---\nid: ${record.id}\nscope: ${record.shardId}\nround: ${record.round}\nimplementer: ${record.implementer}\nstatus: ${record.status}\ncreated: ${record.created}\n---\n\n## 实施摘要\n${record.summary}\n\n## 变更文件\n${record.changedFiles.map((item) => `- ${item}`).join('\n') || '无'}\n\n## 备注\n${record.notes || '无'}\n`;
  }

  private renderReviewRecord(record: LoopReviewRecord) {
    const issues =
      record.issues.length > 0
        ? record.issues.map((item) => `- ${item.severity}: ${item.desc}`).join('\n')
        : '无';
    return `---\nid: ${record.id}\nshard: ${record.shardId}\nreviewer: ${record.reviewer}\nround: ${record.round}\nverdict: ${record.verdict}\ncreated: ${record.created}\n---\n\n## 审查意见\n${record.summary}\n\n## 问题\n${issues}\n\n## 修复指令\n${record.fixInstructions.map((item) => `- ${item}`).join('\n') || '无'}\n`;
  }

  private renderGlobalReviewRecord(record: LoopGlobalReviewRecord) {
    const issues =
      record.issues.length > 0
        ? record.issues.map((item) => `- ${item.severity}: ${item.desc}`).join('\n')
        : '无';
    return `---\nid: ${record.id}\nissue: ${record.issueId}\nreviewer: ${record.reviewer}\nround: ${record.round}\nverdict: ${record.verdict}\ncreated: ${record.created}\n---\n\n## 整体复查结论\n${record.summary}\n\n## 问题\n${issues}\n\n## 修复指令\n${record.fixInstructions.map((item) => `- ${item}`).join('\n') || '无'}\n`;
  }

  private renderLearnings(learnings: LoopLearning[]) {
    return learnings
      .map((learning) =>
        [
          `## ${learning.kind} · ${learning.id}`,
          '',
          `- workspace: ${learning.workspaceId}`,
          learning.repo ? `- repo: ${learning.repo}` : undefined,
          learning.fingerprint ? `- fingerprint: ${learning.fingerprint}` : undefined,
          learning.tags?.length ? `- tags: ${learning.tags.join(', ')}` : undefined,
          learning.similarLearningIds?.length
            ? `- similar: ${learning.similarLearningIds.join(', ')}`
            : undefined,
          `- confidence: ${learning.confidence}`,
          `- evidence: ${learning.evidenceIds.join(', ') || 'none'}`,
          '',
          learning.summary,
        ]
          .filter((line): line is string => typeof line === 'string')
          .join('\n'),
      )
      .join('\n\n');
  }

  private renderLearningIndex(index: LoopLearningIndex) {
    const entries = index.entries
      .map((entry) =>
        [
          `- ${entry.learningId}`,
          `  - workspace: ${entry.workspaceId}`,
          entry.repo ? `  - repo: ${entry.repo}` : undefined,
          `  - kind: ${entry.kind}`,
          entry.fingerprint ? `  - fingerprint: ${entry.fingerprint}` : undefined,
          entry.tags.length ? `  - tags: ${entry.tags.join(', ')}` : undefined,
          `  - confidence: ${entry.confidence}`,
          `  - recallCount: ${entry.recallCount}`,
          entry.lastRecalledAt ? `  - lastRecalledAt: ${entry.lastRecalledAt}` : undefined,
          `  - evidence: ${entry.evidenceIds.join(', ') || 'none'}`,
        ]
          .filter((line): line is string => typeof line === 'string')
          .join('\n'),
      )
      .join('\n');

    return `---\nkind: learning-cross-workspace-index\ngenerated: ${index.generatedAt}\nartifact: ${index.artifactRef}\n---\n\n## Summary\n- total: ${index.summary.total}\n- workspaces: ${index.summary.workspaces}\n- repos: ${index.summary.repos}\n- duplicateFingerprints: ${index.summary.duplicateFingerprints}\n- reusable: ${index.summary.reusable}\n\n## Entries\n${entries || 'none'}\n`;
  }

  private renderNotification(notification: LoopNotification) {
    return `---\nid: ${notification.id}\nissue: ${notification.issueId}\nchannel: ${notification.channel}\nkind: ${notification.kind}\nrecipient: ${notification.recipient}\nstatus: ${notification.status}\ncreated: ${notification.created}\n---\n\n## ${notification.title}\n\n${notification.body}\n\n${notification.actionHref ? `Action: ${notification.actionHref}\n` : ''}`;
  }

  private findWorkspaceRoot() {
    let current = process.env.LOOPS_WORKSPACE_ROOT || process.cwd();
    for (;;) {
      const packageJson = path.join(current, 'package.json');
      const turboJson = path.join(current, 'turbo.json');
      try {
        if (existsSync(packageJson) && existsSync(turboJson)) {
          return current;
        }
      } catch {
        return process.cwd();
      }

      const parent = path.dirname(current);
      if (parent === current) {
        return process.cwd();
      }
      current = parent;
    }
  }

  // =========================================================================
  // Schedule Trigger persistence (P1-3, R30c)
  // =========================================================================

  listScheduleTriggers(): LoopScheduleTrigger[] {
    const dir = path.join(this.root, 'triggers', 'schedules');
    try {
      const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
      return files
        .map((f) => {
          try {
            return JSON.parse(readFileSync(path.join(dir, f), 'utf8')) as LoopScheduleTrigger;
          } catch {
            return null;
          }
        })
        .filter(Boolean) as LoopScheduleTrigger[];
    } catch {
      return [];
    }
  }

  readScheduleTrigger(triggerId: string): LoopScheduleTrigger | undefined {
    const file = path.join(this.root, 'triggers', 'schedules', `${triggerId}.json`);
    try {
      return JSON.parse(readFileSync(file, 'utf8')) as LoopScheduleTrigger;
    } catch {
      return undefined;
    }
  }

  writeScheduleTrigger(trigger: LoopScheduleTrigger): void {
    const dir = path.join(this.root, 'triggers', 'schedules');
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${trigger.id}.json`);
    writeFileSync(file, `${JSON.stringify(trigger, null, 2)}\n`, 'utf8');
  }

  deleteScheduleTrigger(triggerId: string): void {
    const file = path.join(this.root, 'triggers', 'schedules', `${triggerId}.json`);
    try {
      unlinkSync(file);
    } catch {
      // already deleted
    }
  }

  nextScheduleTriggerSeq(): number {
    const triggers = this.listScheduleTriggers();
    return triggers.length + 1;
  }

  // =========================================================================
  // Trigger Execution persistence (P1-3, R30c)
  // =========================================================================

  listTriggerExecutions(triggerId: string): LoopTriggerExecution[] {
    const dir = path.join(this.root, 'triggers', 'executions', triggerId);
    try {
      const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
      return files
        .map((f) => {
          try {
            return JSON.parse(readFileSync(path.join(dir, f), 'utf8')) as LoopTriggerExecution;
          } catch {
            return null;
          }
        })
        .filter(Boolean) as LoopTriggerExecution[];
    } catch {
      return [];
    }
  }

  readTriggerExecution(executionId: string): LoopTriggerExecution | undefined {
    const allDirs = this.listAllTriggerExecutionDirs();
    for (const dir of allDirs) {
      const file = path.join(this.root, 'triggers', 'executions', dir, `${executionId}.json`);
      try {
        return JSON.parse(readFileSync(file, 'utf8')) as LoopTriggerExecution;
      } catch {
        continue;
      }
    }
    return undefined;
  }

  writeTriggerExecution(execution: LoopTriggerExecution): void {
    const dir = path.join(this.root, 'triggers', 'executions', execution.triggerId);
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${execution.id}.json`);
    writeFileSync(file, `${JSON.stringify(execution, null, 2)}\n`, 'utf8');
  }

  nextTriggerExecutionSeq(): number {
    const allDirs = this.listAllTriggerExecutionDirs();
    let count = 0;
    for (const dir of allDirs) {
      try {
        const files = readdirSync(path.join(this.root, 'triggers', 'executions', dir)).filter((f) =>
          f.endsWith('.json'),
        );
        count += files.length;
      } catch {
        // skip
      }
    }
    return count + 1;
  }

  moveToDeadLetter(execution: LoopTriggerExecution): void {
    const now = new Date().toISOString();
    const deadLetter: LoopTriggerDeadLetter = {
      executionId: execution.id,
      triggerId: execution.triggerId,
      triggerType: execution.triggerType,
      error: execution.error ?? 'Max retries exhausted',
      attempt: execution.attempt,
      inputPayload: execution.inputPayload,
      deadLetteredAt: now,
      reason: `Exhausted retries (${execution.attempt}/${execution.maxRetries})`,
    };
    const dir = path.join(this.root, 'triggers', 'dead-letters');
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${execution.id}.json`);
    writeFileSync(file, `${JSON.stringify(deadLetter, null, 2)}\n`, 'utf8');
  }

  listDeadLetters(): LoopTriggerDeadLetter[] {
    const dir = path.join(this.root, 'triggers', 'dead-letters');
    try {
      const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
      return files
        .map((f) => {
          try {
            return JSON.parse(readFileSync(path.join(dir, f), 'utf8')) as LoopTriggerDeadLetter;
          } catch {
            return null;
          }
        })
        .filter(Boolean) as LoopTriggerDeadLetter[];
    } catch {
      return [];
    }
  }

  private listAllTriggerExecutionDirs(): string[] {
    const baseDir = path.join(this.root, 'triggers', 'executions');
    try {
      return readdirSync(baseDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
    } catch {
      return [];
    }
  }

  // =========================================================================
  // Tool Registry persistence (P1-4, R31a)
  // =========================================================================

  listTools(): LoopTool[] {
    const dir = path.join(this.root, 'tools');
    try {
      const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
      return files
        .map((f) => {
          try {
            return JSON.parse(readFileSync(path.join(dir, f), 'utf8')) as LoopTool;
          } catch {
            return null;
          }
        })
        .filter(Boolean) as LoopTool[];
    } catch {
      return [];
    }
  }

  readTool(toolId: string): LoopTool | undefined {
    const file = path.join(this.root, 'tools', `${toolId}.json`);
    try {
      return JSON.parse(readFileSync(file, 'utf8')) as LoopTool;
    } catch {
      return undefined;
    }
  }

  writeTool(tool: LoopTool): void {
    const dir = path.join(this.root, 'tools');
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${tool.id}.json`);
    writeFileSync(file, `${JSON.stringify(tool, null, 2)}\n`, 'utf8');
  }

  nextToolSeq(): number {
    return this.listTools().length + 1;
  }

  // =========================================================================
  // Delivery Blueprint persistence (P1-2, R31b)
  // =========================================================================

  listBlueprints(): LoopBlueprint[] {
    const dir = path.join(this.root, 'blueprints');
    try {
      const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
      return files
        .map((f) => {
          try {
            return JSON.parse(readFileSync(path.join(dir, f), 'utf8')) as LoopBlueprint;
          } catch {
            return null;
          }
        })
        .filter(Boolean) as LoopBlueprint[];
    } catch {
      return [];
    }
  }

  readBlueprint(blueprintId: string): LoopBlueprint | undefined {
    const file = path.join(this.root, 'blueprints', `${blueprintId}.json`);
    try {
      return JSON.parse(readFileSync(file, 'utf8')) as LoopBlueprint;
    } catch {
      return undefined;
    }
  }

  writeBlueprint(blueprint: LoopBlueprint): void {
    const dir = path.join(this.root, 'blueprints');
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${blueprint.id}.json`);
    writeFileSync(file, `${JSON.stringify(blueprint, null, 2)}\n`, 'utf8');
  }

  nextBlueprintSeq(): number {
    return this.listBlueprints().length + 1;
  }

  // =========================================================================
  // Remote Runner Artifact Read (R36)
  // =========================================================================

  readRemoteRunnerArtifact(runnerId: string, jobId: string, kind: string): string | null {
    const artifactKinds: Record<string, string> = {
      manifest: `runs/${runnerId}/jobs/${jobId}/manifest.json`,
      'worker-receipt': `runs/${runnerId}/jobs/${jobId}/worker-receipt.json`,
      'worker-log': `runs/${runnerId}/jobs/${jobId}/worker.log`,
      trace: `runs/${runnerId}/jobs/${jobId}/trace.json`,
    };
    const relativePath = artifactKinds[kind];
    if (!relativePath) return null;
    try {
      return readFileSync(path.join(this.root, relativePath), 'utf8');
    } catch {
      return null;
    }
  }

  /**
   * Write a Remote Runner job artifact by relative path.
   * Creates parent directories as needed.
   */
  writeRemoteRunnerArtifact(relativePath: string, content: string): void {
    const filePath = path.join(this.root, relativePath);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, content, 'utf8');
  }

  /** gstack P2: Resolve a Browser QA artifact file path for serving inline preview. */
  resolveArtifactPath(issueId: string, artifactSubPath: string): string {
    return path.join(this.root, 'runs', issueId, 'browser-qa', artifactSubPath);
  }

  /** gstack P2: List workspace-level workflow recipe configurations. */
  async listWorkspaceRecipes(query: { limit?: number; page?: number }) {
    const limit = query.limit ?? 20;
    const page = query.page ?? 1;
    const recipes: Array<{
      id: string;
      name: string;
      version: string;
      loopKind: string;
      isDefault: boolean;
      stepCount: number;
      usageCount: number;
      blockerRate?: number;
      updatedAt: string;
    }> = [];
    // Scan .loops/delivery-governance/ for recipe configurations
    try {
      const govDir = path.join(this.root, 'delivery-governance');
      const files = await fs.readdir(govDir).catch(() => [] as string[]);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const data = JSON.parse(await fs.readFile(path.join(govDir, file), 'utf8'));
        if (data.workflowDefaults) {
          for (const [kind, recipeId] of Object.entries(data.workflowDefaults)) {
            recipes.push({
              id: `${file.replace('.json', '')}-${kind}`,
              name: `Default ${kind}`,
              version: 'v1',
              loopKind: kind,
              isDefault: true,
              stepCount: 7,
              usageCount: data.usageCount ?? 0,
              blockerRate: data.blockerRate,
              updatedAt: data.updatedAt ?? new Date().toISOString(),
            });
          }
        }
      }
    } catch {
      /* empty */
    }
    const total = recipes.length;
    const start = (page - 1) * limit;
    return { list: recipes.slice(start, start + limit), total, page, limit };
  }

  /** gstack P2: Build Loop Bench drilldown by workspace/repo/recipe dimensions. */
  async buildLoopBenchDrilldown(query: {
    workspaceId?: string;
    repo?: string;
    recipeId?: string;
    period?: string;
  }) {
    const trends = await this.readBenchTrends();
    const latest = trends.latest ?? {};
    const previous = trends.history?.[trends.history?.length - 2];
    const metrics: Array<{ key: string; label: string }> = [
      { key: 'firstPassReviewRate', label: 'First-pass review rate' },
      { key: 'secondOpinionConflictRate', label: 'Second opinion conflict rate' },
      { key: 'browserQaRegressionRate', label: 'Browser QA regression rate' },
      { key: 'releaseBlockerRate', label: 'Release blocker rate' },
      { key: 'runtimeViolationRate', label: 'Runtime violation rate' },
      { key: 'learningReuseRate', label: 'Learning reuse rate' },
      { key: 'canaryPassRate', label: 'Canary pass rate' },
    ];
    return {
      metrics: metrics.map((m) => ({
        key: m.key,
        label: m.label,
        value: latest[m.key] ?? 0,
        previousValue: previous ? previous[m.key] : undefined,
        delta: previous ? (latest[m.key] ?? 0) - (previous[m.key] ?? 0) : undefined,
        breakdown:
          query.workspaceId || query.repo
            ? [
                {
                  dimension: query.workspaceId ? 'workspace' : 'repo',
                  dimensionValue: query.workspaceId ?? query.repo ?? 'all',
                  value: latest[m.key] ?? 0,
                },
              ]
            : undefined,
      })),
      period: query.period ?? '30d',
      filters: { workspaceId: query.workspaceId, repo: query.repo, recipeId: query.recipeId },
    };
  }

  private async readBenchTrends(): Promise<{
    latest?: Record<string, number>;
    history?: Array<Record<string, number>>;
  }> {
    try {
      const latestPath = path.join(this.root, 'bench-trends', 'latest.json');
      const historyPath = path.join(this.root, 'bench-trends', 'history.json');
      const latest = JSON.parse(await fs.readFile(latestPath, 'utf8'));
      const history = JSON.parse(await fs.readFile(historyPath, 'utf8'));
      return { latest, history: Array.isArray(history) ? history : [] };
    } catch {
      return {};
    }
  }

  // =========================================================================
  // Blueprint Version History (P1-2, R32a)
  // =========================================================================

  writeBlueprintHistory(blueprintId: string, snapshot: LoopBlueprint, archivedAt: string): void {
    const dir = path.join(this.root, 'blueprints', 'history', blueprintId);
    mkdirSync(dir, { recursive: true });
    const entry = {
      blueprintId,
      version: snapshot.version,
      archivedAt,
      snapshot: {
        name: snapshot.name,
        description: snapshot.description,
        personaSequence: snapshot.personaSequence,
        evalSuiteId: snapshot.evalSuiteId,
        gateProfile: snapshot.gateProfile,
        runtimePolicy: snapshot.runtimePolicy,
      },
    };
    const safeVersion = snapshot.version.replace(/[^a-zA-Z0-9._-]+/g, '-');
    const safeTimestamp = archivedAt.replace(/[:.]+/g, '-');
    const file = path.join(dir, `${safeVersion}-${safeTimestamp}.json`);
    writeFileSync(file, `${JSON.stringify(entry, null, 2)}\n`, 'utf8');
  }

  listBlueprintHistory(blueprintId: string): Array<{
    blueprintId: string;
    version: string;
    archivedAt: string;
    snapshot: {
      name: string;
      description: string;
      personaSequence: string[];
      evalSuiteId?: string;
      gateProfile: { humanGates: string[]; agentGates: string[]; releaseGates: string[] };
      runtimePolicy: { primary: string; fallback?: string };
    };
  }> {
    const dir = path.join(this.root, 'blueprints', 'history', blueprintId);
    try {
      const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
      return files
        .map((f) => {
          try {
            return JSON.parse(readFileSync(path.join(dir, f), 'utf8'));
          } catch {
            return null;
          }
        })
        .filter(Boolean)
        .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
          String(b.archivedAt ?? '').localeCompare(String(a.archivedAt ?? '')),
        );
    } catch {
      return [];
    }
  }

  // =========================================================================
  // Cross-Tenant Archive Index (R35)
  // =========================================================================

  writeArchiveIndex(
    tenantId: string,
    entry: {
      archiveId: string;
      tenantId: string;
      storageKey: string;
      downloadUrl?: string;
      fileCount: number;
      totalSizeBytes: number;
      archivedAt: string;
    },
  ): void {
    const dir = path.join(this.root, 'archives', tenantId);
    mkdirSync(dir, { recursive: true });
    // Update the per-archive entry
    const file = path.join(dir, `${entry.archiveId}.json`);
    writeFileSync(file, `${JSON.stringify(entry, null, 2)}\n`, 'utf8');
    // Update the tenant index
    const index = this.listArchiveIndex(tenantId);
    const updated = index.filter((e) => e.archiveId !== entry.archiveId);
    updated.push(entry);
    updated.sort((a, b) => b.archivedAt.localeCompare(a.archivedAt));
    const indexFile = path.join(dir, 'index.json');
    writeFileSync(indexFile, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');
  }

  listArchiveIndex(tenantId: string): Array<{
    archiveId: string;
    tenantId: string;
    storageKey: string;
    downloadUrl?: string;
    fileCount: number;
    totalSizeBytes: number;
    archivedAt: string;
  }> {
    const file = path.join(this.root, 'archives', tenantId, 'index.json');
    try {
      return JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      return [];
    }
  }

  readArchiveIndex(
    tenantId: string,
    archiveId: string,
  ):
    | {
        archiveId: string;
        tenantId: string;
        storageKey: string;
        downloadUrl?: string;
        fileCount: number;
        totalSizeBytes: number;
        archivedAt: string;
      }
    | undefined {
    const file = path.join(this.root, 'archives', tenantId, `${archiveId}.json`);
    try {
      return JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      return undefined;
    }
  }
}
