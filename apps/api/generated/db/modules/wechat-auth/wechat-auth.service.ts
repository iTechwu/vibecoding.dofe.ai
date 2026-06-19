import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@dofe/infra-prisma';
import { TransactionalServiceBase } from '@dofe/infra-shared-db';
import { HandlePrismaError, DbOperationType } from '@dofe/infra-common';
import { PAGINATION } from '@repo/constants';
import type { Prisma, WechatAuth } from '@prisma/client';

@Injectable()
export class WechatAuthService extends TransactionalServiceBase {

  constructor(
    prisma: PrismaService,
  ) {
    super(prisma);
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async get(
    where: Prisma.WechatAuthWhereInput,
    additional?: { select?: Prisma.WechatAuthSelect; include?: Prisma.WechatAuthInclude },
  ): Promise<WechatAuth | null> {
    return this.getReadClient().wechatAuth.findFirst({
      where: { ...where, isDeleted: false },
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async getById(
    id: string,
    additional?: { select?: Prisma.WechatAuthSelect; include?: Prisma.WechatAuthInclude },
  ): Promise<WechatAuth | null> {
    return this.getReadClient().wechatAuth.findUnique({
      where: { openid: id, isDeleted: false },
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async list(
    where: Prisma.WechatAuthWhereInput,
    pagination?: {
      orderBy?: Prisma.WechatAuthOrderByWithRelationInput|Prisma.WechatAuthOrderByWithRelationInput[];
      limit?: number;
      page?: number;
    },
    additional?: { select?: Prisma.WechatAuthSelect; include?: Prisma.WechatAuthInclude },
  ): Promise<{ list: WechatAuth[]; total: number; page: number; limit: number }> {
    const {
      orderBy = { createdAt: 'desc' },
      limit = PAGINATION.MAX_PAGE_SIZE,
      page = 1,
    } = pagination || {};
    const skip = (page - 1) * limit;

    const [list, total] = await Promise.all([
      this.getReadClient().wechatAuth.findMany({
        where: { ...where, isDeleted: false },
        orderBy,
        take: limit,
        skip,
        ...additional,
      }),
      this.getReadClient().wechatAuth.count({
        where: { ...where, isDeleted: false },
      }),
    ]);

    return { list, total, page, limit };
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async count(where?: Prisma.WechatAuthWhereInput): Promise<number> {
    return this.getReadClient().wechatAuth.count({
      where: where ? { ...where, isDeleted: false } : { isDeleted: false },
    });
  }

  @HandlePrismaError(DbOperationType.CREATE)
  async create(
    data: Prisma.WechatAuthCreateInput,
    additional?: { select?: Prisma.WechatAuthSelect; include?: Prisma.WechatAuthInclude },
  ): Promise<WechatAuth> {
    return this.getWriteClient().wechatAuth.create({ data, ...additional });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async update(
    where: Prisma.WechatAuthWhereUniqueInput,
    data: Prisma.WechatAuthUpdateInput,
    additional?: { select?: Prisma.WechatAuthSelect; include?: Prisma.WechatAuthInclude },
  ): Promise<WechatAuth> {
    return this.getWriteClient().wechatAuth.update({
      where,
      data,
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.DELETE)
  async delete(where: Prisma.WechatAuthWhereUniqueInput): Promise<WechatAuth> {
    return this.getWriteClient().wechatAuth.delete({ where });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async softDelete(where: Prisma.WechatAuthWhereUniqueInput): Promise<WechatAuth> {
    return this.getWriteClient().wechatAuth.update({
      where,
      data: { isDeleted: true },
    });
  }

  @HandlePrismaError(DbOperationType.CREATE)
  async createMany(
    data: Prisma.WechatAuthCreateInput[],
  ): Promise<{ count: number }> {
    return this.getWriteClient().wechatAuth.createMany({ data });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async updateMany(
    where: Prisma.WechatAuthWhereInput,
    data: Prisma.WechatAuthUpdateInput,
  ): Promise<{ count: number }> {
    return this.getWriteClient().wechatAuth.updateMany({ where, data });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async upsert(
    args: Prisma.WechatAuthUpsertArgs,
  ): Promise<WechatAuth> {
    return this.getWriteClient().wechatAuth.upsert(args);
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async getOrThrow(
    where: Prisma.WechatAuthWhereUniqueInput,
    additional?: { select?: Prisma.WechatAuthSelect; include?: Prisma.WechatAuthInclude },
  ): Promise<WechatAuth> {
    const record = await this.getReadClient().wechatAuth.findUnique({
      where: { ...where, isDeleted: false },
      ...additional,
    });
    if (!record) {
      throw new NotFoundException('WechatAuth not found');
    }
    return record;
  }
}
