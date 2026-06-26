import { Module } from '@nestjs/common';
import { LoopsStoreModule } from '@app/services/loops-store';
import { LoopsRuntimeModule } from '@app/services/loops-runtime';
import { LoopsIssuesService } from './loops-issues.service';

/**
 * Loops Issues domain module — `@app/services/loops-issues`.
 *
 * 结构优化 Step 2 + Loop 9：issue intake 记录构造原语 + rule snapshot/simple repo 解析。
 * `LoopsStoreModule` 提供 `LoopsFileStoreService` + `LOOPS_PERSISTENCE`；
 * `LoopsRuntimeModule` 提供 `LoopsWorkspaceProfileService`（captureRuleSnapshot 用）。
 */
@Module({
  imports: [LoopsStoreModule, LoopsRuntimeModule],
  providers: [LoopsIssuesService],
  exports: [LoopsIssuesService],
})
export class LoopsIssuesModule {}
