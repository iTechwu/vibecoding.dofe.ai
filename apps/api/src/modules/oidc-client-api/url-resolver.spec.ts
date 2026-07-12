import {
  resolveOidcApiBaseUrl,
  resolveOidcFrontendBaseUrl,
  resolveOidcRedirectUri,
  resolveOidcScopes,
} from './url-resolver';

function createConfig(values: Record<string, unknown>) {
  return {
    get: jest.fn((key: string) => values[key]),
  } as never;
}

describe('OIDC URL resolver', () => {
  it('uses the complete default scope set when SSO_SCOPES is absent', () => {
    expect(resolveOidcScopes(createConfig({}))).toBe('openid profile email tenant offline_access');
  });

  it('uses an explicit scope set approved for the OAuth client', () => {
    expect(
      resolveOidcScopes(
        createConfig({
          SSO_SCOPES: 'openid profile email tenant',
        }),
      ),
    ).toBe('openid profile email tenant');
  });

  it.each(['profile email tenant', 'openid profile email', 'openid profile invalid/scope'])(
    'rejects an invalid SSO_SCOPES value: %s',
    (scope) => {
      expect(() => resolveOidcScopes(createConfig({ SSO_SCOPES: scope }))).toThrow(/SSO_SCOPES/);
    },
  );

  it('uses the registered SSO redirect URI when configured', () => {
    const config = createConfig({
      SSO_REDIRECT_URI: 'https://vibecoding.local.dofe.ai/auth/callback',
      'app.domain': 'dofe.ai',
      'app.subDomain': 'vibecoding.local',
      'app.apiSubDomain': 'api.vibecoding.local',
    });

    expect(resolveOidcRedirectUri(config)).toBe('https://vibecoding.local.dofe.ai/auth/callback');
  });

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

  it('uses local E2E environment URL overrides before configured domains', () => {
    const previousApi = process.env.VIBECODING_APP_BASE_URL;
    const previousFrontend = process.env.VIBECODING_APP_FRONTEND_URL;
    process.env.VIBECODING_APP_BASE_URL = 'http://127.0.0.1:13100/';
    process.env.VIBECODING_APP_FRONTEND_URL = 'http://127.0.0.1:3003/';

    try {
      const config = createConfig({
        'app.domain': 'dofe.ai',
        'app.subDomain': 'vibecoding.local',
        'app.apiSubDomain': 'api.vibecoding.local',
        'app.port': 13100,
        'app.frontendPort': 3003,
      });

      expect(resolveOidcApiBaseUrl(config)).toBe('http://127.0.0.1:13100');
      expect(resolveOidcFrontendBaseUrl(config)).toBe('http://127.0.0.1:3003');
    } finally {
      if (previousApi === undefined) delete process.env.VIBECODING_APP_BASE_URL;
      else process.env.VIBECODING_APP_BASE_URL = previousApi;
      if (previousFrontend === undefined) delete process.env.VIBECODING_APP_FRONTEND_URL;
      else process.env.VIBECODING_APP_FRONTEND_URL = previousFrontend;
    }
  });
});
