import { Inject, Injectable, Optional } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';

@Injectable()
export class LoopsRemoteRunnersLogAdapter {
  constructor(
    @Optional()
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger?: Logger,
  ) {}

  log(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>): void {
    this.logger?.[level](message, meta);
  }
}
