import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@dofe/infra-prisma';
import { TransactionalServiceBase } from '@dofe/infra-shared-db';
import { HandlePrismaError, DbOperationType } from '@dofe/infra-common';
import { PAGINATION } from '@repo/constants';
import type { Prisma, LoopState } from '@prisma/client';

@Injectable()
export class LoopStateService extends TransactionalServiceBase {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async get(
    where: Prisma.LoopStateWhereInput,
    additional?: { select?: Prisma.LoopStateSelect; include?: Prisma.LoopStateInclude },
  ): Promise<LoopState | null> {
    return this.getReadClient().loopState.findFirst({
      where: { ...where, isDeleted: false },
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async getById(
    id: string,
    additional?: { select?: Prisma.LoopStateSelect; include?: Prisma.LoopStateInclude },
  ): Promise<LoopState | null> {
    return this.getReadClient().loopState.findUnique({
      where: { id: id, isDeleted: false },
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async getByIssueId(
    value: string,
    additional?: { select?: Prisma.LoopStateSelect; include?: Prisma.LoopStateInclude },
  ): Promise<LoopState | null> {
    return this.getReadClient().loopState.findUnique({
      where: { issueId: value, isDeleted: false },
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async list(
    where: Prisma.LoopStateWhereInput,
    pagination?: {
      orderBy?:
        | Prisma.LoopStateOrderByWithRelationInput
        | Prisma.LoopStateOrderByWithRelationInput[];
      limit?: number;
      page?: number;
    },
    additional?: { select?: Prisma.LoopStateSelect; include?: Prisma.LoopStateInclude },
  ): Promise<{ list: LoopState[]; total: number; page: number; limit: number }> {
    const {
      orderBy = { id: 'desc' },
      limit = PAGINATION.MAX_PAGE_SIZE,
      page = 1,
    } = pagination || {};
    const skip = (page - 1) * limit;

    const [list, total] = await Promise.all([
      this.getReadClient().loopState.findMany({
        where: { ...where, isDeleted: false },
        orderBy,
        take: limit,
        skip,
        ...additional,
      }),
      this.getReadClient().loopState.count({
        where: { ...where, isDeleted: false },
      }),
    ]);

    return { list, total, page, limit };
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async count(where?: Prisma.LoopStateWhereInput): Promise<number> {
    return this.getReadClient().loopState.count({
      where: where ? { ...where, isDeleted: false } : { isDeleted: false },
    });
  }

  @HandlePrismaError(DbOperationType.CREATE)
  async create(
    data: Prisma.LoopStateCreateInput,
    additional?: { select?: Prisma.LoopStateSelect; include?: Prisma.LoopStateInclude },
  ): Promise<LoopState> {
    return this.getWriteClient().loopState.create({ data, ...additional });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async update(
    where: Prisma.LoopStateWhereUniqueInput,
    data: Prisma.LoopStateUpdateInput,
    additional?: { select?: Prisma.LoopStateSelect; include?: Prisma.LoopStateInclude },
  ): Promise<LoopState> {
    return this.getWriteClient().loopState.update({
      where,
      data,
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.DELETE)
  async delete(where: Prisma.LoopStateWhereUniqueInput): Promise<LoopState> {
    return this.getWriteClient().loopState.delete({ where });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async softDelete(where: Prisma.LoopStateWhereUniqueInput): Promise<LoopState> {
    return this.getWriteClient().loopState.update({
      where,
      data: { isDeleted: true },
    });
  }

  @HandlePrismaError(DbOperationType.CREATE)
  async createMany(data: Prisma.LoopStateCreateManyInput[]): Promise<{ count: number }> {
    return this.getWriteClient().loopState.createMany({ data });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async updateMany(
    where: Prisma.LoopStateWhereInput,
    data: Prisma.LoopStateUpdateInput,
  ): Promise<{ count: number }> {
    return this.getWriteClient().loopState.updateMany({ where, data });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async upsert(args: Prisma.LoopStateUpsertArgs): Promise<LoopState> {
    return this.getWriteClient().loopState.upsert(args);
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async getOrThrow(
    where: Prisma.LoopStateWhereUniqueInput,
    additional?: { select?: Prisma.LoopStateSelect; include?: Prisma.LoopStateInclude },
  ): Promise<LoopState> {
    const record = await this.getReadClient().loopState.findUnique({
      where: { ...where, isDeleted: false },
      ...additional,
    });
    if (!record) {
      throw new NotFoundException('LoopState not found');
    }
    return record;
  }
}
