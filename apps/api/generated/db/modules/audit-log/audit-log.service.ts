import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@dofe/infra-prisma';
import { TransactionalServiceBase } from '@dofe/infra-shared-db';
import { HandlePrismaError, DbOperationType } from '@dofe/infra-common';
import { PAGINATION } from '@repo/constants';
import type { Prisma, AuditLog } from '@prisma/client';

@Injectable()
export class AuditLogService extends TransactionalServiceBase {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async get(
    where: Prisma.AuditLogWhereInput,
    additional?: { select?: Prisma.AuditLogSelect },
  ): Promise<AuditLog | null> {
    return this.getReadClient().auditLog.findFirst({
      where: where,
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async getById(
    id: string,
    additional?: { select?: Prisma.AuditLogSelect },
  ): Promise<AuditLog | null> {
    return this.getReadClient().auditLog.findUnique({
      where: { id: id },
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async list(
    where: Prisma.AuditLogWhereInput,
    pagination?: {
      orderBy?: Prisma.AuditLogOrderByWithRelationInput | Prisma.AuditLogOrderByWithRelationInput[];
      limit?: number;
      page?: number;
    },
    additional?: { select?: Prisma.AuditLogSelect },
  ): Promise<{ list: AuditLog[]; total: number; page: number; limit: number }> {
    const {
      orderBy = { createdAt: 'desc' },
      limit = PAGINATION.MAX_PAGE_SIZE,
      page = 1,
    } = pagination || {};
    const skip = (page - 1) * limit;

    const [list, total] = await Promise.all([
      this.getReadClient().auditLog.findMany({
        where: where,
        orderBy,
        take: limit,
        skip,
        ...additional,
      }),
      this.getReadClient().auditLog.count({
        where: where,
      }),
    ]);

    return { list, total, page, limit };
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async count(where?: Prisma.AuditLogWhereInput): Promise<number> {
    return this.getReadClient().auditLog.count({
      where: where ?? {},
    });
  }

  @HandlePrismaError(DbOperationType.CREATE)
  async create(
    data: Prisma.AuditLogCreateInput,
    additional?: { select?: Prisma.AuditLogSelect },
  ): Promise<AuditLog> {
    return this.getWriteClient().auditLog.create({ data, ...additional });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async update(
    where: Prisma.AuditLogWhereUniqueInput,
    data: Prisma.AuditLogUpdateInput,
    additional?: { select?: Prisma.AuditLogSelect },
  ): Promise<AuditLog> {
    return this.getWriteClient().auditLog.update({
      where,
      data,
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.DELETE)
  async delete(where: Prisma.AuditLogWhereUniqueInput): Promise<AuditLog> {
    return this.getWriteClient().auditLog.delete({ where });
  }

  @HandlePrismaError(DbOperationType.CREATE)
  async createMany(data: Prisma.AuditLogCreateManyInput[]): Promise<{ count: number }> {
    return this.getWriteClient().auditLog.createMany({ data });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async updateMany(
    where: Prisma.AuditLogWhereInput,
    data: Prisma.AuditLogUpdateInput,
  ): Promise<{ count: number }> {
    return this.getWriteClient().auditLog.updateMany({ where, data });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async upsert(args: Prisma.AuditLogUpsertArgs): Promise<AuditLog> {
    return this.getWriteClient().auditLog.upsert(args);
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async getOrThrow(
    where: Prisma.AuditLogWhereUniqueInput,
    additional?: { select?: Prisma.AuditLogSelect },
  ): Promise<AuditLog> {
    const record = await this.getReadClient().auditLog.findUnique({
      where: { ...where },
      ...additional,
    });
    if (!record) {
      throw new NotFoundException('AuditLog not found');
    }
    return record;
  }
}
