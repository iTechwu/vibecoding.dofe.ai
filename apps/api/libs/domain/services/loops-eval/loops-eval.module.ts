import { Module } from '@nestjs/common';
import { LoopsEvalAggregationWorkerService } from './loops-eval-aggregation-worker.service';
import { LoopsEvalService } from './loops-eval.service';

/**
 * Loops Eval domain module — `@app/services/loops-eval`.
 *
 * Step 6 + nextstep Step N2: pure eval suite/run/bench builders + eval/bench
 * trend worker IO orchestration (`runEvalTrendWorker` / `runLoopBenchTrendWorker`)
 * + eval aggregation worker orchestration (`runEvalAggregationWorker`). The IO
 * (evidence collection, trend history read/append, DB persistence, Redis cache
 * warm) is supplied via narrow ports (`LoopsEvalEvidencePort` /
 * `LoopsEvalTrendStorePort`) bound in the API module to the legacy facade until
 * evidence collection itself moves out of the facade.
 */
@Module({
  providers: [LoopsEvalAggregationWorkerService, LoopsEvalService],
  exports: [LoopsEvalAggregationWorkerService, LoopsEvalService],
})
export class LoopsEvalModule {}
