import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { ApiResponseSchema, PaginationQuerySchema } from '../base';
import {
  CreateLoopIssueRequestSchema,
  CreateLoopIssueSimpleRequestSchema,
  DetectLoopRuntimeResponseSchema,
  LoopBrowserQaRequestSchema,
  LoopBenchTrendWorkerResponseSchema,
  LoopCapabilitiesResponseSchema,
  LoopAssetPermissionsResponseSchema,
  LoopAgentRuntimeResponseSchema,
  LoopCostResponseSchema,
  LoopDeliveryEvidenceSchema,
  LoopDeliveryGovernanceRequestSchema,
  RuntimeBackendSchema,
  RuntimeBackendListResponseSchema,
  RuntimeBackendPolicyUpdateSchema,
  EvalSuiteSchema,
  EvalSuiteListResponseSchema,
  EvalRunListResponseSchema,
  EvalRunSchema,
  EvalTrendWorkerResponseSchema,
  LoopDetailSchema,
  LoopInterventionRequestSchema,
  LoopCiCheckActionSchema,
  LoopCiCheckIntegrationListResponseSchema,
  LoopCiCheckIntegrationSchema,
  LoopCiCheckPublicationHistorySchema,
  LoopImplementationRecordSchema,
  LoopIssueCreatedResponseSchema,
  LoopIssuesQuerySchema,
  LoopLearningGovernanceRequestSchema,
  LoopListResponseSchema,
  LoopLogsQuerySchema,
  LoopLogsResponseSchema,
  LoopMetricsResponseSchema,
  LoopMcpServerActionSchema,
  LoopMcpServerListResponseSchema,
  LoopMcpServerSchema,
  LoopNaturalCommandRequestSchema,
  LoopNaturalCommandResponseSchema,
  LoopNotificationsQuerySchema,
  LoopNotificationsResponseSchema,
  LoopRecordShardImplementationRequestSchema,
  LoopReloopResponseSchema,
  LoopReloopRequestSchema,
  LoopRemoteRunnerLeaseRequestSchema,
  LoopRemoteRunnerLeaseSchema,
  LoopRemoteRunnerListResponseSchema,
  LoopRemoteRunnerJobRequestSchema,
  LoopRemoteRunnerJobSchema,
  LoopRemoteRunnerReleaseRequestSchema,
  LoopRecipeAdminActionRequestSchema,
  LoopRecipeAdminActionResponseSchema,
  LoopResolveSecondOpinionSchema,
  LoopReviewRecordSchema,
  LoopReviewShardRequestSchema,
  LoopRunShardTestsRequestSchema,
  LoopTestRecordSchema,
  LoopsDoctorResponseSchema,
  LoopsResumeResponseSchema,
  LoopReviewSpecRequestSchema,
  PullLoopImageRequestSchema,
  PullLoopImageResponseSchema,
  UpsertLoopWorkspaceRequestSchema,
  LoopWorkspacesResponseSchema,
  LoopWebhookTriggerSchema,
  LoopWebhookTriggerResponseSchema,
  CreateScheduleTriggerRequestSchema,
  LoopScheduleTriggerListResponseSchema,
  LoopScheduleTriggerSchema,
  UpdateScheduleTriggerRequestSchema,
  LoopTriggerExecutionListResponseSchema,
  LoopTriggerExecutionSchema,
  LoopTriggerRetryRequestSchema,
  LoopTriggerReplayRequestSchema,
  LoopTriggerDeadLetterListResponseSchema,
  LoopToolSchema,
  RegisterToolRequestSchema,
  UpdateToolRequestSchema,
  LoopToolListResponseSchema,
  ToolHealthCheckResponseSchema,
  ToolTestResponseSchema,
  LoopBlueprintSchema,
  CreateBlueprintRequestSchema,
  UpdateBlueprintRequestSchema,
  LoopBlueprintListResponseSchema,
} from '../schemas/loops.schema';

const c = initContract();

export const loopsContract = c.router(
  {
    list: {
      method: 'GET',
      path: '/issues',
      query: LoopIssuesQuerySchema,
      responses: {
        200: ApiResponseSchema(LoopListResponseSchema),
      },
      summary: 'List Loops issues from the DB index surface',
    },
    listLegacy: {
      method: 'GET',
      path: '/',
      query: LoopIssuesQuerySchema,
      responses: {
        200: ApiResponseSchema(LoopListResponseSchema),
      },
      summary: 'List Loops issues and state (legacy route)',
      deprecated: true,
      description:
        'Deprecated: alias of `list` (`GET /issues`). Kept only for backward compatibility with older clients; new consumers must use `list`. Scheduled for removal in a future version.',
    },
    createIssue: {
      method: 'POST',
      path: '/issues',
      body: CreateLoopIssueRequestSchema,
      responses: {
        201: ApiResponseSchema(LoopIssueCreatedResponseSchema),
      },
      summary: 'Create a Web Issue intake for Loops',
    },
    createSimpleIssue: {
      method: 'POST',
      path: '/issues/simple',
      body: CreateLoopIssueSimpleRequestSchema,
      responses: {
        201: ApiResponseSchema(LoopIssueCreatedResponseSchema),
      },
      summary:
        'Create a Loops issue from a single natural-language request (auto-normalises title/priority/criteria)',
    },
    getIssue: {
      method: 'GET',
      path: '/issues/:issueId',
      pathParams: z.object({
        issueId: z.string(),
      }),
      responses: {
        200: ApiResponseSchema(LoopDetailSchema),
      },
      summary: 'Get a Loops issue detail',
    },
    getDeliveryEvidence: {
      method: 'GET',
      path: '/issues/:issueId/delivery-evidence',
      pathParams: z.object({
        issueId: z.string(),
      }),
      responses: {
        200: ApiResponseSchema(LoopDeliveryEvidenceSchema),
      },
      summary: 'Get a derived, PR-ready delivery evidence summary for a Loops issue (P0-4)',
    },
    assetPermissions: {
      method: 'GET',
      path: '/asset-permissions',
      responses: {
        200: ApiResponseSchema(LoopAssetPermissionsResponseSchema),
      },
      summary:
        'Get SSO-derived Loops asset permissions for workspace, runtime, tools, eval, triggers, MCP, remote runner, and CI checks',
    },
    // --- Runtime Backend Registry (P0-2) ---
    listRuntimeBackends: {
      method: 'GET',
      path: '/runtime-backends',
      query: PaginationQuerySchema,
      responses: {
        200: ApiResponseSchema(RuntimeBackendListResponseSchema),
      },
      summary:
        'List runtime backends (Codex CLI / Claude Code CLI) with health, policy, and stage support',
    },
    getRuntimeBackend: {
      method: 'GET',
      path: '/runtime-backends/:id',
      pathParams: z.object({ id: z.string() }),
      responses: {
        200: ApiResponseSchema(RuntimeBackendSchema),
      },
      summary: 'Get a runtime backend detail',
    },
    runtimeBackendHealthCheck: {
      method: 'POST',
      path: '/runtime-backends/:id/health-check',
      pathParams: z.object({ id: z.string() }),
      body: z.object({}).optional(),
      responses: {
        200: ApiResponseSchema(RuntimeBackendSchema),
      },
      summary: 'Trigger a health check for a runtime backend',
    },
    updateRuntimeBackendPolicy: {
      method: 'PATCH',
      path: '/runtime-backends/:id/policy',
      pathParams: z.object({ id: z.string() }),
      body: RuntimeBackendPolicyUpdateSchema,
      responses: {
        200: ApiResponseSchema(RuntimeBackendSchema),
      },
      summary: 'Update fallback/cost/permission policy for a runtime backend',
    },
    // --- Remote Runner Pool (P2-3) ---
    listRemoteRunners: {
      method: 'GET',
      path: '/remote-runners',
      query: PaginationQuerySchema,
      responses: {
        200: ApiResponseSchema(LoopRemoteRunnerListResponseSchema),
      },
      summary: 'List remote runner pool capacity, lease posture, and artifact roots',
    },
    acquireRemoteRunnerLease: {
      method: 'POST',
      path: '/remote-runners/:id/leases',
      pathParams: z.object({ id: z.string() }),
      body: LoopRemoteRunnerLeaseRequestSchema,
      responses: {
        200: ApiResponseSchema(LoopRemoteRunnerLeaseSchema),
      },
      summary:
        'Acquire a control-plane lease for a remote runner slot after SSO asset permission checks',
    },
    releaseRemoteRunnerLease: {
      method: 'POST',
      path: '/remote-runners/:id/leases/release',
      pathParams: z.object({ id: z.string() }),
      body: LoopRemoteRunnerReleaseRequestSchema,
      responses: {
        200: ApiResponseSchema(LoopRemoteRunnerLeaseSchema),
      },
      summary: 'Release a control-plane remote runner lease after SSO asset permission checks',
    },
    runRemoteRunnerJob: {
      method: 'POST',
      path: '/remote-runners/:id/jobs',
      pathParams: z.object({ id: z.string() }),
      body: LoopRemoteRunnerJobRequestSchema,
      responses: {
        200: ApiResponseSchema(LoopRemoteRunnerJobSchema),
      },
      summary:
        'Run a remote runner worker job and persist artifact metadata after SSO admin checks',
    },
    // --- MCP Server Registry (P1-2) ---
    listMcpServers: {
      method: 'GET',
      path: '/mcp-servers',
      query: PaginationQuerySchema,
      responses: {
        200: ApiResponseSchema(LoopMcpServerListResponseSchema),
      },
      summary: 'List SSO-governed MCP server configurations and compatibility posture',
    },
    connectMcpServer: {
      method: 'POST',
      path: '/mcp-servers/:id/connect',
      pathParams: z.object({ id: z.string() }),
      body: LoopMcpServerActionSchema.optional(),
      responses: {
        200: ApiResponseSchema(LoopMcpServerSchema),
      },
      summary: 'Connect an MCP server configuration after SSO asset permission checks',
    },
    disconnectMcpServer: {
      method: 'POST',
      path: '/mcp-servers/:id/disconnect',
      pathParams: z.object({ id: z.string() }),
      body: LoopMcpServerActionSchema.optional(),
      responses: {
        200: ApiResponseSchema(LoopMcpServerSchema),
      },
      summary: 'Disconnect an MCP server configuration after SSO asset permission checks',
    },
    testMcpServer: {
      method: 'POST',
      path: '/mcp-servers/:id/test',
      pathParams: z.object({ id: z.string() }),
      body: LoopMcpServerActionSchema.optional(),
      responses: {
        200: ApiResponseSchema(LoopMcpServerSchema),
      },
      summary: 'Run a control-plane MCP server configuration test',
    },
    // --- CI Check Registry (P2-3) ---
    listCiChecks: {
      method: 'GET',
      path: '/ci-checks',
      query: PaginationQuerySchema,
      responses: {
        200: ApiResponseSchema(LoopCiCheckIntegrationListResponseSchema),
      },
      summary: 'List CI check integrations that can publish release evidence',
    },
    connectCiCheck: {
      method: 'POST',
      path: '/ci-checks/:id/connect',
      pathParams: z.object({ id: z.string() }),
      body: LoopCiCheckActionSchema.optional(),
      responses: {
        200: ApiResponseSchema(LoopCiCheckIntegrationSchema),
      },
      summary: 'Connect a CI check integration after SSO asset permission checks',
    },
    disconnectCiCheck: {
      method: 'POST',
      path: '/ci-checks/:id/disconnect',
      pathParams: z.object({ id: z.string() }),
      body: LoopCiCheckActionSchema.optional(),
      responses: {
        200: ApiResponseSchema(LoopCiCheckIntegrationSchema),
      },
      summary: 'Disconnect a CI check integration after SSO asset permission checks',
    },
    testCiCheck: {
      method: 'POST',
      path: '/ci-checks/:id/test',
      pathParams: z.object({ id: z.string() }),
      body: LoopCiCheckActionSchema.optional(),
      responses: {
        200: ApiResponseSchema(LoopCiCheckIntegrationSchema),
      },
      summary: 'Run a control-plane CI check integration test',
    },
    listCiCheckPublications: {
      method: 'GET',
      path: '/ci-checks/:id/publications',
      pathParams: z.object({ id: z.string() }),
      responses: {
        200: ApiResponseSchema(LoopCiCheckPublicationHistorySchema),
      },
      summary: 'List durable CI check publication history for evidence review',
    },
    // --- Multi-tenant Recipe Admin (P2) ---
    requestRecipeAdminAction: {
      method: 'POST',
      path: '/recipe-admin/actions',
      body: LoopRecipeAdminActionRequestSchema,
      responses: {
        200: ApiResponseSchema(LoopRecipeAdminActionResponseSchema),
      },
      summary:
        'Request a tenant-scoped recipe admin action and persist an auditable artifact after SSO blueprint permission checks',
    },
    // --- Eval Suite / Eval Run (P0-3) ---
    listEvalSuites: {
      method: 'GET',
      path: '/eval-suites',
      query: PaginationQuerySchema,
      responses: {
        200: ApiResponseSchema(EvalSuiteListResponseSchema),
      },
      summary: 'List eval suites with pass-rate summaries and hard gates',
    },
    getEvalSuite: {
      method: 'GET',
      path: '/eval-suites/:id',
      pathParams: z.object({ id: z.string() }),
      responses: {
        200: ApiResponseSchema(EvalSuiteSchema),
      },
      summary: 'Get an eval suite detail with per-check pass/fail/blocked counts',
    },
    listEvalRuns: {
      method: 'GET',
      path: '/eval-runs',
      query: PaginationQuerySchema.extend({
        suiteId: z.string().optional(),
        loopId: z.string().optional(),
      }),
      responses: {
        200: ApiResponseSchema(EvalRunListResponseSchema),
      },
      summary: 'List eval runs across suites, optionally filtered by suite or loop',
    },
    getEvalRun: {
      method: 'GET',
      path: '/eval-runs/:id',
      pathParams: z.object({ id: z.string() }),
      responses: {
        200: ApiResponseSchema(EvalRunSchema),
      },
      summary: 'Get a single eval run with per-check results and trend delta',
    },
    runEvalTrendWorker: {
      method: 'POST',
      path: '/eval-runs/historical-baseline-worker',
      body: z.object({}).optional(),
      responses: {
        200: ApiResponseSchema(EvalTrendWorkerResponseSchema),
      },
      summary: 'Materialize cross-blueprint eval historical baseline snapshots and trend deltas',
    },
    // R33: Cross-tenant eval aggregation with DB + Redis cache.
    getCrossTenantEvalAggregation: {
      method: 'GET',
      path: '/eval-aggregation',
      query: z.object({
        tenantId: z.string().trim().min(1).optional(),
        suiteId: z.string().trim().min(1).optional(),
        period: z.enum(['7d', '30d', '90d', 'all']).default('30d'),
        blueprintId: z.string().trim().min(1).optional(),
        page: z.coerce.number().positive().min(1).optional().default(1),
        limit: z.coerce.number().positive().optional().default(20),
      }),
      responses: {
        200: ApiResponseSchema(
          z.object({
            aggregations: z.array(
              z.object({
                id: z.string(),
                tenantId: z.string(),
                workspaceId: z.string(),
                suiteId: z.string(),
                blueprintId: z.string().optional(),
                totalChecks: z.number(),
                passedChecks: z.number(),
                failedChecks: z.number(),
                blockedChecks: z.number(),
                passRate: z.number(),
                averageScore: z.number(),
                loopCount: z.number(),
                trendDelta: z.number().optional(),
                period: z.string(),
                capturedAt: z.string(),
              }),
            ),
            total: z.number(),
            page: z.number(),
            limit: z.number(),
            source: z.enum(['redis-cache', 'db-query', 'request-time']),
          }),
        ),
      },
      summary: 'Get cross-tenant eval quality aggregation (Redis-cached + DB-persisted, R33)',
    },
    runEvalAggregationWorker: {
      method: 'POST',
      path: '/eval-aggregation/worker',
      body: z
        .object({
          tenantId: z.string().trim().min(1).optional(),
          period: z.enum(['7d', '30d', '90d', 'all']).default('30d'),
        })
        .optional(),
      responses: {
        200: ApiResponseSchema(
          z.object({
            processed: z.number(),
            persisted: z.number(),
            cachedInRedis: z.boolean(),
            period: z.string(),
            generatedAt: z.string(),
          }),
        ),
      },
      summary:
        'Run the cross-tenant Eval aggregation worker synchronously (persists to DB + warms Redis cache, R33)',
    },
    enqueueEvalAggregationJob: {
      method: 'POST',
      path: '/eval-aggregation/enqueue',
      body: z
        .object({
          type: z.enum(['aggregate-all', 'aggregate-tenant']).default('aggregate-all'),
          tenantId: z.string().trim().min(1).optional(),
          periods: z.array(z.enum(['7d', '30d', '90d', 'all'])).optional(),
        })
        .optional(),
      responses: {
        200: ApiResponseSchema(
          z.object({
            jobId: z.string(),
            queueName: z.string(),
            type: z.string(),
            enqueuedAt: z.string(),
          }),
        ),
      },
      summary: 'Enqueue a cross-tenant Eval aggregation job via BullMQ (async, R33+)',
    },
    getEvalAggregationCacheHealth: {
      method: 'GET',
      path: '/eval-aggregation/cache-health',
      responses: {
        200: ApiResponseSchema(
          z.object({
            available: z.boolean(),
            cachedKeys: z.number(),
            message: z.string(),
          }),
        ),
      },
      summary: 'Check Redis cache health for Eval aggregation (R33+)',
    },
    // R34b: Trigger scheduler lifecycle management
    startTriggerScheduler: {
      method: 'POST',
      path: '/triggers/scheduler/start',
      body: z
        .object({
          intervalSeconds: z.number().int().min(10).max(3600).default(60),
        })
        .optional(),
      responses: {
        200: ApiResponseSchema(
          z.object({
            started: z.boolean(),
            intervalSeconds: z.number(),
            message: z.string(),
          }),
        ),
      },
      summary: 'Start the BullMQ trigger auto-execution scheduler (R34b)',
    },
    stopTriggerScheduler: {
      method: 'POST',
      path: '/triggers/scheduler/stop',
      body: z.object({}).optional(),
      responses: {
        200: ApiResponseSchema(
          z.object({
            stopped: z.boolean(),
            message: z.string(),
          }),
        ),
      },
      summary: 'Stop the BullMQ trigger auto-execution scheduler (R34b)',
    },
    getTriggerSchedulerStatus: {
      method: 'GET',
      path: '/triggers/scheduler/status',
      responses: {
        200: ApiResponseSchema(
          z.object({
            running: z.boolean(),
            intervalSeconds: z.number().optional(),
            lastTickAt: z.string().optional(),
            activeTriggers: z.number(),
            totalFired: z.number(),
            totalErrors: z.number(),
          }),
        ),
      },
      summary: 'Get the trigger scheduler status and stats (R34b)',
    },
    // =========================================================================
    // Cross-Tenant Archive (R35: object storage + SSO multi-tenant)
    // =========================================================================
    archiveTenant: {
      method: 'POST',
      path: '/archives',
      body: z.object({
        tenantId: z.string().trim().min(1),
        includeClosed: z.boolean().default(false),
        period: z.enum(['7d', '30d', '90d', 'all']).default('all'),
      }),
      responses: {
        200: ApiResponseSchema(
          z.object({
            archiveId: z.string(),
            tenantId: z.string(),
            fileCount: z.number(),
            totalSizeBytes: z.number(),
            storageKey: z.string(),
            downloadUrl: z.string().optional(),
            archivedAt: z.string(),
          }),
        ),
      },
      summary:
        'Archive all Loops artifacts for a tenant to object storage (R35: object storage + SSO)',
    },
    listArchives: {
      method: 'GET',
      path: '/archives',
      query: z.object({ tenantId: z.string().trim().min(1) }),
      responses: {
        200: ApiResponseSchema(
          z.object({
            archives: z.array(
              z.object({
                archiveId: z.string(),
                tenantId: z.string(),
                storageKey: z.string(),
                downloadUrl: z.string().optional(),
                fileCount: z.number(),
                totalSizeBytes: z.number(),
                archivedAt: z.string(),
              }),
            ),
          }),
        ),
      },
      summary: 'List all archives for a tenant (R35)',
    },
    refreshArchiveUrl: {
      method: 'POST',
      path: '/archives/:archiveId/refresh-url',
      pathParams: z.object({ archiveId: z.string() }),
      body: z.object({ tenantId: z.string().trim().min(1) }),
      responses: {
        200: ApiResponseSchema(
          z.object({
            archiveId: z.string(),
            downloadUrl: z.string().optional(),
            message: z.string(),
          }),
        ),
      },
      summary: 'Refresh the presigned download URL for an archive (URLs expire after 7 days) (R35)',
    },
    // R36: Remote Runner external artifact upload
    uploadRemoteRunnerArtifacts: {
      method: 'POST',
      path: '/remote-runners/:runnerId/jobs/:jobId/upload-artifacts',
      pathParams: z.object({ runnerId: z.string(), jobId: z.string() }),
      body: z
        .object({
          vendor: z.string().optional(),
          bucket: z.string().optional(),
        })
        .optional(),
      responses: {
        200: ApiResponseSchema(
          z.object({
            jobId: z.string(),
            uploaded: z.number(),
            artifacts: z.array(
              z.object({
                kind: z.string(),
                storageKey: z.string(),
                uploadUrl: z.string().optional(),
              }),
            ),
            message: z.string(),
          }),
        ),
      },
      summary: 'Upload Remote Runner job artifacts to external object storage (R36)',
    },
    // R37: Docker sandbox health
    getDockerSandboxHealth: {
      method: 'GET',
      path: '/docker-sandbox/health',
      responses: {
        200: ApiResponseSchema(
          z.object({
            available: z.boolean(),
            version: z.string().optional(),
            message: z.string(),
          }),
        ),
      },
      summary: 'Check Docker availability for OS-level sandbox execution (R37)',
    },
    // R37: Real MCP handshake test
    testMcpHandshake: {
      method: 'POST',
      path: '/mcp-servers/:id/handshake',
      pathParams: z.object({ id: z.string() }),
      body: z
        .object({
          command: z.string().trim().min(1).optional(),
          args: z.array(z.string()).optional(),
          reason: z.string().optional(),
        })
        .optional(),
      responses: {
        200: ApiResponseSchema(
          z.object({
            serverId: z.string(),
            handshakeOk: z.boolean(),
            serverInfo: z.object({ name: z.string(), version: z.string() }).optional(),
            protocolVersion: z.string().optional(),
            toolCount: z.number().optional(),
            tools: z.array(z.object({ name: z.string() })).optional(),
            durationMs: z.number().optional(),
            error: z.string().optional(),
          }),
        ),
      },
      summary: 'Perform real MCP protocol handshake with a registered MCP server (R37)',
    },
    runLoopBenchTrendWorker: {
      method: 'POST',
      path: '/loop-bench/trend-worker',
      body: z.object({}).optional(),
      responses: {
        200: ApiResponseSchema(LoopBenchTrendWorkerResponseSchema),
      },
      summary: 'Materialize file-backed Loop Bench quality trend snapshots',
    },
    generateSpec: {
      method: 'POST',
      path: '/issues/:issueId/spec',
      pathParams: z.object({
        issueId: z.string(),
      }),
      body: z.object({}).optional(),
      responses: {
        200: ApiResponseSchema(LoopDetailSchema),
      },
      summary: 'Generate an MVP draft spec for a Loops issue',
    },
    reviewSpec: {
      method: 'POST',
      path: '/issues/:issueId/spec/review',
      pathParams: z.object({
        issueId: z.string(),
      }),
      body: LoopReviewSpecRequestSchema,
      responses: {
        200: ApiResponseSchema(LoopDetailSchema),
      },
      summary: 'Approve, request revision, or reject a Loops spec',
    },
    decompose: {
      method: 'POST',
      path: '/issues/:issueId/decompose',
      pathParams: z.object({
        issueId: z.string(),
      }),
      body: z.object({}).optional(),
      responses: {
        200: ApiResponseSchema(LoopDetailSchema),
      },
      summary: 'Create MVP shards and test annotations for an approved spec',
    },
    runShardTests: {
      method: 'POST',
      path: '/issues/:issueId/shards/:shardId/tests',
      pathParams: z.object({
        issueId: z.string(),
        shardId: z.string(),
      }),
      body: LoopRunShardTestsRequestSchema.optional(),
      responses: {
        200: ApiResponseSchema(LoopTestRecordSchema),
      },
      summary: 'Run test commands for a Loops shard and write a Test Record',
    },
    recordShardImplementation: {
      method: 'POST',
      path: '/issues/:issueId/shards/:shardId/implementation',
      pathParams: z.object({
        issueId: z.string(),
        shardId: z.string(),
      }),
      body: LoopRecordShardImplementationRequestSchema,
      responses: {
        200: ApiResponseSchema(LoopImplementationRecordSchema),
      },
      summary: 'Record implementation evidence for a Loops shard',
    },
    reviewShard: {
      method: 'POST',
      path: '/issues/:issueId/shards/:shardId/review',
      pathParams: z.object({
        issueId: z.string(),
        shardId: z.string(),
      }),
      body: LoopReviewShardRequestSchema,
      responses: {
        200: ApiResponseSchema(LoopReviewRecordSchema),
      },
      summary: 'Review implementation evidence for a Loops shard',
    },
    runLoop: {
      method: 'POST',
      path: '/issues/:issueId/run',
      pathParams: z.object({
        issueId: z.string(),
      }),
      body: z.object({}).optional(),
      responses: {
        200: ApiResponseSchema(LoopDetailSchema),
      },
      summary: 'Advance a Loops loop one scheduler step (auto-implement/test/review a ready shard)',
    },
    advance: {
      method: 'POST',
      path: '/issues/:issueId/advance',
      pathParams: z.object({
        issueId: z.string(),
      }),
      body: z.object({}).optional(),
      responses: {
        200: ApiResponseSchema(LoopDetailSchema),
      },
      summary:
        'Advance a Loops issue to the next product-level checkpoint, stopping only for human approval gates',
    },
    reviewGlobal: {
      method: 'POST',
      path: '/issues/:issueId/global-review',
      pathParams: z.object({
        issueId: z.string(),
      }),
      body: z.object({}).optional(),
      responses: {
        200: ApiResponseSchema(LoopDetailSchema),
      },
      summary: 'Phase 7: run a Codex global review across all converged shards',
    },
    reloop: {
      method: 'POST',
      path: '/issues/:issueId/reloop',
      pathParams: z.object({
        issueId: z.string(),
      }),
      body: LoopReloopRequestSchema,
      responses: {
        200: ApiResponseSchema(LoopReloopResponseSchema),
      },
      summary: 'Phase 7→1: re-loop by bumping spec version after a non-PASS global review',
    },
    naturalCommand: {
      method: 'POST',
      path: '/issues/:issueId/natural-command',
      pathParams: z.object({
        issueId: z.string(),
      }),
      body: LoopNaturalCommandRequestSchema,
      responses: {
        200: ApiResponseSchema(LoopNaturalCommandResponseSchema),
      },
      summary: 'Map a deterministic natural-language command to a safe Loops operation',
    },
    finalize: {
      method: 'POST',
      path: '/issues/:issueId/finalize',
      pathParams: z.object({
        issueId: z.string(),
      }),
      body: z.object({}).optional(),
      responses: {
        200: ApiResponseSchema(LoopDetailSchema),
      },
      summary: 'Phase 8: terminal annotation refresh, close the issue and emit the convergence PR',
    },
    runBrowserQa: {
      method: 'POST',
      path: '/issues/:issueId/browser-qa',
      pathParams: z.object({
        issueId: z.string(),
      }),
      body: LoopBrowserQaRequestSchema,
      responses: {
        200: ApiResponseSchema(LoopDetailSchema),
      },
      summary: 'Run a report-only browser QA check for a Loops issue',
    },
    runSecondOpinion: {
      method: 'POST',
      path: '/issues/:issueId/second-opinion',
      pathParams: z.object({
        issueId: z.string(),
      }),
      body: z.object({}).optional(),
      responses: {
        200: ApiResponseSchema(LoopDetailSchema),
      },
      summary: 'Run a report-only Claude Code second-opinion review for a Loops issue',
    },
    resolveSecondOpinion: {
      method: 'POST',
      path: '/issues/:issueId/second-opinion/resolve',
      pathParams: z.object({
        issueId: z.string(),
      }),
      body: LoopResolveSecondOpinionSchema,
      responses: {
        200: ApiResponseSchema(LoopDetailSchema),
      },
      summary:
        'Resolve a second-opinion conflict by accepting primary/secondary findings or waiving (P1-5)',
    },
    runReleaseCanary: {
      method: 'POST',
      path: '/issues/:issueId/release-canary',
      pathParams: z.object({
        issueId: z.string(),
      }),
      body: z.object({
        targetUrl: z.string().url(),
        riskLevel: z.enum(['low', 'medium', 'high']).default('medium'),
        environment: z.string().trim().min(1).optional(),
        environmentOwner: z.string().trim().min(1).optional(),
        rollbackNote: z.string().trim().min(1).optional(),
      }),
      responses: {
        200: ApiResponseSchema(LoopDetailSchema),
      },
      summary:
        'Run a release canary check (smoke + Browser QA subset) and record result in delivery governance',
    },
    governDelivery: {
      method: 'POST',
      path: '/issues/:issueId/delivery-governance',
      pathParams: z.object({
        issueId: z.string(),
      }),
      body: LoopDeliveryGovernanceRequestSchema,
      responses: {
        200: ApiResponseSchema(LoopDetailSchema),
      },
      summary:
        'Record per-loop delivery governance for workflow, gates, QA, release, memory, and runtime security',
    },
    intervene: {
      method: 'POST',
      path: '/issues/:issueId/interventions',
      pathParams: z.object({
        issueId: z.string(),
      }),
      body: LoopInterventionRequestSchema,
      responses: {
        200: ApiResponseSchema(LoopDetailSchema),
      },
      summary: 'Pause, resume, or take over a Loops issue or shard',
    },
    doctor: {
      method: 'GET',
      path: '/doctor',
      responses: {
        200: ApiResponseSchema(LoopsDoctorResponseSchema),
      },
      summary: 'Check Loops file-backed state consistency',
    },
    cost: {
      method: 'GET',
      path: '/cost',
      responses: {
        200: ApiResponseSchema(LoopCostResponseSchema),
      },
      summary: 'Get Loops cost usage and circuit breaker state',
    },
    metrics: {
      method: 'GET',
      path: '/metrics',
      responses: {
        200: ApiResponseSchema(LoopMetricsResponseSchema),
      },
      summary: 'Get aggregated Loops control-plane metrics',
    },
    capabilities: {
      method: 'GET',
      path: '/capabilities',
      responses: {
        200: ApiResponseSchema(LoopCapabilitiesResponseSchema),
      },
      summary: 'Get the Loops capability registry and planned integration surface',
    },
    agentRuntime: {
      method: 'GET',
      path: '/agent-runtime',
      responses: {
        200: ApiResponseSchema(LoopAgentRuntimeResponseSchema),
      },
      summary: 'Get the current Loops agent runtime status and diagnostics',
    },
    listWorkspaces: {
      method: 'GET',
      path: '/workspaces',
      responses: {
        200: ApiResponseSchema(LoopWorkspacesResponseSchema),
      },
      summary: 'List configured Loops workspaces and the active workspace',
    },
    governLearning: {
      method: 'POST',
      path: '/learnings/:learningId/governance',
      pathParams: z.object({
        learningId: z.string(),
      }),
      body: LoopLearningGovernanceRequestSchema,
      responses: {
        200: ApiResponseSchema(LoopWorkspacesResponseSchema),
      },
      summary: 'Dismiss or merge a Loop learning memory item',
    },
    runLearningAutoMergeWorker: {
      method: 'POST',
      path: '/learnings/auto-merge-worker',
      body: z.object({}).optional(),
      responses: {
        200: ApiResponseSchema(LoopWorkspacesResponseSchema),
      },
      summary: 'Promote learning similarity suggestions into pending auto-merge approvals',
    },
    runLearningIndexWorker: {
      method: 'POST',
      path: '/learnings/index-worker',
      body: z.object({}).optional(),
      responses: {
        200: ApiResponseSchema(LoopWorkspacesResponseSchema),
      },
      summary: 'Materialize a file-backed cross-workspace learning index',
    },
    upsertWorkspace: {
      method: 'POST',
      path: '/workspaces',
      body: UpsertLoopWorkspaceRequestSchema,
      responses: {
        200: ApiResponseSchema(LoopWorkspacesResponseSchema),
      },
      summary: 'Create or update a Loops workspace profile (root, agent modes)',
    },
    detectWorkspaceRuntime: {
      method: 'POST',
      path: '/workspaces/:workspaceId/detect-runtime',
      pathParams: z.object({
        workspaceId: z.string(),
      }),
      body: z.object({}).optional(),
      responses: {
        200: ApiResponseSchema(DetectLoopRuntimeResponseSchema),
      },
      summary: 'Probe local CLI + Docker runtimes for a workspace',
    },
    pullWorkspaceImage: {
      method: 'POST',
      path: '/workspaces/:workspaceId/pull-image',
      pathParams: z.object({
        workspaceId: z.string(),
      }),
      body: PullLoopImageRequestSchema,
      responses: {
        200: ApiResponseSchema(PullLoopImageResponseSchema),
      },
      summary: 'Pull the Docker fallback image for an agent in a workspace',
    },
    logs: {
      method: 'GET',
      path: '/logs',
      query: LoopLogsQuerySchema,
      responses: {
        200: ApiResponseSchema(LoopLogsResponseSchema),
      },
      summary: 'Read recent immutable Loops log events',
    },
    notifications: {
      method: 'GET',
      path: '/notifications',
      query: LoopNotificationsQuerySchema,
      responses: {
        200: ApiResponseSchema(LoopNotificationsResponseSchema),
      },
      summary: 'Read recorded Loops notifications',
    },
    webhookTrigger: {
      method: 'POST',
      path: '/triggers/webhook',
      body: LoopWebhookTriggerSchema,
      responses: {
        200: ApiResponseSchema(LoopWebhookTriggerResponseSchema),
      },
      summary:
        'Receive an external webhook (GitHub/Linear/Jira/Slack/generic) and create a Loop issue from it (P0-2, R7)',
    },
    // =========================================================================
    // Schedule Triggers (P1-3, R30c)
    // =========================================================================
    listScheduleTriggers: {
      method: 'GET',
      path: '/triggers/schedules',
      query: PaginationQuerySchema,
      responses: {
        200: ApiResponseSchema(LoopScheduleTriggerListResponseSchema),
      },
      summary: 'List all schedule triggers with lifecycle status',
    },
    getScheduleTrigger: {
      method: 'GET',
      path: '/triggers/schedules/:triggerId',
      pathParams: z.object({ triggerId: z.string() }),
      responses: {
        200: ApiResponseSchema(LoopScheduleTriggerSchema),
      },
      summary: 'Get a single schedule trigger by ID',
    },
    createScheduleTrigger: {
      method: 'POST',
      path: '/triggers/schedules',
      body: CreateScheduleTriggerRequestSchema,
      responses: {
        200: ApiResponseSchema(LoopScheduleTriggerSchema),
      },
      summary: 'Create a cron-based schedule trigger for recurring Loop creation',
    },
    updateScheduleTrigger: {
      method: 'PATCH',
      path: '/triggers/schedules/:triggerId',
      pathParams: z.object({ triggerId: z.string() }),
      body: UpdateScheduleTriggerRequestSchema,
      responses: {
        200: ApiResponseSchema(LoopScheduleTriggerSchema),
      },
      summary: 'Update a schedule trigger (cron, status, template)',
    },
    deleteScheduleTrigger: {
      method: 'DELETE',
      path: '/triggers/schedules/:triggerId',
      pathParams: z.object({ triggerId: z.string() }),
      body: z.object({}).optional(),
      responses: {
        200: ApiResponseSchema(z.object({ deleted: z.boolean(), triggerId: z.string() })),
      },
      summary: 'Delete a schedule trigger',
    },
    fireScheduleTrigger: {
      method: 'POST',
      path: '/triggers/schedules/:triggerId/fire',
      pathParams: z.object({ triggerId: z.string() }),
      body: z
        .object({
          reason: z.string().trim().min(1).optional(),
        })
        .optional(),
      responses: {
        200: ApiResponseSchema(LoopWebhookTriggerResponseSchema),
      },
      summary: 'Manually fire a schedule trigger to create a Loop issue immediately (R32a)',
    },
    // =========================================================================
    // Trigger Lifecycle Management (P1-3, R30c)
    // =========================================================================
    listTriggerExecutions: {
      method: 'GET',
      path: '/triggers/:triggerId/executions',
      pathParams: z.object({ triggerId: z.string() }),
      query: PaginationQuerySchema,
      responses: {
        200: ApiResponseSchema(LoopTriggerExecutionListResponseSchema),
      },
      summary: 'List execution history for a trigger with retry/dead-letter status',
    },
    retryTriggerExecution: {
      method: 'POST',
      path: '/triggers/executions/:executionId/retry',
      pathParams: z.object({ executionId: z.string() }),
      body: LoopTriggerRetryRequestSchema,
      responses: {
        200: ApiResponseSchema(LoopTriggerExecutionSchema),
      },
      summary: 'Retry a failed trigger execution',
    },
    replayTriggerExecution: {
      method: 'POST',
      path: '/triggers/executions/:executionId/replay',
      pathParams: z.object({ executionId: z.string() }),
      body: LoopTriggerReplayRequestSchema,
      responses: {
        200: ApiResponseSchema(LoopTriggerExecutionSchema),
      },
      summary: 'Replay a completed trigger execution with the same input payload',
    },
    listDeadLetters: {
      method: 'GET',
      path: '/triggers/dead-letters',
      query: PaginationQuerySchema,
      responses: {
        200: ApiResponseSchema(LoopTriggerDeadLetterListResponseSchema),
      },
      summary: 'List dead-lettered trigger executions for inspection and replay',
    },
    // =========================================================================
    // Tool Registry (P1-4, R31a)
    // =========================================================================
    listTools: {
      method: 'GET',
      path: '/tools',
      query: PaginationQuerySchema,
      responses: {
        200: ApiResponseSchema(LoopToolListResponseSchema),
      },
      summary: 'List all registered tools with lifecycle, auth, health, and compatibility status',
    },
    getTool: {
      method: 'GET',
      path: '/tools/:toolId',
      pathParams: z.object({ toolId: z.string() }),
      responses: {
        200: ApiResponseSchema(LoopToolSchema),
      },
      summary: 'Get a single tool detail',
    },
    registerTool: {
      method: 'POST',
      path: '/tools',
      body: RegisterToolRequestSchema,
      responses: {
        200: ApiResponseSchema(LoopToolSchema),
      },
      summary: 'Register a new tool in the governed tool registry',
    },
    updateTool: {
      method: 'PATCH',
      path: '/tools/:toolId',
      pathParams: z.object({ toolId: z.string() }),
      body: UpdateToolRequestSchema,
      responses: {
        200: ApiResponseSchema(LoopToolSchema),
      },
      summary: 'Update tool lifecycle status, permissions, or compatibility',
    },
    toolHealthCheck: {
      method: 'POST',
      path: '/tools/:toolId/health-check',
      pathParams: z.object({ toolId: z.string() }),
      body: z.object({}).optional(),
      responses: {
        200: ApiResponseSchema(ToolHealthCheckResponseSchema),
      },
      summary: 'Trigger a health check for a registered tool',
    },
    testTool: {
      method: 'POST',
      path: '/tools/:toolId/test',
      pathParams: z.object({ toolId: z.string() }),
      body: z
        .object({
          input: z.record(z.string(), z.unknown()).optional(),
        })
        .optional(),
      responses: {
        200: ApiResponseSchema(ToolTestResponseSchema),
      },
      summary: 'Run a smoke test against a registered tool and record the result',
    },
    // =========================================================================
    // Delivery Blueprint Marketplace (P1-2, R31b)
    // =========================================================================
    listBlueprints: {
      method: 'GET',
      path: '/blueprints',
      query: PaginationQuerySchema,
      responses: {
        200: ApiResponseSchema(LoopBlueprintListResponseSchema),
      },
      summary:
        'List all delivery blueprints with version, persona sequence, gates, and usage stats',
    },
    getBlueprint: {
      method: 'GET',
      path: '/blueprints/:blueprintId',
      pathParams: z.object({ blueprintId: z.string() }),
      responses: {
        200: ApiResponseSchema(LoopBlueprintSchema),
      },
      summary: 'Get a single delivery blueprint detail',
    },
    createBlueprint: {
      method: 'POST',
      path: '/blueprints',
      body: CreateBlueprintRequestSchema,
      responses: {
        200: ApiResponseSchema(LoopBlueprintSchema),
      },
      summary: 'Create a new versioned delivery blueprint',
    },
    updateBlueprint: {
      method: 'PATCH',
      path: '/blueprints/:blueprintId',
      pathParams: z.object({ blueprintId: z.string() }),
      body: UpdateBlueprintRequestSchema,
      responses: {
        200: ApiResponseSchema(LoopBlueprintSchema),
      },
      summary: 'Update blueprint version, persona sequence, gates, or runtime policy',
    },
    rollbackBlueprint: {
      method: 'POST',
      path: '/blueprints/:blueprintId/rollback',
      pathParams: z.object({ blueprintId: z.string() }),
      body: z
        .object({
          targetVersion: z.string().trim().min(1).optional(),
          reason: z.string().trim().min(1).optional(),
        })
        .optional(),
      responses: {
        200: ApiResponseSchema(LoopBlueprintSchema),
      },
      summary: 'Rollback a blueprint to a previous version from history (R32a)',
    },
    resume: {
      method: 'POST',
      path: '/resume',
      body: z.object({}).optional(),
      responses: {
        200: ApiResponseSchema(LoopsResumeResponseSchema),
      },
      summary: 'Recover interrupted Loops shards',
    },
    // gstack P2: Serve Browser QA artifact files for embedded preview.
    getBrowserQaArtifact: {
      method: 'GET',
      path: '/:issueId/browser-qa/artifact/*',
      pathParams: z.object({ issueId: z.string() }),
      responses: {
        200: z.any(),
      },
      summary: 'Serve a Browser QA artifact file (screenshot, trace, diff) for inline preview',
    },
    // gstack P2: Workspace recipe admin — list all workspace-level recipe configurations.
    listWorkspaceRecipes: {
      method: 'GET',
      path: '/workspace-recipes',
      query: PaginationQuerySchema,
      responses: {
        200: ApiResponseSchema(
          z.object({
            list: z.array(
              z.object({
                id: z.string(),
                name: z.string(),
                version: z.string(),
                loopKind: z.string(),
                isDefault: z.boolean(),
                stepCount: z.number(),
                usageCount: z.number(),
                blockerRate: z.number().optional(),
                updatedAt: z.string(),
              }),
            ),
            total: z.number(),
            page: z.number(),
            limit: z.number(),
          }),
        ),
      },
      summary: 'List workspace-level workflow recipe configurations for admin',
    },
    // gstack P2: Loop Bench drilldown — workspace/repo/recipe dimension metrics.
    getLoopBenchDrilldown: {
      method: 'GET',
      path: '/bench/drilldown',
      query: z.object({
        workspaceId: z.string().optional(),
        repo: z.string().optional(),
        recipeId: z.string().optional(),
        period: z.enum(['7d', '30d', '90d', 'all']).optional().default('30d'),
      }),
      responses: {
        200: ApiResponseSchema(
          z.object({
            metrics: z.array(
              z.object({
                key: z.string(),
                label: z.string(),
                value: z.number(),
                previousValue: z.number().optional(),
                delta: z.number().optional(),
                breakdown: z
                  .array(
                    z.object({
                      dimension: z.string(),
                      dimensionValue: z.string(),
                      value: z.number(),
                    }),
                  )
                  .optional(),
              }),
            ),
            period: z.string(),
            filters: z.object({
              workspaceId: z.string().optional(),
              repo: z.string().optional(),
              recipeId: z.string().optional(),
            }),
          }),
        ),
      },
      summary: 'Get Loop Bench quality metrics with workspace/repo/recipe drilldown',
    },
  },
  {
    pathPrefix: '/loops',
  },
);

export type LoopsContract = typeof loopsContract;
