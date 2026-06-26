import { Module } from '@nestjs/common';
import { InMemoryLoopsLockBackend } from './in-memory-loops-lock.backend';
import { LOOPS_LOCK_BACKEND } from './loops-lock-backend.interface';
import { LoopsWorkLockService } from './loops-work-lock.service';

/**
 * Loops Locks domain module — `@app/services/loops-locks`.
 *
 * 结构优化 Step 1b：把 loops 的并发工作锁从 API module 下沉到 domain。
 *
 * Provider 迁移自原 `apps/api/src/modules/loops/loops.module.ts`：
 * - `InMemoryLoopsLockBackend` 作为默认 backend（单进程，行为不变）。
 * - `LOOPS_LOCK_BACKEND` token alias 到 in-memory 实现。
 * - 导出 `LoopsWorkLockService` 供 `LoopsService` 注入。
 *
 * `RedisLoopsLockBackend` 暂不在此注册（保持原状：多实例锁定启用时再用
 * factory 绑定到 @dofe/infra-redis）。依赖方向：不 import `src/modules/**`。
 *
 * 通过 `LoopsDomainModule` re-export，API module 仍可注入 `LoopsWorkLockService`。
 */
@Module({
  providers: [
    InMemoryLoopsLockBackend,
    { provide: LOOPS_LOCK_BACKEND, useExisting: InMemoryLoopsLockBackend },
    LoopsWorkLockService,
  ],
  exports: [LoopsWorkLockService],
})
export class LoopsLocksModule {}
