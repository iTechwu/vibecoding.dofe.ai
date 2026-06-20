import { Injectable } from '@nestjs/common';
import { AuditLogService as AuditLogDbService } from '@app/db';
import type { AuditActionType, AuditLog, Prisma } from '@prisma/client';

export interface CreateAuditLogDto {
  action: AuditActionType;
  resource: string;
  resourceId?: string | null;
  actorType: string;
  actorId?: string | null;
  teamId?: string | null;
  changes?: Prisma.InputJsonValue | null;
  metadata?: Prisma.InputJsonValue | null;
  status?: string;
  errorMsg?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuditLogQuery {
  action?: AuditActionType;
  resource?: string;
  resourceId?: string;
  actorType?: string;
  actorId?: string;
  teamId?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

@Injectable()
export class AuditLogService {
  constructor(private readonly auditLogDb: AuditLogDbService) {}

  async create(dto: CreateAuditLogDto): Promise<AuditLog> {
    return this.auditLogDb.create({
      action: dto.action,
      resource: dto.resource,
      resourceId: dto.resourceId,
      actorType: dto.actorType,
      actorId: dto.actorId,
      teamId: dto.teamId,
      changes: dto.changes ?? undefined,
      metadata: dto.metadata ?? undefined,
      status: dto.status ?? 'success',
      errorMsg: dto.errorMsg,
      ipAddress: dto.ipAddress,
      userAgent: dto.userAgent,
    });
  }

  async query(
    query: AuditLogQuery,
  ): Promise<{ list: AuditLog[]; total: number; page: number; limit: number }> {
    const where: Prisma.AuditLogWhereInput = {
      ...(query.action ? { action: query.action } : {}),
      ...(query.resource ? { resource: query.resource } : {}),
      ...(query.resourceId ? { resourceId: query.resourceId } : {}),
      ...(query.actorType ? { actorType: query.actorType } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.teamId ? { teamId: query.teamId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.startDate || query.endDate
        ? {
            createdAt: {
              ...(query.startDate ? { gte: query.startDate } : {}),
              ...(query.endDate ? { lte: query.endDate } : {}),
            },
          }
        : {}),
    };

    return this.auditLogDb.list(where, {
      page: query.page,
      limit: query.limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  async logCreate(
    resource: string,
    resourceId: string,
    actorId: string,
    metadata?: Prisma.InputJsonValue,
  ): Promise<AuditLog> {
    return this.create({
      action: 'CREATE',
      resource,
      resourceId,
      actorType: 'user',
      actorId,
      metadata,
    });
  }

  async logUpdate(
    resource: string,
    resourceId: string,
    actorId: string,
    changes?: Prisma.InputJsonValue,
    metadata?: Prisma.InputJsonValue,
  ): Promise<AuditLog> {
    return this.create({
      action: 'UPDATE',
      resource,
      resourceId,
      actorType: 'user',
      actorId,
      changes,
      metadata,
    });
  }

  async logDelete(
    resource: string,
    resourceId: string,
    actorId: string,
    metadata?: Prisma.InputJsonValue,
  ): Promise<AuditLog> {
    return this.create({
      action: 'DELETE',
      resource,
      resourceId,
      actorType: 'user',
      actorId,
      metadata,
    });
  }

  async logLogin(actorId: string, metadata?: Prisma.InputJsonValue): Promise<AuditLog> {
    return this.create({
      action: 'LOGIN',
      resource: 'auth',
      actorType: 'user',
      actorId,
      metadata,
    });
  }

  async logLogout(actorId: string, metadata?: Prisma.InputJsonValue): Promise<AuditLog> {
    return this.create({
      action: 'LOGOUT',
      resource: 'auth',
      actorType: 'user',
      actorId,
      metadata,
    });
  }

  async logExport(
    resource: string,
    actorId: string,
    metadata?: Prisma.InputJsonValue,
  ): Promise<AuditLog> {
    return this.create({
      action: 'EXPORT',
      resource,
      actorType: 'user',
      actorId,
      metadata,
    });
  }
}
