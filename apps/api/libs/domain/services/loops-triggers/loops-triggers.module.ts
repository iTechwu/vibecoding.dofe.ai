import { Module } from '@nestjs/common';
import { LoopsStoreModule } from '@app/services/loops-store';
import { LoopsTriggersService } from './loops-triggers.service';

/**
 * Loops Triggers domain module — `@app/services/loops-triggers`.
 *
 * Step 8 partial: schedule trigger CRUD and next-run calculation. Firing a
 * trigger still coordinates through the legacy facade because it creates issues.
 */
@Module({
  imports: [LoopsStoreModule],
  providers: [LoopsTriggersService],
  exports: [LoopsTriggersService],
})
export class LoopsTriggersModule {}
