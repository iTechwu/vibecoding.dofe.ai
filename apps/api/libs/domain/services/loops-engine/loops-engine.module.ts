import { Module } from '@nestjs/common';
import { LoopsStoreModule } from '@app/services/loops-store';
import { LoopsEngineService } from './loops-engine.service';

/**
 * Loops Engine domain module — `@app/services/loops-engine`.
 *
 * 结构优化 Step 3 + nextstep Step N1：loop 状态机纯推导原语 + spec/decompose 推进流。
 * `LoopsStoreModule` 提供 `LoopsFileStoreService`（spec/shard 写入 + cost guard）；
 * `LoopsAgentAdapter` 经 facade per-call 透传（impl 由 API module 经
 * `LOOPS_AGENT_ADAPTER` token 装配，保持 env-based CLI/Deterministic 选择在 API 层）。
 */
@Module({
  imports: [LoopsStoreModule],
  providers: [LoopsEngineService],
  exports: [LoopsEngineService],
})
export class LoopsEngineModule {}
