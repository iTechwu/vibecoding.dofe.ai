import { Controller, Inject, Optional, Req, VERSION_NEUTRAL } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { created, success } from '@dofe/infra-common/ts-rest';
import { loopsContract as c } from '@repo/contracts/api';
import type { LoopTenantContext } from '@repo/contracts';
import { CURRENT_TENANT_HEADER } from '@repo/constants';
import { Auth } from '@app/auth';
import type { AuthenticatedRequest } from '@app/auth';
import { AuditLogService } from '@app/audit-log';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';
import type { Prisma } from '@prisma/client';
import { LOOPS_PERMISSION, RequireLoopsPermission } from './loops-rbac.decorator';
import { LoopsService } from './loops.service';

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

function pickTenantContext(
  req: AuthenticatedRequest,
  bodyTenantContext?: LoopTenantContext,
): LoopTenantContext | undefined {
  const headerTenantId = firstHeaderValue(req.headers[CURRENT_TENANT_HEADER]);
  const tenantId = req.tenantId ?? headerTenantId ?? bodyTenantContext?.tenantId;
  const teamId = req.teamId ?? bodyTenantContext?.teamId;
  const tenantName = bodyTenantContext?.tenantName;
  const tenantContext: LoopTenantContext = {
    ...(tenantId ? { tenantId } : {}),
    ...(tenantName ? { tenantName } : {}),
    ...(teamId ? { teamId } : {}),
  };
  return Object.keys(tenantContext).length > 0 ? tenantContext : undefined;
}

@Auth('api')
@Controller({
  version: VERSION_NEUTRAL,
})
export class LoopsController {
  constructor(
    private readonly loopsService: LoopsService,
    private readonly auditLogService: AuditLogService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    // R33+: BullMQ queue for async Eval aggregation jobs
    @Optional() @InjectQueue('loops-eval-aggregation') private readonly evalAggQueue?: Queue,
  ) {}

  @RequireLoopsPermission(LOOPS_PERMISSION.READ)
  @TsRestHandler(c.list)
  async list() {
    return tsRestHandler(c.list, async ({ query }) => {
      return success(await this.loopsService.list(query));
    });
  }

  @RequireLoopsPermission(LOOPS_PERMISSION.READ)
  @TsRestHandler(c.listLegacy)
  async listLegacy() {
    return tsRestHandler(c.listLegacy, async ({ query }) => {
      return success(await this.loopsService.list(query));
    });
  }

  @RequireLoopsPermission(LOOPS_PERMISSION.CREATE)
  @TsRestHandler(c.createIssue)
  async createIssue(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.createIssue, async ({ body }) => {
      // Submitter is derived server-side from the authenticated SSO user
      // (provider `dofe-sso`), ignoring any client-supplied submitter fields
      // so identity cannot be spoofed. The CLI/internal path calls the service
      // directly without a request and falls back to the `dev` defaults.
      const result = await this.loopsService.createIssue(
        { ...body, tenantContext: pickTenantContext(req, body.tenantContext) },
        req.userInfo,
      );
      await this.auditLoopCreate(req, result.issue.id, {
        title: result.issue.title,
        priority: result.issue.priority,
        targetRepo: result.issue.targetRepo,
      });
      return created(result);
    });
  }

  @RequireLoopsPermission(LOOPS_PERMISSION.CREATE)
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

  @RequireLoopsPermission(LOOPS_PERMISSION.CREATE)
  @TsRestHandler(c.createSimpleIssue)
  async createSimpleIssue(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.createSimpleIssue, async ({ body }) => {
      // Same SSO-derived submitter + audit path as the full createIssue; the
      // service normalises the one-sentence request first (0622 · B4).
      const result = await this.loopsService.createSimpleIssue(
        { ...body, tenantContext: pickTenantContext(req, body.tenantContext) },
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

  @RequireLoopsPermission(LOOPS_PERMISSION.READ)
  @TsRestHandler(c.getIssue)
  async getIssue() {
    return tsRestHandler(c.getIssue, async ({ params }) => {
      return success(await this.loopsService.getIssue(params.issueId));
    });
  }

  @RequireLoopsPermission(LOOPS_PERMISSION.READ)
  @TsRestHandler(c.getDeliveryEvidence)
  async getDeliveryEvidence() {
    return tsRestHandler(c.getDeliveryEvidence, async ({ params }) => {
      return success(await this.loopsService.getDeliveryEvidence(params.issueId));
    });
  }

  @RequireLoopsPermission(LOOPS_PERMISSION.READ)
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

  @RequireLoopsPermission(LOOPS_PERMISSION.READ)
  @TsRestHandler(c.listRuntimeBackends)
  async listRuntimeBackends() {
    return tsRestHandler(c.listRuntimeBackends, async ({ query }) => {
      return success(await this.loopsService.listRuntimeBackends(query));
    });
  }

  @RequireLoopsPermission(LOOPS_PERMISSION.READ)
  @TsRestHandler(c.getRuntimeBackend)
  async getRuntimeBackend() {
    return tsRestHandler(c.getRuntimeBackend, async ({ params }) => {
      return success(await this.loopsService.getRuntimeBackend(params.id));
    });
  }

  @RequireLoopsPermission(LOOPS_PERMISSION.OPERATE)
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

  @RequireLoopsPermission(LOOPS_PERMISSION.OPERATE)
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

  @RequireLoopsPermission(LOOPS_PERMISSION.READ)
  @TsRestHandler(c.listRemoteRunners)
  async listRemoteRunners() {
    return tsRestHandler(c.listRemoteRunners, async ({ query }) => {
      return success(await this.loopsService.listRemoteRunners(query));
    });
  }

  @RequireLoopsPermission(LOOPS_PERMISSION.ADMIN)
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

  @RequireLoopsPermission(LOOPS_PERMISSION.ADMIN)
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

  @RequireLoopsPermission(LOOPS_PERMISSION.ADMIN)
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

  @RequireLoopsPermission(LOOPS_PERMISSION.READ)
  @TsRestHandler(c.listMcpServers)
  async listMcpServers() {
    return tsRestHandler(c.listMcpServers, async ({ query }) => {
      return success(await this.loopsService.listMcpServers(query));
    });
  }

  @RequireLoopsPermission(LOOPS_PERMISSION.ADMIN)
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

  @RequireLoopsPermission(LOOPS_PERMISSION.ADMIN)
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

  @RequireLoopsPermission(LOOPS_PERMISSION.ADMIN)
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

  @RequireLoopsPermission(LOOPS_PERMISSION.READ)
  @TsRestHandler(c.listCiChecks)
  async listCiChecks() {
    return tsRestHandler(c.listCiChecks, async ({ query }) => {
      return success(await this.loopsService.listCiChecks(query));
    });
  }

  @RequireLoopsPermission(LOOPS_PERMISSION.READ)
  @TsRestHandler(c.listCiCheckPublications)
  async listCiCheckPublications() {
    return tsRestHandler(c.listCiCheckPublications, async ({ params }) => {
      return success(await this.loopsService.listCiCheckPublications(params.id));
    });
  }

  @RequireLoopsPermission(LOOPS_PERMISSION.OPERATE)
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

  @RequireLoopsPermission(LOOPS_PERMISSION.OPERATE)
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

  @RequireLoopsPermission(LOOPS_PERMISSION.OPERATE)
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

  @RequireLoopsPermission(LOOPS_PERMISSION.CREATE)
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

  @RequireLoopsPermission(LOOPS_PERMISSION.READ)
  @TsRestHandler(c.listEvalSuites)
  async listEvalSuites() {
    return tsRestHandler(c.listEvalSuites, async ({ query }) => {
      return success(await this.loopsService.listEvalSuites(query));
    });
  }

  @RequireLoopsPermission(LOOPS_PERMISSION.READ)
  @TsRestHandler(c.getEvalSuite)
  async getEvalSuite() {
    return tsRestHandler(c.getEvalSuite, async ({ params }) => {
      return success(await this.loopsService.getEvalSuite(params.id));
    });
  }

  @RequireLoopsPermission(LOOPS_PERMISSION.READ)
  @TsRestHandler(c.listEvalRuns)
  async listEvalRuns() {
    return tsRestHandler(c.listEvalRuns, async ({ query }) => {
      return success(await this.loopsService.listEvalRuns(query));
    });
  }

  @RequireLoopsPermission(LOOPS_PERMISSION.READ)
  @TsRestHandler(c.getEvalRun)
  async getEvalRun() {
    return tsRestHandler(c.getEvalRun, async ({ params }) => {
      return success(await this.loopsService.getEvalRun(params.id));
    });
  }

  @RequireLoopsPermission(LOOPS_PERMISSION.OPERATE)
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

  @RequireLoopsPermission(LOOPS_PERMISSION.OPERATE)
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

  @RequireLoopsPermission(LOOPS_PERMISSION.OPERATE)
  @TsRestHandler(c.generateSpec)
  async generateSpec(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.generateSpec, async ({ params }) => {
      const result = await this.loopsService.generateSpec(params.issueId);
      await this.auditLoopUpdate(req, params.issueId, 'generateSpec', {
        specVersion: result.state.specVersion,
        phase: result.state.phase,
      });
      return success(result);
    });
  }

  @RequireLoopsPermission(LOOPS_PERMISSION.OPERATE)
  @TsRestHandler(c.reviewSpec)
  async reviewSpec(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.reviewSpec, async ({ params, body }) => {
      const result = await this.loopsService.reviewSpec(params.issueId, body);
      await this.auditLoopUpdate(req, params.issueId, 'reviewSpec', {
        action: body.action,
        reviewer: body.reviewer,
        specStatus: result.spec?.status,
        phase: result.state.phase,
      });
      return success(result);
    });
  }

  @RequireLoopsPermission(LOOPS_PERMISSION.OPERATE)
  @TsRestHandler(c.decompose)
  async decompose(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.decompose, async ({ params }) => {
      const result = await this.loopsService.decompose(params.issueId);
      await this.auditLoopUpdate(req, params.issueId, 'decompose', {
        shardsTotal: result.state.shardsTotal,
        phase: result.state.phase,
      });
      return success(result);
    });
  }

  @RequireLoopsPermission(LOOPS_PERMISSION.OPERATE)
  @TsRestHandler(c.runShardTests)
  async runShardTests(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.runShardTests, async ({ params, body }) => {
      const result = await this.loopsService.runShardTests(params.issueId, params.shardId, body);
      await this.auditLoopUpdate(req, params.issueId, 'runShardTests', {
        shardId: params.shardId,
        status: result.status,
        commandCount: result.commands.length,
      });
      return success(result);
    });
  }

  @RequireLoopsPermission(LOOPS_PERMISSION.OPERATE)
  @TsRestHandler(c.recordShardImplementation)
  async recordShardImplementation(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.recordShardImplementation, async ({ params, body }) => {
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

  @RequireLoopsPermission(LOOPS_PERMISSION.OPERATE)
  @TsRestHandler(c.reviewShard)
  async reviewShard(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.reviewShard, async ({ params, body }) => {
      const result = await this.loopsService.reviewShard(params.issueId, params.shardId, body);
      await this.auditLoopUpdate(req, params.issueId, 'reviewShard', {
        shardId: params.shardId,
        reviewer: result.reviewer,
        verdict: result.verdict,
      });
      return success(result);
    });
  }

  @RequireLoopsPermission(LOOPS_PERMISSION.OPERATE)
  @TsRestHandler(c.runLoop)
  async runLoop(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.runLoop, async ({ params }) => {
      const result = await this.loopsService.runLoop(params.issueId);
      await this.auditLoopUpdate(req, params.issueId, 'runLoop', {
        phase: result.state.phase,
        shardsDone: result.state.shardsDone,
        shardsInProgress: result.state.shardsInProgress,
      });
      return success(result);
    });
  }

  @RequireLoopsPermission(LOOPS_PERMISSION.OPERATE)
  @TsRestHandler(c.advance)
  async advance(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.advance, async ({ params }) => {
      const result = await this.loopsService.advance(params.issueId);
      await this.auditLoopUpdate(req, params.issueId, 'advance', {
        phase: result.state.phase,
        specStatus: result.spec?.status,
        shardsDone: result.state.shardsDone,
        shardsInProgress: result.state.shardsInProgress,
        globalVerdict: result.state.globalVerdict,
        finalized: result.state.finalized,
      });
      return success(result);
    });
  }

  @RequireLoopsPermission(LOOPS_PERMISSION.OPERATE)
  @TsRestHandler(c.reviewGlobal)
  async reviewGlobal(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.reviewGlobal, async ({ params }) => {
      const result = await this.loopsService.reviewGlobal(params.issueId);
      await this.auditLoopUpdate(req, params.issueId, 'reviewGlobal', {
        globalVerdict: result.state.globalVerdict,
        phase: result.state.phase,
      });
      return success(result);
    });
  }

  @RequireLoopsPermission(LOOPS_PERMISSION.OPERATE)
  @TsRestHandler(c.reloop)
  async reloop(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.reloop, async ({ params, body }) => {
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

  @RequireLoopsPermission(LOOPS_PERMISSION.OPERATE)
  @TsRestHandler(c.finalize)
  async finalize(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.finalize, async ({ params }) => {
      const result = await this.loopsService.finalize(params.issueId);
      await this.auditLoopUpdate(req, params.issueId, 'finalize', {
        phase: result.state.phase,
        finalized: result.state.finalized,
      });
      return success(result);
    });
  }

  @RequireLoopsPermission(LOOPS_PERMISSION.OPERATE)
  @TsRestHandler(c.naturalCommand)
  async naturalCommand(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.naturalCommand, async ({ params, body }) => {
      const result = await this.loopsService.naturalCommand(params.issueId, body);
      await this.auditLoopUpdate(req, params.issueId, 'naturalCommand', {
        intent: result.intent,
        executed: result.executed,
      });
      return success(result);
    });
  }

  @RequireLoopsPermission(LOOPS_PERMISSION.OPERATE)
  @TsRestHandler(c.runBrowserQa)
  async runBrowserQa(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.runBrowserQa, async ({ params, body }) => {
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

  @RequireLoopsPermission(LOOPS_PERMISSION.OPERATE)
  @TsRestHandler(c.runSecondOpinion)
  async runSecondOpinion(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.runSecondOpinion, async ({ params }) => {
      const result = await this.loopsService.runSecondOpinion(params.issueId);
      await this.auditLoopUpdate(req, params.issueId, 'runSecondOpinion', {
        status: result.secondOpinion?.status,
        secondaryStatus: result.secondOpinion?.secondary.status,
      });
      return success(result);
    });
  }

  @RequireLoopsPermission(LOOPS_PERMISSION.OPERATE)
  @TsRestHandler(c.resolveSecondOpinion)
  async resolveSecondOpinion(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.resolveSecondOpinion, async ({ params, body }) => {
      const result = await this.loopsService.resolveSecondOpinion(params.issueId, body);
      await this.auditLoopUpdate(req, params.issueId, 'resolveSecondOpinion', {
        action: body.action,
        fingerprint: body.findingFingerprint,
      });
      return success(result);
    });
  }

  @RequireLoopsPermission(LOOPS_PERMISSION.OPERATE)
  @TsRestHandler(c.runReleaseCanary)
  async runReleaseCanary(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.runReleaseCanary, async ({ params, body }) => {
      const result = await this.loopsService.runReleaseCanary(params.issueId, body);
      await this.auditLoopUpdate(req, params.issueId, 'runReleaseCanary', {
        targetUrl: body.targetUrl,
        riskLevel: body.riskLevel,
      });
      return success(result);
    });
  }

  @RequireLoopsPermission(LOOPS_PERMISSION.OPERATE)
  @TsRestHandler(c.governDelivery)
  async governDelivery(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.governDelivery, async ({ params, body }) => {
      const result = await this.loopsService.governDelivery(params.issueId, body);
      await this.auditLoopUpdate(req, params.issueId, 'governDelivery', {
        action: body.action,
      });
      return success(result);
    });
  }

  @RequireLoopsPermission(LOOPS_PERMISSION.OPERATE)
  @TsRestHandler(c.intervene)
  async intervene(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.intervene, async ({ params, body }) => {
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

  @RequireLoopsPermission(LOOPS_PERMISSION.ADMIN)
  @TsRestHandler(c.doctor)
  async doctor() {
    return tsRestHandler(c.doctor, async () => {
      return success(await this.loopsService.doctor());
    });
  }

  @RequireLoopsPermission(LOOPS_PERMISSION.READ)
  @TsRestHandler(c.cost)
  async cost() {
    return tsRestHandler(c.cost, async () => {
      return success(await this.loopsService.cost());
    });
  }

  @RequireLoopsPermission(LOOPS_PERMISSION.READ)
  @TsRestHandler(c.metrics)
  async metrics() {
    return tsRestHandler(c.metrics, async () => {
      return success(await this.loopsService.metrics());
    });
  }

  @RequireLoopsPermission(LOOPS_PERMISSION.READ)
  @TsRestHandler(c.capabilities)
  async capabilities() {
    return tsRestHandler(c.capabilities, async () => {
      return success(await this.loopsService.capabilities());
    });
  }

  @RequireLoopsPermission(LOOPS_PERMISSION.READ)
  @TsRestHandler(c.agentRuntime)
  async agentRuntime() {
    return tsRestHandler(c.agentRuntime, async () => {
      return success(await this.loopsService.agentRuntime());
    });
  }

  @RequireLoopsPermission(LOOPS_PERMISSION.READ)
  @TsRestHandler(c.listWorkspaces)
  async listWorkspaces() {
    return tsRestHandler(c.listWorkspaces, async () => {
      return success(await this.loopsService.listWorkspaces());
    });
  }

  @RequireLoopsPermission(LOOPS_PERMISSION.OPERATE)
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

  @RequireLoopsPermission(LOOPS_PERMISSION.OPERATE)
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

  @RequireLoopsPermission(LOOPS_PERMISSION.OPERATE)
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

  @RequireLoopsPermission(LOOPS_PERMISSION.OPERATE)
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

  @RequireLoopsPermission(LOOPS_PERMISSION.OPERATE)
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

  @RequireLoopsPermission(LOOPS_PERMISSION.OPERATE)
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

  @RequireLoopsPermission(LOOPS_PERMISSION.READ)
  @TsRestHandler(c.logs)
  async logs() {
    return tsRestHandler(c.logs, async ({ query }) => {
      return success(await this.loopsService.logs(query));
    });
  }

  @RequireLoopsPermission(LOOPS_PERMISSION.READ)
  @TsRestHandler(c.notifications)
  async notifications() {
    return tsRestHandler(c.notifications, async ({ query }) => {
      return success(await this.loopsService.notifications(query));
    });
  }

  @RequireLoopsPermission(LOOPS_PERMISSION.ADMIN)
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
  @RequireLoopsPermission(LOOPS_PERMISSION.READ)
  @TsRestHandler(c.getBrowserQaArtifact)
  async getBrowserQaArtifact(@Req() req: BrowserQaArtifactRequest) {
    return tsRestHandler(c.getBrowserQaArtifact, async ({ params }) => {
      const artifactPath = req.params?.['0'] ?? '';
      const result = await this.loopsService.getBrowserQaArtifact(params.issueId, artifactPath);
      return { status: 200 as const, body: result };
    });
  }

  /** gstack P2: List workspace-level workflow recipe configurations. */
  @RequireLoopsPermission(LOOPS_PERMISSION.READ)
  @TsRestHandler(c.listWorkspaceRecipes)
  async listWorkspaceRecipes() {
    return tsRestHandler(c.listWorkspaceRecipes, async ({ query }) => {
      const result = await this.loopsService.listWorkspaceRecipes(query);
      return success(result);
    });
  }

  /** gstack P2: Loop Bench drilldown by workspace/repo/recipe dimensions. */
  @RequireLoopsPermission(LOOPS_PERMISSION.READ)
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
  @RequireLoopsPermission(LOOPS_PERMISSION.READ)
  async listScheduleTriggers() {
    return tsRestHandler(c.listScheduleTriggers, async ({ query }) => {
      return success(await this.loopsService.listScheduleTriggers(query));
    });
  }

  @TsRestHandler(c.getScheduleTrigger)
  @RequireLoopsPermission(LOOPS_PERMISSION.READ)
  async getScheduleTrigger() {
    return tsRestHandler(c.getScheduleTrigger, async ({ params }) => {
      return success(await this.loopsService.getScheduleTrigger(params.triggerId));
    });
  }

  @TsRestHandler(c.createScheduleTrigger)
  @RequireLoopsPermission(LOOPS_PERMISSION.CREATE)
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
  @RequireLoopsPermission(LOOPS_PERMISSION.OPERATE)
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
  @RequireLoopsPermission(LOOPS_PERMISSION.ADMIN)
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
  @RequireLoopsPermission(LOOPS_PERMISSION.OPERATE)
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
  @RequireLoopsPermission(LOOPS_PERMISSION.READ)
  async listTriggerExecutions() {
    return tsRestHandler(c.listTriggerExecutions, async ({ params, query }) => {
      return success(await this.loopsService.listTriggerExecutions(params.triggerId, query));
    });
  }

  @TsRestHandler(c.retryTriggerExecution)
  @RequireLoopsPermission(LOOPS_PERMISSION.OPERATE)
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
  @RequireLoopsPermission(LOOPS_PERMISSION.OPERATE)
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
  @RequireLoopsPermission(LOOPS_PERMISSION.READ)
  async listDeadLetters() {
    return tsRestHandler(c.listDeadLetters, async ({ query }) => {
      return success(await this.loopsService.listDeadLetters(query));
    });
  }

  // =========================================================================
  // Tool Registry (P1-4, R31a)
  // =========================================================================

  @TsRestHandler(c.listTools)
  @RequireLoopsPermission(LOOPS_PERMISSION.READ)
  async listTools() {
    return tsRestHandler(c.listTools, async ({ query }) => {
      return success(await this.loopsService.listTools(query));
    });
  }

  @TsRestHandler(c.getTool)
  @RequireLoopsPermission(LOOPS_PERMISSION.READ)
  async getTool() {
    return tsRestHandler(c.getTool, async ({ params }) => {
      return success(await this.loopsService.getTool(params.toolId));
    });
  }

  @TsRestHandler(c.registerTool)
  @RequireLoopsPermission(LOOPS_PERMISSION.CREATE)
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
  @RequireLoopsPermission(LOOPS_PERMISSION.OPERATE)
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
  @RequireLoopsPermission(LOOPS_PERMISSION.OPERATE)
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
  @RequireLoopsPermission(LOOPS_PERMISSION.OPERATE)
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
  @RequireLoopsPermission(LOOPS_PERMISSION.READ)
  async listBlueprints() {
    return tsRestHandler(c.listBlueprints, async ({ query }) => {
      return success(await this.loopsService.listBlueprints(query));
    });
  }

  @TsRestHandler(c.getBlueprint)
  @RequireLoopsPermission(LOOPS_PERMISSION.READ)
  async getBlueprint() {
    return tsRestHandler(c.getBlueprint, async ({ params }) => {
      return success(await this.loopsService.getBlueprint(params.blueprintId));
    });
  }

  @TsRestHandler(c.createBlueprint)
  @RequireLoopsPermission(LOOPS_PERMISSION.CREATE)
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
  @RequireLoopsPermission(LOOPS_PERMISSION.OPERATE)
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
  @RequireLoopsPermission(LOOPS_PERMISSION.ADMIN)
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
  @RequireLoopsPermission(LOOPS_PERMISSION.READ)
  async getCrossTenantEvalAggregation() {
    return tsRestHandler(c.getCrossTenantEvalAggregation, async ({ query }) => {
      return success(await this.loopsService.getCrossTenantEvalAggregation(query));
    });
  }

  @TsRestHandler(c.runEvalAggregationWorker)
  @RequireLoopsPermission(LOOPS_PERMISSION.OPERATE)
  async runEvalAggregationWorker(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.runEvalAggregationWorker, async ({ body }) => {
      const result = await this.loopsService.runEvalAggregationWorker(body);
      await this.auditLog(req, 'UPDATE', 'eval_aggregation', 'worker', 'runEvalAggregationWorker', {
        processed: result.processed,
        persisted: result.persisted,
        period: result.period,
      } as Prisma.InputJsonObject);
      return success(result);
    });
  }

  @TsRestHandler(c.enqueueEvalAggregationJob)
  @RequireLoopsPermission(LOOPS_PERMISSION.OPERATE)
  async enqueueEvalAggregationJob(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.enqueueEvalAggregationJob, async ({ body }) => {
      const jobData = {
        type: (body?.type ?? 'aggregate-all') as 'aggregate-all' | 'aggregate-tenant',
        tenantId: body?.tenantId,
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
  @RequireLoopsPermission(LOOPS_PERMISSION.READ)
  async getEvalAggregationCacheHealth() {
    return tsRestHandler(c.getEvalAggregationCacheHealth, async () => {
      return success(await this.loopsService.getEvalAggregationCacheHealth());
    });
  }

  // =========================================================================
  // Trigger Scheduler (R34b: BullMQ auto-execution)
  // =========================================================================

  @TsRestHandler(c.startTriggerScheduler)
  @RequireLoopsPermission(LOOPS_PERMISSION.ADMIN)
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
  @RequireLoopsPermission(LOOPS_PERMISSION.ADMIN)
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
  @RequireLoopsPermission(LOOPS_PERMISSION.READ)
  async getTriggerSchedulerStatus() {
    return tsRestHandler(c.getTriggerSchedulerStatus, async () => {
      return success(await this.loopsService.getTriggerSchedulerStatus());
    });
  }

  // =========================================================================
  // Cross-Tenant Archive (R35: object storage + SSO multi-tenant)
  // =========================================================================

  @TsRestHandler(c.archiveTenant)
  @RequireLoopsPermission(LOOPS_PERMISSION.ADMIN)
  async archiveTenant(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.archiveTenant, async ({ body }) => {
      const result = await this.loopsService.archiveTenant(body);
      await this.auditLog(req, 'CREATE', 'loops_archive', result.archiveId, 'archiveTenant', {
        tenantId: body.tenantId,
        fileCount: result.fileCount,
      } as Prisma.InputJsonObject);
      return success(result);
    });
  }

  @TsRestHandler(c.listArchives)
  @RequireLoopsPermission(LOOPS_PERMISSION.READ)
  async listArchives() {
    return tsRestHandler(c.listArchives, async ({ query }) => {
      return success(await this.loopsService.listArchives(query.tenantId));
    });
  }

  @TsRestHandler(c.refreshArchiveUrl)
  @RequireLoopsPermission(LOOPS_PERMISSION.OPERATE)
  async refreshArchiveUrl() {
    return tsRestHandler(c.refreshArchiveUrl, async ({ params, body }) => {
      const result = await this.loopsService.refreshArchiveUrl(body.tenantId, params.archiveId);
      return success(result);
    });
  }

  // =========================================================================
  // Remote Runner External Artifact Upload (R36)
  // =========================================================================

  @TsRestHandler(c.uploadRemoteRunnerArtifacts)
  @RequireLoopsPermission(LOOPS_PERMISSION.ADMIN)
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
  @RequireLoopsPermission(LOOPS_PERMISSION.READ)
  async getDockerSandboxHealth() {
    return tsRestHandler(c.getDockerSandboxHealth, async () => {
      return success(await this.loopsService.getDockerSandboxHealth());
    });
  }

  @TsRestHandler(c.testMcpHandshake)
  @RequireLoopsPermission(LOOPS_PERMISSION.ADMIN)
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
