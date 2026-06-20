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
});

export const LoopIssueSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: LoopIssueStatusSchema,
  priority: LoopPrioritySchema,
  created: z.string(),
  updated: z.string(),
  sourceChannel: z.literal('web'),
  sourceKind: z.literal('web_form'),
  submitterId: z.string(),
  submitterName: z.string(),
  targetRepo: z.string(),
  body: z.string(),
  acceptanceCriteria: z.array(z.string()),
  rawPayloadRef: z.string(),
});

export const LoopIntakeSchema = z.object({
  id: z.string(),
  issueId: z.string(),
  sourceChannel: z.literal('web'),
  sourceKind: z.literal('web_form'),
  submitter: LoopSubmitterSchema,
  rawPayloadRef: z.string(),
  status: z.enum(['RECEIVED', 'NEEDS-CLARIFICATION', 'NORMALIZED', 'REJECTED']),
  created: z.string(),
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
  label: z.string(),
  priority: LoopPrioritySchema,
  phase: LoopPhaseSchema.optional(),
  href: z.string(),
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
    'annotations',
  ]),
  path: z.string(),
  status: z.enum(['present', 'pending']),
  count: z.number().int().nonnegative().optional(),
  summary: z.string().optional(),
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
});

export const LoopDetailSchema = z.object({
  issue: LoopIssueSchema,
  intake: LoopIntakeSchema,
  spec: LoopSpecSchema.optional(),
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
  requirementsCoverage: LoopRequirementCoverageSchema.optional(),
  evidenceArtifacts: z.array(LoopEvidenceArtifactSchema).optional(),
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

export type CreateLoopIssueRequest = z.infer<typeof CreateLoopIssueRequestSchema>;
export type LoopSubmitterProvider = z.infer<typeof LoopSubmitterProviderSchema>;
export type LoopSubmitter = z.infer<typeof LoopSubmitterSchema>;
export type LoopIssue = z.infer<typeof LoopIssueSchema>;
export type LoopIntake = z.infer<typeof LoopIntakeSchema>;
export type LoopSpec = z.infer<typeof LoopSpecSchema>;
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
export type LoopRequirementCoverageItem = z.infer<typeof LoopRequirementCoverageItemSchema>;
export type LoopRequirementCoverageSummary = z.infer<typeof LoopRequirementCoverageSummarySchema>;
export type LoopRequirementCoverage = z.infer<typeof LoopRequirementCoverageSchema>;
export type LoopEvidenceArtifact = z.infer<typeof LoopEvidenceArtifactSchema>;
export type LoopTraceSummary = z.infer<typeof LoopTraceSummarySchema>;
export type LoopResumeSummary = z.infer<typeof LoopResumeSummarySchema>;
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
export type LoopConvergencePr = z.infer<typeof LoopConvergencePrSchema>;
