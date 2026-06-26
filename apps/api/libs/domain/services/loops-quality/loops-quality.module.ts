import { Module } from '@nestjs/common';
import { LoopsBrowserQaWorkerService } from './loops-browser-qa-worker.service';
import { LoopsLearningGovernanceService } from './loops-learning-governance.service';
import { LoopsSecondOpinionWorkerService } from './loops-second-opinion-worker.service';

/**
 * Loops Quality domain module — `@app/services/loops-quality`.
 *
 * Step 5 partial: browser QA worker, Claude Code second-opinion worker,
 * learning governance, visual regression and second-opinion comparison
 * primitives.
 */
@Module({
  providers: [
    LoopsBrowserQaWorkerService,
    LoopsLearningGovernanceService,
    LoopsSecondOpinionWorkerService,
  ],
  exports: [
    LoopsBrowserQaWorkerService,
    LoopsLearningGovernanceService,
    LoopsSecondOpinionWorkerService,
  ],
})
export class LoopsQualityModule {}
