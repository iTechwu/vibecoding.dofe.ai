import { Module } from '@nestjs/common';
import { LoopSecondOpinionRecordService } from './loop-second-opinion-record.service';
import { PrismaModule } from '@dofe/infra-prisma';

@Module({
  imports: [PrismaModule],
  providers: [LoopSecondOpinionRecordService],
  exports: [LoopSecondOpinionRecordService],
})
export class LoopSecondOpinionRecordModule {}
