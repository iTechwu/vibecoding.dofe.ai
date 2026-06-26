import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LoopsDbModule } from '@app/db';
import { LoopsNotificationSender } from './loops-notification-sender.service';
import { LoopsFileStoreService } from './loops-file-store.service';
import { LoopsPersistenceService } from './loops-persistence.service';
import { LOOPS_PERSISTENCE } from './loops-persistence.token';

/**
 * Loops Store domain module — `@app/services/loops-store`.
 *
 * 结构优化 Step 1 落点：loops 的「文件真相源 + DB index persistence + 路径策略」底座。
 *
 * Provider 迁移自原 `apps/api/src/modules/loops/loops.module.ts`：
 * - `LoopsFileStoreService`：`.loops` 文件真相源；依赖 `LoopsNotificationSender`。
 * - `LoopsPersistenceService`：DB index 双写；依赖 `LoopsDbService`（`@app/db`）。
 * - `LOOPS_PERSISTENCE` token alias 到 persistence 实现，供 `LoopsService` 经 token 注入。
 * - `LoopsNotificationSender`：file-store 依赖项（外部 HTTP 走 `@nestjs/axios`，Rule 3）。
 *   注：notification-sender 的最终归属是 `loops-integrations`（Step 7），此处随 file-store
 *   暂置，避免 domain → src 的反向依赖；Step 7 再 re-home。
 *
 * imports HttpModule（为 notification-sender 提供 HttpService）+ LoopsDbModule（为 persistence）。
 * 经 `LoopsDomainModule` re-export，API 层 `LoopsService` 仍可注入 file-store 与 LOOPS_PERSISTENCE。
 *
 * 依赖方向：只依赖 `@app/db` / `@dofe/infra-*` / `@repo/contracts`，不得 import `src/modules/**`。
 */
@Module({
  imports: [HttpModule, LoopsDbModule],
  providers: [
    LoopsNotificationSender,
    LoopsFileStoreService,
    LoopsPersistenceService,
    { provide: LOOPS_PERSISTENCE, useExisting: LoopsPersistenceService },
  ],
  exports: [LoopsFileStoreService, LoopsPersistenceService, LOOPS_PERSISTENCE],
})
export class LoopsStoreModule {}
