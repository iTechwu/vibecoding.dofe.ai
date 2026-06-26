import { Module } from '@nestjs/common';
import { LoopsStoreModule } from '../loops-store';
import { LoopsLocksModule } from '../loops-locks';
import { LoopsIssuesModule } from '../loops-issues';
import { LoopsEngineModule } from '../loops-engine';
import { LoopsRuntimeModule } from '../loops-runtime';
import { LoopsEvidenceModule } from '../loops-evidence';
import { LoopsQualityModule } from '../loops-quality/loops-quality.module';
import { LoopsRunnersModule } from '../loops-runners/loops-runners.module';
import { LoopsIntegrationsModule } from '../loops-integrations/loops-integrations.module';
import { LoopsEvalModule } from '../loops-eval/loops-eval.module';
import { LoopsAdminModule } from '../loops-admin/loops-admin.module';
import { LoopsTriggersModule } from '../loops-triggers/loops-triggers.module';
import { LoopsRemoteRunnersModule } from '../loops-remote-runners/loops-remote-runners.module';

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
 * Step 5a：接入 `LoopsQualityModule`（browser QA / learning / visual regression 原语）。
 * Step 4a：接入 `LoopsRunnersModule`（process runner + runtime command planner 纯原语）。
 * Step 7a：接入 `LoopsIntegrationsModule`（PR provider / MCP client / MCP secret）。
 * Step 6a：接入 `LoopsEvalModule`（Eval aggregation worker）。
 * Step 9a：接入 `LoopsAdminModule`（capability registry）。
 * Step 8a：接入 `LoopsTriggersModule`（schedule trigger CRUD）。
 * Step 8b：接入 `LoopsRemoteRunnersModule`（remote runner pool primitives）。
 */
@Module({
  imports: [
    LoopsStoreModule,
    LoopsLocksModule,
    LoopsIssuesModule,
    LoopsEngineModule,
    LoopsRuntimeModule,
    LoopsEvidenceModule,
    LoopsQualityModule,
    LoopsRunnersModule,
    LoopsIntegrationsModule,
    LoopsEvalModule,
    LoopsAdminModule,
    LoopsTriggersModule,
    LoopsRemoteRunnersModule,
  ],
  exports: [
    LoopsStoreModule,
    LoopsLocksModule,
    LoopsIssuesModule,
    LoopsEngineModule,
    LoopsRuntimeModule,
    LoopsEvidenceModule,
    LoopsQualityModule,
    LoopsRunnersModule,
    LoopsIntegrationsModule,
    LoopsEvalModule,
    LoopsAdminModule,
    LoopsTriggersModule,
    LoopsRemoteRunnersModule,
  ],
})
export class LoopsDomainModule {}
