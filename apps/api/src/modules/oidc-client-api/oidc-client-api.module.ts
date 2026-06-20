import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { OidcClientApiController } from './oidc-client-api.controller';
import { OidcClientApiService } from './oidc-client-api.service';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from '@dofe/infra-redis';
import { UserInfoModule } from '@app/db';

@Module({
  imports: [JwtModule.register({}), ConfigModule, RedisModule, UserInfoModule],
  controllers: [OidcClientApiController],
  providers: [OidcClientApiService],
  exports: [OidcClientApiService],
})
export class OidcClientApiModule {}
