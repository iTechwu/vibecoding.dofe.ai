import { Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { AuditLogModule as AuditLogDbModule } from '@app/db';

@Module({
  imports: [AuditLogDbModule],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
