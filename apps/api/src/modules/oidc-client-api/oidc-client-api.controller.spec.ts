jest.mock('@app/auth', () => ({
  Public: () => () => undefined,
}));

jest.mock('./oidc-client-api.service', () => ({
  OidcClientApiService: class OidcClientApiService {},
}));

import { OidcClientApiController } from './oidc-client-api.controller';

describe('OidcClientApiController callback', () => {
  it('does not log a raw OAuth provider error description', async () => {
    const logger = {
      warn: jest.fn(),
      error: jest.fn(),
    };
    const controller = new OidcClientApiController(
      {
        callbackFrontendUrl: 'https://vibecoding.local.dofe.ai/auth/oidc/success',
      } as never,
      {} as never,
      {} as never,
      logger as never,
    );
    const reply = { redirect: jest.fn() } as never;

    await controller.callback(
      undefined,
      undefined,
      'invalid_scope',
      'provider detail must not be logged',
      reply,
    );

    expect(logger.warn).toHaveBeenCalledWith('OIDC callback received error', {
      error: 'invalid_scope',
      hasErrorDescription: true,
      state: undefined,
    });
    expect((reply as { redirect: jest.Mock }).redirect).toHaveBeenCalledWith(
      expect.stringContaining('error_description=provider+detail+must+not+be+logged'),
      302,
    );
  });
});
