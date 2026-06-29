import { z } from 'zod';
import { PaginatedResponseSchema, PaginationQuerySchema } from '../base';

export const LoopIssueStatusSchema = z.enum([
  'INTAKE',
  'NEEDS-CLARIFICATION',
  'OPEN',
  'IN_LOOP',
  'CLOSED',
  'ARCHIVED',
  'REJECTED',
]);

export const LoopPrioritySchema = z.enum(['P0', 'P1', 'P2', 'P3']);

export const LoopSubmitterProviderSchema = z.enum(['dev', 'dofe-sso']);

export const LoopSubmitterSchema = z.object({
  provider: LoopSubmitterProviderSchema,
  userId: z.string(),
  name: z.string(),
});

export const LoopRuleSnapshotRuleSchema = z.object({
  id: z.string(),
  label: z.string(),
  path: z.string(),
  status: z.enum(['present', 'missing']),
  summary: z.string().optional(),
  updated: z.string().optional(),
});

export const LoopRuleSnapshotDiagnosticSchema = z.object({
  id: z.string(),
  level: z.enum(['info', 'warning']),
  message: z.string(),
  evidence: z.string(),
});

export const LoopRuleSnapshotEnforcementSchema = z.object({
  policy: z.literal('snapshot-required'),
  status: z.enum(['enforced', 'attention']),
  agentReadable: z.boolean(),
  evidence: z.array(z.string()),
});

export const LoopRuleSnapshotSchema = z.object({
  workspaceId: z.string(),
  root: z.string(),
  capturedAt: z.string(),
  present: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  rules: z.array(LoopRuleSnapshotRuleSchema),
  diagnostics: z.array(LoopRuleSnapshotDiagnosticSchema).optional(),
  enforcement: LoopRuleSnapshotEnforcementSchema,
});

export const LoopPhaseSchema = z.enum([
  'PHASE_0_INTAKE',
  'PHASE_1_SPEC',
  'PHASE_2_REVIEW',
  'PHASE_3_DECOMPOSE',
  'PHASE_4_IMPLEMENT',
  'PHASE_5_REVIEW',
  'PHASE_6_CONVERGE',
  'PHASE_7_GLOBAL_REVIEW',
  'PHASE_8_ANNOTATE',
  'CLOSED',
  'PAUSED',
]);

export const LoopSpecStatusSchema = z.enum(['DRAFT', 'APPROVED', 'REVISION_REQUESTED', 'REJECTED']);

export const LoopShardStatusSchema = z.enum([
  'TODO',
  'IN_PROGRESS',
  'IMPLEMENTED',
  'DONE',
  'NEEDS-WORK',
  'FAILED',
  'BLOCKED',
  'TIMEOUT',
]);

export const LoopTestStatusSchema = z.enum([
  'TEST-PASS',
  'TEST-MISSING',
  'TEST-FAIL',
  'TEST-FLAKY',
  'SKIPPED',
]);

export const LoopSourceChannelSchema = z.enum(['web', 'webhook', 'schedule']);
export const LoopSourceKindSchema = z.enum([
  'web_form',
  'github',
  'linear',
  'jira',
  'slack',
  'schedule',
  'generic',
]);

export const LoopTenantContextSchema = z.object({
  tenantId: z.string().trim().min(1).optional(),
  tenantName: z.string().trim().min(1).optional(),
  teamId: z.string().trim().min(1).optional(),
});

export const CreateLoopIssueRequestSchema = z.object({
  title: z.string().trim().min(4).max(160),
  targetRepo: z.string().trim().min(1),
  body: z.string().trim().min(10),
  priority: LoopPrioritySchema.default('P2'),
  acceptanceCriteria: z.array(z.string().trim().min(1)).min(1),
  submitter: z
    .object({
      provider: LoopSubmitterProviderSchema.optional(),
      userId: z.string().trim().min(1).optional(),
      name: z.string().trim().min(1).optional(),
    })
    .optional(),
  submitterId: z.string().trim().min(1).optional(),
  submitterName: z.string().trim().min(1).optional(),
  sourceChannel: LoopSourceChannelSchema.optional(),
  sourceKind: LoopSourceKindSchema.optional(),
  tenantContext: LoopTenantContextSchema.optional(),
});

export const LoopIssueSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: LoopIssueStatusSchema,
  priority: LoopPrioritySchema,
  created: z.string(),
  updated: z.string(),
  sourceChannel: LoopSourceChannelSchema,
  sourceKind: LoopSourceKindSchema,
  submitterId: z.string(),
  submitterName: z.string(),
  targetRepo: z.string(),
  body: z.string(),
  acceptanceCriteria: z.array(z.string()),
  rawPayloadRef: z.string(),
  tenantContext: LoopTenantContextSchema.optional(),
});

export const LoopIntakeSchema = z.object({
  id: z.string(),
  issueId: z.string(),
  sourceChannel: LoopSourceChannelSchema,
  sourceKind: LoopSourceKindSchema,
  submitter: LoopSubmitterSchema,
  rawPayloadRef: z.string(),
  status: z.enum(['RECEIVED', 'NEEDS-CLARIFICATION', 'NORMALIZED', 'REJECTED']),
  created: z.string(),
  ruleSnapshot: LoopRuleSnapshotSchema.optional(),
  tenantContext: LoopTenantContextSchema.optional(),
});

export const LoopSpecSchema = z.object({
  id: z.string(),
  issueId: z.string(),
  version: z.string(),
  status: LoopSpecStatusSchema,
  created: z.string(),
  approvedBy: z.string().optional(),
  contextBudget: z.number(),
  body: z.string(),
});

export const LoopSpecHistoryItemSchema = LoopSpecSchema.pick({
  id: true,
  issueId: true,
  version: true,
  status: true,
  created: true,
  approvedBy: true,
  body: true,
});

export const LoopShardSchema = z.object({
  id: z.string(),
  specId: z.string(),
  title: z.string(),
  status: LoopShardStatusSchema,
  priority: LoopPrioritySchema,
  dependsOn: z.array(z.string()),
  estContext: z.number(),
  estEffort: z.enum(['S', 'M', 'L']),
  acceptance: z.array(z.string()),
  testRequirements: z.object({
    unit: z.array(z.string()),
    integration: z.array(z.string()),
    e2e: z.array(z.string()),
  }),
  filesHint: z.array(z.string()),
});

export const LoopAnnotationSchema = z.object({
  target: z.string(),
  annotator: z.enum(['codex', 'system', 'human']),
  round: z.number(),
  implStatus: z.enum(['not-started', 'in-progress', 'done', 'failed', 'skipped']),
  testStatus: z.enum(['not-run', 'pass', 'missing', 'fail', 'flaky', 'skipped']),
  verdict: z.enum(['pass', 'needs-work', 'fail', 'unreviewed']),
  coverage: z.enum(['none', 'partial', 'full']),
  location: z.array(z.string()),
  risk: z.enum(['low', 'medium', 'high']),
  notes: z.string(),
});

export const LoopTestMatrixSchema = z.object({
  id: z.string(),
  issueId: z.string(),
  specId: z.string(),
  owner: z.literal('codex'),
  status: z.enum(['DRAFT', 'ACTIVE', 'PASS', 'NEEDS-WORK']),
  created: z.string(),
  requiredTests: z.array(
    z.object({
      id: z.string(),
      shardId: z.string(),
      level: z.enum(['unit', 'integration', 'e2e', 'regression', 'manual']),
      title: z.string(),
      command: z.string().optional(),
      required: z.boolean(),
    }),
  ),
  regressionScope: z.array(z.string()),
  manualAcceptance: z.array(z.string()),
});

export const LoopRunShardTestsRequestSchema = z.object({
  commands: z.array(z.string().trim().min(1)).optional(),
  runner: z.string().trim().min(1).default('loops-runner'),
});

export const LoopRecordShardImplementationRequestSchema = z.object({
  implementer: z.string().trim().min(1).default('human'),
  summary: z.string().trim().min(1),
  changedFiles: z.array(z.string().trim().min(1)).default([]),
  notes: z.string().trim().optional(),
});

export const LoopReviewVerdictSchema = z.enum(['PASS', 'NEEDS-WORK', 'FAIL']);

export const LoopImplementationRecordSchema = z.object({
  id: z.string(),
  issueId: z.string(),
  shardId: z.string(),
  round: z.number(),
  implementer: z.string(),
  status: z.enum(['IMPLEMENTED', 'NEEDS-WORK']),
  summary: z.string(),
  changedFiles: z.array(z.string()),
  notes: z.string().optional(),
  created: z.string(),
  // Cost / observability accounting (see 05 §2.4). Optional for back-compat with
  // records written before token/duration capture landed.
  tokens: z.number().int().nonnegative().optional(),
  durationSec: z.number().nonnegative().optional(),
  testsChanged: z.array(z.string()).optional(),
});

export const LoopReviewShardRequestSchema = z.object({
  reviewer: z.string().trim().min(1).default('codex'),
  verdict: LoopReviewVerdictSchema,
  summary: z.string().trim().min(1),
  issues: z.array(
    z.object({
      severity: z.enum(['minor', 'major', 'critical']),
      desc: z.string().trim().min(1),
    }),
  ),
  fixInstructions: z.array(z.string().trim().min(1)),
});

export const LoopReviewRecordSchema = z.object({
  id: z.string(),
  issueId: z.string(),
  shardId: z.string(),
  round: z.number(),
  reviewer: z.string(),
  verdict: LoopReviewVerdictSchema,
  issues: z.array(
    z.object({
      severity: z.enum(['minor', 'major', 'critical']),
      desc: z.string(),
    }),
  ),
  fixInstructions: z.array(z.string()),
  summary: z.string(),
  created: z.string(),
});

export const LoopRuntimeSecurityPolicySnapshotSchema = z.object({
  id: z.string(),
  mode: z.literal('test-command'),
  /** gstack P0-1: Identifies whether Docker container or local shell executed commands. */
  sandboxBackend: z.enum(['docker', 'local-shell']).optional(),
  shell: z.object({
    strategy: z.enum(['allowlist', 'strict-allowlist']),
    allowedCommands: z.array(z.string()),
    blockedOperators: z.array(z.string()),
  }),
  network: z.object({
    strategy: z.literal('deny-by-default'),
    status: z.enum(['not-requested', 'blocked', 'allowed-by-override']),
    blockedTools: z.array(z.string()).default([]),
    /** gstack P0-1: Whether network isolation is enforced at container level. */
    sandboxEnforced: z.boolean().optional(),
  }),
  write: z.object({
    strategy: z.literal('workspace-scoped'),
    scope: z.literal('target-repo'),
    blockedPatterns: z.array(z.string()).default([]),
    /** gstack P0-1: Whether write isolation is enforced at container/fs level. */
    sandboxEnforced: z.boolean().optional(),
  }),
  approvals: z.object({
    override: z.literal('not-supported'),
    requiredFor: z.array(z.string()),
  }),
  canary: z.object({
    strategy: z.literal('env-token'),
    status: z.enum(['armed', 'leaked', 'not-run']),
    leakedInCommands: z.array(z.string()),
  }),
  capturedAt: z.string(),
});

export const LoopTestRecordSchema = z.object({
  id: z.string(),
  issueId: z.string(),
  shardId: z.string(),
  round: z.number(),
  runner: z.string(),
  reviewer: z.literal('system'),
  status: LoopTestStatusSchema,
  commands: z.array(
    z.object({
      command: z.string(),
      exitCode: z.number().nullable(),
      durationMs: z.number(),
      stdout: z.string(),
      stderr: z.string(),
    }),
  ),
  coverage: z
    .object({
      lines: z.number().optional(),
      branches: z.number().optional(),
    })
    .optional(),
  failedTests: z.array(
    z.object({
      name: z.string(),
      reason: z.string(),
    }),
  ),
  fixInstructions: z.array(z.string()),
  runtimeSecurityPolicy: LoopRuntimeSecurityPolicySnapshotSchema.optional(),
  created: z.string(),
});

export const LoopGlobalVerdictSchema = z.enum(['PASS', 'NEEDS-WORK', 'FAIL']);

// M3 · Phase 7 整体复查（reviewGlobal）。跨 Shard 一致性结论，触发回环或终态标注。
export const LoopGlobalReviewRecordSchema = z.object({
  id: z.string(),
  issueId: z.string(),
  reviewer: z.string(),
  round: z.number(),
  verdict: LoopGlobalVerdictSchema,
  issues: z.array(
    z.object({
      severity: z.enum(['minor', 'major', 'critical']),
      desc: z.string(),
    }),
  ),
  fixInstructions: z.array(z.string()),
  summary: z.string(),
  created: z.string(),
});

export const LoopReloopRequestSchema = z.object({
  reviewer: z.string().trim().min(1).default('human'),
  notes: z.string().trim().optional(),
});

export const LoopReloopResponseSchema = z.object({
  issueId: z.string(),
  specVersion: z.string(),
  round: z.number(),
  reloopCount: z.number(),
  maxReloop: z.number(),
  phase: LoopPhaseSchema,
  paused: z.boolean(),
});

export const LoopBrowserQaRequestSchema = z.object({
  targetUrl: z.string().url(),
  checkedFlows: z.array(z.string().trim().min(1)).default(['page-load']),
  notes: z.string().trim().optional(),
  authSessionRef: z.string().trim().min(1).optional(),
  /** gstack P1: Authenticated session profile for Browser QA.
   *  Uses test account credentials instead of personal cookies. */
  authSession: z
    .object({
      /** Reference to the test account (never stores real credentials inline). */
      testAccountRef: z.string(),
      /** Short-lived session token or cookie string. */
      sessionToken: z.string().optional(),
      /** Cookie JSON array for Playwright storageState format. */
      cookies: z
        .array(
          z.object({
            name: z.string(),
            value: z.string(),
            domain: z.string(),
            path: z.string().default('/'),
            httpOnly: z.boolean().optional(),
            secure: z.boolean().optional(),
            sameSite: z.enum(['Strict', 'Lax', 'None']).optional(),
          }),
        )
        .optional(),
      /** Session expiration timestamp for audit trail. */
      expiresAt: z.string().optional(),
      /** Auth mode: token (bearer header), cookie (storageState), or header (custom). */
      authMode: z.enum(['token', 'cookie', 'header']).default('cookie'),
      /** Custom HTTP headers to inject into browser context. */
      extraHeaders: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
  /** gstack/0 P1-3: Configurable viewports for multi-viewport visual regression. */
  viewports: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      }),
    )
    .default([{ name: 'desktop', width: 1440, height: 900 }]),
});

export const LoopBrowserQaReportSchema = z.object({
  id: z.string(),
  issueId: z.string(),
  runner: z.literal('playwright-cli'),
  status: z.enum(['passed', 'failed', 'blocked']),
  targetUrl: z.string().url(),
  title: z.string().optional(),
  screenshots: z.array(z.object({ path: z.string(), label: z.string() })),
  traces: z.array(z.object({ path: z.string(), label: z.string() })).optional(),
  visualDiffs: z
    .array(
      z.object({
        baselinePath: z.string(),
        actualPath: z.string(),
        diffPath: z.string().optional(),
        status: z.enum(['baseline-created', 'matched', 'changed']),
        changedPixels: z.number().int().nonnegative().optional(),
        label: z.string(),
        /** gstack/0 P1-3: Viewport identity for multi-viewport regression. */
        viewport: z
          .object({
            name: z.string(),
            width: z.number().int().positive(),
            height: z.number().int().positive(),
          })
          .optional(),
      }),
    )
    .optional(),
  viewports: z
    .array(
      z.object({
        name: z.string(),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      }),
    )
    .optional(),
  handoffs: z
    .array(
      z.object({
        path: z.string(),
        label: z.string(),
      }),
    )
    .optional(),
  consoleErrors: z.array(z.string()),
  networkFailures: z.array(z.object({ url: z.string(), status: z.number().optional() })),
  ignoredNetworkFailures: z
    .array(z.object({ url: z.string(), reason: z.string(), classification: z.string() }))
    .optional(),
  checkedFlows: z.array(z.string()),
  blockedReason: z.string().optional(),
  command: z.string(),
  durationMs: z.number().int().nonnegative(),
  created: z.string(),
});

export const LoopNaturalCommandIntentSchema = z.enum([
  'continue',
  'pause',
  'resume',
  'approve-spec',
  'request-revision',
  'query-evidence',
  'unknown',
]);

export const LoopNaturalCommandRequestSchema = z.object({
  command: z.string().trim().min(2).max(500),
  actor: z.string().trim().min(1).default('human'),
});

export const LoopNaturalCommandResponseSchema = z.object({
  issueId: z.string(),
  intent: LoopNaturalCommandIntentSchema,
  executed: z.boolean(),
  message: z.string(),
  detail: z.lazy(() => LoopDetailSchema).optional(),
  logs: z.array(z.lazy(() => LoopLogEntrySchema)).optional(),
});

// M4 · commit-per-shard + 收敛 PR（GitAdapter，见 ADR-008）
export const LoopConvergencePrSchema = z.object({
  id: z.string(),
  issueId: z.string(),
  branch: z.string(),
  baseBranch: z.string(),
  provider: z.enum(['github', 'gitlab', 'gitea']).optional(),
  url: z.string().url().optional(),
  commits: z.array(
    z.object({
      shardId: z.string(),
      message: z.string(),
      commitSha: z.string().trim().min(7).optional(),
      branch: z.string().trim().min(1).optional(),
    }),
  ),
  annotationsSummary: z.string(),
  prBody: z.string(),
  status: z.enum(['DRAFT', 'PUSHED', 'OPENED', 'SKIPPED']),
  created: z.string(),
});

export const LoopStateItemSchema = z.object({
  issueId: z.string(),
  phase: LoopPhaseSchema,
  round: z.number(),
  specVersion: z.string(),
  shardsTotal: z.number(),
  shardsDone: z.number(),
  shardsInProgress: z.number(),
  reloopCount: z.number(),
  costTokens: z.number(),
  costCalls: z.number(),
  updated: z.string(),
  paused: z.boolean(),
  // M3 收敛状态：整体复查结论与终态标注完成标志。
  globalVerdict: LoopGlobalVerdictSchema.optional(),
  finalized: z.boolean().optional(),
});

export const LoopLogEntrySchema = z.object({
  ts: z.string(),
  type: z.string(),
  loop: z.string().optional(),
  issue: z.string().optional(),
  shard: z.string().optional(),
  action: z.string().optional(),
  status: z.string().optional(),
  verdict: z.string().optional(),
  payload: z.record(z.string(), z.unknown()),
});

export const LoopLogsQuerySchema = z.object({
  issueId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
});

export const LoopLogsResponseSchema = z.object({
  entries: z.array(LoopLogEntrySchema),
});

export const LoopNotificationSchema = z.object({
  id: z.string(),
  issueId: z.string(),
  channel: z.enum(['web', 'feishu']),
  kind: z.enum([
    'ISSUE_RECEIVED',
    'SPEC_REVIEW_REQUESTED',
    'LOOP_STARTED',
    'HUMAN_INTERVENTION',
    'COST_GUARD_TRIPPED',
    'CONVERGENCE_READY',
    'SHARD_REDO_LIMIT',
    'RELOOP_LIMIT',
    'CONTEXT_BUDGET_EXCEEDED',
  ]),
  recipient: z.string(),
  title: z.string(),
  body: z.string(),
  status: z.enum(['RECORDED', 'SENT', 'FAILED', 'SKIPPED']),
  actionHref: z.string().optional(),
  created: z.string(),
});

export const LoopNotificationsQuerySchema = z.object({
  issueId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
});

export const LoopNotificationsResponseSchema = z.object({
  notifications: z.array(LoopNotificationSchema),
});

export const LoopCostItemSchema = z.object({
  issueId: z.string(),
  costTokens: z.number(),
  costCalls: z.number(),
  tokenCap: z.number(),
  callCap: z.number(),
  tokensRemaining: z.number(),
  callsRemaining: z.number(),
  paused: z.boolean(),
  tripped: z.boolean(),
});

export const LoopCostResponseSchema = z.object({
  loops: z.array(LoopCostItemSchema),
});

export const LoopMetricsPhaseItemSchema = z.object({
  phase: LoopPhaseSchema.or(z.string()),
  label: z.string(),
  count: z.number().int().nonnegative(),
});

export const LoopMetricsRiskItemSchema = z.object({
  issueId: z.string(),
  title: z.string(),
  level: z.enum(['critical', 'warning', 'info']),
  reason: z.string(),
  phase: LoopPhaseSchema.optional(),
  priority: LoopPrioritySchema,
  status: LoopIssueStatusSchema,
  href: z.string(),
});

export const LoopMetricsActionItemSchema = z.object({
  issueId: z.string(),
  title: z.string(),
  action: z.enum([
    'generate-spec',
    'review-spec',
    'decompose',
    'run-step',
    'global-review',
    'reloop',
    'finalize',
    'resume',
    'closed',
  ]),
  nextActionCategory: z.enum(['continue', 'decision', 'exception', 'done']).optional(),
  label: z.string(),
  priority: LoopPrioritySchema,
  phase: LoopPhaseSchema.optional(),
  href: z.string(),
});

export const LoopBenchMetricKeySchema = z.enum([
  'firstPassReviewRate',
  'browserQaRegressionRate',
  'secondOpinionConflictRate',
  'releaseBlockerRate',
  'runtimeViolationRate',
  'learningReuseRate',
  'canaryPassRate',
]);

export const LoopBenchMetricsSchema = z.object({
  firstPassReviewRate: z.number().min(0).max(100),
  browserQaRegressionRate: z.number().min(0).max(100),
  secondOpinionConflictRate: z.number().min(0).max(100),
  releaseBlockerRate: z.number().min(0).max(100),
  runtimeViolationRate: z.number().min(0).max(100),
  learningReuseRate: z.number().min(0).max(100),
  canaryPassRate: z.number().min(0).max(100),
});

export const LoopBenchTrendSnapshotSchema = z.object({
  id: z.string(),
  capturedAt: z.string(),
  artifactRef: z.string(),
  loopCount: z.number().int().nonnegative(),
  metrics: LoopBenchMetricsSchema,
  previousMetrics: LoopBenchMetricsSchema.optional(),
  deltas: z
    .object({
      firstPassReviewRate: z.number(),
      browserQaRegressionRate: z.number(),
      secondOpinionConflictRate: z.number(),
      releaseBlockerRate: z.number(),
      runtimeViolationRate: z.number(),
      learningReuseRate: z.number(),
      canaryPassRate: z.number(),
    })
    .optional(),
});

export const LoopBenchTrendSummarySchema = z.object({
  latest: LoopBenchTrendSnapshotSchema.optional(),
  historyCount: z.number().int().nonnegative(),
});

export const LoopBenchTrendWorkerResponseSchema = z.object({
  generatedAt: z.string(),
  snapshot: LoopBenchTrendSnapshotSchema,
  historyCount: z.number().int().nonnegative(),
});

export const LoopRequirementCoverageItemSchema = z.object({
  id: z.string(),
  criterion: z.string(),
  inSpec: z.boolean(),
  shardIds: z.array(z.string()),
  testIds: z.array(z.string()),
  implementationRecordIds: z.array(z.string()),
  reviewRecordIds: z.array(z.string()),
  status: z.enum(['missing', 'planned', 'implemented', 'tested', 'reviewed', 'accepted']),
});

export const LoopRequirementCoverageSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  accepted: z.number().int().nonnegative(),
  reviewed: z.number().int().nonnegative(),
  tested: z.number().int().nonnegative(),
  implemented: z.number().int().nonnegative(),
  planned: z.number().int().nonnegative(),
  missing: z.number().int().nonnegative(),
  percent: z.number().min(0).max(100),
});

export const LoopRequirementCoverageSchema = z.object({
  summary: LoopRequirementCoverageSummarySchema,
  items: z.array(LoopRequirementCoverageItemSchema),
});

export const LoopEvidenceArtifactSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum([
    'raw-payload',
    'issue',
    'intake',
    'spec',
    'shards',
    'test-matrix',
    'implementation-record',
    'test-record',
    'review-record',
    'global-review',
    'convergence-pr',
    'browser-qa',
    'second-opinion',
    'annotations',
  ]),
  path: z.string(),
  status: z.enum(['present', 'pending']),
  round: z.number().int().positive().optional(),
  count: z.number().int().nonnegative().optional(),
  summary: z.string().optional(),
});

export const LoopLearningSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  repo: z.string().optional(),
  kind: z.enum(['pattern', 'pitfall', 'decision', 'test_policy', 'ownership', 'security']),
  summary: z.string(),
  fingerprint: z.string().trim().min(1).optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
  similarLearningIds: z.array(z.string().trim().min(1)).optional(),
  evidenceIds: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  lastUsedAt: z.string().optional(),
  createdAt: z.string(),
});

export const LoopLearningIndexEntrySchema = z.object({
  learningId: z.string(),
  workspaceId: z.string(),
  repo: z.string().optional(),
  kind: z.enum(['pattern', 'pitfall', 'decision', 'test_policy', 'ownership', 'security']),
  fingerprint: z.string().trim().min(1).optional(),
  tags: z.array(z.string().trim().min(1)).default([]),
  confidence: z.number().min(0).max(1),
  evidenceIds: z.array(z.string()).default([]),
  recallCount: z.number().int().nonnegative(),
  lastRecalledAt: z.string().optional(),
  createdAt: z.string(),
});

export const LoopLearningIndexSchema = z.object({
  generatedAt: z.string(),
  artifactRef: z.string(),
  summary: z.object({
    total: z.number().int().nonnegative(),
    workspaces: z.number().int().nonnegative(),
    repos: z.number().int().nonnegative(),
    duplicateFingerprints: z.number().int().nonnegative(),
    reusable: z.number().int().nonnegative(),
  }),
  entries: z.array(LoopLearningIndexEntrySchema),
});

export const LoopRuntimeSecurityExceptionSchema = z.object({
  id: z.string(),
  testRecordId: z.string(),
  shardId: z.string(),
  round: z.number().int().positive(),
  level: z.enum(['critical', 'warning']),
  reason: z.string(),
  evidence: z.string(),
  command: z.string().optional(),
  created: z.string(),
});

export const LoopLearningGovernanceActionSchema = z.enum([
  'dismiss',
  'merge',
  'approve-merge',
  'reject-merge',
  'deprecate',
  'supersede',
]);

export const LoopLearningGovernanceRequestSchema = z.object({
  action: LoopLearningGovernanceActionSchema,
  actor: z.string().trim().min(1).default('human'),
  reason: z.string().trim().optional(),
  targetLearningId: z.string().trim().min(1).optional(),
});

export const LoopLearningGovernanceSchema = z.object({
  dismissed: z.array(
    z.object({
      learningId: z.string(),
      actor: z.string(),
      reason: z.string().optional(),
      createdAt: z.string(),
    }),
  ),
  merges: z.array(
    z.object({
      sourceLearningId: z.string(),
      targetLearningId: z.string(),
      actor: z.string(),
      reason: z.string().optional(),
      createdAt: z.string(),
    }),
  ),
  deprecated: z
    .array(
      z.object({
        learningId: z.string(),
        actor: z.string(),
        reason: z.string().optional(),
        createdAt: z.string(),
      }),
    )
    .default([]),
  superseded: z
    .array(
      z.object({
        sourceLearningId: z.string(),
        targetLearningId: z.string(),
        actor: z.string(),
        reason: z.string().optional(),
        createdAt: z.string(),
      }),
    )
    .default([]),
  autoMergeCandidates: z
    .array(
      z.object({
        sourceLearningId: z.string(),
        targetLearningId: z.string(),
        status: z.enum(['pending-approval', 'approved', 'rejected']),
        reason: z.string(),
        createdAt: z.string(),
      }),
    )
    .default([]),
});

export const LoopTraceSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  recent: z.number().int().nonnegative(),
  lastEventAt: z.string().optional(),
  eventTypes: z.array(
    z.object({
      type: z.string(),
      count: z.number().int().nonnegative(),
    }),
  ),
});

export const LoopResumeSummarySchema = z.object({
  resumableShards: z.number().int().nonnegative(),
  affectedIssues: z.number().int().nonnegative(),
});

// ============================================================================
// gstack-inspired delivery control contracts (0623). These are optional on list
// and detail payloads so existing file-backed Loops records remain compatible.
// Runtime ownership is intentionally limited to this product's two foundations:
// Codex CLI for planning/review and Claude Code CLI for implementation.
// ============================================================================
export const LoopWorkflowRuntimeOwnerSchema = z.enum(['codex', 'claude-code', 'human', 'system']);

export const LoopWorkflowStepKindSchema = z.enum([
  'intake',
  'product_review',
  'spec_review',
  'architecture_review',
  'implementation',
  'code_review',
  'security_review',
  'browser_qa',
  'test_gate',
  'release_gate',
  'retro',
]);

export const LoopWorkflowGateSchema = z.enum(['none', 'approval', 'decision', 'override']);

export const LoopWorkflowStepSchema = z.object({
  id: z.string(),
  kind: LoopWorkflowStepKindSchema,
  label: z.string(),
  required: z.boolean(),
  status: z.enum(['pending', 'current', 'passed', 'blocked', 'skipped']),
  owner: LoopWorkflowRuntimeOwnerSchema,
  humanGate: LoopWorkflowGateSchema.default('none'),
  phase: LoopPhaseSchema.optional(),
  evidenceTypes: z.array(z.string()).default([]),
  evidenceIds: z.array(z.string()).default([]),
  blockedReason: z.string().optional(),
});

export const LoopWorkflowBaselineEvidenceSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(['blueprint', 'runtime', 'eval', 'gate', 'risk']),
  value: z.string(),
  evidenceRef: z.string().optional(),
});

export const LoopWorkflowRecipeSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.number().int().positive(),
  appliesTo: z.array(z.enum(['feature', 'bugfix', 'refactor', 'docs', 'ops'])),
  capturedAt: z.string(),
  source: z.enum(['default', 'workspace', 'loop-snapshot']),
  baselineEvidence: z.array(LoopWorkflowBaselineEvidenceSchema).default([]),
  steps: z.array(LoopWorkflowStepSchema),
});

export const LoopReviewGateKindSchema = z.enum([
  'product',
  'architecture',
  'design',
  'devex',
  'security',
  'code',
]);

export const LoopReviewGateStatusSchema = z.enum([
  'pending',
  'passed',
  'needs_changes',
  'blocked',
  'waived',
]);

export const LoopReviewGateSchema = z.object({
  id: z.string(),
  kind: LoopReviewGateKindSchema,
  status: LoopReviewGateStatusSchema,
  reviewer: LoopWorkflowRuntimeOwnerSchema,
  confidence: z.number().min(0).max(1).optional(),
  findingsCount: z.number().int().nonnegative().default(0),
  evidenceId: z.string().optional(),
  requiredByStepId: z.string(),
  waiverReason: z.string().optional(),
  updated: z.string(),
});

export const LoopReleaseGateSchema = z.object({
  id: z.string(),
  status: z.enum(['pending', 'ready', 'blocked', 'shipped']),
  checklist: z.object({
    specApproved: z.boolean(),
    implementationEvidence: z.boolean(),
    testsPassed: z.boolean(),
    requiredReviewsPassed: z.boolean(),
    secondOpinionPassed: z.boolean().optional(),
    browserQaPassed: z.boolean(),
    docsUpdated: z.boolean(),
    prReady: z.boolean(),
    rollbackNote: z.boolean(),
    canaryPassed: z.boolean().optional(),
  }),
  evidenceIds: z.array(z.string()).default([]),
  blocker: z.string().optional(),
  updated: z.string(),
});

export const LoopSecondOpinionFindingSchema = z.object({
  fingerprint: z.string().trim().min(1),
  severity: z.enum(['minor', 'major', 'critical']),
  desc: z.string().trim().min(1),
  sourceEvidenceId: z.string().trim().min(1).optional(),
});

export const LoopSecondOpinionReviewerSchema = z.object({
  role: z.enum(['primary', 'secondary']),
  reviewer: z.enum(['codex', 'claude-code']),
  status: z.enum(['not_run', 'pending', 'passed', 'needs_changes']),
  findingsCount: z.number().int().nonnegative().default(0),
  findings: z.array(LoopSecondOpinionFindingSchema).default([]),
  evidenceIds: z.array(z.string()).default([]),
  summary: z.string().optional(),
});

export const LoopSecondOpinionSchema = z.object({
  id: z.string(),
  status: z.enum(['not_required', 'pending', 'passed', 'needs_changes', 'conflict']),
  primary: LoopSecondOpinionReviewerSchema,
  secondary: LoopSecondOpinionReviewerSchema,
  comparison: z.object({
    agreementCount: z.number().int().nonnegative(),
    primaryOnlyCount: z.number().int().nonnegative(),
    secondaryOnlyCount: z.number().int().nonnegative(),
    conflictCount: z.number().int().nonnegative(),
    agreementFingerprints: z.array(z.string()).default([]),
    primaryOnlyFingerprints: z.array(z.string()).default([]),
    secondaryOnlyFingerprints: z.array(z.string()).default([]),
    conflictFingerprints: z.array(z.string()).default([]),
  }),
  requiredForRelease: z.boolean(),
  updated: z.string(),
});

export const LoopDeliveryGovernanceSchema = z.object({
  workflowDefaults: z
    .array(
      z.object({
        loopKind: z.enum(['feature', 'bugfix', 'refactor', 'docs', 'ops']),
        recipeId: z.string().trim().min(1),
        actor: z.string().trim().min(1),
        reason: z.string().trim().optional(),
        updated: z.string(),
      }),
    )
    .default([]),
  reviewGateOverrides: z
    .array(
      z.object({
        gateKind: LoopReviewGateKindSchema,
        status: z.enum(['passed', 'blocked', 'waived']),
        actor: z.string().trim().min(1),
        reason: z.string().trim().optional(),
        expiresAt: z.string().optional(),
        updated: z.string(),
      }),
    )
    .default([]),
  requiredReviewGates: z
    .object({
      gateKinds: z.array(LoopReviewGateKindSchema).min(1),
      actor: z.string().trim().min(1),
      reason: z.string().trim().optional(),
      updated: z.string(),
    })
    .optional(),
  secondOpinionPolicy: z
    .object({
      requiredForRelease: z.boolean(),
      conflictHumanGate: z.boolean(),
      actor: z.string().trim().min(1),
      reason: z.string().trim().optional(),
      updated: z.string(),
    })
    .optional(),
  secondOpinionResolutions: z
    .array(
      z.object({
        id: z.string(),
        resolution: z.enum(['accept-primary', 'accept-secondary', 'waive', 'request-changes']),
        actor: z.string().trim().min(1),
        reason: z.string().trim().min(1),
        conflictFingerprint: z.string().trim().min(1).optional(),
        updated: z.string(),
      }),
    )
    .default([]),
  releaseCanary: z
    .object({
      status: z.enum(['not_run', 'pending', 'passed', 'failed']),
      environment: z.string().trim().min(1).optional(),
      environmentOwner: z.string().trim().min(1).optional(),
      targetUrl: z.string().url().optional(),
      rollbackNote: z.string().trim().min(1).optional(),
      actor: z.string().trim().min(1),
      reason: z.string().trim().optional(),
      updated: z.string(),
    })
    .optional(),
  runtimeOverrides: z
    .array(
      z.object({
        id: z.string(),
        scope: z.enum(['network', 'write', 'shell']),
        actor: z.string().trim().min(1),
        reason: z.string().trim().min(1),
        expiresAt: z.string(),
        updated: z.string(),
      }),
    )
    .default([]),
  browserQaSessionPolicy: z
    .object({
      authMode: z.enum(['none', 'test-account', 'manual-session']),
      testAccountRef: z.string().trim().min(1).optional(),
      actor: z.string().trim().min(1),
      reason: z.string().trim().optional(),
      updated: z.string(),
    })
    .optional(),
  learningPolicy: z
    .object({
      dedupeScope: z.enum(['workspace', 'cross-workspace']),
      autoMergeApproval: z.enum(['manual-only', 'approval-required']),
      actor: z.string().trim().min(1),
      reason: z.string().trim().optional(),
      updated: z.string(),
    })
    .optional(),
});

export const LoopDeliveryGovernanceRequestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('set-workflow-default'),
    loopKind: z.enum(['feature', 'bugfix', 'refactor', 'docs', 'ops']),
    recipeId: z.string().trim().min(1),
    actor: z.string().trim().min(1).default('human'),
    reason: z.string().trim().optional(),
  }),
  z.object({
    action: z.literal('set-review-gate'),
    gateKind: LoopReviewGateKindSchema,
    status: z.enum(['passed', 'blocked', 'waived']),
    actor: z.string().trim().min(1).default('human'),
    reason: z.string().trim().optional(),
    expiresAt: z.string().optional(),
  }),
  z.object({
    action: z.literal('set-required-review-gates'),
    gateKinds: z.array(LoopReviewGateKindSchema).min(1),
    actor: z.string().trim().min(1).default('human'),
    reason: z.string().trim().optional(),
  }),
  z.object({
    action: z.literal('set-second-opinion-policy'),
    requiredForRelease: z.boolean(),
    conflictHumanGate: z.boolean().default(true),
    actor: z.string().trim().min(1).default('human'),
    reason: z.string().trim().optional(),
  }),
  z.object({
    action: z.literal('record-release-canary'),
    status: z.enum(['not_run', 'pending', 'passed', 'failed']),
    environment: z.string().trim().min(1).optional(),
    environmentOwner: z.string().trim().min(1).optional(),
    targetUrl: z.string().url().optional(),
    rollbackNote: z.string().trim().min(1).optional(),
    actor: z.string().trim().min(1).default('human'),
    reason: z.string().trim().optional(),
  }),
  z.object({
    action: z.literal('record-runtime-override'),
    scope: z.enum(['network', 'write', 'shell']),
    actor: z.string().trim().min(1).default('human'),
    reason: z.string().trim().min(1),
    expiresAt: z.string(),
  }),
  z.object({
    action: z.literal('set-browser-qa-session-policy'),
    authMode: z.enum(['none', 'test-account', 'manual-session']),
    testAccountRef: z.string().trim().min(1).optional(),
    actor: z.string().trim().min(1).default('human'),
    reason: z.string().trim().optional(),
  }),
  z.object({
    action: z.literal('set-learning-policy'),
    dedupeScope: z.enum(['workspace', 'cross-workspace']),
    autoMergeApproval: z.enum(['manual-only', 'approval-required']),
    actor: z.string().trim().min(1).default('human'),
    reason: z.string().trim().optional(),
  }),
  z.object({
    action: z.literal('resolve-second-opinion-conflict'),
    resolution: z.enum(['accept-primary', 'accept-secondary', 'waive', 'request-changes']),
    conflictFingerprint: z.string().trim().min(1).optional(),
    actor: z.string().trim().min(1).default('human'),
    reason: z.string().trim().min(1),
  }),
]);

// ============================================================================
// Agent Runtime detection facts (0622 · B1).
// Backend-provided, environment-derived facts about whether the local `codex` /
// `claude` CLIs are installed, whether Docker can back them up, and which
// runtime mode is selected for the current workspace. The orchestration layer
// consumes this surface; CLI paths, Docker commands and image tags never leak
// to the frontend (see docs/0622/agent-run-time/01-runtime-detection-and-execution.md).
// ============================================================================
export const LoopAgentKindSchema = z.enum(['codex', 'claude-code']);

export const LoopRuntimeModeSchema = z.enum(['local-cli', 'docker']);

export const LoopRuntimeStatusSchema = z.enum(['ready', 'missing', 'misconfigured', 'error']);

export const LoopRuntimeDiagnosticCodeSchema = z.enum([
  'LOCAL_CLI_MISSING',
  'DOCKER_DAEMON_DOWN',
  'DOCKER_IMAGE_MISSING',
  'WORKSPACE_REQUIRED',
  'WORKSPACE_NOT_MOUNTABLE',
  'AUTH_REQUIRED',
]);

export const LoopRuntimeCheckSchema = z.object({
  code: LoopRuntimeDiagnosticCodeSchema,
  level: z.enum(['critical', 'warning', 'info']),
  message: z.string(),
  /** Stable, frontend-actionable action key (e.g. `select-workspace`, `pull-image`). */
  action: z.string(),
});

export const LoopRuntimeCandidateSchema = z.object({
  mode: LoopRuntimeModeSchema,
  status: LoopRuntimeStatusSchema,
  command: z.string().optional(),
  version: z.string().optional(),
  image: z.string().optional(),
  workspaceRequired: z.boolean(),
});

export const LoopRuntimeDetectionSchema = z.object({
  agent: LoopAgentKindSchema,
  preferredMode: LoopRuntimeModeSchema,
  local: LoopRuntimeCandidateSchema.optional(),
  docker: LoopRuntimeCandidateSchema.optional(),
  selected: LoopRuntimeCandidateSchema.optional(),
  checks: z.array(LoopRuntimeCheckSchema),
});

export const LoopAgentRuntimeStatusSchema = z.enum(['running', 'attention', 'idle']);

export const LoopAgentRuntimeItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: LoopAgentRuntimeStatusSchema,
  phase: LoopPhaseSchema,
  supportedPhases: z.array(LoopPhaseSchema),
  issueId: z.string().optional(),
  issueTitle: z.string().optional(),
  href: z.string().optional(),
  meta: z.string(),
  diagnostics: z.array(z.string()),
  updated: z.string().optional(),
});

export const LoopAgentRuntimeDiagnosticSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  issueId: z.string(),
  title: z.string(),
  href: z.string(),
  level: z.enum(['critical', 'warning', 'info']),
  reason: z.string(),
  meta: z.string(),
  updated: z.string().optional(),
});

export const LoopAgentRuntimeResponseSchema = z.object({
  summary: z.object({
    running: z.number().int().nonnegative(),
    attention: z.number().int().nonnegative(),
    idle: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  }),
  agents: z.array(LoopAgentRuntimeItemSchema),
  diagnostics: z.array(LoopAgentRuntimeDiagnosticSchema),
  // Runtime detection facts (0622 · B1). Optional so older file-only consumers
  // (and the hermetic service spec) keep working when no detection service is
  // wired in. `workspaceId` is the workspace these facts were resolved against.
  runtimes: z.array(LoopRuntimeDetectionSchema).optional(),
  workspaceId: z.string().optional(),
});

export const LoopMetricsResponseSchema = z.object({
  health: z.object({
    ok: z.boolean(),
    root: z.string(),
    loops: z.number().int().nonnegative(),
    issues: z.number().int().nonnegative(),
    problems: z.array(z.string()),
  }),
  summary: z.object({
    total: z.number().int().nonnegative(),
    active: z.number().int().nonnegative(),
    inLoop: z.number().int().nonnegative(),
    paused: z.number().int().nonnegative(),
    attention: z.number().int().nonnegative(),
    closed: z.number().int().nonnegative(),
  }),
  phaseDistribution: z.array(LoopMetricsPhaseItemSchema),
  costSummary: z.object({
    loops: z.number().int().nonnegative(),
    tripped: z.number().int().nonnegative(),
    totalCalls: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
    minCallsRemaining: z.number().int().nonnegative(),
    minTokensRemaining: z.number().int().nonnegative(),
  }),
  riskQueue: z.array(LoopMetricsRiskItemSchema),
  actionQueue: z.array(LoopMetricsActionItemSchema),
  requirementsCoverage: LoopRequirementCoverageSummarySchema,
  traceSummary: LoopTraceSummarySchema,
  resumeSummary: LoopResumeSummarySchema,
  loopBenchTrend: LoopBenchTrendSummarySchema.optional(),
});

export const LoopDetailSchema = z.object({
  issue: LoopIssueSchema,
  intake: LoopIntakeSchema,
  spec: LoopSpecSchema.optional(),
  specHistory: z.array(LoopSpecHistoryItemSchema).optional(),
  shards: z.array(LoopShardSchema),
  testMatrix: LoopTestMatrixSchema.optional(),
  annotations: z.array(LoopAnnotationSchema),
  implementationRecords: z.array(LoopImplementationRecordSchema),
  reviewRecords: z.array(LoopReviewRecordSchema),
  testRecords: z.array(LoopTestRecordSchema),
  logs: z.array(LoopLogEntrySchema),
  notifications: z.array(LoopNotificationSchema),
  state: LoopStateItemSchema,
  globalReview: LoopGlobalReviewRecordSchema.optional(),
  convergencePr: LoopConvergencePrSchema.optional(),
  browserQaReports: z.array(LoopBrowserQaReportSchema).optional(),
  requirementsCoverage: LoopRequirementCoverageSchema.optional(),
  evidenceArtifacts: z.array(LoopEvidenceArtifactSchema).optional(),
  learnings: z.array(LoopLearningSchema).optional(),
  workflowRecipe: LoopWorkflowRecipeSchema.optional(),
  reviewGates: z.array(LoopReviewGateSchema).optional(),
  releaseGate: LoopReleaseGateSchema.optional(),
  secondOpinion: LoopSecondOpinionSchema.optional(),
  deliveryGovernance: LoopDeliveryGovernanceSchema.optional(),
});

export const LoopIssuesQuerySchema = PaginationQuerySchema.extend({
  status: LoopIssueStatusSchema.optional(),
  phase: LoopPhaseSchema.optional(),
  priority: LoopPrioritySchema.optional(),
  targetRepo: z.string().trim().min(1).optional(),
});

export const LoopIssueListItemSchema = z.object({
  issue: LoopIssueSchema,
  state: LoopStateItemSchema.optional(),
  workflowRecipe: LoopWorkflowRecipeSchema.optional(),
  reviewGates: z.array(LoopReviewGateSchema).optional(),
  releaseGate: LoopReleaseGateSchema.optional(),
  runtimeSecurityExceptions: z.array(LoopRuntimeSecurityExceptionSchema).optional(),
  deliveryGovernance: LoopDeliveryGovernanceSchema.optional(),
});

export const LoopListResponseSchema = PaginatedResponseSchema(LoopIssueListItemSchema);

export const LoopIssueCreatedResponseSchema = z.object({
  issue: LoopIssueSchema,
  intake: LoopIntakeSchema,
  state: LoopStateItemSchema,
});

export const LoopReviewSpecRequestSchema = z.object({
  action: z.enum(['approve', 'request-revision', 'reject']),
  reviewer: z.string().trim().min(1).default('human'),
  notes: z.string().trim().optional(),
});

export const LoopInterventionRequestSchema = z.object({
  action: z.enum(['pause', 'resume', 'take']),
  actor: z.string().trim().min(1).default('human'),
  shardId: z.string().trim().min(1).optional(),
  notes: z.string().trim().optional(),
});

export const LoopsDoctorResponseSchema = z.object({
  ok: z.boolean(),
  root: z.string(),
  loops: z.number(),
  issues: z.number(),
  fileProblems: z.array(z.string()).default([]),
  dbProblems: z.array(z.string()).default([]),
  consistencyProblems: z.array(z.string()).default([]),
  problems: z.array(z.string()),
});

export const LoopsResumeResponseSchema = z.object({
  resumed: z.number(),
  updatedShards: z.array(
    z.object({
      issueId: z.string(),
      shardId: z.string(),
      from: z.string(),
      to: z.string(),
    }),
  ),
});

export const LoopCapabilityStatusSchema = z.enum(['done', 'planned', 'in-progress']);

export const LoopCapabilityCategorySchema = z.enum([
  'agent',
  'tool',
  'integration',
  'runtime',
  'trace',
  'checkpoint',
  'evidence',
]);

export const LoopRegistryLifecycleSchema = z.enum(['active', 'planned', 'experimental']);

export const LoopRegistryPermissionSchema = z.enum([
  'read-repo',
  'write-repo',
  'run-tests',
  'create-pr',
  'notify-human',
  'human-approval-required',
]);

export const LoopAgentRegistryItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  provider: z.enum(['codex', 'claude-code', 'third-party']),
  lifecycle: LoopRegistryLifecycleSchema,
  responsibilities: z.array(z.string()),
  supportedPhases: z.array(LoopPhaseSchema),
  permissions: z.array(LoopRegistryPermissionSchema),
  toolIds: z.array(z.string()),
});

export const LoopToolRegistryItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(['code-execution', 'review', 'git', 'test', 'notification', 'artifact']),
  lifecycle: LoopRegistryLifecycleSchema,
  ownerAgentIds: z.array(z.string()),
  permissions: z.array(LoopRegistryPermissionSchema),
  deterministicBoundary: z.string(),
  compatibility: z.object({
    codex: z.boolean(),
    claudeCode: z.boolean(),
    thirdParty: z.enum(['unsupported', 'planned', 'compatible']),
  }),
});

export const LoopAgentToolRegistrySchema = z.object({
  agents: z.array(LoopAgentRegistryItemSchema),
  tools: z.array(LoopToolRegistryItemSchema),
  compatibilityChecks: z.array(
    z.object({
      id: z.string(),
      status: z.enum(['pass', 'planned', 'fail']),
      summary: z.string(),
    }),
  ),
});

export const LoopCapabilityItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  category: LoopCapabilityCategorySchema,
  status: LoopCapabilityStatusSchema,
  summary: z.string(),
  currentFoundation: z.array(z.string()),
  nextSteps: z.array(z.string()),
  risks: z.array(z.string()).default([]),
  agentToolRegistry: LoopAgentToolRegistrySchema.optional(),
});

export const LoopCapabilitiesResponseSchema = z.object({
  capabilities: z.array(LoopCapabilityItemSchema),
  summary: z.object({
    total: z.number(),
    done: z.number(),
    planned: z.number(),
    inProgress: z.number(),
  }),
});

// ============================================================================
// Workspace profile (0622 · B2). Docker runtime must bind a workspace so the
// container mount, workdir, config/cache dirs and target repo are explicit and
// isolated per workspace. File-backed (`.loops/runtime/profile.json`); no DB.
// ============================================================================
export const LoopWorkspaceStatusSchema = z.enum([
  'UNCONFIGURED',
  'SELECTED',
  'VALIDATED',
  'READY',
  'ERROR',
]);

export const LoopWorkspaceAgentProfileSchema = z.object({
  mode: LoopRuntimeModeSchema,
  localCommand: z.string().optional(),
  dockerImage: z.string(),
});

export const LoopWorkspaceRuleStatusSchema = z.enum(['present', 'missing']);

export const LoopWorkspaceRuleSchema = z.object({
  id: z.string(),
  label: z.string(),
  path: z.string(),
  status: LoopWorkspaceRuleStatusSchema,
  summary: z.string().optional(),
  updated: z.string().optional(),
});

export const LoopWorkspaceRuleDiagnosticLevelSchema = z.enum(['info', 'warning']);

export const LoopWorkspaceRuleDiagnosticSchema = z.object({
  id: z.string(),
  level: LoopWorkspaceRuleDiagnosticLevelSchema,
  message: z.string(),
  evidence: z.string(),
});

export const LoopWorkspaceRulesSummarySchema = z.object({
  present: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  rules: z.array(LoopWorkspaceRuleSchema),
  diagnostics: z.array(LoopWorkspaceRuleDiagnosticSchema).optional(),
});

export const LoopWorkspaceProfileSchema = z.object({
  workspaceId: z.string(),
  root: z.string(),
  containerWorkdir: z.string().optional(),
  status: LoopWorkspaceStatusSchema,
  isDefault: z.boolean().optional(),
  agents: z.object({
    codex: LoopWorkspaceAgentProfileSchema,
    'claude-code': LoopWorkspaceAgentProfileSchema,
  }),
  rules: LoopWorkspaceRulesSummarySchema.optional(),
});

/** Lightweight workspace entry for the dashboard switcher. */
export const LoopWorkspaceSummarySchema = z.object({
  workspaceId: z.string(),
  root: z.string(),
  status: LoopWorkspaceStatusSchema,
  isDefault: z.boolean(),
  selected: z.object({
    codex: LoopRuntimeModeSchema,
    'claude-code': LoopRuntimeModeSchema,
  }),
  rules: LoopWorkspaceRulesSummarySchema.optional(),
});

export const LoopWorkspacesResponseSchema = z.object({
  workspaces: z.array(LoopWorkspaceSummarySchema),
  /** workspaceId of the current/active workspace. */
  current: z.string(),
  recentLearnings: z.array(LoopLearningSchema).optional(),
  learningGovernance: LoopLearningGovernanceSchema.optional(),
  learningIndex: LoopLearningIndexSchema.optional(),
});

export const LoopAssetPermissionActionSchema = z.enum(['read', 'create', 'operate', 'admin']);

export const LoopAssetPermissionKindSchema = z.enum([
  'workspace',
  'blueprint',
  'runtime-backend',
  'tool',
  'eval-suite',
  'trigger',
  'remote-runner',
  'mcp-server',
  'ci-check',
]);

export const LoopAssetPermissionItemSchema = z.object({
  assetKind: LoopAssetPermissionKindSchema,
  assetId: z.string(),
  label: z.string(),
  scope: z.enum(['tenant', 'workspace', 'repo', 'global']),
  requiredAction: LoopAssetPermissionActionSchema,
  granted: z.boolean(),
  sourcePermission: z.string(),
});

export const LoopAssetPermissionsResponseSchema = z.object({
  identity: z.object({
    userId: z.string(),
    teamId: z.string().optional(),
    tenantId: z.string().optional(),
    isSuperAdmin: z.boolean(),
  }),
  source: z.literal('sso'),
  permissions: z.array(z.string()),
  roles: z.array(z.string()).default([]),
  assets: z.array(LoopAssetPermissionItemSchema),
  summary: z.object({
    total: z.number().int().nonnegative(),
    granted: z.number().int().nonnegative(),
    blocked: z.number().int().nonnegative(),
  }),
});

export const UpsertLoopWorkspaceAgentsSchema = z.object({
  codex: z.object({ mode: LoopRuntimeModeSchema }).optional(),
  'claude-code': z.object({ mode: LoopRuntimeModeSchema }).optional(),
});

export const UpsertLoopWorkspaceRequestSchema = z.object({
  workspaceId: z.string().trim().min(1),
  root: z.string().trim().min(1),
  containerWorkdir: z.string().trim().min(1).optional(),
  makeDefault: z.boolean().optional(),
  agents: UpsertLoopWorkspaceAgentsSchema.optional(),
});

export const DetectLoopRuntimeResponseSchema = z.object({
  workspaceId: z.string(),
  root: z.string(),
  status: LoopWorkspaceStatusSchema,
  runtimes: z.array(LoopRuntimeDetectionSchema),
});

export const PullLoopImageRequestSchema = z.object({
  agent: LoopAgentKindSchema,
});

export const PullLoopImageResponseSchema = z.object({
  agent: LoopAgentKindSchema,
  image: z.string(),
  status: z.enum(['pulled', 'already-present', 'failed']),
  message: z.string(),
});

// ============================================================================
// Simple issue intake (0622 · B4). Lowers the submission barrier to "one
// sentence + workspace"; the backend normalises into the existing
// CreateLoopIssueRequest, keeping the SSO submitter server-derived.
// ============================================================================
export const LoopSimpleIssueTemplateSchema = z.enum([
  'auto',
  'feature',
  'bugfix',
  'docs',
  'refactor',
  'integration',
  'flow',
]);

export const CreateLoopIssueSimpleRequestSchema = z.object({
  request: z.string().trim().min(10).max(8000),
  workspaceId: z.string().trim().min(1).optional(),
  targetRepo: z.string().trim().min(1).optional(),
  template: LoopSimpleIssueTemplateSchema.default('auto'),
  priority: LoopPrioritySchema.optional(),
  title: z.string().trim().min(4).max(160).optional(),
  acceptanceCriteria: z.array(z.string().trim().min(1)).optional(),
  tenantContext: LoopTenantContextSchema.optional(),
});

/** Normalised preview of what the simple request will become before create. */
export const LoopSimpleIssuePreviewSchema = z.object({
  title: z.string(),
  body: z.string(),
  template: LoopSimpleIssueTemplateSchema,
  priority: LoopPrioritySchema,
  acceptanceCriteria: z.array(z.string()),
  targetRepo: z.string(),
});

export type CreateLoopIssueRequest = z.infer<typeof CreateLoopIssueRequestSchema>;
export type LoopPriority = z.infer<typeof LoopPrioritySchema>;
export type LoopSourceChannel = z.infer<typeof LoopSourceChannelSchema>;
export type LoopSourceKind = z.infer<typeof LoopSourceKindSchema>;
export type LoopSubmitterProvider = z.infer<typeof LoopSubmitterProviderSchema>;
export type LoopTenantContext = z.infer<typeof LoopTenantContextSchema>;
export type LoopSubmitter = z.infer<typeof LoopSubmitterSchema>;
export type LoopRuleSnapshotRule = z.infer<typeof LoopRuleSnapshotRuleSchema>;
export type LoopRuleSnapshotDiagnostic = z.infer<typeof LoopRuleSnapshotDiagnosticSchema>;
export type LoopRuleSnapshotEnforcement = z.infer<typeof LoopRuleSnapshotEnforcementSchema>;
export type LoopRuleSnapshot = z.infer<typeof LoopRuleSnapshotSchema>;
export type LoopPhase = z.infer<typeof LoopPhaseSchema>;
export type LoopIssue = z.infer<typeof LoopIssueSchema>;
export type LoopIntake = z.infer<typeof LoopIntakeSchema>;
export type LoopSpec = z.infer<typeof LoopSpecSchema>;
export type LoopSpecHistoryItem = z.infer<typeof LoopSpecHistoryItemSchema>;
export type LoopShard = z.infer<typeof LoopShardSchema>;
export type LoopAnnotation = z.infer<typeof LoopAnnotationSchema>;
export type LoopTestMatrix = z.infer<typeof LoopTestMatrixSchema>;
export type LoopRecordShardImplementationRequest = z.infer<
  typeof LoopRecordShardImplementationRequestSchema
>;
export type LoopReviewVerdict = z.infer<typeof LoopReviewVerdictSchema>;
export type LoopImplementationRecord = z.infer<typeof LoopImplementationRecordSchema>;
export type LoopReviewShardRequest = z.infer<typeof LoopReviewShardRequestSchema>;
export type LoopReviewRecord = z.infer<typeof LoopReviewRecordSchema>;
export type LoopRuntimeSecurityPolicySnapshot = z.infer<
  typeof LoopRuntimeSecurityPolicySnapshotSchema
>;
export type LoopRunShardTestsRequest = z.infer<typeof LoopRunShardTestsRequestSchema>;
export type LoopTestRecord = z.infer<typeof LoopTestRecordSchema>;
export type LoopStateItem = z.infer<typeof LoopStateItemSchema>;
export type LoopLogEntry = z.infer<typeof LoopLogEntrySchema>;
export type LoopLogsQuery = z.infer<typeof LoopLogsQuerySchema>;
export type LoopLogsResponse = z.infer<typeof LoopLogsResponseSchema>;
export type LoopNotification = z.infer<typeof LoopNotificationSchema>;
export type LoopNotificationsQuery = z.infer<typeof LoopNotificationsQuerySchema>;
export type LoopNotificationsResponse = z.infer<typeof LoopNotificationsResponseSchema>;
export type LoopCostItem = z.infer<typeof LoopCostItemSchema>;
export type LoopCostResponse = z.infer<typeof LoopCostResponseSchema>;
export type LoopMetricsPhaseItem = z.infer<typeof LoopMetricsPhaseItemSchema>;
export type LoopMetricsRiskItem = z.infer<typeof LoopMetricsRiskItemSchema>;
export type LoopMetricsActionItem = z.infer<typeof LoopMetricsActionItemSchema>;
export type LoopBenchMetricKey = z.infer<typeof LoopBenchMetricKeySchema>;
export type LoopBenchMetrics = z.infer<typeof LoopBenchMetricsSchema>;
export type LoopBenchTrendSnapshot = z.infer<typeof LoopBenchTrendSnapshotSchema>;
export type LoopBenchTrendSummary = z.infer<typeof LoopBenchTrendSummarySchema>;
export type LoopBenchTrendWorkerResponse = z.infer<typeof LoopBenchTrendWorkerResponseSchema>;
export type LoopRequirementCoverageItem = z.infer<typeof LoopRequirementCoverageItemSchema>;
export type LoopRequirementCoverageSummary = z.infer<typeof LoopRequirementCoverageSummarySchema>;
export type LoopRequirementCoverage = z.infer<typeof LoopRequirementCoverageSchema>;
export type LoopEvidenceArtifact = z.infer<typeof LoopEvidenceArtifactSchema>;
export type LoopLearning = z.infer<typeof LoopLearningSchema>;
export type LoopLearningIndexEntry = z.infer<typeof LoopLearningIndexEntrySchema>;
export type LoopLearningIndex = z.infer<typeof LoopLearningIndexSchema>;
export type LoopRuntimeSecurityException = z.infer<typeof LoopRuntimeSecurityExceptionSchema>;
export type LoopLearningGovernanceAction = z.infer<typeof LoopLearningGovernanceActionSchema>;
export type LoopLearningGovernanceRequest = z.infer<typeof LoopLearningGovernanceRequestSchema>;
export type LoopLearningGovernance = z.infer<typeof LoopLearningGovernanceSchema>;
export type LoopTraceSummary = z.infer<typeof LoopTraceSummarySchema>;
export type LoopResumeSummary = z.infer<typeof LoopResumeSummarySchema>;
export type LoopWorkflowRuntimeOwner = z.infer<typeof LoopWorkflowRuntimeOwnerSchema>;
export type LoopWorkflowStepKind = z.infer<typeof LoopWorkflowStepKindSchema>;
export type LoopWorkflowGate = z.infer<typeof LoopWorkflowGateSchema>;
export type LoopWorkflowStep = z.infer<typeof LoopWorkflowStepSchema>;
export type LoopWorkflowRecipe = z.infer<typeof LoopWorkflowRecipeSchema>;
export type LoopReviewGateKind = z.infer<typeof LoopReviewGateKindSchema>;
export type LoopReviewGateStatus = z.infer<typeof LoopReviewGateStatusSchema>;
export type LoopReviewGate = z.infer<typeof LoopReviewGateSchema>;
export type LoopReleaseGate = z.infer<typeof LoopReleaseGateSchema>;
export type LoopSecondOpinionFinding = z.infer<typeof LoopSecondOpinionFindingSchema>;
export type LoopSecondOpinionReviewer = z.infer<typeof LoopSecondOpinionReviewerSchema>;
export type LoopSecondOpinion = z.infer<typeof LoopSecondOpinionSchema>;
export type LoopDeliveryGovernance = z.infer<typeof LoopDeliveryGovernanceSchema>;
export type LoopDeliveryGovernanceRequest = z.infer<typeof LoopDeliveryGovernanceRequestSchema>;
export type LoopAgentRuntimeStatus = z.infer<typeof LoopAgentRuntimeStatusSchema>;
export type LoopAgentRuntimeItem = z.infer<typeof LoopAgentRuntimeItemSchema>;
export type LoopAgentRuntimeDiagnostic = z.infer<typeof LoopAgentRuntimeDiagnosticSchema>;
export type LoopAgentRuntimeResponse = z.infer<typeof LoopAgentRuntimeResponseSchema>;
export type LoopMetricsResponse = z.infer<typeof LoopMetricsResponseSchema>;
export type LoopDetail = z.infer<typeof LoopDetailSchema>;
export type LoopIssuesQuery = z.infer<typeof LoopIssuesQuerySchema>;
export type LoopIssueListItem = z.infer<typeof LoopIssueListItemSchema>;
export type LoopListResponse = z.infer<typeof LoopListResponseSchema>;
export type LoopIssueCreatedResponse = z.infer<typeof LoopIssueCreatedResponseSchema>;
export type LoopReviewSpecRequest = z.infer<typeof LoopReviewSpecRequestSchema>;
export type LoopInterventionRequest = z.infer<typeof LoopInterventionRequestSchema>;
export type LoopsDoctorResponse = z.infer<typeof LoopsDoctorResponseSchema>;
export type LoopsResumeResponse = z.infer<typeof LoopsResumeResponseSchema>;
export type LoopCapabilityStatus = z.infer<typeof LoopCapabilityStatusSchema>;
export type LoopCapabilityCategory = z.infer<typeof LoopCapabilityCategorySchema>;
export type LoopRegistryLifecycle = z.infer<typeof LoopRegistryLifecycleSchema>;
export type LoopRegistryPermission = z.infer<typeof LoopRegistryPermissionSchema>;
export type LoopAgentRegistryItem = z.infer<typeof LoopAgentRegistryItemSchema>;
export type LoopToolRegistryItem = z.infer<typeof LoopToolRegistryItemSchema>;
export type LoopAgentToolRegistry = z.infer<typeof LoopAgentToolRegistrySchema>;
export type LoopCapabilityItem = z.infer<typeof LoopCapabilityItemSchema>;
export type LoopCapabilitiesResponse = z.infer<typeof LoopCapabilitiesResponseSchema>;
export type LoopGlobalVerdict = z.infer<typeof LoopGlobalVerdictSchema>;
export type LoopGlobalReviewRecord = z.infer<typeof LoopGlobalReviewRecordSchema>;
export type LoopReloopRequest = z.infer<typeof LoopReloopRequestSchema>;
export type LoopReloopResponse = z.infer<typeof LoopReloopResponseSchema>;
export type LoopBrowserQaRequest = z.infer<typeof LoopBrowserQaRequestSchema>;
export type LoopBrowserQaReport = z.infer<typeof LoopBrowserQaReportSchema>;
export type LoopNaturalCommandIntent = z.infer<typeof LoopNaturalCommandIntentSchema>;
export type LoopNaturalCommandRequest = z.infer<typeof LoopNaturalCommandRequestSchema>;
export type LoopNaturalCommandResponse = z.infer<typeof LoopNaturalCommandResponseSchema>;
export type LoopConvergencePr = z.infer<typeof LoopConvergencePrSchema>;
// 0622 · Agent runtime detection / workspace / simple issue
export type LoopAgentKind = z.infer<typeof LoopAgentKindSchema>;
export type LoopRuntimeMode = z.infer<typeof LoopRuntimeModeSchema>;
export type LoopRuntimeStatus = z.infer<typeof LoopRuntimeStatusSchema>;
export type LoopRuntimeDiagnosticCode = z.infer<typeof LoopRuntimeDiagnosticCodeSchema>;
export type LoopRuntimeCheck = z.infer<typeof LoopRuntimeCheckSchema>;
export type LoopRuntimeCandidate = z.infer<typeof LoopRuntimeCandidateSchema>;
export type LoopRuntimeDetection = z.infer<typeof LoopRuntimeDetectionSchema>;
export type LoopWorkspaceStatus = z.infer<typeof LoopWorkspaceStatusSchema>;
export type LoopWorkspaceRuleStatus = z.infer<typeof LoopWorkspaceRuleStatusSchema>;
export type LoopWorkspaceRule = z.infer<typeof LoopWorkspaceRuleSchema>;
export type LoopWorkspaceRuleDiagnosticLevel = z.infer<
  typeof LoopWorkspaceRuleDiagnosticLevelSchema
>;
export type LoopWorkspaceRuleDiagnostic = z.infer<typeof LoopWorkspaceRuleDiagnosticSchema>;
export type LoopWorkspaceRulesSummary = z.infer<typeof LoopWorkspaceRulesSummarySchema>;
export type LoopWorkspaceAgentProfile = z.infer<typeof LoopWorkspaceAgentProfileSchema>;
export type LoopWorkspaceProfile = z.infer<typeof LoopWorkspaceProfileSchema>;
export type LoopWorkspaceSummary = z.infer<typeof LoopWorkspaceSummarySchema>;
export type LoopWorkspacesResponse = z.infer<typeof LoopWorkspacesResponseSchema>;
export type LoopAssetPermissionAction = z.infer<typeof LoopAssetPermissionActionSchema>;
export type LoopAssetPermissionKind = z.infer<typeof LoopAssetPermissionKindSchema>;
export type LoopAssetPermissionItem = z.infer<typeof LoopAssetPermissionItemSchema>;
export type LoopAssetPermissionsResponse = z.infer<typeof LoopAssetPermissionsResponseSchema>;
export type UpsertLoopWorkspaceRequest = z.infer<typeof UpsertLoopWorkspaceRequestSchema>;
export type DetectLoopRuntimeResponse = z.infer<typeof DetectLoopRuntimeResponseSchema>;
export type PullLoopImageRequest = z.infer<typeof PullLoopImageRequestSchema>;
export type PullLoopImageResponse = z.infer<typeof PullLoopImageResponseSchema>;
export type LoopSimpleIssueTemplate = z.infer<typeof LoopSimpleIssueTemplateSchema>;
export type CreateLoopIssueSimpleRequest = z.infer<typeof CreateLoopIssueSimpleRequestSchema>;
export type LoopSimpleIssuePreview = z.infer<typeof LoopSimpleIssuePreviewSchema>;

// ============================================================================
// Delivery Evidence (P0-4, 0623 · CrewAI gap 8). A derived, exportable summary
// of one loop's spec, work packages, tests, reviews, risks, cost and global
// verdict, plus a pre-formatted markdown body for PR comments. v1 is derived
// read-only from existing LoopDetail data; no new persistence is required.
// Runtime execution still sits on Codex CLI / Claude Code CLI.
// ============================================================================
export const LoopDeliveryEvidenceWorkPackageSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  files: z.array(z.string()).default([]),
  tests: z.string(),
  review: z.string(),
  commitSha: z.string().trim().min(7).optional(),
  commitMessage: z.string().trim().min(1).optional(),
  branch: z.string().trim().min(1).optional(),
});

export const LoopDeliveryEvidenceSchema = z.object({
  issueId: z.string(),
  generatedAt: z.string(),
  spec: z.object({
    version: z.string(),
    status: z.string(),
    summary: z.string(),
  }),
  workPackages: z.array(LoopDeliveryEvidenceWorkPackageSchema).default([]),
  tests: z.object({
    total: z.number().int().nonnegative(),
    passed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    coverage: z.string(),
  }),
  reviews: z.object({
    shardReviews: z.number().int().nonnegative(),
    globalVerdict: z.string(),
    findings: z.number().int().nonnegative(),
  }),
  risks: z.array(
    z.object({
      severity: z.enum(['critical', 'warning', 'info']),
      description: z.string(),
    }),
  ),
  cost: z.object({
    tokens: z.number().int().nonnegative(),
    calls: z.number().int().nonnegative(),
    budget: z.string(),
  }),
  globalVerdict: z.string(),
  prReady: z.boolean(),
  prStatus: z.string(),
  markdown: z.string(),
});

export type LoopDeliveryEvidence = z.infer<typeof LoopDeliveryEvidenceSchema>;
export type LoopDeliveryEvidenceWorkPackage = z.infer<typeof LoopDeliveryEvidenceWorkPackageSchema>;

// ============================================================================
// Runtime Backend Registry (P0-2, 0623 · CrewAI gap 2). A formal contract for
// Codex CLI / Claude Code CLI runtimes as first-class, configurable assets.
// v1: derived read-only from existing agent-runtime-detection data.
// ============================================================================
export const RuntimeBackendKindSchema = z.enum([
  'codex-cli',
  'claude-code-cli',
  'docker',
  'remote-runner',
]);
export const RuntimeBackendStatusSchema = z.enum(['ready', 'degraded', 'unavailable']);
export const RuntimeBackendModeSchema = z.enum(['local-cli', 'docker', 'remote']);

export const RuntimeBackendHealthCheckSchema = z.object({
  code: z.string(),
  level: z.enum(['critical', 'warning', 'info']),
  message: z.string(),
  action: z.string(),
});

export const RuntimeBackendSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: RuntimeBackendKindSchema,
  mode: RuntimeBackendModeSchema,
  status: RuntimeBackendStatusSchema,
  version: z.string().optional(),
  authStatus: z.enum(['authenticated', 'not-authenticated', 'unreported']),
  supportedStages: z.array(z.string()),
  permissionProfile: z.string(),
  workspacePolicy: z.string(),
  costPolicy: z.string(),
  fallbackPolicy: z.string(),
  healthChecks: z.array(RuntimeBackendHealthCheckSchema),
  lastDetectedAt: z.string().optional(),
});

export const RuntimeBackendListResponseSchema = PaginatedResponseSchema(RuntimeBackendSchema);

export const RuntimeBackendPolicyUpdateSchema = z.object({
  fallbackPolicy: z.string().trim().min(1).optional(),
  costPolicy: z.string().trim().min(1).optional(),
  permissionProfile: z.string().trim().min(1).optional(),
});

export type RuntimeBackendKind = z.infer<typeof RuntimeBackendKindSchema>;
export type RuntimeBackendStatus = z.infer<typeof RuntimeBackendStatusSchema>;
export type RuntimeBackendMode = z.infer<typeof RuntimeBackendModeSchema>;
export type RuntimeBackendHealthCheck = z.infer<typeof RuntimeBackendHealthCheckSchema>;
export type RuntimeBackend = z.infer<typeof RuntimeBackendSchema>;
export type RuntimeBackendListResponse = z.infer<typeof RuntimeBackendListResponseSchema>;
export type RuntimeBackendPolicyUpdate = z.infer<typeof RuntimeBackendPolicyUpdateSchema>;

// ============================================================================
// Remote Runner Pool (P2-3, 0623 · CrewAI). Control-plane v1 for execution pool
// governance. Jobs still execute through Codex CLI / Claude Code CLI runtimes;
// this surface models pool capacity, leases, artifact roots, and SSO-gated
// lifecycle actions before a real queue worker is introduced.
// ============================================================================
export const LoopRemoteRunnerStatusSchema = z.enum(['ready', 'degraded', 'offline']);

export const LoopRemoteRunnerSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: LoopRemoteRunnerStatusSchema,
  runtimeBackends: z.array(RuntimeBackendKindSchema),
  capacity: z.object({
    maxConcurrent: z.number().int().positive(),
    leased: z.number().int().nonnegative(),
    available: z.number().int().nonnegative(),
  }),
  queue: z.object({
    pending: z.number().int().nonnegative(),
    running: z.number().int().nonnegative(),
  }),
  sandboxProfile: z.enum(['workspace-scoped', 'docker-isolated', 'remote-sandbox']),
  artifactRoot: z.string(),
  leaseTtlSec: z.number().int().positive(),
  health: z.object({
    ok: z.boolean(),
    message: z.string(),
  }),
  risks: z.array(z.string()).default([]),
});

export const LoopRemoteRunnerListResponseSchema = PaginatedResponseSchema(LoopRemoteRunnerSchema);

export const LoopRemoteRunnerLeaseRequestSchema = z.object({
  issueId: z.string().trim().min(1).optional(),
  shardId: z.string().trim().min(1).optional(),
  runtimeBackend: RuntimeBackendKindSchema.default('codex-cli'),
  reason: z.string().trim().min(1).optional(),
});

export const LoopRemoteRunnerLeaseSchema = z.object({
  id: z.string(),
  runnerId: z.string(),
  issueId: z.string().optional(),
  shardId: z.string().optional(),
  runtimeBackend: RuntimeBackendKindSchema,
  status: z.enum(['leased', 'released']),
  leasedAt: z.string(),
  expiresAt: z.string(),
  artifactRoot: z.string(),
  message: z.string(),
});

export const LoopRemoteRunnerReleaseRequestSchema = z.object({
  leaseId: z.string().trim().min(1),
  reason: z.string().trim().min(1).optional(),
});

export const LoopRemoteRunnerJobArtifactSchema = z.object({
  path: z.string().trim().min(1),
  kind: z.enum(['manifest', 'log', 'evidence', 'trace']),
  sizeBytes: z.number().int().nonnegative().optional(),
  sha256: z.string().trim().min(1).optional(),
});

export const LoopRemoteRunnerJobRequestSchema = z.object({
  leaseId: z.string().trim().min(1).optional(),
  issueId: z.string().trim().min(1).optional(),
  shardId: z.string().trim().min(1).optional(),
  runtimeBackend: RuntimeBackendKindSchema.default('codex-cli'),
  workerKind: z.enum(['codex-cli', 'claude-code-cli', 'artifact-only']).default('artifact-only'),
  reason: z.string().trim().min(1).optional(),
});

export const LoopRemoteRunnerJobSchema = z.object({
  id: z.string(),
  runnerId: z.string(),
  leaseId: z.string().optional(),
  issueId: z.string().optional(),
  shardId: z.string().optional(),
  runtimeBackend: RuntimeBackendKindSchema,
  workerKind: z.enum(['codex-cli', 'claude-code-cli', 'artifact-only']),
  status: z.enum(['queued', 'running', 'succeeded', 'failed']),
  queuedAt: z.string(),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
  artifactRoot: z.string(),
  artifacts: z.array(LoopRemoteRunnerJobArtifactSchema).default([]),
  message: z.string(),
});

export type LoopRemoteRunnerStatus = z.infer<typeof LoopRemoteRunnerStatusSchema>;
export type LoopRemoteRunner = z.infer<typeof LoopRemoteRunnerSchema>;
export type LoopRemoteRunnerListResponse = z.infer<typeof LoopRemoteRunnerListResponseSchema>;
export type LoopRemoteRunnerLeaseRequest = z.infer<typeof LoopRemoteRunnerLeaseRequestSchema>;
export type LoopRemoteRunnerLease = z.infer<typeof LoopRemoteRunnerLeaseSchema>;
export type LoopRemoteRunnerReleaseRequest = z.infer<typeof LoopRemoteRunnerReleaseRequestSchema>;
export type LoopRemoteRunnerJobArtifact = z.infer<typeof LoopRemoteRunnerJobArtifactSchema>;
export type LoopRemoteRunnerJobRequest = z.infer<typeof LoopRemoteRunnerJobRequestSchema>;
export type LoopRemoteRunnerJob = z.infer<typeof LoopRemoteRunnerJobSchema>;

// ============================================================================
// Multi-tenant Recipe Admin (P2, 0623 · CrewAI). Control-plane action requests
// for tenant-scoped delivery blueprint administration. v1 persists an auditable
// request artifact; downstream CRUD/approval/rollback workers consume it later.
// ============================================================================
export const LoopRecipeAdminActionIdSchema = z.enum([
  'createVersion',
  'reviewApproval',
  'rollbackVersion',
]);

export const LoopRecipeAdminActionRequestSchema = z.object({
  actionId: LoopRecipeAdminActionIdSchema,
  blueprintId: z.string().trim().min(1).default('delivery-blueprints'),
  recipeKind: z.string().trim().min(1).optional(),
  targetVersion: z.string().trim().min(1).optional(),
  reason: z.string().trim().min(1).optional(),
  evidenceRefs: z.array(z.string().trim().min(1)).default([]),
});

export const LoopRecipeAdminActionResponseSchema = z.object({
  id: z.string(),
  actionId: LoopRecipeAdminActionIdSchema,
  status: z.enum(['requested', 'blocked']),
  artifactRef: z.string().trim().min(1),
  blueprintId: z.string(),
  recipeKind: z.string().optional(),
  targetVersion: z.string().optional(),
  tenantId: z.string().optional(),
  teamId: z.string().optional(),
  actorId: z.string(),
  sourcePermission: z.string(),
  requestedAt: z.string(),
  reason: z.string().optional(),
  evidenceRefs: z.array(z.string()).default([]),
  message: z.string(),
});

export type LoopRecipeAdminActionId = z.infer<typeof LoopRecipeAdminActionIdSchema>;
export type LoopRecipeAdminActionRequest = z.infer<typeof LoopRecipeAdminActionRequestSchema>;
export type LoopRecipeAdminActionResponse = z.infer<typeof LoopRecipeAdminActionResponseSchema>;

// ============================================================================
// MCP / CI Integration Registry (P1-2/P2-3, 0623 · CrewAI). Control-plane v1 for
// tenant-governed integration assets. Real MCP handshake and GitHub Checks API
// publication stay in provider clients; this contract captures config posture,
// compatibility, and SSO-gated lifecycle actions.
// ============================================================================
export const LoopIntegrationLifecycleSchema = z.enum([
  'configured',
  'connected',
  'disconnected',
  'failed',
]);

export const LoopMcpServerSchema = z.object({
  id: z.string(),
  name: z.string(),
  protocol: z.literal('mcp'),
  transport: z.enum(['stdio', 'sse', 'http']),
  status: LoopIntegrationLifecycleSchema,
  toolIds: z.array(z.string()).default([]),
  permissionProfile: z.string(),
  authStatus: z.enum(['configured', 'missing', 'not-required']),
  secretRef: z.string().trim().min(1).optional(),
  lastTestedAt: z.string().optional(),
  health: z.object({
    ok: z.boolean(),
    message: z.string(),
  }),
  executionAudit: z
    .object({
      auditRef: z.string(),
      artifactRef: z.string().trim().min(1).optional(),
      providerId: z.string(),
      action: z.enum(['connect', 'disconnect', 'test']),
      outcome: z.enum(['success', 'failed', 'skipped']),
      toolCount: z.number().int().nonnegative(),
      recordedAt: z.string(),
    })
    .optional(),
  risks: z.array(z.string()).default([]),
});

export const LoopMcpServerListResponseSchema = PaginatedResponseSchema(LoopMcpServerSchema);

export const LoopMcpServerActionSchema = z.object({
  reason: z.string().trim().min(1).optional(),
});

export const LoopCiCheckPublicationWorkPackageSchema = z.object({
  workPackageId: z.string().trim().min(1),
  title: z.string().trim().min(1).optional(),
  commitSha: z.string().trim().min(7).optional(),
  commitMessage: z.string().trim().min(1).optional(),
  branch: z.string().trim().min(1).optional(),
  files: z.array(z.string()).default([]),
});

export const LoopCiCheckPublicationSchema = z.object({
  artifactRef: z.string().trim().min(1),
  integrationId: z.string().trim().min(1).optional(),
  provider: z.enum(['github', 'gitlab', 'gitea']).optional(),
  headSha: z.string().trim().min(7).optional(),
  checkRunId: z.string().trim().min(1).optional(),
  url: z.string().url().optional(),
  outcome: z.enum(['published', 'failed']),
  reason: z.string().trim().min(1).optional(),
  issueId: z.string().trim().min(1).optional(),
  prId: z.string().trim().min(1).optional(),
  evidenceBacklink: z.string().url().optional(),
  workPackageCommitMap: z.array(LoopCiCheckPublicationWorkPackageSchema).default([]),
  request: z
    .object({
      name: z.string().trim().min(1).optional(),
      title: z.string().trim().min(1).optional(),
      summary: z.string().trim().min(1).optional(),
      detailsUrl: z.string().url().optional(),
      evidenceBacklink: z.string().url().optional(),
      status: z.enum(['queued', 'in_progress', 'completed']).optional(),
      conclusion: z
        .enum([
          'success',
          'failure',
          'neutral',
          'cancelled',
          'skipped',
          'timed_out',
          'action_required',
        ])
        .optional(),
    })
    .default({}),
  publishedAt: z.string(),
});

export const LoopCiCheckPublicationHistorySchema = z.object({
  integrationId: z.string().trim().min(1),
  latest: LoopCiCheckPublicationSchema.optional(),
  entries: z.array(LoopCiCheckPublicationSchema).default([]),
  updatedAt: z.string().optional(),
});

export const LoopCiCheckIntegrationSchema = z.object({
  id: z.string(),
  provider: z.enum(['github-checks', 'generic-ci']),
  name: z.string(),
  status: LoopIntegrationLifecycleSchema,
  requiredForRelease: z.boolean(),
  checkSuites: z.array(z.string()).default([]),
  targetRef: z.string(),
  lastPublishedAt: z.string().optional(),
  lastPublication: LoopCiCheckPublicationSchema.optional(),
  health: z.object({
    ok: z.boolean(),
    message: z.string(),
  }),
  risks: z.array(z.string()).default([]),
});

export const LoopCiCheckIntegrationListResponseSchema = PaginatedResponseSchema(
  LoopCiCheckIntegrationSchema,
);

export const LoopCiCheckActionSchema = z.object({
  reason: z.string().trim().min(1).optional(),
  headSha: z.string().trim().min(7).optional(),
  name: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).optional(),
  summary: z.string().trim().min(1).optional(),
  detailsUrl: z.string().url().optional(),
  issueId: z.string().trim().min(1).optional(),
  prId: z.string().trim().min(1).optional(),
  evidenceBacklink: z.string().url().optional(),
  status: z.enum(['queued', 'in_progress', 'completed']).optional(),
  conclusion: z
    .enum(['success', 'failure', 'neutral', 'cancelled', 'skipped', 'timed_out', 'action_required'])
    .optional(),
});

export type LoopIntegrationLifecycle = z.infer<typeof LoopIntegrationLifecycleSchema>;
export type LoopMcpServer = z.infer<typeof LoopMcpServerSchema>;
export type LoopMcpServerListResponse = z.infer<typeof LoopMcpServerListResponseSchema>;
export type LoopMcpServerAction = z.infer<typeof LoopMcpServerActionSchema>;
export type LoopCiCheckIntegration = z.infer<typeof LoopCiCheckIntegrationSchema>;
export type LoopCiCheckPublicationWorkPackage = z.infer<
  typeof LoopCiCheckPublicationWorkPackageSchema
>;
export type LoopCiCheckPublication = z.infer<typeof LoopCiCheckPublicationSchema>;
export type LoopCiCheckPublicationHistory = z.infer<typeof LoopCiCheckPublicationHistorySchema>;
export type LoopCiCheckIntegrationListResponse = z.infer<
  typeof LoopCiCheckIntegrationListResponseSchema
>;
export type LoopCiCheckAction = z.infer<typeof LoopCiCheckActionSchema>;

// ============================================================================
// Eval Suite / Eval Run (P0-3, 0623 · CrewAI gap 4). Formal quality gate
// contracts so teams can track pass rates, trends, and baselines across loops.
// v1: derived from existing loop evidence (architecture, delivery, runtime, test,
// cost) — no new persistence. suite-scoped, not per-loop.
// ============================================================================
export const EvalScopeSchema = z.enum([
  'workspace',
  'blueprint',
  'agent',
  'runtime',
  'tool',
  'delivery',
]);
export const EvalCheckStatusSchema = z.enum(['passed', 'attention', 'blocked']);

export const EvalSuiteCheckSchema = z.object({
  id: z.string(),
  label: z.string(),
  category: z.enum(['architecture', 'delivery', 'runtime', 'test', 'cost']),
  hardGate: z.boolean(),
  status: EvalCheckStatusSchema,
  evidence: z.string(),
  passCount: z.number().int().nonnegative(),
  failCount: z.number().int().nonnegative(),
  blockedCount: z.number().int().nonnegative(),
});

export const EvalSuiteSchema = z.object({
  id: z.string(),
  name: z.string(),
  scope: EvalScopeSchema,
  version: z.number().int().positive(),
  capturedAt: z.string(),
  checks: z.array(EvalSuiteCheckSchema),
  summary: z.object({
    total: z.number().int().nonnegative(),
    passed: z.number().int().nonnegative(),
    attention: z.number().int().nonnegative(),
    blocked: z.number().int().nonnegative(),
    passRate: z.number().min(0).max(100),
  }),
});

export const EvalSuiteListResponseSchema = PaginatedResponseSchema(EvalSuiteSchema);

export const EvalRunSchema = z.object({
  id: z.string(),
  suiteId: z.string(),
  loopId: z.string(),
  targetRef: z.string(),
  blueprintId: z.string().optional(),
  baselineVersion: z.string().optional(),
  baselineScore: z.number().min(0).max(100).optional(),
  status: EvalCheckStatusSchema,
  score: z.number().min(0).max(100),
  checkResults: z.array(EvalSuiteCheckSchema),
  evidenceRefs: z.array(z.string()).default([]),
  trendDelta: z.number().optional(),
  runAt: z.string(),
});

export const EvalRunListResponseSchema = PaginatedResponseSchema(EvalRunSchema);

export const EvalHistoricalBaselineSnapshotSchema = z.object({
  id: z.string(),
  suiteId: z.string(),
  blueprintId: z.string(),
  baselineVersion: z.string(),
  capturedAt: z.string(),
  runCount: z.number().int().nonnegative(),
  averageScore: z.number().min(0).max(100),
  passRate: z.number().min(0).max(100),
  previousAverageScore: z.number().min(0).max(100).optional(),
  trendDelta: z.number().optional(),
});

export const EvalTrendWorkerResponseSchema = z.object({
  generatedAt: z.string(),
  snapshotCount: z.number().int().nonnegative(),
  baselines: z.array(EvalHistoricalBaselineSnapshotSchema),
});

export type EvalScope = z.infer<typeof EvalScopeSchema>;
export type EvalCheckStatus = z.infer<typeof EvalCheckStatusSchema>;
export type EvalSuiteCheck = z.infer<typeof EvalSuiteCheckSchema>;
export type EvalSuite = z.infer<typeof EvalSuiteSchema>;
export type EvalSuiteListResponse = z.infer<typeof EvalSuiteListResponseSchema>;
export type EvalRun = z.infer<typeof EvalRunSchema>;
export type EvalRunListResponse = z.infer<typeof EvalRunListResponseSchema>;
export type EvalHistoricalBaselineSnapshot = z.infer<typeof EvalHistoricalBaselineSnapshotSchema>;
export type EvalTrendWorkerResponse = z.infer<typeof EvalTrendWorkerResponseSchema>;

// ============================================================================
// Second Opinion Resolution (P1-5, gstack/0, 0623).
// ============================================================================
export const LoopResolveSecondOpinionSchema = z.object({
  action: z.enum(['accept-primary', 'accept-secondary', 'waive', 'request-changes']),
  role: z.enum(['primary', 'secondary']).optional(),
  findingFingerprint: z.string().trim().min(1).optional(),
  findingFingerprints: z.array(z.string().trim().min(1)).optional(),
  reason: z.string().trim().optional(),
});

export type LoopResolveSecondOpinion = z.infer<typeof LoopResolveSecondOpinionSchema>;

// ============================================================================
// Webhook Trigger (P0-2, 0623 · crewAI R7).
// External systems can trigger loop creation via signed webhook POST.
// ============================================================================
export const LoopWebhookTriggerSourceSchema = z.enum([
  'github',
  'linear',
  'jira',
  'slack',
  'schedule',
  'generic',
]);

export const LoopWebhookTriggerSchema = z.object({
  source: LoopWebhookTriggerSourceSchema,
  event: z.string().trim().min(1),
  payload: z.record(z.string(), z.unknown()),
  signatureHeader: z.string().trim().min(1).optional(),
  signature: z.string().trim().min(1).optional(),
  secretRef: z.string().trim().min(1).optional(),
});

export const LoopWebhookTriggerResponseSchema = z.object({
  loopId: z.string(),
  issueId: z.string(),
  source: LoopWebhookTriggerSourceSchema,
  event: z.string(),
  created: z.boolean(),
  message: z.string(),
});

export type LoopWebhookTriggerSource = z.infer<typeof LoopWebhookTriggerSourceSchema>;
export type LoopWebhookTrigger = z.infer<typeof LoopWebhookTriggerSchema>;
export type LoopWebhookTriggerResponse = z.infer<typeof LoopWebhookTriggerResponseSchema>;

// ============================================================================
// Schedule Trigger (P1-3, 0623 · crewAI R30c).
// Cron-based scheduled loop creation for recurring delivery tasks.
// ============================================================================
export const LoopScheduleTriggerStatusSchema = z.enum(['active', 'paused', 'error']);

export const LoopScheduleTriggerSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  blueprintId: z.string().optional(),
  name: z.string().trim().min(1),
  cronExpression: z.string().trim().min(1),
  status: LoopScheduleTriggerStatusSchema,
  targetRepo: z.string().trim().min(1),
  templateTitle: z.string().trim().min(1),
  templateBody: z.string().trim().min(1),
  templatePriority: LoopPrioritySchema.default('P2'),
  templateAcceptanceCriteria: z.array(z.string().trim().min(1)).min(1),
  lastRunAt: z.string().optional(),
  nextRunAt: z.string().optional(),
  failureCount: z.number().int().nonnegative().default(0),
  maxFailures: z.number().int().positive().default(3),
  createdAt: z.string(),
  updatedAt: z.string(),
  owner: z.string().optional(),
});

export const CreateScheduleTriggerRequestSchema = z.object({
  name: z.string().trim().min(1),
  cronExpression: z.string().trim().min(1),
  blueprintId: z.string().trim().min(1).optional(),
  targetRepo: z.string().trim().min(1),
  templateTitle: z.string().trim().min(1),
  templateBody: z.string().trim().min(10),
  templatePriority: LoopPrioritySchema.optional(),
  templateAcceptanceCriteria: z.array(z.string().trim().min(1)).min(1),
  owner: z.string().trim().min(1).optional(),
});

export const UpdateScheduleTriggerRequestSchema = z.object({
  name: z.string().trim().min(1).optional(),
  cronExpression: z.string().trim().min(1).optional(),
  status: LoopScheduleTriggerStatusSchema.optional(),
  blueprintId: z.string().trim().min(1).optional(),
  templateTitle: z.string().trim().min(1).optional(),
  templateBody: z.string().trim().min(10).optional(),
  templatePriority: LoopPrioritySchema.optional(),
  templateAcceptanceCriteria: z.array(z.string().trim().min(1)).optional(),
  owner: z.string().trim().min(1).optional(),
});

export const LoopScheduleTriggerListResponseSchema =
  PaginatedResponseSchema(LoopScheduleTriggerSchema);

// ============================================================================
// Trigger Lifecycle Management (P1-3, 0623 · crewAI R30c).
// Retry, replay, and dead-letter queue for trigger executions.
// ============================================================================
export const LoopTriggerExecutionStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
  'dead_lettered',
]);

export const LoopTriggerExecutionSchema = z.object({
  id: z.string(),
  triggerId: z.string(),
  triggerType: z.enum(['webhook', 'schedule', 'manual']),
  status: LoopTriggerExecutionStatusSchema,
  inputPayload: z.record(z.string(), z.unknown()).optional(),
  outputLoopId: z.string().optional(),
  outputIssueId: z.string().optional(),
  error: z.string().optional(),
  attempt: z.number().int().nonnegative().default(1),
  maxRetries: z.number().int().nonnegative().default(3),
  nextRetryAt: z.string().optional(),
  createdAt: z.string(),
  completedAt: z.string().optional(),
});

export const LoopTriggerRetryRequestSchema = z.object({
  reason: z.string().trim().min(1).optional(),
});

export const LoopTriggerReplayRequestSchema = z.object({
  executionId: z.string().trim().min(1),
  reason: z.string().trim().min(1).optional(),
});

export const LoopTriggerDeadLetterSchema = z.object({
  executionId: z.string(),
  triggerId: z.string(),
  triggerType: z.enum(['webhook', 'schedule', 'manual']),
  error: z.string(),
  attempt: z.number().int().nonnegative(),
  inputPayload: z.record(z.string(), z.unknown()).optional(),
  deadLetteredAt: z.string(),
  reason: z.string().optional(),
});

export const LoopTriggerDeadLetterListResponseSchema = PaginatedResponseSchema(
  LoopTriggerDeadLetterSchema,
);

export const LoopTriggerExecutionListResponseSchema = PaginatedResponseSchema(
  LoopTriggerExecutionSchema,
);

export type LoopScheduleTriggerStatus = z.infer<typeof LoopScheduleTriggerStatusSchema>;
export type LoopScheduleTrigger = z.infer<typeof LoopScheduleTriggerSchema>;
export type CreateScheduleTriggerRequest = z.infer<typeof CreateScheduleTriggerRequestSchema>;
export type UpdateScheduleTriggerRequest = z.infer<typeof UpdateScheduleTriggerRequestSchema>;
export type LoopScheduleTriggerListResponse = z.infer<typeof LoopScheduleTriggerListResponseSchema>;
export type LoopTriggerExecutionStatus = z.infer<typeof LoopTriggerExecutionStatusSchema>;
export type LoopTriggerExecution = z.infer<typeof LoopTriggerExecutionSchema>;
export type LoopTriggerRetryRequest = z.infer<typeof LoopTriggerRetryRequestSchema>;
export type LoopTriggerReplayRequest = z.infer<typeof LoopTriggerReplayRequestSchema>;
export type LoopTriggerDeadLetter = z.infer<typeof LoopTriggerDeadLetterSchema>;
export type LoopTriggerDeadLetterListResponse = z.infer<
  typeof LoopTriggerDeadLetterListResponseSchema
>;
export type LoopTriggerExecutionListResponse = z.infer<
  typeof LoopTriggerExecutionListResponseSchema
>;

// ============================================================================
// Tool Registry (P1-4, 0623 · crewAI gap 5). Formal tool lifecycle management
// with schema, auth, health, test, and audit. Upgrades the read-only capability
// registry into a configurable, governed tool catalog.
// ============================================================================
export const LoopToolLifecycleSchema = z.enum(['active', 'planned', 'experimental', 'deprecated']);
export const LoopToolAuthKindSchema = z.enum(['none', 'token', 'oauth', 'ssh', 'mcp']);

export const LoopToolSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.string(),
  category: z.enum(['repo', 'build', 'qa', 'collaboration', 'runtime', 'security', 'custom']),
  status: LoopToolLifecycleSchema,
  description: z.string(),
  schema: z
    .object({
      inputs: z.array(z.object({ name: z.string(), type: z.string(), required: z.boolean() })),
      outputs: z.array(z.object({ name: z.string(), type: z.string() })),
    })
    .optional(),
  auth: z.object({
    kind: LoopToolAuthKindSchema,
    configured: z.boolean(),
    expiresAt: z.string().optional(),
    scopes: z.array(z.string()).default([]),
  }),
  permissions: z.array(z.string()).default([]),
  compatibility: z.object({
    codex: z.boolean(),
    claudeCode: z.boolean(),
    thirdParty: z.enum(['unsupported', 'planned', 'compatible']),
  }),
  health: z.object({
    ok: z.boolean(),
    message: z.string(),
    lastCheckedAt: z.string().optional(),
  }),
  risks: z.array(z.string()).default([]),
  deterministicBoundary: z.string(),
  ownerAgentIds: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const RegisterToolRequestSchema = z.object({
  name: z.string().trim().min(1),
  kind: z.string().trim().min(1),
  category: z.enum(['repo', 'build', 'qa', 'collaboration', 'runtime', 'security', 'custom']),
  description: z.string().trim().min(1),
  authKind: LoopToolAuthKindSchema.default('none'),
  permissions: z.array(z.string()).default([]),
  compatibility: z
    .object({
      codex: z.boolean(),
      claudeCode: z.boolean(),
      thirdParty: z.enum(['unsupported', 'planned', 'compatible']),
    })
    .default({ codex: false, claudeCode: false, thirdParty: 'unsupported' as const }),
  deterministicBoundary: z.string().trim().min(1),
});

export const UpdateToolRequestSchema = z.object({
  name: z.string().trim().min(1).optional(),
  status: LoopToolLifecycleSchema.optional(),
  description: z.string().trim().min(1).optional(),
  permissions: z.array(z.string()).optional(),
  compatibility: z
    .object({
      codex: z.boolean().optional(),
      claudeCode: z.boolean().optional(),
      thirdParty: z.enum(['unsupported', 'planned', 'compatible']).optional(),
    })
    .optional(),
  deterministicBoundary: z.string().trim().min(1).optional(),
});

export const LoopToolListResponseSchema = PaginatedResponseSchema(LoopToolSchema);

export const ToolHealthCheckResponseSchema = z.object({
  toolId: z.string(),
  ok: z.boolean(),
  message: z.string(),
  checkedAt: z.string(),
});

export const ToolTestResponseSchema = z.object({
  toolId: z.string(),
  ok: z.boolean(),
  message: z.string(),
  output: z.string().optional(),
  durationMs: z.number().nonnegative().optional(),
  testedAt: z.string(),
});

export type LoopToolLifecycle = z.infer<typeof LoopToolLifecycleSchema>;
export type LoopToolAuthKind = z.infer<typeof LoopToolAuthKindSchema>;
export type LoopTool = z.infer<typeof LoopToolSchema>;
export type RegisterToolRequest = z.infer<typeof RegisterToolRequestSchema>;
export type UpdateToolRequest = z.infer<typeof UpdateToolRequestSchema>;
export type LoopToolListResponse = z.infer<typeof LoopToolListResponseSchema>;
export type ToolHealthCheckResponse = z.infer<typeof ToolHealthCheckResponseSchema>;
export type ToolTestResponse = z.infer<typeof ToolTestResponseSchema>;

// ============================================================================
// Delivery Blueprint (P1-2, 0623 · crewAI gap 3). Versioned delivery templates
// that encode persona sequence, runtime policy, eval suite, gates, and evidence.
// Upgrades the frontend-only blueprint catalog into a governed, versioned registry.
// ============================================================================
export const LoopBlueprintSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum([
    'bugfix',
    'feature',
    'refactor',
    'docs',
    'integration',
    'flow',
    'security',
    'dependency',
  ]),
  description: z.string(),
  version: z.string(),
  priority: LoopPrioritySchema,
  active: z.boolean(),
  personaSequence: z.array(z.string()),
  evalSuiteId: z.string().optional(),
  gateProfile: z.object({
    humanGates: z.array(z.string()).default([]),
    agentGates: z.array(z.string()).default([]),
    releaseGates: z.array(z.string()).default([]),
  }),
  runtimePolicy: z.object({
    primary: z.string(),
    fallback: z.string().optional(),
  }),
  evidenceTemplate: z.object({
    requiredArtifacts: z.array(z.string()).default([]),
    prCommentTemplate: z.string().optional(),
  }),
  usageCount: z.number().int().nonnegative().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CreateBlueprintRequestSchema = z.object({
  name: z.string().trim().min(1),
  kind: z.enum([
    'bugfix',
    'feature',
    'refactor',
    'docs',
    'integration',
    'flow',
    'security',
    'dependency',
  ]),
  description: z.string().trim().min(1),
  personaSequence: z.array(z.string().trim().min(1)).min(1),
  evalSuiteId: z.string().trim().min(1).optional(),
  gateProfile: z
    .object({
      humanGates: z.array(z.string()).default([]),
      agentGates: z.array(z.string()).default([]),
      releaseGates: z.array(z.string()).default([]),
    })
    .optional(),
  runtimePolicy: z.object({
    primary: z.string().trim().min(1),
    fallback: z.string().trim().min(1).optional(),
  }),
});

export const UpdateBlueprintRequestSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional(),
  active: z.boolean().optional(),
  personaSequence: z.array(z.string().trim().min(1)).optional(),
  evalSuiteId: z.string().trim().min(1).optional(),
  gateProfile: z
    .object({
      humanGates: z.array(z.string()).optional(),
      agentGates: z.array(z.string()).optional(),
      releaseGates: z.array(z.string()).optional(),
    })
    .optional(),
  runtimePolicy: z
    .object({
      primary: z.string().trim().min(1).optional(),
      fallback: z.string().trim().min(1).optional(),
    })
    .optional(),
});

export const LoopBlueprintListResponseSchema = PaginatedResponseSchema(LoopBlueprintSchema);

export type LoopBlueprint = z.infer<typeof LoopBlueprintSchema>;
export type CreateBlueprintRequest = z.infer<typeof CreateBlueprintRequestSchema>;
export type UpdateBlueprintRequest = z.infer<typeof UpdateBlueprintRequestSchema>;
export type LoopBlueprintListResponse = z.infer<typeof LoopBlueprintListResponseSchema>;
