import { ConflictException } from '@nestjs/common';
import { RedisLoopsLockBackend, type LoopsLockRedisClient } from './redis-loops-lock.backend';

type MockRedis = {
  store: Map<string, string>;
  set: jest.Mock;
  get: jest.Mock;
  del: jest.Mock;
};

function mockRedis(): MockRedis {
  const store = new Map<string, string>();
  return {
    store,
    set: jest.fn(async (key: string, value: string, _mode: 'NX', _exp: 'PX', _ms: number) => {
      if (store.has(key)) return null;
      store.set(key, value);
      return 'OK';
    }),
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    del: jest.fn(async (...keys: string[]) => {
      let n = 0;
      for (const k of keys) if (store.delete(k)) n += 1;
      return n;
    }),
  };
}

describe('RedisLoopsLockBackend', () => {
  it('acquires all keys when none are held', async () => {
    const redis = mockRedis();
    const backend = new RedisLoopsLockBackend(redis as unknown as LoopsLockRedisClient, {
      holderId: 'h1',
    });

    await expect(backend.acquire(['issue:1', 'repo:a'])).resolves.toBeUndefined();
    expect(redis.store.get('issue:1')).toBe('h1');
    expect(redis.store.get('repo:a')).toBe('h1');
  });

  it('throws ConflictException and rolls back partial acquisition when a key is held', async () => {
    const redis = mockRedis();
    redis.store.set('repo:a', 'someone-else');
    const backend = new RedisLoopsLockBackend(redis as unknown as LoopsLockRedisClient, {
      holderId: 'h1',
    });

    await expect(backend.acquire(['issue:1', 'repo:a'])).rejects.toBeInstanceOf(ConflictException);
    // issue:1 was acquired then rolled back
    expect(redis.store.has('issue:1')).toBe(false);
  });

  it('releases only keys it still owns', async () => {
    const redis = mockRedis();
    const backend = new RedisLoopsLockBackend(redis as unknown as LoopsLockRedisClient, {
      holderId: 'h1',
    });
    await backend.acquire(['issue:1']);
    // Simulate TTL expiry + re-acquisition by another holder.
    redis.store.set('issue:1', 'h2');

    await backend.release(['issue:1']);
    expect(redis.store.get('issue:1')).toBe('h2'); // not deleted — not ours
  });

  it('releases keys it owns', async () => {
    const redis = mockRedis();
    const backend = new RedisLoopsLockBackend(redis as unknown as LoopsLockRedisClient, {
      holderId: 'h1',
    });
    await backend.acquire(['issue:1', 'repo:a']);
    await backend.release(['issue:1', 'repo:a']);
    expect(redis.store.has('issue:1')).toBe(false);
    expect(redis.store.has('repo:a')).toBe(false);
  });
});
