import Redis from 'ioredis';

export type BootstrapLogger = Pick<Console, 'warn' | 'error' | 'info'>;

export type RedisVersionCheckClient = {
  connect(): Promise<void>;
  info(section: string): Promise<string>;
  quit(): Promise<unknown>;
};

export type RedisVersionCheckClientFactory = (
  url: string,
  options: {
    maxRetriesPerRequest: number;
    connectTimeout: number;
    lazyConnect: boolean;
  },
) => RedisVersionCheckClient;

export interface BullMqBootstrapOptions {
  redisUrl?: string;
  logger: BootstrapLogger;
  RedisClient?: RedisVersionCheckClientFactory;
  isProduction?: () => boolean;
}

export interface BullMqRootOptions {
  connection: {
    url: string;
  };
}

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
  if (!redisUrl) {
    logger.warn('REDIS_URL 未设置，BullMQ 队列功能将不可用');
    throw new Error('REDIS_URL environment variable is not set');
  }

  try {
    const checkClient = RedisClient(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
      lazyConnect: true,
    });

    await checkClient.connect();
    const info = await checkClient.info('server');
    await checkClient.quit();

    const versionMatch = info.match(/redis_version:([\d.]+)/);
    if (versionMatch) {
      const version = versionMatch[1];
      const [major] = version.split('.').map(Number);
      if (major < 5) {
        const errorMsg =
          `Redis 版本错误: 当前版本 ${version}，BullMQ 需要 >= 5.0.0。` + `请升级 Redis 服务器。`;
        logger.error(errorMsg);
        throw new Error(
          `Redis version ${version} is too old. BullMQ requires Redis >= 5.0.0. Please upgrade Redis server.`,
        );
      }

      if (isProduction()) {
        logger.info(`Redis 版本检查通过: ${version}`);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('version')) {
      throw error;
    }
    logger.warn(`无法预先检查 Redis 版本，BullMQ 将尝试连接: ${message}`);
  }

  return {
    connection: {
      url: redisUrl,
    },
  };
}
