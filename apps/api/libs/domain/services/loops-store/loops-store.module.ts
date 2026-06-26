import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LoopsDbModule } from '@app/db';
import { LoopsIntegrationsModule } from '@app/services/loops-integrations';
import { LoopsFileStoreService } from './loops-file-store.service';
import { LoopsPersistenceService } from './loops-persistence.service';
import { LOOPS_PERSISTENCE } from './loops-persistence.token';

/**
 * Loops Store domain module — `@app/services/loops-store`.
 *
 * 结构优化 Step 1 落点：loops 的「文件真相源 + DB index persistence + 路径策略」底座。
 *
 * Provider：
 * - `LoopsFileStoreService`：`.loops` 文件真相源；通知发布经 `LoopsNotificationSender`。
 * - `LoopsPersistenceService`：DB index 双写；依赖 `LoopsDbService`（`@app/db`）。
 * - `LOOPS_PERSISTENCE` token alias 到 persistence 实现，供 `LoopsService` 经 token 注入。
 *
 * nextstep Step N6：`LoopsNotificationSender` 已 re-home 到 `loops-integrations`，本 module
 * 经 `imports: [LoopsIntegrationsModule]` 取得其单例（无环：integrations 不依赖 store）。
 * imports HttpModule（兼容既有 HttpService 依赖）+ LoopsDbModule（为 persistence）。
 * 经 `LoopsDomainModule` re-export，API 层 `LoopsService` 仍可注入 file-store 与 LOOPS_PERSISTENCE。
 *
 * 依赖方向：只依赖 `@app/db` / `@app/services/loops-integrations` / `@dofe/infra-*` / `@repo/contracts`，
 * 不得 import `src/modules/**`。
 */
@Module({
  imports: [HttpModule, LoopsDbModule, LoopsIntegrationsModule],
  providers: [
    LoopsFileStoreService,
    LoopsPersistenceService,
    { provide: LOOPS_PERSISTENCE, useExisting: LoopsPersistenceService },
  ],
  exports: [LoopsFileStoreService, LoopsPersistenceService, LOOPS_PERSISTENCE],
})
export class LoopsStoreModule {}
