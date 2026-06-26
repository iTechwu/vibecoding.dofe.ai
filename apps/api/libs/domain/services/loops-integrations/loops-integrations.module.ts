import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { LoopsCiChecksService } from './loops-ci-checks.service';
import { LoopsMcpClientService } from './loops-mcp-client.service';
import { LoopsMcpSecretService } from './loops-mcp-secret.service';
import { LoopsNotificationSender } from './loops-notification-sender.service';
import { LoopsPrProviderClient } from './loops-pr-provider.client';

/**
 * Loops Integrations domain module — `@app/services/loops-integrations`.
 *
 * Step 7 / nextstep Step N6: PR provider, MCP client, MCP secret resolution +
 * CI checks registry / publication evidence builder (`LoopsCiChecksService`) +
 * notification sender (`LoopsNotificationSender`, re-homed from `loops-store`).
 * HTTP integration goes through `@nestjs/axios` via `HttpModule`.
 */
@Module({
  imports: [HttpModule],
  providers: [
    LoopsPrProviderClient,
    LoopsMcpClientService,
    LoopsMcpSecretService,
    LoopsCiChecksService,
    LoopsNotificationSender,
  ],
  exports: [
    LoopsPrProviderClient,
    LoopsMcpClientService,
    LoopsMcpSecretService,
    LoopsCiChecksService,
    LoopsNotificationSender,
  ],
})
export class LoopsIntegrationsModule {}
