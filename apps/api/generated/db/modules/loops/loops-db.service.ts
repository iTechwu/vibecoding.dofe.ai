import { Injectable, NotFoundException } from '@nestjs/common';
import { DbOperationType, HandlePrismaError } from '@dofe/infra-common';
import { PrismaService } from '@dofe/infra-prisma';
import { TransactionalServiceBase } from '@dofe/infra-shared-db';
import { PAGINATION } from '@repo/constants';
import type {
  LoopIntake,
  LoopIssue,
  LoopIssuesQuery,
  LoopStateItem,
  RuntimeBackendPolicyUpdate,
} from '@repo/contracts';
import { Prisma } from '@prisma/client';
import type { LoopIssue as DbLoopIssue, LoopIssueIntake, LoopState } from '@prisma/client';

export type CreateLoopIssuePersistenceInput = {
  issue: LoopIssue;
  intake: LoopIntake;
  state: LoopStateItem;
  rawPayload?: Prisma.InputJsonValue;
};

export type LoopIssueDetailPersistence = {
  issue: DbLoopIssue;
  intakes: LoopIssueIntake[];
  state: LoopState;
};

type RuntimeBackendPolicyRow = {
  id: string;
  fallback_policy: string | null;
  cost_policy: string | null;
  permission_profile: string | null;
};

@Injectable()
export class LoopsDbService extends TransactionalServiceBase {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  @HandlePrismaError(DbOperationType.CREATE)
  async createIssue(input: CreateLoopIssuePersistenceInput): Promise<LoopIssueDetailPersistence> {
    const createdAt = this.toDate(input.issue.created);
    const updatedAt = this.toDate(input.issue.updated);
    const stateUpdatedAt = this.toDate(input.state.updated);
    const closedAt = input.issue.status === 'CLOSED' ? updatedAt : null;

    return this.getWriteClient().$transaction(async (tx) => {
      const issue = await tx.loopIssue.create({
        data: {
          id: input.issue.id,
          title: input.issue.title,
          body: input.issue.body,
          status: input.issue.status,
          priority: input.issue.priority,
          sourceChannel: input.issue.sourceChannel,
          sourceKind: input.issue.sourceKind,
          submitterProvider: input.intake.submitter.provider,
          submitterId: input.issue.submitterId,
          submitterName: input.issue.submitterName,
          targetRepo: input.issue.targetRepo,
          acceptanceCriteria: input.issue.acceptanceCriteria,
          rawPayloadRef: input.issue.rawPayloadRef,
          createdAt,
          updatedAt,
          closedAt,
        },
      });
      const intake = await tx.loopIssueIntake.create({
        data: {
          id: input.intake.id,
          issueId: input.issue.id,
          sourceChannel: input.intake.sourceChannel,
          sourceKind: input.intake.sourceKind,
          submitterProvider: input.intake.submitter.provider,
          submitterId: input.intake.submitter.userId,
          submitterName: input.intake.submitter.name,
          message: input.issue.body,
          rawPayload: input.rawPayload ?? Prisma.JsonNull,
          rawPayloadRef: input.intake.rawPayloadRef,
          status: input.intake.status,
          createdAt: this.toDate(input.intake.created),
        },
      });
      const state = await tx.loopState.create({
        data: this.toStateCreateInput(input.issue.id, input.state, stateUpdatedAt),
      });

      return { issue, intakes: [intake], state };
    });
  }

  @HandlePrismaError(DbOperationType.CREATE)
  async createIntake(input: {
    issueId: string;
    intake: LoopIntake;
    message: string;
    rawPayload?: Prisma.InputJsonValue;
  }): Promise<LoopIssueIntake> {
    return this.getWriteClient().loopIssueIntake.create({
      data: {
        id: input.intake.id,
        issueId: input.issueId,
        sourceChannel: input.intake.sourceChannel,
        sourceKind: input.intake.sourceKind,
        submitterProvider: input.intake.submitter.provider,
        submitterId: input.intake.submitter.userId,
        submitterName: input.intake.submitter.name,
        message: input.message,
        rawPayload: input.rawPayload ?? Prisma.JsonNull,
        rawPayloadRef: input.intake.rawPayloadRef,
        status: input.intake.status,
        createdAt: this.toDate(input.intake.created),
      },
    });
  }

  @HandlePrismaError(DbOperationType.CREATE)
  async createLoopState(issueId: string, state: LoopStateItem): Promise<LoopState> {
    return this.getWriteClient().loopState.create({
      data: this.toStateCreateInput(issueId, state, this.toDate(state.updated)),
    });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async updateLoopState(issueId: string, state: Partial<LoopStateItem>): Promise<LoopState> {
    return this.getWriteClient().loopState.update({
      where: { issueId },
      data: this.toStateUpdateInput(state),
    });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async updateIssueStatus(input: {
    issueId: string;
    status: string;
    updated: string;
  }): Promise<DbLoopIssue> {
    const updatedAt = this.toDate(input.updated);
    return this.getWriteClient().loopIssue.update({
      where: { id: input.issueId },
      data: {
        status: input.status,
        updatedAt,
        closedAt:
          input.status === 'CLOSED' || input.status === 'REJECTED' || input.status === 'ARCHIVED'
            ? updatedAt
            : null,
      },
    });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async upsertLoopState(issueId: string, state: LoopStateItem): Promise<LoopState> {
    return this.getWriteClient().loopState.upsert({
      where: { issueId },
      create: this.toStateCreateInput(issueId, state, this.toDate(state.updated)),
      update: this.toStateUpdateInput(state),
    });
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async listIssuesByStatus(
    statuses: string[],
    pagination?: {
      limit?: number;
      page?: number;
      orderBy?:
        | Prisma.LoopIssueOrderByWithRelationInput
        | Prisma.LoopIssueOrderByWithRelationInput[];
    },
  ): Promise<{ list: DbLoopIssue[]; total: number; page: number; limit: number }> {
    const limit = pagination?.limit ?? PAGINATION.DEFAULT_PAGE_SIZE;
    const page = pagination?.page ?? PAGINATION.DEFAULT_PAGE;
    const where: Prisma.LoopIssueWhereInput =
      statuses.length > 0 ? { status: { in: statuses } } : {};
    const orderBy = pagination?.orderBy ?? { createdAt: 'desc' };
    const skip = (page - 1) * limit;

    const [list, total] = await Promise.all([
      this.getReadClient().loopIssue.findMany({
        where,
        orderBy,
        take: limit,
        skip,
      }),
      this.getReadClient().loopIssue.count({ where }),
    ]);

    return { list, total, page, limit };
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async listIssues(query: LoopIssuesQuery): Promise<{
    list: Array<DbLoopIssue & { state: LoopState | null }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const { limit = PAGINATION.DEFAULT_PAGE_SIZE, page = PAGINATION.DEFAULT_PAGE } = query;
    const where: Prisma.LoopIssueWhereInput = {
      isDeleted: false,
      status: query.status,
      priority: query.priority,
      targetRepo: query.targetRepo,
      state: query.phase ? { phase: query.phase, isDeleted: false } : { isDeleted: false },
    };
    const skip = (page - 1) * limit;

    const [list, total] = await Promise.all([
      this.getReadClient().loopIssue.findMany({
        where,
        include: { state: true },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip,
      }),
      this.getReadClient().loopIssue.count({ where }),
    ]);

    return { list, total, page, limit };
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async listAllIssueStates(): Promise<Array<DbLoopIssue & { state: LoopState | null }>> {
    return this.getReadClient().loopIssue.findMany({
      where: { isDeleted: false },
      include: { state: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async getIssueDetailByIssueId(issueId: string): Promise<LoopIssueDetailPersistence | null> {
    const issue = await this.getReadClient().loopIssue.findUnique({
      where: { id: issueId },
      include: {
        intakes: { orderBy: { createdAt: 'asc' } },
        state: true,
      },
    });

    if (!issue || !issue.state) {
      return null;
    }

    return {
      issue,
      intakes: issue.intakes,
      state: issue.state,
    };
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async getIssueDetailByIssueIdOrThrow(issueId: string): Promise<LoopIssueDetailPersistence> {
    const detail = await this.getIssueDetailByIssueId(issueId);
    if (!detail) {
      throw new NotFoundException(`Loop issue ${issueId} not found`);
    }
    return detail;
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async listRuntimeBackendPolicies(): Promise<Record<string, RuntimeBackendPolicyUpdate>> {
    const rows = await this.getReadClient().$queryRaw<RuntimeBackendPolicyRow[]>`
      SELECT id, fallback_policy, cost_policy, permission_profile
      FROM loop_runtime_backend_policy
      WHERE is_deleted = false
      ORDER BY updated_at DESC
    `;
    return Object.fromEntries(rows.map((row) => [row.id, this.toRuntimeBackendPolicy(row)]));
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async upsertRuntimeBackendPolicy(
    id: string,
    policy: RuntimeBackendPolicyUpdate,
  ): Promise<RuntimeBackendPolicyUpdate> {
    const rows = await this.getWriteClient().$queryRaw<RuntimeBackendPolicyRow[]>`
      INSERT INTO loop_runtime_backend_policy (
        id,
        fallback_policy,
        cost_policy,
        permission_profile,
        updated_at,
        is_deleted,
        deleted_at
      )
      VALUES (
        ${id},
        ${policy.fallbackPolicy ?? null},
        ${policy.costPolicy ?? null},
        ${policy.permissionProfile ?? null},
        NOW(),
        false,
        NULL
      )
      ON CONFLICT (id) DO UPDATE SET
        fallback_policy = EXCLUDED.fallback_policy,
        cost_policy = EXCLUDED.cost_policy,
        permission_profile = EXCLUDED.permission_profile,
        updated_at = NOW(),
        is_deleted = false,
        deleted_at = NULL
      RETURNING id, fallback_policy, cost_policy, permission_profile
    `;
    return this.toRuntimeBackendPolicy(rows[0]);
  }

  private toDate(value: string) {
    return new Date(value);
  }

  private toStateCreateInput(
    issueId: string,
    state: LoopStateItem,
    updatedAt: Date,
  ): Prisma.LoopStateUncheckedCreateInput {
    return {
      issueId,
      phase: state.phase,
      round: state.round,
      specVersion: state.specVersion,
      shardsTotal: state.shardsTotal,
      shardsDone: state.shardsDone,
      shardsInProgress: state.shardsInProgress,
      reloopCount: state.reloopCount,
      costTokens: state.costTokens,
      costCalls: state.costCalls,
      globalVerdict: state.globalVerdict,
      paused: state.paused,
      finalized: state.finalized ?? false,
      updatedAt,
    };
  }

  private toStateUpdateInput(state: Partial<LoopStateItem>): Prisma.LoopStateUpdateInput {
    return {
      phase: state.phase,
      round: state.round,
      specVersion: state.specVersion,
      shardsTotal: state.shardsTotal,
      shardsDone: state.shardsDone,
      shardsInProgress: state.shardsInProgress,
      reloopCount: state.reloopCount,
      costTokens: state.costTokens,
      costCalls: state.costCalls,
      globalVerdict: state.globalVerdict,
      paused: state.paused,
      finalized: state.finalized,
      updatedAt: state.updated ? this.toDate(state.updated) : undefined,
    };
  }

  private toRuntimeBackendPolicy(
    row: RuntimeBackendPolicyRow | undefined,
  ): RuntimeBackendPolicyUpdate {
    return {
      ...(row?.fallback_policy ? { fallbackPolicy: row.fallback_policy } : {}),
      ...(row?.cost_policy ? { costPolicy: row.cost_policy } : {}),
      ...(row?.permission_profile ? { permissionProfile: row.permission_profile } : {}),
    };
  }
}
