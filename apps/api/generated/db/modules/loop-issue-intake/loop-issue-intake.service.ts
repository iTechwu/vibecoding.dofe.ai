import { Injectable } from '@nestjs/common';
import { PrismaService } from '@dofe/infra-prisma';
import { TransactionalServiceBase } from '@dofe/infra-shared-db';
import { DbOperationType, HandlePrismaError } from '@dofe/infra-common';
import type { LoopIssueIntake, Prisma } from '@prisma/client';

@Injectable()
export class LoopIssueIntakeService extends TransactionalServiceBase {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async getById(id: string): Promise<LoopIssueIntake | null> {
    return this.getReadClient().loopIssueIntake.findFirst({
      where: { id, isDeleted: false },
    });
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async getLatestByIssueId(issueId: string): Promise<LoopIssueIntake | null> {
    return this.getReadClient().loopIssueIntake.findFirst({
      where: { issueId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
    });
  }

  @HandlePrismaError(DbOperationType.CREATE)
  async upsert(args: Prisma.LoopIssueIntakeUpsertArgs): Promise<LoopIssueIntake> {
    return this.getWriteClient().loopIssueIntake.upsert(args);
  }
}
