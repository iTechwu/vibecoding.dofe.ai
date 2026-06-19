import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@dofe/infra-prisma';
import { TransactionalServiceBase } from '@dofe/infra-shared-db';
import { HandlePrismaError, DbOperationType } from '@dofe/infra-common';
import { PAGINATION } from '@repo/constants';
import type { Prisma, GoogleAuth } from '@prisma/client';

@Injectable()
export class GoogleAuthService extends TransactionalServiceBase {

  constructor(
    prisma: PrismaService,
  ) {
    super(prisma);
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async get(
    where: Prisma.GoogleAuthWhereInput,
    additional?: { select?: Prisma.GoogleAuthSelect; include?: Prisma.GoogleAuthInclude },
  ): Promise<GoogleAuth | null> {
    return this.getReadClient().googleAuth.findFirst({
      where: { ...where, isDeleted: false },
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async getById(
    id: string,
    additional?: { select?: Prisma.GoogleAuthSelect; include?: Prisma.GoogleAuthInclude },
  ): Promise<GoogleAuth | null> {
    return this.getReadClient().googleAuth.findUnique({
      where: { sub: id, isDeleted: false },
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async list(
    where: Prisma.GoogleAuthWhereInput,
    pagination?: {
      orderBy?: Prisma.GoogleAuthOrderByWithRelationInput|Prisma.GoogleAuthOrderByWithRelationInput[];
      limit?: number;
      page?: number;
    },
    additional?: { select?: Prisma.GoogleAuthSelect; include?: Prisma.GoogleAuthInclude },
  ): Promise<{ list: GoogleAuth[]; total: number; page: number; limit: number }> {
    const {
      orderBy = { createdAt: 'desc' },
      limit = PAGINATION.MAX_PAGE_SIZE,
      page = 1,
    } = pagination || {};
    const skip = (page - 1) * limit;

    const [list, total] = await Promise.all([
      this.getReadClient().googleAuth.findMany({
        where: { ...where, isDeleted: false },
        orderBy,
        take: limit,
        skip,
        ...additional,
      }),
      this.getReadClient().googleAuth.count({
        where: { ...where, isDeleted: false },
      }),
    ]);

    return { list, total, page, limit };
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async count(where?: Prisma.GoogleAuthWhereInput): Promise<number> {
    return this.getReadClient().googleAuth.count({
      where: where ? { ...where, isDeleted: false } : { isDeleted: false },
    });
  }

  @HandlePrismaError(DbOperationType.CREATE)
  async create(
    data: Prisma.GoogleAuthCreateInput,
    additional?: { select?: Prisma.GoogleAuthSelect; include?: Prisma.GoogleAuthInclude },
  ): Promise<GoogleAuth> {
    return this.getWriteClient().googleAuth.create({ data, ...additional });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async update(
    where: Prisma.GoogleAuthWhereUniqueInput,
    data: Prisma.GoogleAuthUpdateInput,
    additional?: { select?: Prisma.GoogleAuthSelect; include?: Prisma.GoogleAuthInclude },
  ): Promise<GoogleAuth> {
    return this.getWriteClient().googleAuth.update({
      where,
      data,
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.DELETE)
  async delete(where: Prisma.GoogleAuthWhereUniqueInput): Promise<GoogleAuth> {
    return this.getWriteClient().googleAuth.delete({ where });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async softDelete(where: Prisma.GoogleAuthWhereUniqueInput): Promise<GoogleAuth> {
    return this.getWriteClient().googleAuth.update({
      where,
      data: { isDeleted: true },
    });
  }

  @HandlePrismaError(DbOperationType.CREATE)
  async createMany(
    data: Prisma.GoogleAuthCreateInput[],
  ): Promise<{ count: number }> {
    return this.getWriteClient().googleAuth.createMany({ data });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async updateMany(
    where: Prisma.GoogleAuthWhereInput,
    data: Prisma.GoogleAuthUpdateInput,
  ): Promise<{ count: number }> {
    return this.getWriteClient().googleAuth.updateMany({ where, data });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async upsert(
    args: Prisma.GoogleAuthUpsertArgs,
  ): Promise<GoogleAuth> {
    return this.getWriteClient().googleAuth.upsert(args);
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async getOrThrow(
    where: Prisma.GoogleAuthWhereUniqueInput,
    additional?: { select?: Prisma.GoogleAuthSelect; include?: Prisma.GoogleAuthInclude },
  ): Promise<GoogleAuth> {
    const record = await this.getReadClient().googleAuth.findUnique({
      where: { ...where, isDeleted: false },
      ...additional,
    });
    if (!record) {
      throw new NotFoundException('GoogleAuth not found');
    }
    return record;
  }
}
