import { Module } from '@nestjs/common';
import { LoopIssueService } from './loop-issue.service';
import { PrismaModule } from '@dofe/infra-prisma';

@Module({
  imports: [PrismaModule],
  providers: [LoopIssueService],
  exports: [LoopIssueService],
})
export class LoopIssueModule {}
