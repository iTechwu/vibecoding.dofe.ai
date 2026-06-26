import { Module } from '@nestjs/common';
import { LoopsEvidenceModule } from '@app/services/loops-evidence';
import { LoopsStoreModule } from '@app/services/loops-store';
import { LoopsRuntimeModule } from '@app/services/loops-runtime';
import { LoopsIssuesService } from './loops-issues.service';

/**
 * Loops Issues domain module — `@app/services/loops-issues`.
 *
 * 结构优化 Step 2 + Loop 9 + nextstep Step N3：issue intake 记录构造原语 +
 * rule snapshot/simple repo 解析 + 完整 `createIssue` 编排（workflow recipe 派生）。
 * `LoopsStoreModule` 提供 `LoopsFileStoreService` + `LOOPS_PERSISTENCE`；
 * `LoopsRuntimeModule` 提供 `LoopsWorkspaceProfileService`（captureRuleSnapshot 用）；
 * `LoopsEvidenceModule` 提供 `LoopsEvidenceService`（inferWorkflowKind / buildWorkflowRecipe）。
 */
@Module({
  imports: [LoopsStoreModule, LoopsRuntimeModule, LoopsEvidenceModule],
  providers: [LoopsIssuesService],
  exports: [LoopsIssuesService],
})
export class LoopsIssuesModule {}
