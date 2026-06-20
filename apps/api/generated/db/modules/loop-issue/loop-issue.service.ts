import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@dofe/infra-prisma';
import { TransactionalServiceBase } from '@dofe/infra-shared-db';
import { HandlePrismaError, DbOperationType } from '@dofe/infra-common';
import { PAGINATION } from '@repo/constants';
import type { Prisma, LoopIssue } from '@prisma/client';

@Injectable()
export class LoopIssueService extends TransactionalServiceBase {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async get(
    where: Prisma.LoopIssueWhereInput,
    additional?: { select?: Prisma.LoopIssueSelect; include?: Prisma.LoopIssueInclude },
  ): Promise<LoopIssue | null> {
    return this.getReadClient().loopIssue.findFirst({
      where: { ...where, isDeleted: false },
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async getById(
    id: string,
    additional?: { select?: Prisma.LoopIssueSelect; include?: Prisma.LoopIssueInclude },
  ): Promise<LoopIssue | null> {
    return this.getReadClient().loopIssue.findUnique({
      where: { id: id, isDeleted: false },
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async list(
    where: Prisma.LoopIssueWhereInput,
    pagination?: {
      orderBy?:
        | Prisma.LoopIssueOrderByWithRelationInput
        | Prisma.LoopIssueOrderByWithRelationInput[];
      limit?: number;
      page?: number;
    },
    additional?: { select?: Prisma.LoopIssueSelect; include?: Prisma.LoopIssueInclude },
  ): Promise<{ list: LoopIssue[]; total: number; page: number; limit: number }> {
    const {
      orderBy = { createdAt: 'desc' },
      limit = PAGINATION.MAX_PAGE_SIZE,
      page = 1,
    } = pagination || {};
    const skip = (page - 1) * limit;

    const [list, total] = await Promise.all([
      this.getReadClient().loopIssue.findMany({
        where: { ...where, isDeleted: false },
        orderBy,
        take: limit,
        skip,
        ...additional,
      }),
      this.getReadClient().loopIssue.count({
        where: { ...where, isDeleted: false },
      }),
    ]);

    return { list, total, page, limit };
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async count(where?: Prisma.LoopIssueWhereInput): Promise<number> {
    return this.getReadClient().loopIssue.count({
      where: where ? { ...where, isDeleted: false } : { isDeleted: false },
    });
  }

  @HandlePrismaError(DbOperationType.CREATE)
  async create(
    data: Prisma.LoopIssueCreateInput,
    additional?: { select?: Prisma.LoopIssueSelect; include?: Prisma.LoopIssueInclude },
  ): Promise<LoopIssue> {
    return this.getWriteClient().loopIssue.create({ data, ...additional });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async update(
    where: Prisma.LoopIssueWhereUniqueInput,
    data: Prisma.LoopIssueUpdateInput,
    additional?: { select?: Prisma.LoopIssueSelect; include?: Prisma.LoopIssueInclude },
  ): Promise<LoopIssue> {
    return this.getWriteClient().loopIssue.update({
      where,
      data,
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.DELETE)
  async delete(where: Prisma.LoopIssueWhereUniqueInput): Promise<LoopIssue> {
    return this.getWriteClient().loopIssue.delete({ where });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async softDelete(where: Prisma.LoopIssueWhereUniqueInput): Promise<LoopIssue> {
    return this.getWriteClient().loopIssue.update({
      where,
      data: { isDeleted: true },
    });
  }

  @HandlePrismaError(DbOperationType.CREATE)
  async createMany(data: Prisma.LoopIssueCreateManyInput[]): Promise<{ count: number }> {
    return this.getWriteClient().loopIssue.createMany({ data });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async updateMany(
    where: Prisma.LoopIssueWhereInput,
    data: Prisma.LoopIssueUpdateInput,
  ): Promise<{ count: number }> {
    return this.getWriteClient().loopIssue.updateMany({ where, data });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async upsert(args: Prisma.LoopIssueUpsertArgs): Promise<LoopIssue> {
    return this.getWriteClient().loopIssue.upsert(args);
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async getOrThrow(
    where: Prisma.LoopIssueWhereUniqueInput,
    additional?: { select?: Prisma.LoopIssueSelect; include?: Prisma.LoopIssueInclude },
  ): Promise<LoopIssue> {
    const record = await this.getReadClient().loopIssue.findUnique({
      where: { ...where, isDeleted: false },
      ...additional,
    });
    if (!record) {
      throw new NotFoundException('LoopIssue not found');
    }
    return record;
  }
}
