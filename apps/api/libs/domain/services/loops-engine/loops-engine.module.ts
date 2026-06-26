import { Module } from '@nestjs/common';
import { LoopsEngineService } from './loops-engine.service';

/**
 * Loops Engine domain module — `@app/services/loops-engine`.
 *
 * 结构优化 Step 3：loop 状态机纯推导原语。当前为纯函数集合，无外部依赖；
 * 后续状态机推进方法抽取时再 import store/locks/quality 等。
 */
@Module({
  providers: [LoopsEngineService],
  exports: [LoopsEngineService],
})
export class LoopsEngineModule {}
