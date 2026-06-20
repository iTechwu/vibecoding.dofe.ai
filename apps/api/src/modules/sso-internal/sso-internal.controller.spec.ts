import { ApiException } from '@dofe/infra-common/filter/exception/api.exception';
import type { ConfigService } from '@nestjs/config';
import type { Logger } from 'winston';
import { SsoInternalController } from './sso-internal.controller';

function createController(secret = 'internal-secret') {
  const config = {
    get: jest.fn((key: string) => (key === 'INTERNAL_API_SECRET' ? secret : undefined)),
  } as unknown as ConfigService;
  const logger = {
    warn: jest.fn(),
  } as unknown as Logger;

  return {
    controller: new SsoInternalController(config, logger),
    logger,
  };
}

describe('SsoInternalController', () => {
  it('rejects requests without internal bearer token', () => {
    const { controller } = createController();

    expect(() => controller.receiveOutboxAlerts(undefined, {})).toThrow(ApiException);
  });

  it('rejects requests with invalid internal bearer token', () => {
    const { controller } = createController();

    expect(() => controller.receiveOutboxAlerts('Bearer wrong-secret', {})).toThrow(ApiException);
  });

  it('accepts SSO outbox alerts and logs only summary metadata', () => {
    const { controller, logger } = createController();

    const result = controller.receiveOutboxAlerts('Bearer internal-secret', {
      source: 'sso.dofe.ai',
      clientId: 'vibecoding-dofe-ai',
      generatedAt: '2026-06-20T00:00:00.000Z',
      alerts: [{ status: 'FAILED', eventId: 'evt-1', signature: 'raw-secret-signature' }],
      snapshot: { failed: 1 },
      thresholds: { failed: 1 },
    });

    expect(result).toEqual({ code: 0, msg: 'ok', data: { accepted: true } });
    expect(logger.warn).toHaveBeenCalledWith('Received SSO outbox alert', {
      source: 'sso.dofe.ai',
      clientId: 'vibecoding-dofe-ai',
      generatedAt: '2026-06-20T00:00:00.000Z',
      alertCount: 1,
      hasSnapshot: true,
      hasThresholds: true,
    });
  });
});
