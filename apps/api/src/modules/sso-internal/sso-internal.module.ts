import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SsoInternalController } from './sso-internal.controller';

@Module({
  imports: [ConfigModule],
  controllers: [SsoInternalController],
})
export class SsoInternalModule {}
