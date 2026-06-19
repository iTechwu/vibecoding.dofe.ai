import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@dofe/infra-prisma';
import { TransactionalServiceBase } from '@dofe/infra-shared-db';
import { HandlePrismaError, DbOperationType } from '@dofe/infra-common';
import { PAGINATION } from '@repo/constants';
import type { Prisma, FileSource } from '@prisma/client';

@Injectable()
export class FileSourceService extends TransactionalServiceBase {

  constructor(
    prisma: PrismaService,
  ) {
    super(prisma);
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async get(
    where: Prisma.FileSourceWhereInput,
    additional?: { select?: Prisma.FileSourceSelect; include?: Prisma.FileSourceInclude },
  ): Promise<FileSource | null> {
    return this.getReadClient().fileSource.findFirst({
      where: { ...where, isDeleted: false },
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async getById(
    id: string,
    additional?: { select?: Prisma.FileSourceSelect; include?: Prisma.FileSourceInclude },
  ): Promise<FileSource | null> {
    return this.getReadClient().fileSource.findUnique({
      where: { id: id, isDeleted: false },
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async getByKey(value: string, additional?: { select?: Prisma.FileSourceSelect; include?: Prisma.FileSourceInclude }): Promise<FileSource | null> {
    return this.getReadClient().fileSource.findUnique({
      where: { key: value, isDeleted: false },
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async list(
    where: Prisma.FileSourceWhereInput,
    pagination?: {
      orderBy?: Prisma.FileSourceOrderByWithRelationInput|Prisma.FileSourceOrderByWithRelationInput[];
      limit?: number;
      page?: number;
    },
    additional?: { select?: Prisma.FileSourceSelect; include?: Prisma.FileSourceInclude },
  ): Promise<{ list: FileSource[]; total: number; page: number; limit: number }> {
    const {
      orderBy = { createdAt: 'desc' },
      limit = PAGINATION.MAX_PAGE_SIZE,
      page = 1,
    } = pagination || {};
    const skip = (page - 1) * limit;

    const [list, total] = await Promise.all([
      this.getReadClient().fileSource.findMany({
        where: { ...where, isDeleted: false },
        orderBy,
        take: limit,
        skip,
        ...additional,
      }),
      this.getReadClient().fileSource.count({
        where: { ...where, isDeleted: false },
      }),
    ]);

    return { list, total, page, limit };
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async count(where?: Prisma.FileSourceWhereInput): Promise<number> {
    return this.getReadClient().fileSource.count({
      where: where ? { ...where, isDeleted: false } : { isDeleted: false },
    });
  }

  @HandlePrismaError(DbOperationType.CREATE)
  async create(
    data: Prisma.FileSourceCreateInput,
    additional?: { select?: Prisma.FileSourceSelect; include?: Prisma.FileSourceInclude },
  ): Promise<FileSource> {
    return this.getWriteClient().fileSource.create({ data, ...additional });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async update(
    where: Prisma.FileSourceWhereUniqueInput,
    data: Prisma.FileSourceUpdateInput,
    additional?: { select?: Prisma.FileSourceSelect; include?: Prisma.FileSourceInclude },
  ): Promise<FileSource> {
    return this.getWriteClient().fileSource.update({
      where,
      data,
      ...additional,
    });
  }

  @HandlePrismaError(DbOperationType.DELETE)
  async delete(where: Prisma.FileSourceWhereUniqueInput): Promise<FileSource> {
    return this.getWriteClient().fileSource.delete({ where });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async softDelete(where: Prisma.FileSourceWhereUniqueInput): Promise<FileSource> {
    return this.getWriteClient().fileSource.update({
      where,
      data: { isDeleted: true },
    });
  }

  @HandlePrismaError(DbOperationType.CREATE)
  async createMany(
    data: Prisma.FileSourceCreateInput[],
  ): Promise<{ count: number }> {
    return this.getWriteClient().fileSource.createMany({ data });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async updateMany(
    where: Prisma.FileSourceWhereInput,
    data: Prisma.FileSourceUpdateInput,
  ): Promise<{ count: number }> {
    return this.getWriteClient().fileSource.updateMany({ where, data });
  }

  @HandlePrismaError(DbOperationType.UPDATE)
  async upsert(
    args: Prisma.FileSourceUpsertArgs,
  ): Promise<FileSource> {
    return this.getWriteClient().fileSource.upsert(args);
  }

  @HandlePrismaError(DbOperationType.QUERY)
  async getOrThrow(
    where: Prisma.FileSourceWhereUniqueInput,
    additional?: { select?: Prisma.FileSourceSelect; include?: Prisma.FileSourceInclude },
  ): Promise<FileSource> {
    const record = await this.getReadClient().fileSource.findUnique({
      where: { ...where, isDeleted: false },
      ...additional,
    });
    if (!record) {
      throw new NotFoundException('FileSource not found');
    }
    return record;
  }
}
