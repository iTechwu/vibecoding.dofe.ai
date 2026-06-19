import { Module } from '@nestjs/common';
import { DiscordAuthService } from './discord-auth.service';
import { PrismaModule } from '@dofe/infra-prisma';

@Module({
  imports: [PrismaModule],
  providers: [DiscordAuthService],
  exports: [DiscordAuthService],
})
export class DiscordAuthModule {}
