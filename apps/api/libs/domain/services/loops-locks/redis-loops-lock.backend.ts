import { ConflictException, Injectable } from '@nestjs/common';
import type { LoopsLockBackend } from './loops-lock-backend.interface';

/**
 * Minimal Redis client surface required for locking. Intentionally narrow so
 * it can be unit-tested with a plain mock and bound to `@dofe/infra-redis`
 * (ioredis) in the module factory when multi-instance locking is enabled.
 *
 * `set(key, value, 'NX', 'PX', ms)` mirrors the ioredis signature and returns
 * `'OK'` only when the key was absent (i.e. the lock was acquired).
 */
export type LoopsLockRedisClient = {
  set(key: string, value: string, mode: 'NX', expiryMode: 'PX', ms: number): Promise<string | null>;
  get(key: string): Promise<string | null>;
  del(...keys: string[]): Promise<number>;
};

export type RedisLoopsLockOptions = {
  /** Auto-release TTL; bounds staleness if a holder crashes. Default 60s. */
  ttlMs?: number;
  /** Unique holder token so release only deletes keys we still own. */
  holderId?: string;
};

/**
 * Multi-instance lock backend backed by Redis `SET NX PX`.
 *
 * Release is ownership-checked: a key is deleted only if it still holds our
 * `holderId`, so an expired-then-re-acquired lock is never released by the
 * wrong owner. (The get→del window is non-atomic; for Loops' coarse-grained
 * issue/repo serialization this is acceptable. A Lua compare-and-del can swap
 * in later without changing the interface.)
 */
@Injectable()
export class RedisLoopsLockBackend implements LoopsLockBackend {
  private readonly ttlMs: number;
  private readonly holderId: string;

  constructor(
    private readonly client: LoopsLockRedisClient,
    options: RedisLoopsLockOptions = {},
  ) {
    this.ttlMs = options.ttlMs ?? 60_000;
    this.holderId = options.holderId ?? `loops-${process.pid}`;
  }

  async acquire(keys: string[]): Promise<void> {
    const acquired: string[] = [];
    for (const key of keys) {
      const ok = await this.client.set(key, this.holderId, 'NX', 'PX', this.ttlMs);
      if (ok !== 'OK') {
        if (acquired.length > 0) {
          await this.client.del(...acquired);
        }
        throw new ConflictException(`Loops work lock already held: ${key}`);
      }
      acquired.push(key);
    }
  }

  async release(keys: string[]): Promise<void> {
    for (const key of keys) {
      if ((await this.client.get(key)) === this.holderId) {
        await this.client.del(key);
      }
    }
  }
}
