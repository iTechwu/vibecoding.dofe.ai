import { Module } from '@nestjs/common';
import { LoopsStoreModule } from '@app/services/loops-store';
import { LoopsTriggersService } from './loops-triggers.service';

/**
 * Loops Triggers domain module — `@app/services/loops-triggers`.
 *
 * Step 8 / nextstep Step N2: schedule trigger CRUD + next-run calculation +
 * `fireScheduleTrigger` orchestration (trigger read → issue creation port →
 * execution record → stats update). Issue intake itself is delegated to the
 * `LOOPS_ISSUE_CREATION_PORT`, bound in the API module to the legacy facade
 * until the intake pipeline moves to `loops-issues`.
 */
@Module({
  imports: [LoopsStoreModule],
  providers: [LoopsTriggersService],
  exports: [LoopsTriggersService],
})
export class LoopsTriggersModule {}
