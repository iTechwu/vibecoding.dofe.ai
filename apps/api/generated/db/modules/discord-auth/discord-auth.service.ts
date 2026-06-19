import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@dofe/infra-prisma';
import { TransactionalServiceBase } from '@dofe/infra-shared-db';
import { HandlePrismaError, DbOperationType } from '@dofe/infra-common';
import { PAGINATION } from '@repo/constants';
import type { Prisma, DiscordAuth } from '@prisma/client';

@Injectable()
export class DiscordAuthService extends TransactionalServiceBase {

  constructor(
    prisma: PrismaService,
  ) {
    super(prisma);
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async get(
    where: Prisma.DiscordAuthWhereInput,
    additional?: { select?: Prisma.DiscordAuthSelect; include?: Prisma.DiscordAuthInclude },
  ): Promise<DiscordAuth | null> {
    return this.getReadClient().discordAuth.findFirst({
      where: { ...where, isDeleted: false },
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async getById(
    id: string,
    additional?: { select?: Prisma.DiscordAuthSelect; include?: Prisma.DiscordAuthInclude },
  ): Promise<DiscordAuth | null> {
    return this.getReadClient().discordAuth.findUnique({
      where: { discordId: id, isDeleted: false },
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async list(
    where: Prisma.DiscordAuthWhereInput,
    pagination?: {
      orderBy?: Prisma.DiscordAuthOrderByWithRelationInput|Prisma.DiscordAuthOrderByWithRelationInput[];
      limit?: number;
      page?: number;
    },
    additional?: { select?: Prisma.DiscordAuthSelect; include?: Prisma.DiscordAuthInclude },
  ): Promise<{ list: DiscordAuth[]; total: number; page: number; limit: number }> {
    const {
      orderBy = { createdAt: 'desc' },
      limit = PAGINATION.MAX_PAGE_SIZE,
      page = 1,
    } = pagination || {};
    const skip = (page - 1) * limit;

    const [list, total] = await Promise.all([
      this.getReadClient().discordAuth.findMany({
        where: { ...where, isDeleted: false },
        orderBy,
        take: limit,
        skip,
        ...additional,
      }),
      this.getReadClient().discordAuth.count({
        where: { ...where, isDeleted: false },
      }),
    ]);

    return { list, total, page, limit };
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async count(where?: Prisma.DiscordAuthWhereInput): Promise<number> {
    return this.getReadClient().discordAuth.count({
      where: where ? { ...where, isDeleted: false } : { isDeleted: false },
    });
  }

  @HandlePrismaError(DbOperationType.CREATE)
  async create(
    data: Prisma.DiscordAuthCreateInput,
    additional?: { select?: Prisma.DiscordAuthSelect; include?: Prisma.DiscordAuthInclude },
  ): Promise<DiscordAuth> {
    return this.getWriteClient().discordAuth.create({ data, ...additional });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async update(
    where: Prisma.DiscordAuthWhereUniqueInput,
    data: Prisma.DiscordAuthUpdateInput,
    additional?: { select?: Prisma.DiscordAuthSelect; include?: Prisma.DiscordAuthInclude },
  ): Promise<DiscordAuth> {
    return this.getWriteClient().discordAuth.update({
      where,
      data,
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.DELETE)
  async delete(where: Prisma.DiscordAuthWhereUniqueInput): Promise<DiscordAuth> {
    return this.getWriteClient().discordAuth.delete({ where });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async softDelete(where: Prisma.DiscordAuthWhereUniqueInput): Promise<DiscordAuth> {
    return this.getWriteClient().discordAuth.update({
      where,
      data: { isDeleted: true },
    });
  }

  @HandlePrismaError(DbOperationType.CREATE)
  async createMany(
    data: Prisma.DiscordAuthCreateInput[],
  ): Promise<{ count: number }> {
    return this.getWriteClient().discordAuth.createMany({ data });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async updateMany(
    where: Prisma.DiscordAuthWhereInput,
    data: Prisma.DiscordAuthUpdateInput,
  ): Promise<{ count: number }> {
    return this.getWriteClient().discordAuth.updateMany({ where, data });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async upsert(
    args: Prisma.DiscordAuthUpsertArgs,
  ): Promise<DiscordAuth> {
    return this.getWriteClient().discordAuth.upsert(args);
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async getOrThrow(
    where: Prisma.DiscordAuthWhereUniqueInput,
    additional?: { select?: Prisma.DiscordAuthSelect; include?: Prisma.DiscordAuthInclude },
  ): Promise<DiscordAuth> {
    const record = await this.getReadClient().discordAuth.findUnique({
      where: { ...where, isDeleted: false },
      ...additional,
    });
    if (!record) {
      throw new NotFoundException('DiscordAuth not found');
    }
    return record;
  }
}
