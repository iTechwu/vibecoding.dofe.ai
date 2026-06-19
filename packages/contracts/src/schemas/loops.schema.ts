import { z } from 'zod';

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
  submitterId: z.string().trim().min(1).default('mock-user'),
  submitterName: z.string().trim().min(1).default('Mock User'),
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
  submitter: z.object({
    provider: z.literal('dofe-sso'),
    userId: z.string(),
    name: z.string(),
  }),
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
  state: LoopStateItemSchema,
});

export const LoopListResponseSchema = z.object({
  issues: z.array(LoopIssueSchema),
  loops: z.array(LoopStateItemSchema),
});

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

export type CreateLoopIssueRequest = z.infer<typeof CreateLoopIssueRequestSchema>;
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
export type LoopCostItem = z.infer<typeof LoopCostItemSchema>;
export type LoopCostResponse = z.infer<typeof LoopCostResponseSchema>;
export type LoopDetail = z.infer<typeof LoopDetailSchema>;
export type LoopListResponse = z.infer<typeof LoopListResponseSchema>;
export type LoopIssueCreatedResponse = z.infer<typeof LoopIssueCreatedResponseSchema>;
export type LoopReviewSpecRequest = z.infer<typeof LoopReviewSpecRequestSchema>;
export type LoopInterventionRequest = z.infer<typeof LoopInterventionRequestSchema>;
export type LoopsDoctorResponse = z.infer<typeof LoopsDoctorResponseSchema>;
export type LoopsResumeResponse = z.infer<typeof LoopsResumeResponseSchema>;
