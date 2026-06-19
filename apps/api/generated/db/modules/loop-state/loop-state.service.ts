import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@dofe/infra-prisma';
import { TransactionalServiceBase } from '@dofe/infra-shared-db';
import { DbOperationType, HandlePrismaError } from '@dofe/infra-common';
import type { LoopState, Prisma } from '@prisma/client';

@Injectable()
export class LoopStateService extends TransactionalServiceBase {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async getByIssueId(issueId: string): Promise<LoopState | null> {
    return this.getReadClient().loopState.findFirst({
      where: { issueId, isDeleted: false },
    });
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async getByIssueIdOrThrow(issueId: string): Promise<LoopState> {
    const state = await this.getByIssueId(issueId);
    if (!state) {
      throw new NotFoundException(`Loop state for issue ${issueId} not found`);
    }
    return state;
  }

  @HandlePrismaError(DbOperationType.CREATE)
  async upsert(args: Prisma.LoopStateUpsertArgs): Promise<LoopState> {
    return this.getWriteClient().loopState.upsert(args);
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async update(where: Prisma.LoopStateWhereUniqueInput, data: Prisma.LoopStateUpdateInput) {
    return this.getWriteClient().loopState.update({ where, data });
  }
}
