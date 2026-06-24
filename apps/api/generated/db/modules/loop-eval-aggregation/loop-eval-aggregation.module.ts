import { Module } from '@nestjs/common';
import { LoopEvalAggregationService } from './loop-eval-aggregation.service';
import { PrismaModule } from '@dofe/infra-prisma';

@Module({
  imports: [PrismaModule],
  providers: [LoopEvalAggregationService],
  exports: [LoopEvalAggregationService],
})
export class LoopEvalAggregationModule {}
