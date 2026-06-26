import { Module } from '@nestjs/common';
import { LoopsRunnerService } from './loops-runner.service';

/**
 * Loops Runners domain module — `@app/services/loops-runners`.
 *
 * Step 4 partial: pure runner primitives used by CLI adapters, runtime
 * detection, and second-opinion worker. Adapter services themselves still live
 * in the API layer until their provider tokens are moved together.
 */
@Module({
  providers: [LoopsRunnerService],
  exports: [LoopsRunnerService],
})
export class LoopsRunnersModule {}
