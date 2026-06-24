import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@dofe/infra-prisma';
import { TransactionalServiceBase } from '@dofe/infra-shared-db';
import { HandlePrismaError, DbOperationType } from '@dofe/infra-common';
import { PAGINATION } from '@dofe/infra-contracts';
import type { Prisma, LoopLearningRecord } from '@prisma/client';

@Injectable()
export class LoopLearningRecordService extends TransactionalServiceBase {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async get(
    where: Prisma.LoopLearningRecordWhereInput,
    additional?: { select?: Prisma.LoopLearningRecordSelect },
  ): Promise<LoopLearningRecord | null> {
    return this.getReadClient().loopLearningRecord.findFirst({
      where: { ...where, isDeleted: false },
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async getById(
    id: string,
    additional?: { select?: Prisma.LoopLearningRecordSelect },
  ): Promise<LoopLearningRecord | null> {
    return this.getReadClient().loopLearningRecord.findFirst({
      where: { id: id, isDeleted: false },
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async list(
    where: Prisma.LoopLearningRecordWhereInput,
    pagination?: {
      orderBy?:
        | Prisma.LoopLearningRecordOrderByWithRelationInput
        | Prisma.LoopLearningRecordOrderByWithRelationInput[];
      limit?: number;
      page?: number;
    },
    additional?: { select?: Prisma.LoopLearningRecordSelect },
  ): Promise<{ list: LoopLearningRecord[]; total: number; page: number; limit: number }> {
    const {
      orderBy = { createdAt: 'desc' },
      limit = PAGINATION.MAX_PAGE_SIZE,
      page = 1,
    } = pagination || {};
    const skip = (page - 1) * limit;

    const [list, total] = await Promise.all([
      this.getReadClient().loopLearningRecord.findMany({
        where: { ...where, isDeleted: false },
        orderBy,
        take: limit,
        skip,
        ...additional,
      }),
      this.getReadClient().loopLearningRecord.count({
        where: { ...where, isDeleted: false },
      }),
    ]);

    return { list, total, page, limit };
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async count(where?: Prisma.LoopLearningRecordWhereInput): Promise<number> {
    return this.getReadClient().loopLearningRecord.count({
      where: where ? { ...where, isDeleted: false } : { isDeleted: false },
    });
  }

  @HandlePrismaError(DbOperationType.CREATE)
  async create(
    data: Prisma.LoopLearningRecordCreateInput,
    additional?: { select?: Prisma.LoopLearningRecordSelect },
  ): Promise<LoopLearningRecord> {
    return this.getWriteClient().loopLearningRecord.create({ data, ...additional });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async update(
    where: Prisma.LoopLearningRecordWhereUniqueInput,
    data: Prisma.LoopLearningRecordUpdateInput,
    additional?: { select?: Prisma.LoopLearningRecordSelect },
  ): Promise<LoopLearningRecord> {
    return this.getWriteClient().loopLearningRecord.update({
      where,
      data,
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.DELETE)
  async delete(where: Prisma.LoopLearningRecordWhereUniqueInput): Promise<LoopLearningRecord> {
    return this.getWriteClient().loopLearningRecord.delete({ where });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async softDelete(where: Prisma.LoopLearningRecordWhereUniqueInput): Promise<LoopLearningRecord> {
    return this.getWriteClient().loopLearningRecord.update({
      where,
      data: { isDeleted: true },
    });
  }

  @HandlePrismaError(DbOperationType.CREATE)
  async createMany(data: Prisma.LoopLearningRecordCreateManyInput[]): Promise<{ count: number }> {
    return this.getWriteClient().loopLearningRecord.createMany({ data });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async updateMany(
    where: Prisma.LoopLearningRecordWhereInput,
    data: Prisma.LoopLearningRecordUpdateInput,
  ): Promise<{ count: number }> {
    return this.getWriteClient().loopLearningRecord.updateMany({ where, data });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async upsert(args: Prisma.LoopLearningRecordUpsertArgs): Promise<LoopLearningRecord> {
    return this.getWriteClient().loopLearningRecord.upsert(args);
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async getOrThrow(
    where: Prisma.LoopLearningRecordWhereUniqueInput,
    additional?: { select?: Prisma.LoopLearningRecordSelect },
  ): Promise<LoopLearningRecord> {
    const record = await this.getReadClient().loopLearningRecord.findFirst({
      where: { ...where, isDeleted: false },
      ...additional,
    });
    if (!record) {
      throw new NotFoundException('LoopLearningRecord not found');
    }
    return record;
  }
}
