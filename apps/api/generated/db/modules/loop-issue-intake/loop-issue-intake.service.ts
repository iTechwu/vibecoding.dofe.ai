import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@dofe/infra-prisma';
import { TransactionalServiceBase } from '@dofe/infra-shared-db';
import { HandlePrismaError, DbOperationType } from '@dofe/infra-common';
import { PAGINATION } from '@repo/constants';
import type { Prisma, LoopIssueIntake } from '@prisma/client';

@Injectable()
export class LoopIssueIntakeService extends TransactionalServiceBase {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async get(
    where: Prisma.LoopIssueIntakeWhereInput,
    additional?: { select?: Prisma.LoopIssueIntakeSelect; include?: Prisma.LoopIssueIntakeInclude },
  ): Promise<LoopIssueIntake | null> {
    return this.getReadClient().loopIssueIntake.findFirst({
      where: { ...where, isDeleted: false },
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async getById(
    id: string,
    additional?: { select?: Prisma.LoopIssueIntakeSelect; include?: Prisma.LoopIssueIntakeInclude },
  ): Promise<LoopIssueIntake | null> {
    return this.getReadClient().loopIssueIntake.findUnique({
      where: { id: id, isDeleted: false },
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async list(
    where: Prisma.LoopIssueIntakeWhereInput,
    pagination?: {
      orderBy?:
        | Prisma.LoopIssueIntakeOrderByWithRelationInput
        | Prisma.LoopIssueIntakeOrderByWithRelationInput[];
      limit?: number;
      page?: number;
    },
    additional?: { select?: Prisma.LoopIssueIntakeSelect; include?: Prisma.LoopIssueIntakeInclude },
  ): Promise<{ list: LoopIssueIntake[]; total: number; page: number; limit: number }> {
    const {
      orderBy = { createdAt: 'desc' },
      limit = PAGINATION.MAX_PAGE_SIZE,
      page = 1,
    } = pagination || {};
    const skip = (page - 1) * limit;

    const [list, total] = await Promise.all([
      this.getReadClient().loopIssueIntake.findMany({
        where: { ...where, isDeleted: false },
        orderBy,
        take: limit,
        skip,
        ...additional,
      }),
      this.getReadClient().loopIssueIntake.count({
        where: { ...where, isDeleted: false },
      }),
    ]);

    return { list, total, page, limit };
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async count(where?: Prisma.LoopIssueIntakeWhereInput): Promise<number> {
    return this.getReadClient().loopIssueIntake.count({
      where: where ? { ...where, isDeleted: false } : { isDeleted: false },
    });
  }

  @HandlePrismaError(DbOperationType.CREATE)
  async create(
    data: Prisma.LoopIssueIntakeCreateInput,
    additional?: { select?: Prisma.LoopIssueIntakeSelect; include?: Prisma.LoopIssueIntakeInclude },
  ): Promise<LoopIssueIntake> {
    return this.getWriteClient().loopIssueIntake.create({ data, ...additional });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async update(
    where: Prisma.LoopIssueIntakeWhereUniqueInput,
    data: Prisma.LoopIssueIntakeUpdateInput,
    additional?: { select?: Prisma.LoopIssueIntakeSelect; include?: Prisma.LoopIssueIntakeInclude },
  ): Promise<LoopIssueIntake> {
    return this.getWriteClient().loopIssueIntake.update({
      where,
      data,
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.DELETE)
  async delete(where: Prisma.LoopIssueIntakeWhereUniqueInput): Promise<LoopIssueIntake> {
    return this.getWriteClient().loopIssueIntake.delete({ where });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async softDelete(where: Prisma.LoopIssueIntakeWhereUniqueInput): Promise<LoopIssueIntake> {
    return this.getWriteClient().loopIssueIntake.update({
      where,
      data: { isDeleted: true },
    });
  }

  @HandlePrismaError(DbOperationType.CREATE)
  async createMany(data: Prisma.LoopIssueIntakeCreateManyInput[]): Promise<{ count: number }> {
    return this.getWriteClient().loopIssueIntake.createMany({ data });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async updateMany(
    where: Prisma.LoopIssueIntakeWhereInput,
    data: Prisma.LoopIssueIntakeUpdateInput,
  ): Promise<{ count: number }> {
    return this.getWriteClient().loopIssueIntake.updateMany({ where, data });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async upsert(args: Prisma.LoopIssueIntakeUpsertArgs): Promise<LoopIssueIntake> {
    return this.getWriteClient().loopIssueIntake.upsert(args);
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async getOrThrow(
    where: Prisma.LoopIssueIntakeWhereUniqueInput,
    additional?: { select?: Prisma.LoopIssueIntakeSelect; include?: Prisma.LoopIssueIntakeInclude },
  ): Promise<LoopIssueIntake> {
    const record = await this.getReadClient().loopIssueIntake.findUnique({
      where: { ...where, isDeleted: false },
      ...additional,
    });
    if (!record) {
      throw new NotFoundException('LoopIssueIntake not found');
    }
    return record;
  }
}
