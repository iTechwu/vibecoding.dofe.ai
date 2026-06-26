import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { LoopsMcpClientService } from './loops-mcp-client.service';
import { LoopsMcpSecretService } from './loops-mcp-secret.service';
import { LoopsPrProviderClient } from './loops-pr-provider.client';

/**
 * Loops Integrations domain module — `@app/services/loops-integrations`.
 *
 * Step 7 partial: PR provider, MCP client, and MCP secret resolution. HTTP
 * integration goes through `@nestjs/axios` via `HttpModule`.
 */
@Module({
  imports: [HttpModule],
  providers: [LoopsPrProviderClient, LoopsMcpClientService, LoopsMcpSecretService],
  exports: [LoopsPrProviderClient, LoopsMcpClientService, LoopsMcpSecretService],
})
export class LoopsIntegrationsModule {}
