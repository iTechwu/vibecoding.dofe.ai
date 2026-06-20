import type { ModuleMetadata } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { ConfigFactory } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { getConfig } from '@dofe/infra-common';
import type { AppConfig } from '@dofe/infra-common';
import { AcceptLanguageResolver, HeaderResolver, I18nModule, QueryResolver } from 'nestjs-i18n';
import { WinstonModule } from 'nest-winston';
import { getWinstonConfig, type LogOutputMode } from '@dofe/infra-utils';
import * as winston from 'winston';
import { RedisModule } from '@dofe/infra-redis';
import {
  AppVersionModule,
  CacheDecoratorModule,
  EventDecoratorModule,
  FeatureFlagModule,
  VersionDecoratorModule,
} from '@dofe/infra-common';
import { JwtModule } from '@dofe/infra-jwt';
// Import via direct subpaths. Barrels eagerly load file-storage, whose Prisma
// enums are intentionally absent because files are owned by sso.dofe.ai.
import { VerifyModule } from '@dofe/infra-clients/verify';
import { SystemHealthModule } from '@dofe/infra-shared-services/system-health';
import { IpInfoServiceModule } from '@app/services/ip-info';
import { LoopsModule } from '../modules/loops/loops.module';
import { OidcClientApiModule } from '../modules/oidc-client-api/oidc-client-api.module';
import { AuthModule } from '@app/auth';
import { createBullMqRootOptions } from './bullmq.bootstrap';
import type { BootstrapLogger, RedisVersionCheckClientFactory } from './bullmq.bootstrap';
import { createI18nRootOptions } from './i18n.bootstrap';

type AppModuleImports = NonNullable<ModuleMetadata['imports']>;

const preBootstrapLogger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console({ format: winston.format.simple() })],
});
const loadAppConfig: ConfigFactory = () => getConfig() ?? {};

export function createAppModuleImports(
  options: {
    redisUrl?: string;
    logger?: BootstrapLogger;
    RedisClient?: RedisVersionCheckClientFactory;
  } = {},
): AppModuleImports {
  const redisUrl = options.redisUrl ?? process.env.REDIS_URL;
  const logger = options.logger ?? preBootstrapLogger;

  return [
    ConfigModule.forRoot({
      load: [loadAppConfig],
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
        return createI18nRootOptions({ appConfig });
      },
      resolvers: [
        { use: QueryResolver, options: ['lang'] },
        AcceptLanguageResolver,
        { use: HeaderResolver, options: ['x-lang'] },
      ],
      inject: [ConfigService],
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) =>
        createBullMqRootOptions({
          redisUrl: redisUrl ?? configService.get<string>('REDIS_URL'),
          logger,
          RedisClient: options.RedisClient,
        }),
      inject: [ConfigService],
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
    OidcClientApiModule,
    AuthModule,
    LoopsModule,
  ];
}

export function getAppModuleImportNames(imports = createAppModuleImports()): string[] {
  return imports.map((moduleImport) => {
    if (typeof moduleImport === 'function') return moduleImport.name;
    if (moduleImport instanceof Promise) return 'ConfigModule';
    if (moduleImport && typeof moduleImport === 'object' && 'module' in moduleImport) {
      const dynamicModule = moduleImport as { module?: { name?: string } };
      return dynamicModule.module?.name ?? 'UnknownDynamicModule';
    }
    return 'UnknownModule';
  });
}
