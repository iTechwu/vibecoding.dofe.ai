import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@dofe/infra-prisma';
import { TransactionalServiceBase } from '@dofe/infra-shared-db';
import { DbOperationType, HandlePrismaError } from '@dofe/infra-common';
import type { LoopIssue, Prisma } from '@prisma/client';

@Injectable()
export class LoopIssueService extends TransactionalServiceBase {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async list(
    where: Prisma.LoopIssueWhereInput = {},
    pagination: {
      orderBy?: Prisma.LoopIssueOrderByWithRelationInput | Prisma.LoopIssueOrderByWithRelationInput[];
      limit?: number;
      page?: number;
    } = {},
  ): Promise<{ list: LoopIssue[]; total: number; page: number; limit: number }> {
    const { orderBy = { createdAt: 'desc' }, limit = 50, page = 1 } = pagination;
    const effectiveWhere = { ...where, isDeleted: false };
    const skip = (page - 1) * limit;
    const [list, total] = await Promise.all([
      this.getReadClient().loopIssue.findMany({
        where: effectiveWhere,
        orderBy,
        take: limit,
        skip,
      }),
      this.getReadClient().loopIssue.count({ where: effectiveWhere }),
    ]);

    return { list, total, page, limit };
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async getById(
    id: string,
    additional?: { include?: Prisma.LoopIssueInclude; select?: Prisma.LoopIssueSelect },
  ): Promise<LoopIssue | null> {
    return this.getReadClient().loopIssue.findFirst({
      where: { id, isDeleted: false },
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async getByIdOrThrow(
    id: string,
    additional?: { include?: Prisma.LoopIssueInclude; select?: Prisma.LoopIssueSelect },
  ): Promise<LoopIssue> {
    const issue = await this.getById(id, additional);
    if (!issue) {
      throw new NotFoundException(`Loop issue ${id} not found`);
    }
    return issue;
  }

  @HandlePrismaError(DbOperationType.CREATE)
  async upsert(args: Prisma.LoopIssueUpsertArgs): Promise<LoopIssue> {
    return this.getWriteClient().loopIssue.upsert(args);
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async update(
    where: Prisma.LoopIssueWhereUniqueInput,
    data: Prisma.LoopIssueUpdateInput,
  ): Promise<LoopIssue> {
    return this.getWriteClient().loopIssue.update({ where, data });
  }
}
