import { Module } from '@nestjs/common';
import { PrismaModule } from '@dofe/infra-prisma';
import { LoopIssueService } from './loop-issue.service';

@Module({
  imports: [PrismaModule],
  providers: [LoopIssueService],
  exports: [LoopIssueService],
})
export class LoopIssueModule {}
