import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { JwtModule } from '@dofe/infra-jwt';
import { RedisModule } from '@dofe/infra-redis';
import { SsoClientModule as InfraSsoClientModule } from '@dofe/infra-clients/sso';
import { SsoClientModule } from '@dofe/sso-nestjs';
import { FileClient } from '@dofe/file-sdk';
import { UserInfoModule } from '@app/db';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { AuthValidationService } from './auth-validation.service';
import { PermissionGuard } from './guards/permission.guard';
import { PermissionService } from './permission.service';
import { UserSyncService } from './user-sync.service';

@Global()
@Module({
  imports: [
    ConfigModule,
    HttpModule.register({ timeout: 5000 }),
    RedisModule,
    JwtModule,
    InfraSsoClientModule,
    SsoClientModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        baseUrl:
          config.get<string>('SSO_INTERNAL_API_URL') ?? config.getOrThrow<string>('SSO_API_URL'),
        internalSecret: config.getOrThrow<string>('INTERNAL_API_SECRET'),
        serviceName: config.get<string>('SSO_SERVICE_NAME') ?? 'vibecoding.dofe.ai',
        timeoutMs: 5000,
      }),
    }),
    UserInfoModule,
  ],
  providers: [
    AuthGuard,
    AuthService,
    {
      provide: FileClient,
      useFactory: (config: ConfigService) =>
        new FileClient({
          baseUrl: config.getOrThrow<string>('SSO_API_URL'),
          internalSecret: config.getOrThrow<string>('INTERNAL_API_SECRET'),
        }),
      inject: [ConfigService],
    },
    AuthValidationService,
    UserSyncService,
    PermissionService,
    PermissionGuard,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionGuard,
    },
  ],
  exports: [
    AuthGuard,
    AuthService,
    AuthValidationService,
    UserSyncService,
    PermissionService,
    PermissionGuard,
    JwtModule,
    UserInfoModule,
    InfraSsoClientModule,
  ],
})
export class AuthModule {}
