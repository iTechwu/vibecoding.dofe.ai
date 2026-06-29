import { Inject, Injectable, Optional } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';
import { LoopsDbService } from '@app/db';
import type {
  LoopIntake,
  LoopDetail,
  LoopIssue,
  LoopIssueCreatedResponse,
  LoopIssuesQuery,
  LoopListResponse,
  LoopsDoctorResponse,
  LoopStateItem,
  LoopWorkflowRecipe,
  RuntimeBackendPolicyUpdate,
} from '@repo/contracts';
import type {
  LoopIssue as DbLoopIssue,
  LoopIssueIntake as DbLoopIssueIntake,
  LoopState as DbLoopState,
  Prisma,
} from '@prisma/client';
import { LoopsFileStoreService } from './loops-file-store.service';

@Injectable()
export class LoopsPersistenceService {
  constructor(
    private readonly db: LoopsDbService,
    private readonly store: LoopsFileStoreService,
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

  async list(query: LoopIssuesQuery): Promise<LoopListResponse> {
    const result = await this.db.listIssues(query);
    if (result.total > 0 || this.hasListFilters(query)) {
      return {
        list: result.list.map((item) => ({
          issue: this.toContractIssue(item),
          state: item.state ? this.toContractState(item.state) : undefined,
        })),
        total: result.total,
        page: result.page,
        limit: result.limit,
      };
    }

    const fallback = await this.store.list();
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filtered = fallback.issues
      .map((issue) => ({
        issue,
        state: fallback.loops.find((state) => state.issueId === issue.id),
      }))
      .filter((item) => this.matchesQuery(item.issue, item.state, query));
    const start = (page - 1) * limit;

    return {
      list: filtered.slice(start, start + limit),
      total: filtered.length,
      page,
      limit,
    };
  }

  async readDetail(issueId: string): Promise<LoopDetail> {
    const detail = await this.store.readDetail(issueId);
    const dbDetail = await this.db.getIssueDetailByIssueId(issueId);
    if (!dbDetail) {
      return detail;
    }
    const latestIntake = dbDetail.intakes.at(-1);

    const intake = latestIntake ? this.toContractIntake(latestIntake) : detail.intake;

    return {
      ...detail,
      issue: {
        ...this.toContractIssue(dbDetail.issue),
        tenantContext: detail.issue.tenantContext,
      },
      intake: {
        ...intake,
        ruleSnapshot: detail.intake.ruleSnapshot,
        tenantContext: detail.intake.tenantContext ?? detail.issue.tenantContext,
      },
      state: this.toContractState(dbDetail.state),
    };
  }

  async writeIssue(input: {
    issue: LoopIssue;
    intake: LoopIntake;
    state: LoopStateItem;
    rawPayload: unknown;
    workflowRecipe?: LoopWorkflowRecipe;
  }): Promise<LoopIssueCreatedResponse> {
    await this.store.writeIssue(input);
    await this.db.createIssue({
      issue: input.issue,
      intake: input.intake,
      state: input.state,
      rawPayload: this.toInputJson(input.rawPayload),
    });
    return {
      issue: input.issue,
      intake: input.intake,
      state: input.state,
    };
  }

  async createIssue(input: {
    issue: LoopIssue;
    intake: LoopIntake;
    state: LoopStateItem;
    rawPayload: unknown;
    workflowRecipe?: LoopWorkflowRecipe;
  }): Promise<LoopIssueCreatedResponse> {
    return this.writeIssue(input);
  }

  async syncState(state: LoopStateItem, issueStatus?: LoopIssue['status']) {
    await this.db.upsertLoopState(state.issueId, state);
    if (issueStatus) {
      await this.db.updateIssueStatus({
        issueId: state.issueId,
        status: issueStatus,
        updated: state.updated,
      });
    }
  }

  async syncClosed(state: LoopStateItem) {
    await this.syncState({ ...state, phase: 'CLOSED', finalized: true }, 'CLOSED');
  }

  async readRuntimeBackendPolicies(): Promise<Record<string, RuntimeBackendPolicyUpdate>> {
    return this.db.listRuntimeBackendPolicies();
  }

  async patchRuntimeBackendPolicy(
    id: string,
    patch: RuntimeBackendPolicyUpdate,
  ): Promise<RuntimeBackendPolicyUpdate> {
    const current = (await this.db.listRuntimeBackendPolicies())[id] ?? {};
    return this.db.upsertRuntimeBackendPolicy(id, { ...current, ...patch });
  }

  async doctor(): Promise<LoopsDoctorResponse> {
    const [fileDoctor, fileList, dbIssues] = await Promise.all([
      this.store.doctor(),
      this.store.list(),
      this.db.listAllIssueStates(),
    ]);
    const dbProblems: string[] = [];
    const consistencyProblems: string[] = [];
    const fileIssueIds = new Set(fileList.issues.map((issue) => issue.id));
    const fileStateByIssue = new Map(fileList.loops.map((state) => [state.issueId, state]));
    const dbIssueIds = new Set(dbIssues.map((issue) => issue.id));

    for (const issue of dbIssues) {
      if (!fileIssueIds.has(issue.id)) {
        consistencyProblems.push(`db issue ${issue.id} missing .loops/issues/${issue.id}.json`);
      }
      if (!issue.state) {
        dbProblems.push(`db issue ${issue.id} missing db loop state`);
        continue;
      }

      const fileState = fileStateByIssue.get(issue.id);
      if (!fileState) {
        consistencyProblems.push(`db issue ${issue.id} missing .loops/state.json entry`);
        continue;
      }

      this.compareState(issue.id, issue.state, fileState, consistencyProblems);
      this.inspectClosedIssue(issue, issue.state, fileState, consistencyProblems);
    }

    for (const issue of fileList.issues) {
      if (!dbIssueIds.has(issue.id)) {
        consistencyProblems.push(`.loops issue ${issue.id} missing db issue`);
      }
    }

    const problems = [...fileDoctor.fileProblems, ...dbProblems, ...consistencyProblems];

    if (problems.length > 0) {
      this.log('warn', `[Loops] doctor detected ${problems.length} problem(s)`, {
        count: problems.length,
        fileProblems: fileDoctor.fileProblems.length,
        dbProblems: dbProblems.length,
        consistencyProblems: consistencyProblems.length,
      });
    }

    return {
      ...fileDoctor,
      ok: problems.length === 0,
      fileProblems: fileDoctor.fileProblems,
      dbProblems,
      consistencyProblems,
      problems,
    };
  }

  private toContractIssue(issue: DbLoopIssue): LoopIssue {
    return {
      id: issue.id,
      title: issue.title,
      status: issue.status as LoopIssue['status'],
      priority: issue.priority as LoopIssue['priority'],
      created: issue.createdAt.toISOString(),
      updated: issue.updatedAt.toISOString(),
      sourceChannel: issue.sourceChannel as LoopIssue['sourceChannel'],
      sourceKind: issue.sourceKind as LoopIssue['sourceKind'],
      submitterId: issue.submitterId,
      submitterName: issue.submitterName,
      targetRepo: issue.targetRepo,
      body: issue.body,
      acceptanceCriteria: Array.isArray(issue.acceptanceCriteria)
        ? issue.acceptanceCriteria.filter((item): item is string => typeof item === 'string')
        : [],
      rawPayloadRef: issue.rawPayloadRef,
    };
  }

  private toContractState(state: DbLoopState): LoopStateItem {
    return {
      issueId: state.issueId,
      phase: state.phase as LoopStateItem['phase'],
      round: state.round,
      specVersion: state.specVersion,
      shardsTotal: state.shardsTotal,
      shardsDone: state.shardsDone,
      shardsInProgress: state.shardsInProgress,
      reloopCount: state.reloopCount,
      costTokens: state.costTokens,
      costCalls: state.costCalls,
      updated: state.updatedAt.toISOString(),
      paused: state.paused,
      globalVerdict: state.globalVerdict as LoopStateItem['globalVerdict'],
      finalized: state.finalized,
    };
  }

  private toContractIntake(intake: DbLoopIssueIntake): LoopIntake {
    return {
      id: intake.id,
      issueId: intake.issueId,
      sourceChannel: intake.sourceChannel as LoopIntake['sourceChannel'],
      sourceKind: intake.sourceKind as LoopIntake['sourceKind'],
      submitter: {
        provider: intake.submitterProvider as LoopIntake['submitter']['provider'],
        userId: intake.submitterId,
        name: intake.submitterName,
      },
      rawPayloadRef: intake.rawPayloadRef,
      status: intake.status as LoopIntake['status'],
      created: intake.createdAt.toISOString(),
    };
  }

  private hasListFilters(query: LoopIssuesQuery) {
    return Boolean(query.status || query.phase || query.priority || query.targetRepo);
  }

  private matchesQuery(issue: LoopIssue, state: LoopStateItem | undefined, query: LoopIssuesQuery) {
    return (
      (!query.status || issue.status === query.status) &&
      (!query.phase || state?.phase === query.phase) &&
      (!query.priority || issue.priority === query.priority) &&
      (!query.targetRepo || issue.targetRepo === query.targetRepo)
    );
  }

  private toInputJson(value: unknown): Prisma.InputJsonValue {
    if (value === undefined) {
      return {};
    }
    return value as Prisma.InputJsonValue;
  }

  private compareState(
    issueId: string,
    dbState: DbLoopState,
    fileState: LoopStateItem,
    problems: string[],
  ) {
    const checks: Array<[string, string | number | boolean, string | number | boolean]> = [
      ['phase', dbState.phase, fileState.phase],
      ['round', dbState.round, fileState.round],
      ['finalized', dbState.finalized, fileState.finalized ?? false],
    ];

    for (const [field, dbValue, fileValue] of checks) {
      if (dbValue !== fileValue) {
        problems.push(
          `db/.loops state mismatch for ${issueId}: ${field} db=${dbValue} file=${fileValue}`,
        );
      }
    }
  }

  private inspectClosedIssue(
    issue: DbLoopIssue,
    dbState: DbLoopState,
    fileState: LoopStateItem,
    problems: string[],
  ) {
    if (issue.status !== 'CLOSED') {
      return;
    }
    if (!dbState.finalized) {
      problems.push(`closed issue ${issue.id} missing finalized=true in db state`);
    }
    if (!fileState.finalized) {
      problems.push(`closed issue ${issue.id} missing finalized=true in .loops/state.json`);
    }
    if (fileState.phase !== 'CLOSED' || dbState.phase !== 'CLOSED') {
      problems.push(`closed issue ${issue.id} missing CLOSED phase in db/.loops state`);
    }
  }
}
