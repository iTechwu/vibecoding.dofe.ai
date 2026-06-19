import { Module } from '@nestjs/common';
import { DeterministicLoopsAgentAdapter } from './adapters/deterministic-loops-agent.adapter';
import { LOOPS_AGENT_ADAPTER } from './adapters/loops-agent-adapter.interface';
import { LoopsController } from './loops.controller';
import { LoopsFileStoreService } from './loops-file-store.service';
import { LoopsRunnerService } from './loops-runner.service';
import { LoopsService } from './loops.service';

@Module({
  controllers: [LoopsController],
  providers: [
    LoopsService,
    LoopsFileStoreService,
    LoopsRunnerService,
    DeterministicLoopsAgentAdapter,
    {
      provide: LOOPS_AGENT_ADAPTER,
      useExisting: DeterministicLoopsAgentAdapter,
    },
  ],
})
export class LoopsModule {}
