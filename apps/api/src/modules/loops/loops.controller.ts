import { Controller, Inject, Req, VERSION_NEUTRAL } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { created, success } from '@dofe/infra-common/ts-rest';
import { loopsContract as c } from '@repo/contracts/api';
import { Auth } from '@app/auth';
import type { AuthenticatedRequest } from '@app/auth';
import { AuditLogService } from '@app/audit-log';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';
import type { Prisma } from '@prisma/client';
import { LOOPS_PERMISSION, RequireLoopsPermission } from './loops-rbac.decorator';
import { LoopsService } from './loops.service';

@Auth('api')
@Controller({
  version: VERSION_NEUTRAL,
})
export class LoopsController {
  constructor(
    private readonly loopsService: LoopsService,
    private readonly auditLogService: AuditLogService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
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
      const result = await this.loopsService.createIssue(body, req.userInfo);
      await this.auditLoopCreate(req, result.issue.id, {
        title: result.issue.title,
        priority: result.issue.priority,
        targetRepo: result.issue.targetRepo,
      });
      return created(result);
    });
  }

  @RequireLoopsPermission(LOOPS_PERMISSION.CREATE)
  @TsRestHandler(c.createSimpleIssue)
  async createSimpleIssue(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.createSimpleIssue, async ({ body }) => {
      // Same SSO-derived submitter + audit path as the full createIssue; the
      // service normalises the one-sentence request first (0622 · B4).
      const result = await this.loopsService.createSimpleIssue(body, req.userInfo);
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
