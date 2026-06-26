/**
 * Loops Locks barrel — `@app/services/loops-locks`.
 *
 * 结构优化 Step 1b：导出工作锁 service、backend 接口与实现、注入 token。
 */
export { LoopsLocksModule } from './loops-locks.module';
export { LoopsWorkLockService } from './loops-work-lock.service';
export { LOOPS_LOCK_BACKEND, type LoopsLockBackend } from './loops-lock-backend.interface';
export { InMemoryLoopsLockBackend } from './in-memory-loops-lock.backend';
export {
  RedisLoopsLockBackend,
  type LoopsLockRedisClient,
  type RedisLoopsLockOptions,
} from './redis-loops-lock.backend';
