import { Module } from '@nestjs/common';
import { LoopsEvalAggregationWorkerService } from './loops-eval-aggregation-worker.service';
import { LoopsEvalService } from './loops-eval.service';

/**
 * Loops Eval domain module — `@app/services/loops-eval`.
 *
 * Step 6 partial: Redis-backed eval aggregation worker. Eval suite/run builders
 * still live in the legacy API LoopsService until the evidence builders move.
 */
@Module({
  providers: [LoopsEvalAggregationWorkerService, LoopsEvalService],
  exports: [LoopsEvalAggregationWorkerService, LoopsEvalService],
})
export class LoopsEvalModule {}
