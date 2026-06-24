import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@dofe/infra-prisma';
import { TransactionalServiceBase } from '@dofe/infra-shared-db';
import { HandlePrismaError, DbOperationType } from '@dofe/infra-common';
import { PAGINATION } from '@repo/constants';
import type { Prisma, LoopSecondOpinionRecord } from '@prisma/client';

@Injectable()
export class LoopSecondOpinionRecordService extends TransactionalServiceBase {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async get(
    where: Prisma.LoopSecondOpinionRecordWhereInput,
    additional?: { select?: Prisma.LoopSecondOpinionRecordSelect },
  ): Promise<LoopSecondOpinionRecord | null> {
    return this.getReadClient().loopSecondOpinionRecord.findFirst({
      where: { ...where, isDeleted: false },
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async getById(
    id: string,
    additional?: { select?: Prisma.LoopSecondOpinionRecordSelect },
  ): Promise<LoopSecondOpinionRecord | null> {
    return this.getReadClient().loopSecondOpinionRecord.findFirst({
      where: { id: id, isDeleted: false },
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async list(
    where: Prisma.LoopSecondOpinionRecordWhereInput,
    pagination?: {
      orderBy?:
        | Prisma.LoopSecondOpinionRecordOrderByWithRelationInput
        | Prisma.LoopSecondOpinionRecordOrderByWithRelationInput[];
      limit?: number;
      page?: number;
    },
    additional?: { select?: Prisma.LoopSecondOpinionRecordSelect },
  ): Promise<{ list: LoopSecondOpinionRecord[]; total: number; page: number; limit: number }> {
    const {
      orderBy = { createdAt: 'desc' },
      limit = PAGINATION.MAX_PAGE_SIZE,
      page = 1,
    } = pagination || {};
    const skip = (page - 1) * limit;

    const [list, total] = await Promise.all([
      this.getReadClient().loopSecondOpinionRecord.findMany({
        where: { ...where, isDeleted: false },
        orderBy,
        take: limit,
        skip,
        ...additional,
      }),
      this.getReadClient().loopSecondOpinionRecord.count({
        where: { ...where, isDeleted: false },
      }),
    ]);

    return { list, total, page, limit };
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async count(where?: Prisma.LoopSecondOpinionRecordWhereInput): Promise<number> {
    return this.getReadClient().loopSecondOpinionRecord.count({
      where: where ? { ...where, isDeleted: false } : { isDeleted: false },
    });
  }

  @HandlePrismaError(DbOperationType.CREATE)
  async create(
    data: Prisma.LoopSecondOpinionRecordCreateInput,
    additional?: { select?: Prisma.LoopSecondOpinionRecordSelect },
  ): Promise<LoopSecondOpinionRecord> {
    return this.getWriteClient().loopSecondOpinionRecord.create({ data, ...additional });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async update(
    where: Prisma.LoopSecondOpinionRecordWhereUniqueInput,
    data: Prisma.LoopSecondOpinionRecordUpdateInput,
    additional?: { select?: Prisma.LoopSecondOpinionRecordSelect },
  ): Promise<LoopSecondOpinionRecord> {
    return this.getWriteClient().loopSecondOpinionRecord.update({
      where,
      data,
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.DELETE)
  async delete(
    where: Prisma.LoopSecondOpinionRecordWhereUniqueInput,
  ): Promise<LoopSecondOpinionRecord> {
    return this.getWriteClient().loopSecondOpinionRecord.delete({ where });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async softDelete(
    where: Prisma.LoopSecondOpinionRecordWhereUniqueInput,
  ): Promise<LoopSecondOpinionRecord> {
    return this.getWriteClient().loopSecondOpinionRecord.update({
      where,
      data: { isDeleted: true },
    });
  }

  @HandlePrismaError(DbOperationType.CREATE)
  async createMany(
    data: Prisma.LoopSecondOpinionRecordCreateManyInput[],
  ): Promise<{ count: number }> {
    return this.getWriteClient().loopSecondOpinionRecord.createMany({ data });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async updateMany(
    where: Prisma.LoopSecondOpinionRecordWhereInput,
    data: Prisma.LoopSecondOpinionRecordUpdateInput,
  ): Promise<{ count: number }> {
    return this.getWriteClient().loopSecondOpinionRecord.updateMany({ where, data });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async upsert(args: Prisma.LoopSecondOpinionRecordUpsertArgs): Promise<LoopSecondOpinionRecord> {
    return this.getWriteClient().loopSecondOpinionRecord.upsert(args);
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async getOrThrow(
    where: Prisma.LoopSecondOpinionRecordWhereUniqueInput,
    additional?: { select?: Prisma.LoopSecondOpinionRecordSelect },
  ): Promise<LoopSecondOpinionRecord> {
    const record = await this.getReadClient().loopSecondOpinionRecord.findFirst({
      where: { ...where, isDeleted: false },
      ...additional,
    });
    if (!record) {
      throw new NotFoundException('LoopSecondOpinionRecord not found');
    }
    return record;
  }
}
