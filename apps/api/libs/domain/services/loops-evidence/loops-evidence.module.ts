import { Module } from '@nestjs/common';
import { LoopsEvidenceService } from './loops-evidence.service';

/**
 * Loops Evidence domain module — `@app/services/loops-evidence`.
 *
 * 结构优化 Step 5：交付证据 / delivery 派生原语。当前为纯函数集合；
 * 后续 evidence builder/gate/coverage 抽取时再 import store 等。
 */
@Module({
  providers: [LoopsEvidenceService],
  exports: [LoopsEvidenceService],
})
export class LoopsEvidenceModule {}
