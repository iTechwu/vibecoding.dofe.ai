import { createBullMqRootOptions } from './bullmq.bootstrap';

function createLogger() {
  return {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  };
}

function createRedisClient(infoOrError: string | Error) {
  return () =>
    new (class RedisClient {
      connect = jest.fn(async () => {
        if (infoOrError instanceof Error) {
          throw infoOrError;
        }
      });

      info = jest.fn(async () => {
        if (infoOrError instanceof Error) {
          throw infoOrError;
        }
        return infoOrError;
      });

      quit = jest.fn(async () => undefined);
    })();
}

describe('BullMQ bootstrap options', () => {
  it('fails fast when REDIS_URL is missing', async () => {
    const logger = createLogger();

    await expect(createBullMqRootOptions({ logger })).rejects.toThrow(
      'REDIS_URL environment variable is not set',
    );
    expect(logger.warn).toHaveBeenCalledWith('REDIS_URL 未设置，BullMQ 队列功能将不可用');
  });

  it('returns connection options when Redis version is supported', async () => {
    const logger = createLogger();

    await expect(
      createBullMqRootOptions({
        redisUrl: 'redis://localhost:6379',
        logger,
        RedisClient: createRedisClient('redis_version:7.2.4\r\n'),
        isProduction: () => true,
      }),
    ).resolves.toEqual({
      connection: {
        url: 'redis://localhost:6379',
      },
    });
    expect(logger.info).toHaveBeenCalledWith('Redis 版本检查通过: 7.2.4');
  });

  it('rejects Redis versions that are too old for BullMQ', async () => {
    const logger = createLogger();

    await expect(
      createBullMqRootOptions({
        redisUrl: 'redis://localhost:6379',
        logger,
        RedisClient: createRedisClient('redis_version:4.0.14\r\n'),
      }),
    ).rejects.toThrow('Redis version 4.0.14 is too old');
    expect(logger.error).toHaveBeenCalledWith(
      'Redis 版本错误: 当前版本 4.0.14，BullMQ 需要 >= 5.0.0。请升级 Redis 服务器。',
    );
  });

  it('warns and lets BullMQ try connecting when preflight connection fails', async () => {
    const logger = createLogger();

    await expect(
      createBullMqRootOptions({
        redisUrl: 'redis://localhost:6379',
        logger,
        RedisClient: createRedisClient(new Error('connection refused')),
      }),
    ).resolves.toEqual({
      connection: {
        url: 'redis://localhost:6379',
      },
    });
    expect(logger.warn).toHaveBeenCalledWith(
      '无法预先检查 Redis 版本，BullMQ 将尝试连接: connection refused',
    );
  });
});
