import { Module } from '@nestjs/common';
import { LoopsStoreModule } from '../loops-store';
import { LoopsLocksModule } from '../loops-locks';
import { LoopsIssuesModule } from '../loops-issues';
import { LoopsEngineModule } from '../loops-engine';
import { LoopsRuntimeModule } from '../loops-runtime';
import { LoopsEvidenceModule } from '../loops-evidence';

/**
 * Loops domain aggregation module.
 *
 * 结构优化 Step 0 scaffold：在 `@app/services/loops` 下建立 domain 落点。
 * 后续 Step 1+ 下沉的子域模块（loops-store、loops-locks、loops-issues、
 * loops-engine、…）将陆续 import 到这里。
 *
 * 依赖方向保持 `src/modules/loops -> domain/services/loops -> @dofe/infra-*`。
 * API 层只 import 本 module，不直接依赖子域实现细节。
 *
 * re-export 子域 module，使 API module 的 provider（如 `LoopsService`）
 * 可直接注入子域导出的 service（如 `LoopsWorkLockService`）。
 *
 * Step 1a：接入 `LoopsStoreModule`（path-policy / workspace-root 工具）。
 * Step 1b：接入 `LoopsLocksModule`（工作锁 service + backend token）。
 * Step 2：接入 `LoopsIssuesModule`（issue intake 记录构造原语）。
 * Step 3：接入 `LoopsEngineModule`（loop 状态机纯推导原语）。
 * Step 4：接入 `LoopsRuntimeModule`（docker client + workspace profile + runtime 常量）。
 * Step 5：接入 `LoopsEvidenceModule`（交付证据 / delivery 派生原语）。
 */
@Module({
  imports: [
    LoopsStoreModule,
    LoopsLocksModule,
    LoopsIssuesModule,
    LoopsEngineModule,
    LoopsRuntimeModule,
    LoopsEvidenceModule,
  ],
  exports: [
    LoopsStoreModule,
    LoopsLocksModule,
    LoopsIssuesModule,
    LoopsEngineModule,
    LoopsRuntimeModule,
    LoopsEvidenceModule,
  ],
})
export class LoopsDomainModule {}
