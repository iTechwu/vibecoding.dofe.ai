import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@dofe/infra-prisma';
import { TransactionalServiceBase } from '@dofe/infra-shared-db';
import { HandlePrismaError, DbOperationType } from '@dofe/infra-common';
import { PAGINATION } from '@repo/constants';
import type { Prisma, LoopEvalAggregation } from '@prisma/client';

@Injectable()
export class LoopEvalAggregationService extends TransactionalServiceBase {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async get(
    where: Prisma.LoopEvalAggregationWhereInput,
    additional?: { select?: Prisma.LoopEvalAggregationSelect },
  ): Promise<LoopEvalAggregation | null> {
    return this.getReadClient().loopEvalAggregation.findFirst({
      where: where,
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async getById(
    id: string,
    additional?: { select?: Prisma.LoopEvalAggregationSelect },
  ): Promise<LoopEvalAggregation | null> {
    return this.getReadClient().loopEvalAggregation.findUnique({
      where: { id: id },
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async list(
    where: Prisma.LoopEvalAggregationWhereInput,
    pagination?: {
      orderBy?:
        | Prisma.LoopEvalAggregationOrderByWithRelationInput
        | Prisma.LoopEvalAggregationOrderByWithRelationInput[];
      limit?: number;
      page?: number;
    },
    additional?: { select?: Prisma.LoopEvalAggregationSelect },
  ): Promise<{ list: LoopEvalAggregation[]; total: number; page: number; limit: number }> {
    const {
      orderBy = { createdAt: 'desc' },
      limit = PAGINATION.MAX_PAGE_SIZE,
      page = 1,
    } = pagination || {};
    const skip = (page - 1) * limit;

    const [list, total] = await Promise.all([
      this.getReadClient().loopEvalAggregation.findMany({
        where: where,
        orderBy,
        take: limit,
        skip,
        ...additional,
      }),
      this.getReadClient().loopEvalAggregation.count({
        where: where,
      }),
    ]);

    return { list, total, page, limit };
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async count(where?: Prisma.LoopEvalAggregationWhereInput): Promise<number> {
    return this.getReadClient().loopEvalAggregation.count({
      where: where ?? {},
    });
  }

  @HandlePrismaError(DbOperationType.CREATE)
  async create(
    data: Prisma.LoopEvalAggregationCreateInput,
    additional?: { select?: Prisma.LoopEvalAggregationSelect },
  ): Promise<LoopEvalAggregation> {
    return this.getWriteClient().loopEvalAggregation.create({ data, ...additional });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async update(
    where: Prisma.LoopEvalAggregationWhereUniqueInput,
    data: Prisma.LoopEvalAggregationUpdateInput,
    additional?: { select?: Prisma.LoopEvalAggregationSelect },
  ): Promise<LoopEvalAggregation> {
    return this.getWriteClient().loopEvalAggregation.update({
      where,
      data,
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.DELETE)
  async delete(where: Prisma.LoopEvalAggregationWhereUniqueInput): Promise<LoopEvalAggregation> {
    return this.getWriteClient().loopEvalAggregation.delete({ where });
  }

  @HandlePrismaError(DbOperationType.CREATE)
  async createMany(data: Prisma.LoopEvalAggregationCreateManyInput[]): Promise<{ count: number }> {
    return this.getWriteClient().loopEvalAggregation.createMany({ data });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async updateMany(
    where: Prisma.LoopEvalAggregationWhereInput,
    data: Prisma.LoopEvalAggregationUpdateInput,
  ): Promise<{ count: number }> {
    return this.getWriteClient().loopEvalAggregation.updateMany({ where, data });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async upsert(args: Prisma.LoopEvalAggregationUpsertArgs): Promise<LoopEvalAggregation> {
    return this.getWriteClient().loopEvalAggregation.upsert(args);
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async getOrThrow(
    where: Prisma.LoopEvalAggregationWhereUniqueInput,
    additional?: { select?: Prisma.LoopEvalAggregationSelect },
  ): Promise<LoopEvalAggregation> {
    const record = await this.getReadClient().loopEvalAggregation.findUnique({
      where: { ...where },
      ...additional,
    });
    if (!record) {
      throw new NotFoundException('LoopEvalAggregation not found');
    }
    return record;
  }
}
