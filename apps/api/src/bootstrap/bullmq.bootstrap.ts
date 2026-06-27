import Redis from 'ioredis';
import {
  createBullMqBootstrapOptions,
  type InfraBullMqRootOptions,
  type RedisVersionCheckClient as InfraRedisVersionCheckClient,
  type RedisVersionCheckClientFactory as InfraRedisVersionCheckClientFactory,
} from '@dofe/infra-redis';

export type BootstrapLogger = Pick<Console, 'warn' | 'error' | 'info'>;

export type RedisVersionCheckClient = InfraRedisVersionCheckClient;
export type RedisVersionCheckClientFactory = InfraRedisVersionCheckClientFactory;

export interface BullMqBootstrapOptions {
  redisUrl?: string;
  logger: BootstrapLogger;
  RedisClient?: RedisVersionCheckClientFactory;
  isProduction?: () => boolean;
}

export type BullMqRootOptions = InfraBullMqRootOptions;

export function createRedisVersionCheckClient(
  url: string,
  options: {
    maxRetriesPerRequest: number;
    connectTimeout: number;
    lazyConnect: boolean;
  },
): RedisVersionCheckClient {
  return new Redis(url, options);
}

export function isProductionEnvironment(): boolean {
  return ['prod', 'production', 'produs', 'prodap'].includes(process.env.NODE_ENV ?? '');
}

export async function createBullMqRootOptions({
  redisUrl,
  logger,
  RedisClient = createRedisVersionCheckClient,
  isProduction = isProductionEnvironment,
}: BullMqBootstrapOptions): Promise<BullMqRootOptions> {
  return createBullMqBootstrapOptions({
    redisUrl,
    logger,
    createRedisClient: RedisClient,
    isProduction: () => true,
    warnWhenRedisUrlMissing: 'REDIS_URL 未设置，BullMQ 队列功能将不可用',
    warnWhenPreflightSkipped: 'BullMQ Redis preflight skipped in non-production mode',
    warnWhenPreflightFails: (message) => `无法预先检查 Redis 版本，BullMQ 将尝试连接: ${message}`,
    errorWhenVersionTooOld: (version) => ({
      logMessage: `Redis 版本错误: 当前版本 ${version}，BullMQ 需要 >= 5.0.0。请升级 Redis 服务器。`,
      throwMessage: `Redis version ${version} is too old. BullMQ requires Redis >= 5.0.0. Please upgrade Redis server.`,
    }),
    infoWhenVersionOk: (version) => (isProduction() ? `Redis 版本检查通过: ${version}` : undefined),
  });
}
