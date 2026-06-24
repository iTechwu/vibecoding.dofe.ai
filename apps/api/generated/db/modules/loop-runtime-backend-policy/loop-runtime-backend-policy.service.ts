import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@dofe/infra-prisma';
import { TransactionalServiceBase } from '@dofe/infra-shared-db';
import { HandlePrismaError, DbOperationType } from '@dofe/infra-common';
import { PAGINATION } from '@repo/constants';
import type { Prisma, LoopRuntimeBackendPolicy } from '@prisma/client';

@Injectable()
export class LoopRuntimeBackendPolicyService extends TransactionalServiceBase {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async get(
    where: Prisma.LoopRuntimeBackendPolicyWhereInput,
    additional?: { select?: Prisma.LoopRuntimeBackendPolicySelect },
  ): Promise<LoopRuntimeBackendPolicy | null> {
    return this.getReadClient().loopRuntimeBackendPolicy.findFirst({
      where: { ...where, isDeleted: false },
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async getById(
    id: string,
    additional?: { select?: Prisma.LoopRuntimeBackendPolicySelect },
  ): Promise<LoopRuntimeBackendPolicy | null> {
    return this.getReadClient().loopRuntimeBackendPolicy.findFirst({
      where: { id: id, isDeleted: false },
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async list(
    where: Prisma.LoopRuntimeBackendPolicyWhereInput,
    pagination?: {
      orderBy?:
        | Prisma.LoopRuntimeBackendPolicyOrderByWithRelationInput
        | Prisma.LoopRuntimeBackendPolicyOrderByWithRelationInput[];
      limit?: number;
      page?: number;
    },
    additional?: { select?: Prisma.LoopRuntimeBackendPolicySelect },
  ): Promise<{ list: LoopRuntimeBackendPolicy[]; total: number; page: number; limit: number }> {
    const {
      orderBy = { id: 'desc' },
      limit = PAGINATION.MAX_PAGE_SIZE,
      page = 1,
    } = pagination || {};
    const skip = (page - 1) * limit;

    const [list, total] = await Promise.all([
      this.getReadClient().loopRuntimeBackendPolicy.findMany({
        where: { ...where, isDeleted: false },
        orderBy,
        take: limit,
        skip,
        ...additional,
      }),
      this.getReadClient().loopRuntimeBackendPolicy.count({
        where: { ...where, isDeleted: false },
      }),
    ]);

    return { list, total, page, limit };
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async count(where?: Prisma.LoopRuntimeBackendPolicyWhereInput): Promise<number> {
    return this.getReadClient().loopRuntimeBackendPolicy.count({
      where: where ? { ...where, isDeleted: false } : { isDeleted: false },
    });
  }

  @HandlePrismaError(DbOperationType.CREATE)
  async create(
    data: Prisma.LoopRuntimeBackendPolicyCreateInput,
    additional?: { select?: Prisma.LoopRuntimeBackendPolicySelect },
  ): Promise<LoopRuntimeBackendPolicy> {
    return this.getWriteClient().loopRuntimeBackendPolicy.create({ data, ...additional });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async update(
    where: Prisma.LoopRuntimeBackendPolicyWhereUniqueInput,
    data: Prisma.LoopRuntimeBackendPolicyUpdateInput,
    additional?: { select?: Prisma.LoopRuntimeBackendPolicySelect },
  ): Promise<LoopRuntimeBackendPolicy> {
    return this.getWriteClient().loopRuntimeBackendPolicy.update({
      where,
      data,
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.DELETE)
  async delete(
    where: Prisma.LoopRuntimeBackendPolicyWhereUniqueInput,
  ): Promise<LoopRuntimeBackendPolicy> {
    return this.getWriteClient().loopRuntimeBackendPolicy.delete({ where });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async softDelete(
    where: Prisma.LoopRuntimeBackendPolicyWhereUniqueInput,
  ): Promise<LoopRuntimeBackendPolicy> {
    return this.getWriteClient().loopRuntimeBackendPolicy.update({
      where,
      data: { isDeleted: true },
    });
  }

  @HandlePrismaError(DbOperationType.CREATE)
  async createMany(
    data: Prisma.LoopRuntimeBackendPolicyCreateManyInput[],
  ): Promise<{ count: number }> {
    return this.getWriteClient().loopRuntimeBackendPolicy.createMany({ data });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async updateMany(
    where: Prisma.LoopRuntimeBackendPolicyWhereInput,
    data: Prisma.LoopRuntimeBackendPolicyUpdateInput,
  ): Promise<{ count: number }> {
    return this.getWriteClient().loopRuntimeBackendPolicy.updateMany({ where, data });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async upsert(args: Prisma.LoopRuntimeBackendPolicyUpsertArgs): Promise<LoopRuntimeBackendPolicy> {
    return this.getWriteClient().loopRuntimeBackendPolicy.upsert(args);
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async getOrThrow(
    where: Prisma.LoopRuntimeBackendPolicyWhereUniqueInput,
    additional?: { select?: Prisma.LoopRuntimeBackendPolicySelect },
  ): Promise<LoopRuntimeBackendPolicy> {
    const record = await this.getReadClient().loopRuntimeBackendPolicy.findFirst({
      where: { ...where, isDeleted: false },
      ...additional,
    });
    if (!record) {
      throw new NotFoundException('LoopRuntimeBackendPolicy not found');
    }
    return record;
  }
}
