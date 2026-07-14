import {
  Controller,
  Inject,
  MessageEvent,
  Optional,
  Param,
  Req,
  Sse,
  UseGuards,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { created, success } from '@dofe/infra-common/ts-rest';
import { CURRENT_TENANT_HEADER } from '@dofe/infra-contracts';
import { loopsContract as c } from '@repo/contracts/api';
import { Auth, RequireSuperAdmin, SsoScopeService, type VerifiedTenantScope } from '@app/auth';
import type { AuthenticatedRequest } from '@app/auth';
import { AuditLogService } from '@app/audit-log';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';
import type { Prisma } from '@prisma/client';
import { LoopsService } from './loops.service';
import { LoopsScopeBackfillService } from './loops-scope-backfill.service';
import { LoopsAdvanceQueueService } from './loops-advance-queue.service';
import { LoopsAdvanceStatusService } from './loops-advance-status.service';
import { map, type Observable } from 'rxjs';
import { LoopsTenantAccessGuard } from './loops-tenant-access.guard';

type BrowserQaArtifactRequest = AuthenticatedRequest & {
  params?: {
    '0'?: string;
  };
};

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function pickTenantCandidate(req: AuthenticatedRequest): string | undefined {
  const headerTenantId = firstHeaderValue(req.headers[CURRENT_TENANT_HEADER]);
  return req.tenantId ?? headerTenantId;
}

@Auth('api')
@UseGuards(LoopsTenantAccessGuard)
@Controller({
  version: VERSION_NEUTRAL,
})
export class LoopsController {
  constructor(
    private readonly loopsService: LoopsService,
    private readonly scopeBackfillService: LoopsScopeBackfillService,
    private readonly ssoScopeService: SsoScopeService,
    private readonly auditLogService: AuditLogService,
    private readonly advanceQueue: LoopsAdvanceQueueService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private readonly advanceStatus: LoopsAdvanceStatusService,
    // R33+: BullMQ queue for async Eval aggregation jobs
    @Optional() @InjectQueue('loops-eval-aggregation') private readonly evalAggQueue?: Queue,
  ) {}

  private async resolveTenantContext(req: AuthenticatedRequest): Promise<VerifiedTenantScope> {
    return this.ssoScopeService.resolve({
      ssoSubject: req.ssoSub,
      tenantId: pickTenantCandidate(req),
    });
  }

  /**
   * Resolve the verified SSO scope and assert it owns the issue before any
   * issueId-scoped mutation/read. A tenant mismatch surfaces as 404 (via the
   * service) so cross-tenant issue existence is never leaked. Returns the
   * resolved scope for callers that also need it downstream.
   */
  private async authorizeIssueScope(
    req: AuthenticatedRequest,
    issueId: string,
  ): Promise<VerifiedTenantScope> {
    const scope = await this.resolveTenantContext(req);
    await this.loopsService.assertIssueScope(issueId, scope);
    return scope;
  }
  @TsRestHandler(c.list)
  async list(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.list, async ({ query }) => {
      // Resource-level isolation: the verified SSO tenant is pushed down so the
      // list cannot cross tenant boundaries, and historical NULL-scope rows are
      // hidden from every tenant until audited backfill.
      const scope = await this.resolveTenantContext(req);
      return success(await this.loopsService.list(query, scope));
    });
  }
  @TsRestHandler(c.listLegacy)
  async listLegacy(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.listLegacy, async ({ query }) => {
      const scope = await this.resolveTenantContext(req);
      return success(await this.loopsService.list(query, scope));
    });
  }
  @TsRestHandler(c.createIssue)
  async createIssue(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.createIssue, async ({ body }) => {
      // Submitter is derived server-side from the authenticated SSO user
      // (provider `dofe-sso`), ignoring any client-supplied submitter fields
      // so identity cannot be spoofed. The CLI/internal path calls the service
      // directly without a request and falls back to the `dev` defaults.
      const tenantContext = await this.resolveTenantContext(req);
      const result = await this.loopsService.createIssue({ ...body, tenantContext }, req.userInfo);
      await this.auditLoopCreate(req, result.issue.id, {
        title: result.issue.title,
        priority: result.issue.priority,
        targetRepo: result.issue.targetRepo,
      });
      return created(result);
    });
  }
  @TsRestHandler(c.webhookTrigger)
  async webhookTrigger(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.webhookTrigger, async ({ body }) => {
      const result = await this.loopsService.webhookTrigger(body);
      if (result.created) {
        await this.auditLog(req, 'CREATE', 'loop_issue', result.issueId, 'webhookTrigger', {
          source: body.source,
          event: body.event,
        });
      }
      return success(result);
    });
  }
  @TsRestHandler(c.createSimpleIssue)
  async createSimpleIssue(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.createSimpleIssue, async ({ body }) => {
      // Same SSO-derived submitter + audit path as the full createIssue; the
      // service normalises the one-sentence request first (0622 · B4).
      const tenantContext = await this.resolveTenantContext(req);
      const result = await this.loopsService.createSimpleIssue(
        { ...body, tenantContext },
        req.userInfo,
      );
      await this.auditLoopCreate(req, result.issue.id, {
        title: result.issue.title,
        priority: result.issue.priority,
        targetRepo: result.issue.targetRepo,
        source: 'simple-intake',
      });
      return created(result);
    });
  }
  @TsRestHandler(c.getIssue)
  async getIssue(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.getIssue, async ({ params }) => {
      // Ownership assertion: a non-matching tenant reads as 404 so the existence
      // of another tenant's issue is never leaked.
      const scope = await this.resolveTenantContext(req);
      return success(await this.loopsService.getIssue(params.issueId, scope));
    });
  }
  @TsRestHandler(c.getDeliveryEvidence)
  async getDeliveryEvidence(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.getDeliveryEvidence, async ({ params }) => {
      await this.authorizeIssueScope(req, params.issueId);
      return success(await this.loopsService.getDeliveryEvidence(params.issueId));
    });
  }
  @TsRestHandler(c.assetPermissions)
  async assetPermissions(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.assetPermissions, async () => {
      return success(
        await this.loopsService.assetPermissions({
          userId: req.userId,
          isAdmin: req.isAdmin,
          teamId: req.teamId,
          tenantId: req.tenantId,
        }),
      );
    });
  }

  // --- Runtime Backend Registry (P0-2) ---
  @TsRestHandler(c.listRuntimeBackends)
  async listRuntimeBackends() {
    return tsRestHandler(c.listRuntimeBackends, async ({ query }) => {
      return success(await this.loopsService.listRuntimeBackends(query));
    });
  }
  @TsRestHandler(c.getRuntimeBackend)
  async getRuntimeBackend() {
    return tsRestHandler(c.getRuntimeBackend, async ({ params }) => {
      return success(await this.loopsService.getRuntimeBackend(params.id));
    });
  }
  @TsRestHandler(c.runtimeBackendHealthCheck)
  async runtimeBackendHealthCheck(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.runtimeBackendHealthCheck, async ({ params }) => {
      return success(
        await this.loopsService.runtimeBackendHealthCheck(params.id, {
          userId: req.userId,
          isAdmin: req.isAdmin,
          teamId: req.teamId,
          tenantId: req.tenantId,
        }),
      );
    });
  }
  @TsRestHandler(c.updateRuntimeBackendPolicy)
  async updateRuntimeBackendPolicy(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.updateRuntimeBackendPolicy, async ({ params, body }) => {
      const result = await this.loopsService.updateRuntimeBackendPolicy(params.id, body, {
        userId: req.userId,
        isAdmin: req.isAdmin,
        teamId: req.teamId,
        tenantId: req.tenantId,
      });
      await this.auditLog(req, 'UPDATE', 'loop_runtime_backend', params.id, 'updatePolicy', {
        fallbackPolicy: body.fallbackPolicy,
        costPolicy: body.costPolicy,
        permissionProfile: body.permissionProfile,
      });
      return success(result);
    });
  }

  // --- Remote Runner Pool (P2-3) ---
  @TsRestHandler(c.listRemoteRunners)
  async listRemoteRunners() {
    return tsRestHandler(c.listRemoteRunners, async ({ query }) => {
      return success(await this.loopsService.listRemoteRunners(query));
    });
  }
  @TsRestHandler(c.acquireRemoteRunnerLease)
  async acquireRemoteRunnerLease(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.acquireRemoteRunnerLease, async ({ params, body }) => {
      const result = await this.loopsService.acquireRemoteRunnerLease(params.id, body, {
        userId: req.userId,
        isAdmin: req.isAdmin,
        teamId: req.teamId,
        tenantId: req.tenantId,
      });
      await this.auditLog(
        req,
        'UPDATE',
        'loop_remote_runner',
        params.id,
        'acquireRemoteRunnerLease',
        {
          leaseId: result.id,
          issueId: body.issueId,
          shardId: body.shardId,
          runtimeBackend: body.runtimeBackend,
        },
      );
      return success(result);
    });
  }
  @TsRestHandler(c.releaseRemoteRunnerLease)
  async releaseRemoteRunnerLease(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.releaseRemoteRunnerLease, async ({ params, body }) => {
      const result = await this.loopsService.releaseRemoteRunnerLease(params.id, body, {
        userId: req.userId,
        isAdmin: req.isAdmin,
        teamId: req.teamId,
        tenantId: req.tenantId,
      });
      await this.auditLog(
        req,
        'UPDATE',
        'loop_remote_runner',
        params.id,
        'releaseRemoteRunnerLease',
        {
          leaseId: body.leaseId,
          reason: body.reason,
        },
      );
      return success(result);
    });
  }
  @TsRestHandler(c.runRemoteRunnerJob)
  async runRemoteRunnerJob(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.runRemoteRunnerJob, async ({ params, body }) => {
      const result = await this.loopsService.runRemoteRunnerJob(params.id, body, {
        userId: req.userId,
        isAdmin: req.isAdmin,
        teamId: req.teamId,
        tenantId: req.tenantId,
      });
      await this.auditLog(req, 'UPDATE', 'loop_remote_runner', params.id, 'runRemoteRunnerJob', {
        jobId: result.id,
        leaseId: body.leaseId,
        issueId: body.issueId,
        shardId: body.shardId,
        runtimeBackend: body.runtimeBackend,
        workerKind: body.workerKind,
        artifactRoot: result.artifactRoot,
      });
      return success(result);
    });
  }

  // --- MCP Server Registry (P1-2) ---
  @TsRestHandler(c.listMcpServers)
  async listMcpServers() {
    return tsRestHandler(c.listMcpServers, async ({ query }) => {
      return success(await this.loopsService.listMcpServers(query));
    });
  }
  @TsRestHandler(c.connectMcpServer)
  async connectMcpServer(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.connectMcpServer, async ({ params, body }) => {
      const result = await this.loopsService.connectMcpServer(params.id, body, {
        userId: req.userId,
        isAdmin: req.isAdmin,
        teamId: req.teamId,
        tenantId: req.tenantId,
      });
      await this.auditLog(req, 'UPDATE', 'loop_mcp_server', params.id, 'connectMcpServer', {
        reason: body?.reason,
        status: result.status,
      });
      return success(result);
    });
  }
  @TsRestHandler(c.disconnectMcpServer)
  async disconnectMcpServer(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.disconnectMcpServer, async ({ params, body }) => {
      const result = await this.loopsService.disconnectMcpServer(params.id, body, {
        userId: req.userId,
        isAdmin: req.isAdmin,
        teamId: req.teamId,
        tenantId: req.tenantId,
      });
      await this.auditLog(req, 'UPDATE', 'loop_mcp_server', params.id, 'disconnectMcpServer', {
        reason: body?.reason,
        status: result.status,
      });
      return success(result);
    });
  }
  @TsRestHandler(c.testMcpServer)
  async testMcpServer(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.testMcpServer, async ({ params, body }) => {
      const result = await this.loopsService.testMcpServer(params.id, body, {
        userId: req.userId,
        isAdmin: req.isAdmin,
        teamId: req.teamId,
        tenantId: req.tenantId,
      });
      await this.auditLog(req, 'UPDATE', 'loop_mcp_server', params.id, 'testMcpServer', {
        reason: body?.reason,
        ok: result.health.ok,
      });
      return success(result);
    });
  }

  // --- CI Check Registry (P2-3) ---
  @TsRestHandler(c.listCiChecks)
  async listCiChecks() {
    return tsRestHandler(c.listCiChecks, async ({ query }) => {
      return success(await this.loopsService.listCiChecks(query));
    });
  }
  @TsRestHandler(c.listCiCheckPublications)
  async listCiCheckPublications() {
    return tsRestHandler(c.listCiCheckPublications, async ({ params }) => {
      return success(await this.loopsService.listCiCheckPublications(params.id));
    });
  }
  @TsRestHandler(c.connectCiCheck)
  async connectCiCheck(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.connectCiCheck, async ({ params, body }) => {
      const result = await this.loopsService.connectCiCheck(params.id, body, {
        userId: req.userId,
        isAdmin: req.isAdmin,
        teamId: req.teamId,
        tenantId: req.tenantId,
      });
      await this.auditLog(req, 'UPDATE', 'loop_ci_check', params.id, 'connectCiCheck', {
        reason: body?.reason,
        status: result.status,
      });
      return success(result);
    });
  }
  @TsRestHandler(c.disconnectCiCheck)
  async disconnectCiCheck(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.disconnectCiCheck, async ({ params, body }) => {
      const result = await this.loopsService.disconnectCiCheck(params.id, body, {
        userId: req.userId,
        isAdmin: req.isAdmin,
        teamId: req.teamId,
        tenantId: req.tenantId,
      });
      await this.auditLog(req, 'UPDATE', 'loop_ci_check', params.id, 'disconnectCiCheck', {
        reason: body?.reason,
        status: result.status,
      });
      return success(result);
    });
  }
  @TsRestHandler(c.testCiCheck)
  async testCiCheck(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.testCiCheck, async ({ params, body }) => {
      const result = await this.loopsService.testCiCheck(params.id, body, {
        userId: req.userId,
        isAdmin: req.isAdmin,
        teamId: req.teamId,
        tenantId: req.tenantId,
      });
      await this.auditLog(req, 'UPDATE', 'loop_ci_check', params.id, 'testCiCheck', {
        reason: body?.reason,
        ok: result.health.ok,
      });
      return success(result);
    });
  }

  // --- Multi-tenant Recipe Admin (P2) ---
  @TsRestHandler(c.requestRecipeAdminAction)
  async requestRecipeAdminAction(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.requestRecipeAdminAction, async ({ body }) => {
      const result = await this.loopsService.requestRecipeAdminAction(body, {
        userId: req.userId,
        isAdmin: req.isAdmin,
        teamId: req.teamId,
        tenantId: req.tenantId,
      });
      await this.auditLog(
        req,
        'CREATE',
        'loop_recipe_admin_action',
        result.id,
        'requestRecipeAdminAction',
        {
          actionId: result.actionId,
          blueprintId: result.blueprintId,
          recipeKind: result.recipeKind,
          targetVersion: result.targetVersion,
          artifactRef: result.artifactRef,
        },
      );
      return success(result);
    });
  }

  // --- Eval Suite / Eval Run (P0-3) ---
  @RequireSuperAdmin()
  @TsRestHandler(c.listEvalSuites)
  async listEvalSuites() {
    return tsRestHandler(c.listEvalSuites, async ({ query }) => {
      return success(await this.loopsService.listEvalSuites(query));
    });
  }
  @RequireSuperAdmin()
  @TsRestHandler(c.getEvalSuite)
  async getEvalSuite() {
    return tsRestHandler(c.getEvalSuite, async ({ params }) => {
      return success(await this.loopsService.getEvalSuite(params.id));
    });
  }
  @RequireSuperAdmin()
  @TsRestHandler(c.listEvalRuns)
  async listEvalRuns() {
    return tsRestHandler(c.listEvalRuns, async ({ query }) => {
      return success(await this.loopsService.listEvalRuns(query));
    });
  }
  @RequireSuperAdmin()
  @TsRestHandler(c.getEvalRun)
  async getEvalRun() {
    return tsRestHandler(c.getEvalRun, async ({ params }) => {
      return success(await this.loopsService.getEvalRun(params.id));
    });
  }
  @RequireSuperAdmin()
  @TsRestHandler(c.runEvalTrendWorker)
  async runEvalTrendWorker(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.runEvalTrendWorker, async () => {
      const result = await this.loopsService.runEvalTrendWorker();
      await this.auditLog(
        req,
        'UPDATE',
        'loop_eval_trend',
        'historical-baseline-worker',
        'runEvalTrendWorker',
        {
          snapshotCount: result.snapshotCount,
          generatedAt: result.generatedAt,
        },
      );
      return success(result);
    });
  }
  @RequireSuperAdmin()
  @TsRestHandler(c.runLoopBenchTrendWorker)
  async runLoopBenchTrendWorker(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.runLoopBenchTrendWorker, async () => {
      const result = await this.loopsService.runLoopBenchTrendWorker();
      await this.auditLog(
        req,
        'UPDATE',
        'loop_bench_trend',
        result.snapshot.id,
        'runLoopBenchTrendWorker',
        {
          historyCount: result.historyCount,
          loopCount: result.snapshot.loopCount,
          artifactRef: result.snapshot.artifactRef,
        },
      );
      return success(result);
    });
  }
  @TsRestHandler(c.generateSpec)
  async generateSpec(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.generateSpec, async ({ params }) => {
      await this.authorizeIssueScope(req, params.issueId);
      const result = await this.loopsService.generateSpec(params.issueId);
      await this.auditLoopUpdate(req, params.issueId, 'generateSpec', {
        specVersion: result.state.specVersion,
        phase: result.state.phase,
      });
      return success(result);
    });
  }
  @TsRestHandler(c.reviewSpec)
  async reviewSpec(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.reviewSpec, async ({ params, body }) => {
      await this.authorizeIssueScope(req, params.issueId);
      const result = await this.loopsService.reviewSpec(params.issueId, body, {
        advanceAfterApproval: false,
      });
      const queued =
        body.action === 'approve' ? await this.advanceQueue.enqueue(params.issueId) : undefined;
      await this.auditLoopUpdate(req, params.issueId, 'reviewSpec', {
        action: body.action,
        reviewer: body.reviewer,
        specStatus: result.spec?.status,
        phase: result.state.phase,
        advanceJobId: queued?.jobId,
      });
      return success(result);
    });
  }
  @TsRestHandler(c.decompose)
  async decompose(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.decompose, async ({ params }) => {
      await this.authorizeIssueScope(req, params.issueId);
      const result = await this.loopsService.decompose(params.issueId);
      await this.auditLoopUpdate(req, params.issueId, 'decompose', {
        shardsTotal: result.state.shardsTotal,
        phase: result.state.phase,
      });
      return success(result);
    });
  }
  @TsRestHandler(c.runShardTests)
  async runShardTests(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.runShardTests, async ({ params, body }) => {
      await this.authorizeIssueScope(req, params.issueId);
      const result = await this.loopsService.runShardTests(params.issueId, params.shardId, body);
      await this.auditLoopUpdate(req, params.issueId, 'runShardTests', {
        shardId: params.shardId,
        status: result.status,
        commandCount: result.commands.length,
      });
      return success(result);
    });
  }
  @TsRestHandler(c.recordShardImplementation)
  async recordShardImplementation(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.recordShardImplementation, async ({ params, body }) => {
      await this.authorizeIssueScope(req, params.issueId);
      const result = await this.loopsService.recordShardImplementation(
        params.issueId,
        params.shardId,
        body,
      );
      await this.auditLoopUpdate(req, params.issueId, 'recordShardImplementation', {
        shardId: params.shardId,
        implementer: result.implementer,
        status: result.status,
        changedFileCount: result.changedFiles.length,
      });
      return success(result);
    });
  }
  @TsRestHandler(c.reviewShard)
  async reviewShard(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.reviewShard, async ({ params, body }) => {
      await this.authorizeIssueScope(req, params.issueId);
      const result = await this.loopsService.reviewShard(params.issueId, params.shardId, body);
      await this.auditLoopUpdate(req, params.issueId, 'reviewShard', {
        shardId: params.shardId,
        reviewer: result.reviewer,
        verdict: result.verdict,
      });
      return success(result);
    });
  }
  @TsRestHandler(c.runLoop)
  async runLoop(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.runLoop, async ({ params }) => {
      await this.authorizeIssueScope(req, params.issueId);
      const result = await this.loopsService.runLoop(params.issueId);
      await this.auditLoopUpdate(req, params.issueId, 'runLoop', {
        phase: result.state.phase,
        shardsDone: result.state.shardsDone,
        shardsInProgress: result.state.shardsInProgress,
      });
      return success(result);
    });
  }
  @TsRestHandler(c.advance)
  async advance(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.advance, async ({ params }) => {
      await this.authorizeIssueScope(req, params.issueId);
      const queued = await this.advanceQueue.enqueue(params.issueId);
      const result = await this.loopsService.getIssue(params.issueId);
      await this.auditLoopUpdate(req, params.issueId, 'advanceQueued', {
        jobId: queued.jobId,
        queueName: 'loops-advance',
      });
      return success(result);
    });
  }
  @TsRestHandler(c.getAdvanceStatus)
  async getAdvanceStatus(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.getAdvanceStatus, async ({ params }) => {
      await this.authorizeIssueScope(req, params.issueId);
      return success((await this.advanceStatus.get(params.issueId)) ?? null);
    });
  }
  @Auth('api', 'sse')
  @Sse('issues/:issueId/advance-events')
  async advanceEvents(
    @Req() req: AuthenticatedRequest,
    @Param('issueId') issueId: string,
  ): Promise<Observable<MessageEvent>> {
    await this.authorizeIssueScope(req, issueId);
    return this.advanceStatus
      .watch(issueId)
      .pipe(map((status) => ({ type: 'advance-status', data: status })));
  }
  @TsRestHandler(c.reviewGlobal)
  async reviewGlobal(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.reviewGlobal, async ({ params }) => {
      await this.authorizeIssueScope(req, params.issueId);
      const result = await this.loopsService.reviewGlobal(params.issueId);
      await this.auditLoopUpdate(req, params.issueId, 'reviewGlobal', {
        globalVerdict: result.state.globalVerdict,
        phase: result.state.phase,
      });
      return success(result);
    });
  }
  @TsRestHandler(c.reloop)
  async reloop(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.reloop, async ({ params, body }) => {
      await this.authorizeIssueScope(req, params.issueId);
      const result = await this.loopsService.reloop(params.issueId, body);
      await this.auditLoopUpdate(req, params.issueId, 'reloop', {
        reviewer: body.reviewer,
        round: result.round,
        specVersion: result.specVersion,
        reloopCount: result.reloopCount,
      });
      return success(result);
    });
  }
  @TsRestHandler(c.finalize)
  async finalize(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.finalize, async ({ params }) => {
      await this.authorizeIssueScope(req, params.issueId);
      const result = await this.loopsService.finalize(params.issueId);
      await this.auditLoopUpdate(req, params.issueId, 'finalize', {
        phase: result.state.phase,
        finalized: result.state.finalized,
      });
      return success(result);
    });
  }
  @TsRestHandler(c.naturalCommand)
  async naturalCommand(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.naturalCommand, async ({ params, body }) => {
      await this.authorizeIssueScope(req, params.issueId);
      const result = await this.loopsService.naturalCommand(params.issueId, body);
      await this.auditLoopUpdate(req, params.issueId, 'naturalCommand', {
        intent: result.intent,
        executed: result.executed,
      });
      return success(result);
    });
  }
  @TsRestHandler(c.runBrowserQa)
  async runBrowserQa(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.runBrowserQa, async ({ params, body }) => {
      await this.authorizeIssueScope(req, params.issueId);
      const result = await this.loopsService.runBrowserQa(params.issueId, body);
      const latestReport = result.browserQaReports?.[0];
      await this.auditLoopUpdate(req, params.issueId, 'runBrowserQa', {
        targetUrl: body.targetUrl,
        status: latestReport?.status,
        reportId: latestReport?.id,
      });
      return success(result);
    });
  }
  @TsRestHandler(c.runSecondOpinion)
  async runSecondOpinion(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.runSecondOpinion, async ({ params }) => {
      await this.authorizeIssueScope(req, params.issueId);
      const result = await this.loopsService.runSecondOpinion(params.issueId);
      await this.auditLoopUpdate(req, params.issueId, 'runSecondOpinion', {
        status: result.secondOpinion?.status,
        secondaryStatus: result.secondOpinion?.secondary.status,
      });
      return success(result);
    });
  }
  @TsRestHandler(c.resolveSecondOpinion)
  async resolveSecondOpinion(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.resolveSecondOpinion, async ({ params, body }) => {
      await this.authorizeIssueScope(req, params.issueId);
      const result = await this.loopsService.resolveSecondOpinion(params.issueId, body);
      await this.auditLoopUpdate(req, params.issueId, 'resolveSecondOpinion', {
        action: body.action,
        fingerprint: body.findingFingerprint,
      });
      return success(result);
    });
  }
  @TsRestHandler(c.runReleaseCanary)
  async runReleaseCanary(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.runReleaseCanary, async ({ params, body }) => {
      await this.authorizeIssueScope(req, params.issueId);
      const result = await this.loopsService.runReleaseCanary(params.issueId, body);
      await this.auditLoopUpdate(req, params.issueId, 'runReleaseCanary', {
        targetUrl: body.targetUrl,
        riskLevel: body.riskLevel,
      });
      return success(result);
    });
  }
  @TsRestHandler(c.governDelivery)
  async governDelivery(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.governDelivery, async ({ params, body }) => {
      await this.authorizeIssueScope(req, params.issueId);
      const result = await this.loopsService.governDelivery(params.issueId, body);
      await this.auditLoopUpdate(req, params.issueId, 'governDelivery', {
        action: body.action,
      });
      return success(result);
    });
  }
  @TsRestHandler(c.intervene)
  async intervene(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.intervene, async ({ params, body }) => {
      await this.authorizeIssueScope(req, params.issueId);
      const result = await this.loopsService.intervene(params.issueId, body);
      await this.auditLoopUpdate(req, params.issueId, 'intervene', {
        action: body.action,
        actor: body.actor,
        shardId: body.shardId,
        phase: result.state.phase,
      });
      return success(result);
    });
  }
  @RequireSuperAdmin()
  @TsRestHandler(c.doctor)
  async doctor() {
    return tsRestHandler(c.doctor, async () => {
      return success(await this.loopsService.doctor());
    });
  }
  @TsRestHandler(c.cost)
  async cost(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.cost, async () => {
      return success(await this.loopsService.cost(await this.resolveTenantContext(req)));
    });
  }
  @TsRestHandler(c.metrics)
  async metrics(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.metrics, async () => {
      return success(await this.loopsService.metrics(await this.resolveTenantContext(req)));
    });
  }
  @TsRestHandler(c.capabilities)
  async capabilities() {
    return tsRestHandler(c.capabilities, async () => {
      return success(await this.loopsService.capabilities());
    });
  }
  @TsRestHandler(c.agentRuntime)
  async agentRuntime(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.agentRuntime, async () => {
      return success(await this.loopsService.agentRuntime(await this.resolveTenantContext(req)));
    });
  }
  @TsRestHandler(c.listWorkspaces)
  async listWorkspaces() {
    return tsRestHandler(c.listWorkspaces, async () => {
      return success(await this.loopsService.listWorkspaces());
    });
  }
  @TsRestHandler(c.browseWorkspaceDirectories)
  async browseWorkspaceDirectories() {
    return tsRestHandler(c.browseWorkspaceDirectories, async ({ query }) => {
      return success(await this.loopsService.browseWorkspaceDirectories(query));
    });
  }
  @RequireSuperAdmin()
  @TsRestHandler(c.governLearning)
  async governLearning(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.governLearning, async ({ params, body }) => {
      const result = await this.loopsService.governLearning(params.learningId, body);
      await this.auditLog(req, 'UPDATE', 'loop_learning', params.learningId, 'governLearning', {
        action: body.action,
        targetLearningId: body.targetLearningId,
        reason: body.reason,
      });
      return success(result);
    });
  }
  @RequireSuperAdmin()
  @TsRestHandler(c.runLearningAutoMergeWorker)
  async runLearningAutoMergeWorker(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.runLearningAutoMergeWorker, async () => {
      const result = await this.loopsService.runLearningAutoMergeWorker();
      await this.auditLog(
        req,
        'UPDATE',
        'loop_learning',
        'auto-merge-worker',
        'runLearningAutoMergeWorker',
        {
          candidates: result.learningGovernance?.autoMergeCandidates?.length ?? 0,
        },
      );
      return success(result);
    });
  }
  @RequireSuperAdmin()
  @TsRestHandler(c.runLearningIndexWorker)
  async runLearningIndexWorker(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.runLearningIndexWorker, async () => {
      const result = await this.loopsService.runLearningIndexWorker();
      await this.auditLog(
        req,
        'UPDATE',
        'loop_learning',
        'index-worker',
        'runLearningIndexWorker',
        {
          total: result.learningIndex?.summary.total ?? 0,
          workspaces: result.learningIndex?.summary.workspaces ?? 0,
          duplicateFingerprints: result.learningIndex?.summary.duplicateFingerprints ?? 0,
        },
      );
      return success(result);
    });
  }
  @TsRestHandler(c.upsertWorkspace)
  async upsertWorkspace(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.upsertWorkspace, async ({ body }) => {
      const result = await this.loopsService.upsertWorkspace(body);
      await this.auditLog(req, 'UPDATE', 'loops_workspace', body.workspaceId, 'upsertWorkspace', {
        root: body.root,
        makeDefault: body.makeDefault ?? false,
      });
      return success(result);
    });
  }
  @TsRestHandler(c.createWorkspaceFromDirectory)
  async createWorkspaceFromDirectory(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.createWorkspaceFromDirectory, async ({ body }) => {
      const createdWorkspace = await this.loopsService.createWorkspaceFromDirectory(body);
      await this.auditLog(
        req,
        'CREATE',
        'loops_workspace',
        createdWorkspace.workspaceId,
        'createWorkspaceFromDirectory',
        {
          root: createdWorkspace.root,
          makeDefault: body.makeDefault ?? false,
        },
      );
      return success(createdWorkspace.workspaces);
    });
  }
  @TsRestHandler(c.detectWorkspaceRuntime)
  async detectWorkspaceRuntime(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.detectWorkspaceRuntime, async ({ params }) => {
      const result = await this.loopsService.detectWorkspaceRuntime(params.workspaceId);
      await this.auditLog(
        req,
        'UPDATE',
        'loops_workspace',
        params.workspaceId,
        'detectRuntime',
        {},
      );
      return success(result);
    });
  }
  @TsRestHandler(c.pullWorkspaceImage)
  async pullWorkspaceImage(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.pullWorkspaceImage, async ({ params, body }) => {
      const result = await this.loopsService.pullWorkspaceImage(params.workspaceId, body.agent);
      await this.auditLog(req, 'UPDATE', 'loops_workspace', params.workspaceId, 'pullImage', {
        agent: body.agent,
        status: result.status,
      });
      return success(result);
    });
  }
  @TsRestHandler(c.logs)
  async logs(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.logs, async ({ query }) => {
      const scope = await this.resolveTenantContext(req);
      if (query.issueId) {
        await this.loopsService.assertIssueScope(query.issueId, scope);
      }
      return success(await this.loopsService.logs({ ...query, scope }));
    });
  }
  @TsRestHandler(c.notifications)
  async notifications(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.notifications, async ({ query }) => {
      const scope = await this.resolveTenantContext(req);
      if (query.issueId) {
        await this.loopsService.assertIssueScope(query.issueId, scope);
      }
      return success(await this.loopsService.notifications({ ...query, scope }));
    });
  }
  @RequireSuperAdmin()
  @TsRestHandler(c.resume)
  async resume(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.resume, async () => {
      const result = await this.loopsService.resume();
      await this.auditLog(req, 'UPDATE', 'loops_runtime', 'resume-interrupted-loops', 'resume', {
        resumedCount: Array.isArray(result) ? result.length : undefined,
      });
      return success(result);
    });
  }

  /** gstack P2: Serve Browser QA artifact files for embedded preview in detail page. */
  @TsRestHandler(c.getBrowserQaArtifact)
  async getBrowserQaArtifact(@Req() req: BrowserQaArtifactRequest) {
    return tsRestHandler(c.getBrowserQaArtifact, async ({ params }) => {
      const artifactPath = req.params?.['0'] ?? '';
      await this.authorizeIssueScope(req, params.issueId);
      const result = await this.loopsService.getBrowserQaArtifact(params.issueId, artifactPath);
      return { status: 200 as const, body: result };
    });
  }

  /** gstack P2: List workspace-level workflow recipe configurations. */
  @TsRestHandler(c.listWorkspaceRecipes)
  async listWorkspaceRecipes() {
    return tsRestHandler(c.listWorkspaceRecipes, async ({ query }) => {
      const result = await this.loopsService.listWorkspaceRecipes(query);
      return success(result);
    });
  }

  /** gstack P2: Loop Bench drilldown by workspace/repo/recipe dimensions. */
  @TsRestHandler(c.getLoopBenchDrilldown)
  async getLoopBenchDrilldown() {
    return tsRestHandler(c.getLoopBenchDrilldown, async ({ query }) => {
      const result = await this.loopsService.getLoopBenchDrilldown(query);
      return success(result);
    });
  }

  private async auditLoopCreate(
    req: AuthenticatedRequest,
    issueId: string,
    metadata: Prisma.InputJsonObject,
  ): Promise<void> {
    await this.auditLog(req, 'CREATE', 'loop_issue', issueId, 'createIssue', metadata);
  }

  private async auditLoopUpdate(
    req: AuthenticatedRequest,
    issueId: string,
    operation: string,
    metadata: Prisma.InputJsonObject,
  ): Promise<void> {
    await this.auditLog(req, 'UPDATE', 'loop_issue', issueId, operation, metadata);
  }

  // =========================================================================
  // Schedule Triggers (P1-3, R30c)
  // =========================================================================

  @TsRestHandler(c.listScheduleTriggers)
  async listScheduleTriggers() {
    return tsRestHandler(c.listScheduleTriggers, async ({ query }) => {
      return success(await this.loopsService.listScheduleTriggers(query));
    });
  }

  @TsRestHandler(c.getScheduleTrigger)
  async getScheduleTrigger() {
    return tsRestHandler(c.getScheduleTrigger, async ({ params }) => {
      return success(await this.loopsService.getScheduleTrigger(params.triggerId));
    });
  }

  @TsRestHandler(c.createScheduleTrigger)
  async createScheduleTrigger(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.createScheduleTrigger, async ({ body }) => {
      const result = await this.loopsService.createScheduleTrigger(body);
      await this.auditLog(
        req,
        'CREATE',
        'loop_schedule_trigger',
        result.id,
        'createScheduleTrigger',
        {
          name: result.name,
          cronExpression: result.cronExpression,
        } as Prisma.InputJsonObject,
      );
      return success(result);
    });
  }

  @TsRestHandler(c.updateScheduleTrigger)
  async updateScheduleTrigger(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.updateScheduleTrigger, async ({ params, body }) => {
      const result = await this.loopsService.updateScheduleTrigger(params.triggerId, body);
      await this.auditLog(
        req,
        'UPDATE',
        'loop_schedule_trigger',
        result.id,
        'updateScheduleTrigger',
        {
          status: result.status,
        } as Prisma.InputJsonObject,
      );
      return success(result);
    });
  }

  @TsRestHandler(c.deleteScheduleTrigger)
  async deleteScheduleTrigger(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.deleteScheduleTrigger, async ({ params }) => {
      const result = await this.loopsService.deleteScheduleTrigger(params.triggerId);
      await this.auditLog(
        req,
        'UPDATE',
        'loop_schedule_trigger',
        params.triggerId,
        'deleteScheduleTrigger',
        {} as Prisma.InputJsonObject,
      );
      return success(result);
    });
  }

  @TsRestHandler(c.fireScheduleTrigger)
  async fireScheduleTrigger(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.fireScheduleTrigger, async ({ params, body }) => {
      const result = await this.loopsService.fireScheduleTrigger(params.triggerId, body);
      if (result.created) {
        await this.auditLog(req, 'CREATE', 'loop_issue', result.issueId, 'fireScheduleTrigger', {
          triggerId: params.triggerId,
          source: 'schedule',
        } as Prisma.InputJsonObject);
      }
      return success(result);
    });
  }

  // =========================================================================
  // Trigger Lifecycle Management (P1-3, R30c)
  // =========================================================================

  @TsRestHandler(c.listTriggerExecutions)
  async listTriggerExecutions() {
    return tsRestHandler(c.listTriggerExecutions, async ({ params, query }) => {
      return success(await this.loopsService.listTriggerExecutions(params.triggerId, query));
    });
  }

  @TsRestHandler(c.retryTriggerExecution)
  async retryTriggerExecution(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.retryTriggerExecution, async ({ params, body }) => {
      const result = await this.loopsService.retryTriggerExecution(params.executionId, body);
      await this.auditLog(
        req,
        'UPDATE',
        'loop_trigger_execution',
        params.executionId,
        'retryTriggerExecution',
        {
          attempt: result.attempt,
          reason: body.reason,
        } as Prisma.InputJsonObject,
      );
      return success(result);
    });
  }

  @TsRestHandler(c.replayTriggerExecution)
  async replayTriggerExecution(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.replayTriggerExecution, async ({ params, body }) => {
      const result = await this.loopsService.replayTriggerExecution(params.executionId, body);
      await this.auditLog(
        req,
        'CREATE',
        'loop_trigger_execution',
        result.id,
        'replayTriggerExecution',
        {
          originalExecutionId: params.executionId,
          reason: body.reason,
        } as Prisma.InputJsonObject,
      );
      return success(result);
    });
  }

  @TsRestHandler(c.listDeadLetters)
  async listDeadLetters() {
    return tsRestHandler(c.listDeadLetters, async ({ query }) => {
      return success(await this.loopsService.listDeadLetters(query));
    });
  }

  // =========================================================================
  // Tool Registry (P1-4, R31a)
  // =========================================================================

  @TsRestHandler(c.listTools)
  async listTools() {
    return tsRestHandler(c.listTools, async ({ query }) => {
      return success(await this.loopsService.listTools(query));
    });
  }

  @TsRestHandler(c.getTool)
  async getTool() {
    return tsRestHandler(c.getTool, async ({ params }) => {
      return success(await this.loopsService.getTool(params.toolId));
    });
  }

  @TsRestHandler(c.registerTool)
  async registerTool(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.registerTool, async ({ body }) => {
      const result = await this.loopsService.registerTool(body);
      await this.auditLog(req, 'CREATE', 'loop_tool', result.id, 'registerTool', {
        name: result.name,
        kind: result.kind,
      } as Prisma.InputJsonObject);
      return success(result);
    });
  }

  @TsRestHandler(c.updateTool)
  async updateTool(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.updateTool, async ({ params, body }) => {
      const result = await this.loopsService.updateTool(params.toolId, body);
      await this.auditLog(req, 'UPDATE', 'loop_tool', params.toolId, 'updateTool', {
        status: result.status,
      } as Prisma.InputJsonObject);
      return success(result);
    });
  }

  @TsRestHandler(c.toolHealthCheck)
  async toolHealthCheck(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.toolHealthCheck, async ({ params }) => {
      const result = await this.loopsService.toolHealthCheck(params.toolId);
      await this.auditLog(req, 'UPDATE', 'loop_tool', params.toolId, 'toolHealthCheck', {
        ok: result.ok,
      } as Prisma.InputJsonObject);
      return success(result);
    });
  }

  @TsRestHandler(c.testTool)
  async testTool(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.testTool, async ({ params, body }) => {
      const result = await this.loopsService.testTool(params.toolId, body);
      await this.auditLog(req, 'UPDATE', 'loop_tool', params.toolId, 'testTool', {
        ok: result.ok,
      } as Prisma.InputJsonObject);
      return success(result);
    });
  }

  // =========================================================================
  // Delivery Blueprint Marketplace (P1-2, R31b)
  // =========================================================================

  @TsRestHandler(c.listBlueprints)
  async listBlueprints() {
    return tsRestHandler(c.listBlueprints, async ({ query }) => {
      return success(await this.loopsService.listBlueprints(query));
    });
  }

  @TsRestHandler(c.getBlueprint)
  async getBlueprint() {
    return tsRestHandler(c.getBlueprint, async ({ params }) => {
      return success(await this.loopsService.getBlueprint(params.blueprintId));
    });
  }

  @TsRestHandler(c.createBlueprint)
  async createBlueprint(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.createBlueprint, async ({ body }) => {
      const result = await this.loopsService.createBlueprint(body);
      await this.auditLog(req, 'CREATE', 'loop_blueprint', result.id, 'createBlueprint', {
        name: result.name,
        kind: result.kind,
      } as Prisma.InputJsonObject);
      return success(result);
    });
  }

  @TsRestHandler(c.updateBlueprint)
  async updateBlueprint(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.updateBlueprint, async ({ params, body }) => {
      const result = await this.loopsService.updateBlueprint(params.blueprintId, body);
      await this.auditLog(req, 'UPDATE', 'loop_blueprint', params.blueprintId, 'updateBlueprint', {
        active: result.active,
      } as Prisma.InputJsonObject);
      return success(result);
    });
  }

  @TsRestHandler(c.rollbackBlueprint)
  async rollbackBlueprint(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.rollbackBlueprint, async ({ params, body }) => {
      const result = await this.loopsService.rollbackBlueprint(params.blueprintId, body);
      await this.auditLog(
        req,
        'UPDATE',
        'loop_blueprint',
        params.blueprintId,
        'rollbackBlueprint',
        {
          targetVersion: body?.targetVersion,
          fromVersion: result.version,
          reason: body?.reason,
        } as Prisma.InputJsonObject,
      );
      return success(result);
    });
  }

  // =========================================================================
  // Cross-Tenant Eval Aggregation (R33: DB + Redis + BullMQ)
  // =========================================================================

  @TsRestHandler(c.getCrossTenantEvalAggregation)
  async getCrossTenantEvalAggregation(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.getCrossTenantEvalAggregation, async ({ query }) => {
      const tenantContext = await this.resolveTenantContext(req);
      return success(
        await this.loopsService.getCrossTenantEvalAggregation({
          ...query,
          tenantId: tenantContext.tenantId,
        }),
      );
    });
  }

  @TsRestHandler(c.adminGetTenantEvalAggregation)
  @RequireSuperAdmin()
  async adminGetTenantEvalAggregation(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.adminGetTenantEvalAggregation, async ({ params, query }) => {
      const result = await this.loopsService.getCrossTenantEvalAggregation({
        ...query,
        tenantId: params.tenantId,
      });
      await this.auditLog(
        req,
        'UPDATE',
        'eval_aggregation',
        params.tenantId,
        'adminGetTenantEvalAggregation',
        {
          targetTenantId: params.tenantId,
          authorizationSource: 'authenticated-user',
          source: result.source,
          total: result.total,
        } as Prisma.InputJsonObject,
      );
      return success(result);
    });
  }

  @TsRestHandler(c.runEvalAggregationWorker)
  async runEvalAggregationWorker(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.runEvalAggregationWorker, async ({ body }) => {
      const tenantContext = await this.resolveTenantContext(req);
      const result = await this.loopsService.runEvalAggregationWorker({
        tenantId: tenantContext.tenantId,
        period: body?.period,
      });
      await this.auditLog(req, 'UPDATE', 'eval_aggregation', 'worker', 'runEvalAggregationWorker', {
        processed: result.processed,
        persisted: result.persisted,
        period: result.period,
      } as Prisma.InputJsonObject);
      return success(result);
    });
  }

  @TsRestHandler(c.enqueueEvalAggregationJob)
  async enqueueEvalAggregationJob(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.enqueueEvalAggregationJob, async ({ body }) => {
      const tenantContext = await this.resolveTenantContext(req);
      const jobData = {
        type: 'aggregate-tenant' as const,
        tenantId: tenantContext.tenantId,
        periods: body?.periods,
      };
      const job = this.evalAggQueue
        ? await this.evalAggQueue.add('eval-aggregation', jobData, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: 100,
            removeOnFail: 500,
          })
        : null;

      const result = {
        jobId: job?.id ?? 'bullmq-unavailable',
        queueName: 'loops-eval-aggregation',
        type: jobData.type,
        enqueuedAt: new Date().toISOString(),
      };
      await this.auditLog(
        req,
        'CREATE',
        'eval_aggregation_job',
        result.jobId,
        'enqueueEvalAggregationJob',
        { type: jobData.type, viaBullMQ: Boolean(job) } as Prisma.InputJsonObject,
      );
      return success(result);
    });
  }

  @TsRestHandler(c.getEvalAggregationCacheHealth)
  @RequireSuperAdmin()
  async getEvalAggregationCacheHealth() {
    return tsRestHandler(c.getEvalAggregationCacheHealth, async () => {
      return success(await this.loopsService.getEvalAggregationCacheHealth());
    });
  }

  // =========================================================================
  // Trigger Scheduler (R34b: BullMQ auto-execution)
  // =========================================================================

  @TsRestHandler(c.startTriggerScheduler)
  @RequireSuperAdmin()
  async startTriggerScheduler(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.startTriggerScheduler, async ({ body }) => {
      const intervalSeconds = body?.intervalSeconds ?? 60;
      if (this.evalAggQueue) {
        await this.evalAggQueue.add(
          'trigger-scheduler-tick',
          { type: 'tick' },
          {
            repeat: { every: intervalSeconds * 1000 },
            jobId: 'loops-trigger-scheduler-tick',
          },
        );
      }
      const result = {
        started: true,
        intervalSeconds,
        message: `Trigger scheduler started with ${intervalSeconds}s interval via BullMQ`,
      };
      await this.auditLog(
        req,
        'UPDATE',
        'trigger_scheduler',
        'scheduler',
        'startTriggerScheduler',
        {
          intervalSeconds,
        } as Prisma.InputJsonObject,
      );
      return success(result);
    });
  }

  @TsRestHandler(c.stopTriggerScheduler)
  @RequireSuperAdmin()
  async stopTriggerScheduler(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.stopTriggerScheduler, async () => {
      if (this.evalAggQueue) {
        await this.evalAggQueue.removeRepeatable('trigger-scheduler-tick', { every: 60000 });
        await this.evalAggQueue.removeRepeatable('trigger-scheduler-tick', { every: 120000 });
        await this.evalAggQueue.removeRepeatable('trigger-scheduler-tick', { every: 300000 });
      }
      const result = { stopped: true, message: 'Trigger scheduler stopped' };
      await this.auditLog(
        req,
        'UPDATE',
        'trigger_scheduler',
        'scheduler',
        'stopTriggerScheduler',
        {} as Prisma.InputJsonObject,
      );
      return success(result);
    });
  }

  @TsRestHandler(c.getTriggerSchedulerStatus)
  @RequireSuperAdmin()
  async getTriggerSchedulerStatus() {
    return tsRestHandler(c.getTriggerSchedulerStatus, async () => {
      return success(await this.loopsService.getTriggerSchedulerStatus());
    });
  }

  // =========================================================================
  // Cross-Tenant Archive (R35: object storage + SSO multi-tenant)
  // =========================================================================

  @TsRestHandler(c.archiveTenant)
  async archiveTenant(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.archiveTenant, async ({ body }) => {
      const tenantContext = await this.resolveTenantContext(req);
      const result = await this.loopsService.archiveTenant({
        ...body,
        tenantId: tenantContext.tenantId,
      });
      await this.auditLog(req, 'CREATE', 'loops_archive', result.archiveId, 'archiveTenant', {
        tenantId: tenantContext.tenantId,
        fileCount: result.fileCount,
      } as Prisma.InputJsonObject);
      return success(result);
    });
  }

  @TsRestHandler(c.listArchives)
  async listArchives(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.listArchives, async () => {
      const tenantContext = await this.resolveTenantContext(req);
      return success(await this.loopsService.listArchives(tenantContext.tenantId));
    });
  }

  @TsRestHandler(c.refreshArchiveUrl)
  async refreshArchiveUrl(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.refreshArchiveUrl, async ({ params }) => {
      const tenantContext = await this.resolveTenantContext(req);
      const result = await this.loopsService.refreshArchiveUrl(
        tenantContext.tenantId,
        params.archiveId,
      );
      return success(result);
    });
  }

  @TsRestHandler(c.adminArchiveTenant)
  @RequireSuperAdmin()
  async adminArchiveTenant(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.adminArchiveTenant, async ({ params, body }) => {
      const result = await this.loopsService.archiveTenant({ ...body, tenantId: params.tenantId });
      await this.auditLog(req, 'CREATE', 'loops_archive', result.archiveId, 'adminArchiveTenant', {
        targetTenantId: params.tenantId,
        authorizationSource: 'authenticated-user',
        fileCount: result.fileCount,
      } as Prisma.InputJsonObject);
      return success(result);
    });
  }

  @TsRestHandler(c.adminListArchives)
  @RequireSuperAdmin()
  async adminListArchives(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.adminListArchives, async ({ params }) => {
      const result = await this.loopsService.listArchives(params.tenantId);
      await this.auditLog(req, 'UPDATE', 'loops_archive', params.tenantId, 'adminListArchives', {
        targetTenantId: params.tenantId,
        authorizationSource: 'authenticated-user',
      } as Prisma.InputJsonObject);
      return success(result);
    });
  }

  @TsRestHandler(c.adminRefreshArchiveUrl)
  @RequireSuperAdmin()
  async adminRefreshArchiveUrl(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.adminRefreshArchiveUrl, async ({ params }) => {
      const result = await this.loopsService.refreshArchiveUrl(params.tenantId, params.archiveId);
      await this.auditLog(
        req,
        'UPDATE',
        'loops_archive',
        params.archiveId,
        'adminRefreshArchiveUrl',
        {
          targetTenantId: params.tenantId,
          authorizationSource: 'authenticated-user',
        } as Prisma.InputJsonObject,
      );
      return success(result);
    });
  }

  @TsRestHandler(c.adminBackfillTenantScopes)
  @RequireSuperAdmin()
  async adminBackfillTenantScopes(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.adminBackfillTenantScopes, async ({ body }) => {
      const result = await this.scopeBackfillService.run(body);
      await this.auditLog(
        req,
        'UPDATE',
        'loop_issue_scope',
        'historical-tenant-backfill',
        'backfill',
        {
          authorizationSource: 'authenticated-user',
          dryRun: result.dryRun,
          examined: result.examined,
          updated: result.updated,
          pending: result.pending.length,
        } as Prisma.InputJsonObject,
      );
      return success(result);
    });
  }

  // =========================================================================
  // Remote Runner External Artifact Upload (R36)
  // =========================================================================

  @TsRestHandler(c.uploadRemoteRunnerArtifacts)
  async uploadRemoteRunnerArtifacts(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.uploadRemoteRunnerArtifacts, async ({ params, body }) => {
      const result = await this.loopsService.uploadRemoteRunnerArtifacts(
        params.runnerId,
        params.jobId,
        body,
      );
      await this.auditLog(
        req,
        'UPDATE',
        'remote_runner_artifact',
        params.jobId,
        'uploadRemoteRunnerArtifacts',
        {
          uploaded: result.uploaded,
          runnerId: params.runnerId,
        } as Prisma.InputJsonObject,
      );
      return success(result);
    });
  }

  // =========================================================================
  // Docker Sandbox + MCP Handshake (R37)
  // =========================================================================

  @TsRestHandler(c.getDockerSandboxHealth)
  async getDockerSandboxHealth() {
    return tsRestHandler(c.getDockerSandboxHealth, async () => {
      return success(await this.loopsService.getDockerSandboxHealth());
    });
  }

  @TsRestHandler(c.testMcpHandshake)
  async testMcpHandshake(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.testMcpHandshake, async ({ params, body }) => {
      const result = await this.loopsService.testMcpHandshake(params.id, body);
      await this.auditLog(req, 'UPDATE', 'mcp_server', params.id, 'testMcpHandshake', {
        handshakeOk: result.handshakeOk,
        toolCount: result.toolCount,
      } as Prisma.InputJsonObject);
      return success(result);
    });
  }

  private async auditLog(
    req: AuthenticatedRequest,
    action: 'CREATE' | 'UPDATE',
    resource: string,
    resourceId: string,
    operation: string,
    metadata: Prisma.InputJsonObject,
  ): Promise<void> {
    try {
      await this.auditLogService.create({
        action,
        resource,
        resourceId,
        actorType: 'user',
        actorId: req.userId,
        metadata: {
          operation,
          ...metadata,
        },
        ipAddress: req.realIp ?? req.ip,
        userAgent: req.headers['user-agent'] ?? null,
      });
    } catch (error) {
      this.logger.warn('Failed to record loops audit log', {
        action,
        resource,
        resourceId,
        operation,
        actorId: req.userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
