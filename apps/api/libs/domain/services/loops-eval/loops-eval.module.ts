import { Module } from '@nestjs/common';
import { LoopEvalAggregationModule } from '@app/db/loop-eval-aggregation';
import { LoopsEvalAggregationRunnerService } from './loops-eval-aggregation-runner.service';
import { LoopsEvalAggregationWorkerService } from './loops-eval-aggregation-worker.service';
import { LoopsEvalService } from './loops-eval.service';

/**
 * Loops Eval domain module — `@app/services/loops-eval`.
 *
 * Step 6 + nextstep Step N2 + N2 收尾：pure eval suite/run/bench builders +
 * eval/bench trend worker IO 编排 + eval aggregation runner（DB/Redis 适配下沉，
 * processor/facade 经 runner 触发，不再依赖 facade 类）。evidence 收集经
 * `LOOPS_EVAL_EVIDENCE_PORT` 注入（facade 提供），待 enrichment 下沉后再迁入。
 * `LoopEvalAggregationModule` 提供 `LoopEvalAggregationService`（DB upsert）。
 */
@Module({
  imports: [LoopEvalAggregationModule],
  providers: [
    LoopsEvalAggregationWorkerService,
    LoopsEvalService,
    LoopsEvalAggregationRunnerService,
  ],
  exports: [LoopsEvalAggregationWorkerService, LoopsEvalService, LoopsEvalAggregationRunnerService],
})
export class LoopsEvalModule {}
