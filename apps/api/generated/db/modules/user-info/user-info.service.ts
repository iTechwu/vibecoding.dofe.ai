import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@dofe/infra-prisma';
import { TransactionalServiceBase } from '@dofe/infra-shared-db';
import { HandlePrismaError, DbOperationType } from '@dofe/infra-common';
import { PAGINATION } from '@repo/constants';
import type { Prisma, UserInfo } from '@prisma/client';

@Injectable()
export class UserInfoService extends TransactionalServiceBase {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async get(
    where: Prisma.UserInfoWhereInput,
    additional?: { select?: Prisma.UserInfoSelect },
  ): Promise<UserInfo | null> {
    return this.getReadClient().userInfo.findFirst({
      where: { ...where, isDeleted: false },
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async getById(
    id: string,
    additional?: { select?: Prisma.UserInfoSelect },
  ): Promise<UserInfo | null> {
    return this.getReadClient().userInfo.findFirst({
      where: { id: id, isDeleted: false },
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async getBySsoSub(
    value: string,
    additional?: { select?: Prisma.UserInfoSelect },
  ): Promise<UserInfo | null> {
    return this.getReadClient().userInfo.findFirst({
      where: { ssoSub: value, isDeleted: false },
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async getByCode(
    value: string,
    additional?: { select?: Prisma.UserInfoSelect },
  ): Promise<UserInfo | null> {
    return this.getReadClient().userInfo.findFirst({
      where: { code: value, isDeleted: false },
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async list(
    where: Prisma.UserInfoWhereInput,
    pagination?: {
      orderBy?: Prisma.UserInfoOrderByWithRelationInput | Prisma.UserInfoOrderByWithRelationInput[];
      limit?: number;
      page?: number;
    },
    additional?: { select?: Prisma.UserInfoSelect },
  ): Promise<{ list: UserInfo[]; total: number; page: number; limit: number }> {
    const {
      orderBy = { createdAt: 'desc' },
      limit = PAGINATION.MAX_PAGE_SIZE,
      page = 1,
    } = pagination || {};
    const skip = (page - 1) * limit;

    const [list, total] = await Promise.all([
      this.getReadClient().userInfo.findMany({
        where: { ...where, isDeleted: false },
        orderBy,
        take: limit,
        skip,
        ...additional,
      }),
      this.getReadClient().userInfo.count({
        where: { ...where, isDeleted: false },
      }),
    ]);

    return { list, total, page, limit };
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async count(where?: Prisma.UserInfoWhereInput): Promise<number> {
    return this.getReadClient().userInfo.count({
      where: where ? { ...where, isDeleted: false } : { isDeleted: false },
    });
  }

  @HandlePrismaError(DbOperationType.CREATE)
  async create(
    data: Prisma.UserInfoCreateInput,
    additional?: { select?: Prisma.UserInfoSelect },
  ): Promise<UserInfo> {
    return this.getWriteClient().userInfo.create({ data, ...additional });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async update(
    where: Prisma.UserInfoWhereUniqueInput,
    data: Prisma.UserInfoUpdateInput,
    additional?: { select?: Prisma.UserInfoSelect },
  ): Promise<UserInfo> {
    return this.getWriteClient().userInfo.update({
      where,
      data,
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.DELETE)
  async delete(where: Prisma.UserInfoWhereUniqueInput): Promise<UserInfo> {
    return this.getWriteClient().userInfo.delete({ where });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async softDelete(where: Prisma.UserInfoWhereUniqueInput): Promise<UserInfo> {
    return this.getWriteClient().userInfo.update({
      where,
      data: { isDeleted: true },
    });
  }

  @HandlePrismaError(DbOperationType.CREATE)
  async createMany(data: Prisma.UserInfoCreateManyInput[]): Promise<{ count: number }> {
    return this.getWriteClient().userInfo.createMany({ data });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async updateMany(
    where: Prisma.UserInfoWhereInput,
    data: Prisma.UserInfoUpdateInput,
  ): Promise<{ count: number }> {
    return this.getWriteClient().userInfo.updateMany({ where, data });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async upsert(args: Prisma.UserInfoUpsertArgs): Promise<UserInfo> {
    return this.getWriteClient().userInfo.upsert(args);
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async getOrThrow(
    where: Prisma.UserInfoWhereUniqueInput,
    additional?: { select?: Prisma.UserInfoSelect },
  ): Promise<UserInfo> {
    const record = await this.getReadClient().userInfo.findFirst({
      where: { ...where, isDeleted: false },
      ...additional,
    });
    if (!record) {
      throw new NotFoundException('UserInfo not found');
    }
    return record;
  }
}
