import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@dofe/infra-jwt';
import { RedisModule } from '@dofe/infra-redis';
import { SsoClientModule as InfraSsoClientModule } from '@dofe/infra-clients/sso';
import { FileClient } from '@dofe/file-sdk';
import { UserInfoModule } from '@app/db';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { AuthValidationService } from './auth-validation.service';
import { UserSyncService } from './user-sync.service';

@Global()
@Module({
  imports: [ConfigModule, RedisModule, JwtModule, InfraSsoClientModule, UserInfoModule],
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
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
  exports: [
    AuthGuard,
    AuthService,
    AuthValidationService,
    UserSyncService,
    JwtModule,
    UserInfoModule,
    InfraSsoClientModule,
  ],
})
export class AuthModule {}
