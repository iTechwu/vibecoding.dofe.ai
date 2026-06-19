import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@dofe/infra-prisma';
import { TransactionalServiceBase } from '@dofe/infra-shared-db';
import { HandlePrismaError, DbOperationType } from '@dofe/infra-common';
import { PAGINATION } from '@repo/constants';
import type { Prisma, EmailAuth } from '@prisma/client';

@Injectable()
export class EmailAuthService extends TransactionalServiceBase {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async get(
    where: Prisma.EmailAuthWhereInput,
    additional?: { select?: Prisma.EmailAuthSelect; include?: Prisma.EmailAuthInclude },
  ): Promise<EmailAuth | null> {
    return this.getReadClient().emailAuth.findFirst({
      where: { ...where, isDeleted: false },
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async getById(
    id: string,
    additional?: { select?: Prisma.EmailAuthSelect; include?: Prisma.EmailAuthInclude },
  ): Promise<EmailAuth | null> {
    return this.getReadClient().emailAuth.findUnique({
      where: { email: id, isDeleted: false },
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async list(
    where: Prisma.EmailAuthWhereInput,
    pagination?: {
      orderBy?:
        | Prisma.EmailAuthOrderByWithRelationInput
        | Prisma.EmailAuthOrderByWithRelationInput[];
      limit?: number;
      page?: number;
    },
    additional?: { select?: Prisma.EmailAuthSelect; include?: Prisma.EmailAuthInclude },
  ): Promise<{ list: EmailAuth[]; total: number; page: number; limit: number }> {
    const {
      orderBy = { createdAt: 'desc' },
      limit = PAGINATION.MAX_PAGE_SIZE,
      page = 1,
    } = pagination || {};
    const skip = (page - 1) * limit;

    const [list, total] = await Promise.all([
      this.getReadClient().emailAuth.findMany({
        where: { ...where, isDeleted: false },
        orderBy,
        take: limit,
        skip,
        ...additional,
      }),
      this.getReadClient().emailAuth.count({
        where: { ...where, isDeleted: false },
      }),
    ]);

    return { list, total, page, limit };
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async count(where?: Prisma.EmailAuthWhereInput): Promise<number> {
    return this.getReadClient().emailAuth.count({
      where: where ? { ...where, isDeleted: false } : { isDeleted: false },
    });
  }

  @HandlePrismaError(DbOperationType.CREATE)
  async create(
    data: Prisma.EmailAuthCreateInput,
    additional?: { select?: Prisma.EmailAuthSelect; include?: Prisma.EmailAuthInclude },
  ): Promise<EmailAuth> {
    return this.getWriteClient().emailAuth.create({ data, ...additional });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async update(
    where: Prisma.EmailAuthWhereUniqueInput,
    data: Prisma.EmailAuthUpdateInput,
    additional?: { select?: Prisma.EmailAuthSelect; include?: Prisma.EmailAuthInclude },
  ): Promise<EmailAuth> {
    return this.getWriteClient().emailAuth.update({
      where,
      data,
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.DELETE)
  async delete(where: Prisma.EmailAuthWhereUniqueInput): Promise<EmailAuth> {
    return this.getWriteClient().emailAuth.delete({ where });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async softDelete(where: Prisma.EmailAuthWhereUniqueInput): Promise<EmailAuth> {
    return this.getWriteClient().emailAuth.update({
      where,
      data: { isDeleted: true },
    });
  }

  @HandlePrismaError(DbOperationType.CREATE)
  async createMany(data: Prisma.EmailAuthCreateManyInput[]): Promise<{ count: number }> {
    return this.getWriteClient().emailAuth.createMany({ data });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async updateMany(
    where: Prisma.EmailAuthWhereInput,
    data: Prisma.EmailAuthUpdateInput,
  ): Promise<{ count: number }> {
    return this.getWriteClient().emailAuth.updateMany({ where, data });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async upsert(args: Prisma.EmailAuthUpsertArgs): Promise<EmailAuth> {
    return this.getWriteClient().emailAuth.upsert(args);
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async getOrThrow(
    where: Prisma.EmailAuthWhereUniqueInput,
    additional?: { select?: Prisma.EmailAuthSelect; include?: Prisma.EmailAuthInclude },
  ): Promise<EmailAuth> {
    const record = await this.getReadClient().emailAuth.findUnique({
      where: { ...where, isDeleted: false },
      ...additional,
    });
    if (!record) {
      throw new NotFoundException('EmailAuth not found');
    }
    return record;
  }
}
