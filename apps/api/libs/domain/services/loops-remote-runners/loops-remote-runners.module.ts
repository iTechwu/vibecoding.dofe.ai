import { Module } from '@nestjs/common';
import { LoopsStoreModule } from '@app/services/loops-store';
import { LoopsRemoteRunnersService } from './loops-remote-runners.service';

@Module({
  imports: [LoopsStoreModule],
  providers: [LoopsRemoteRunnersService],
  exports: [LoopsRemoteRunnersService],
})
export class LoopsRemoteRunnersModule {}
