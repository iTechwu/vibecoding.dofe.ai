import { Module } from '@nestjs/common';
import { LoopStateService } from './loop-state.service';
import { PrismaModule } from '@dofe/infra-prisma';

@Module({
  imports: [PrismaModule],
  providers: [LoopStateService],
  exports: [LoopStateService],
})
export class LoopStateModule {}
