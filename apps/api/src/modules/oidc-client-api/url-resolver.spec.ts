import { resolveOidcApiBaseUrl, resolveOidcFrontendBaseUrl } from './url-resolver';

function createConfig(values: Record<string, unknown>) {
  return {
    get: jest.fn((key: string) => values[key]),
  } as never;
}

describe('OIDC URL resolver', () => {
  it('uses configured local domains before loopback fallbacks', () => {
    const config = createConfig({
      'app.domain': 'dofe.ai',
      'app.subDomain': 'vibecoding.local',
      'app.apiSubDomain': 'api.vibecoding.local',
      'app.port': 13100,
      'app.frontendPort': 3003,
    });

    expect(resolveOidcApiBaseUrl(config)).toBe('https://api.vibecoding.local.dofe.ai');
    expect(resolveOidcFrontendBaseUrl(config)).toBe('https://vibecoding.local.dofe.ai');
  });

  it('falls back to loopback only when domains are not configured', () => {
    const config = createConfig({
      'app.port': 13100,
      'app.frontendPort': 3003,
    });

    expect(resolveOidcApiBaseUrl(config)).toBe('http://127.0.0.1:13100');
    expect(resolveOidcFrontendBaseUrl(config)).toBe('http://127.0.0.1:3003');
  });

  it('uses explicit URLs first', () => {
    const config = createConfig({
      'app.baseUrl': 'https://custom-api.example.test/',
      'app.frontendUrl': 'https://custom-web.example.test/',
      'app.domain': 'dofe.ai',
      'app.subDomain': 'vibecoding.local',
      'app.apiSubDomain': 'api.vibecoding.local',
    });

    expect(resolveOidcApiBaseUrl(config)).toBe('https://custom-api.example.test');
    expect(resolveOidcFrontendBaseUrl(config)).toBe('https://custom-web.example.test');
  });
});
