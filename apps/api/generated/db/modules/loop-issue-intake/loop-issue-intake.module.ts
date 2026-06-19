import { Module } from '@nestjs/common';
import { PrismaModule } from '@dofe/infra-prisma';
import { LoopIssueIntakeService } from './loop-issue-intake.service';

@Module({
  imports: [PrismaModule],
  providers: [LoopIssueIntakeService],
  exports: [LoopIssueIntakeService],
})
export class LoopIssueIntakeModule {}
