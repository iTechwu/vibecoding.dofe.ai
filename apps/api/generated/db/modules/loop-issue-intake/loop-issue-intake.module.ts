import { Module } from '@nestjs/common';
import { LoopIssueIntakeService } from './loop-issue-intake.service';
import { PrismaModule } from '@dofe/infra-prisma';

@Module({
  imports: [PrismaModule],
  providers: [LoopIssueIntakeService],
  exports: [LoopIssueIntakeService],
})
export class LoopIssueIntakeModule {}
