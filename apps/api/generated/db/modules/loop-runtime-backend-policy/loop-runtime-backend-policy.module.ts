import { Module } from '@nestjs/common';
import { LoopRuntimeBackendPolicyService } from './loop-runtime-backend-policy.service';
import { PrismaModule } from '@dofe/infra-prisma';

@Module({
  imports: [PrismaModule],
  providers: [LoopRuntimeBackendPolicyService],
  exports: [LoopRuntimeBackendPolicyService],
})
export class LoopRuntimeBackendPolicyModule {}
