import { Module } from '@nestjs/common';
import { LoopLearningRecordService } from './loop-learning-record.service';
import { PrismaModule } from '@dofe/infra-prisma';

@Module({
  imports: [PrismaModule],
  providers: [LoopLearningRecordService],
  exports: [LoopLearningRecordService],
})
export class LoopLearningRecordModule {}
