import { Body, Controller, Headers, Inject, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '@app/auth/auth';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { z } from 'zod';
import type { Logger } from 'winston';
import { CommonErrorCode } from '@repo/contracts/errors';
import { apiError } from '@dofe/infra-common';

const OutboxAlertPayloadSchema = z
  .object({
    source: z.string().trim().min(1).optional(),
    clientId: z.string().trim().min(1).optional(),
    generatedAt: z.string().trim().min(1).optional(),
    snapshot: z.unknown().optional(),
    thresholds: z.unknown().optional(),
    alerts: z.array(z.unknown()).optional(),
  })
  .passthrough();

type OutboxAlertPayload = z.infer<typeof OutboxAlertPayloadSchema>;

@Controller('/internal/sso')
@Public()
export class SsoInternalController {
  constructor(
    private readonly configService: ConfigService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  @Post('/outbox-alerts')
  receiveOutboxAlerts(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    this.assertInternalSecret(authorization);
    const payload = OutboxAlertPayloadSchema.parse(body);

    this.logger.warn('Received SSO outbox alert', {
      source: payload.source ?? 'sso.dofe.ai',
      clientId: payload.clientId,
      generatedAt: payload.generatedAt,
      alertCount: payload.alerts?.length ?? 0,
      hasSnapshot: payload.snapshot !== undefined,
      hasThresholds: payload.thresholds !== undefined,
    });

    return {
      code: 0,
      msg: 'ok',
      data: {
        accepted: true,
      },
    };
  }

  private assertInternalSecret(authorization: string | undefined): void {
    const expected = this.configService.get<string>('INTERNAL_API_SECRET');
    if (!expected) {
      throw apiError(CommonErrorCode.InternalServerError, {
        message: 'INTERNAL_API_SECRET is not configured',
      });
    }

    const token = this.extractBearerToken(authorization);
    if (!token) {
      throw apiError(CommonErrorCode.UnAuthorized, {
        message: 'Missing internal authorization token',
      });
    }

    if (token !== expected) {
      throw apiError(CommonErrorCode.FeatureHasPermissions, {
        message: 'Invalid internal authorization token',
      });
    }
  }

  private extractBearerToken(authorization: string | undefined): string | undefined {
    if (!authorization) return undefined;
    const [scheme, token] = authorization.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) return undefined;
    return token;
  }
}
