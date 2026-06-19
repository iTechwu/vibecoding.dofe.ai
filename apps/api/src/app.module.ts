import {
  Module,
  NestModule,
  MiddlewareConsumer,
  RequestMethod,
  OnModuleInit,
} from '@nestjs/common';

/** config */
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  getConfig,
  HttpExceptionFilter,
  CacheDecoratorModule,
  EventDecoratorModule,
  VersionDecoratorModule,
  FeatureFlagModule,
  AppVersionModule,
  setTransactionMetricsService,
  type AppConfig,
  type ZoneConfig,
} from '@dofe/infra-common';
import RequestMiddleware from '@dofe/infra-common/middleware/request.middleware';
import { environmentUtil, getWinstonConfig, type LogOutputMode } from '@dofe/infra-utils';

/** app filter */
import { APP_FILTER, ModuleRef } from '@nestjs/core';
/** winston */
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

/** uploader module */
import { UploaderModule } from './modules/uploader/uploader.module';
import { LoopsModule } from './modules/loops/loops.module';

/** i18n */
import { AcceptLanguageResolver, QueryResolver, HeaderResolver, I18nModule } from 'nestjs-i18n';
import * as path from 'path';

/** request middleware */
import { IpInfoServiceModule } from '@app/services/ip-info';
import { ScheduleModule } from '@nestjs/schedule';
import { RedisModule } from '@dofe/infra-redis';
import { JwtModule } from '@dofe/infra-jwt';
import { BullModule } from '@nestjs/bullmq';
import Redis from 'ioredis';
import { VerifyModule } from '@dofe/infra-clients';
import { SystemHealthModule } from '@dofe/infra-shared-services';
import { DbMetricsService } from '@dofe/infra-prisma';

const preBootstrapLogger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console({ format: winston.format.simple() })],
});

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [getConfig as any],
    }),
    WinstonModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const output = configService.get<LogOutputMode>('app.nestLogOutput') || 'file';
        return getWinstonConfig(output);
      },
      inject: [ConfigService],
    }),
    I18nModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const appConfig = configService.getOrThrow<AppConfig>('app');
        const zoneConfigs = appConfig.zones;

        let zone: ZoneConfig | undefined;
        zoneConfigs.forEach((config: ZoneConfig) => {
          const defaultZone = process.env?.BASE_ZONE || 'cn';
          if (config.zone === defaultZone) {
            zone = config;
          }
        });
        if (!zone) {
          throw new Error('Zone not found');
        }
        let projectRoot = process.env.PROJECT_ROOT;
        if (projectRoot && projectRoot.includes('$(pwd)')) {
          projectRoot = projectRoot.replace('$(pwd)', process.cwd());
        }
        if (!projectRoot) {
          projectRoot = process.cwd();
        }
        return {
          fallbackLanguage: zone.locale,
          loaderOptions: {
            path: path.join(projectRoot, 'node_modules', '@dofe', 'infra-i18n', 'dist'),
            watch: true,
          },
        };
      },
      resolvers: [
        { use: QueryResolver, options: ['lang'] },
        AcceptLanguageResolver,
        { use: HeaderResolver, options: ['x-lang'] },
      ],
      inject: [ConfigService],
    }),
    BullModule.forRootAsync({
      useFactory: async () => {
        const redisUrl = process.env.REDIS_URL;
        if (!redisUrl) {
          preBootstrapLogger.warn('REDIS_URL 未设置，BullMQ 队列功能将不可用');
          throw new Error('REDIS_URL environment variable is not set');
        }

        try {
          const checkClient = new Redis(redisUrl, {
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
                `Redis 版本错误: 当前版本 ${version}，BullMQ 需要 >= 5.0.0。` +
                `请升级 Redis 服务器。`;
              preBootstrapLogger.error(errorMsg);
              throw new Error(
                `Redis version ${version} is too old. BullMQ requires Redis >= 5.0.0. Please upgrade Redis server.`,
              );
            } else {
              if (environmentUtil.isProduction()) {
                preBootstrapLogger.info(`Redis 版本检查通过: ${version}`);
              }
            }
          }
        } catch (error) {
          if (error.message && error.message.includes('version')) {
            throw error;
          }
          preBootstrapLogger.warn(`无法预先检查 Redis 版本，BullMQ 将尝试连接: ${error.message}`);
        }

        return {
          connection: {
            url: redisUrl,
          },
        };
      },
    }),
    IpInfoServiceModule,
    ScheduleModule.forRoot(),
    RedisModule,
    CacheDecoratorModule,
    EventDecoratorModule,
    VersionDecoratorModule,
    FeatureFlagModule,
    AppVersionModule,
    VerifyModule,
    SystemHealthModule,
    JwtModule,
    UploaderModule,
    LoopsModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule, OnModuleInit {
  constructor(private readonly moduleRef: ModuleRef) {}

  onModuleInit() {
    setTransactionMetricsService(() => {
      try {
        return this.moduleRef.get(DbMetricsService, { strict: false });
      } catch {
        return undefined;
      }
    });
  }

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestMiddleware).forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}
