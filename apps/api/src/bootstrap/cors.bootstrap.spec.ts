import { DEFAULT_CORS_ALLOWED_HEADERS, isCorsOriginAllowed } from './cors.bootstrap';

describe('CORS bootstrap', () => {
  const corsDomains = ['dofe.ai'];

  it('allows local vibecoding domains in development', () => {
    expect(
      isCorsOriginAllowed({
        origin: 'https://vibecoding.local.dofe.ai',
        corsDomains: ['test.dofe.ai'],
        isDevEnv: true,
      }),
    ).toBe(true);
  });

  it('does not allow local dofe domains outside development unless configured', () => {
    expect(
      isCorsOriginAllowed({
        origin: 'https://vibecoding.local.dofe.ai',
        corsDomains: ['test.dofe.ai'],
        isDevEnv: false,
      }),
    ).toBe(false);
  });

  it('allows configured dofe domains', () => {
    expect(
      isCorsOriginAllowed({
        origin: 'https://vibecoding.dofe.ai',
        corsDomains,
        isDevEnv: false,
      }),
    ).toBe(true);
  });

  it('allows wildcard configured domains', () => {
    expect(
      isCorsOriginAllowed({
        origin: 'https://vibecoding.dofe.ai',
        corsDomains: ['*.dofe.ai'],
        isDevEnv: false,
      }),
    ).toBe(true);
  });

  it('keeps unrelated origins blocked', () => {
    expect(
      isCorsOriginAllowed({
        origin: 'https://example.com',
        corsDomains,
        isDevEnv: true,
      }),
    ).toBe(false);
  });

  it('allows headers used by browser preflight requests', () => {
    expect(DEFAULT_CORS_ALLOWED_HEADERS).toEqual(
      expect.arrayContaining([
        'Authorization',
        'x-api-version',
        'x-app-build',
        'x-device-id',
        'x-os',
        'x-platform',
      ]),
    );
  });
});
