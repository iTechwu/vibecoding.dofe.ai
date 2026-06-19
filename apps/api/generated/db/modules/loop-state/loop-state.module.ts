import { Module } from '@nestjs/common';
import { PrismaModule } from '@dofe/infra-prisma';
import { LoopStateService } from './loop-state.service';

@Module({
  imports: [PrismaModule],
  providers: [LoopStateService],
  exports: [LoopStateService],
})
export class LoopStateModule {}
