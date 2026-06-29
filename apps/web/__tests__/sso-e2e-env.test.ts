import { describe, expect, it, vi } from 'vitest';
import {
  buildSsoE2eEnvFromProcess,
  expectedLoopsNewUrl,
  expectedOidcCallback,
  isUsableLoopsRouteStatus,
  probeLoopsRoute,
  validateSsoE2eEnv,
} from '../e2e/sso-e2e-env';

describe('validateSsoE2eEnv', () => {
  it('accepts aligned local web/api/sso origins', () => {
    expect(
      validateSsoE2eEnv({
        enabled: true,
        webBaseUrl: 'http://127.0.0.1:3003',
        apiOrigin: 'http://127.0.0.1:13100',
        ssoOrigin: 'http://127.0.0.1:3100',
        ssoLoginOrigin: 'http://127.0.0.1:3000',
        serverBaseUrl: 'http://127.0.0.1:13100',
        appBaseUrl: 'http://127.0.0.1:13100',
        appFrontendUrl: 'http://127.0.0.1:3003',
        ssoBaseUrl: 'http://127.0.0.1:3100',
        ssoIssuer: 'http://127.0.0.1:3100',
        ssoApiUrl: 'http://127.0.0.1:3100',
        ssoInternalApiUrl: 'http://127.0.0.1:3100',
      }),
    ).toEqual([]);
  });

  it('reports API, frontend, and SSO tier mismatches before browser login', () => {
    expect(
      validateSsoE2eEnv({
        enabled: true,
        webBaseUrl: 'http://127.0.0.1:3003',
        apiOrigin: 'http://127.0.0.1:13100',
        ssoOrigin: 'http://127.0.0.1:3100',
        ssoLoginOrigin: 'http://127.0.0.1:3000',
        serverBaseUrl: 'http://127.0.0.1:13101',
        appBaseUrl: 'https://api.vibecoding.local.dofe.ai',
        appFrontendUrl: 'http://127.0.0.1:3004',
        ssoBaseUrl: 'https://api.sso.local.dofe.ai',
        ssoIssuer: 'https://api.sso.test.dofe.ai',
        ssoApiUrl: 'http://127.0.0.1:3100',
        ssoInternalApiUrl: 'https://internal.sso.test.dofe.ai',
      }),
    ).toEqual([
      'NEXT_PUBLIC_SERVER_BASE_URL (http://127.0.0.1:13101) must match E2E_API_ORIGIN (http://127.0.0.1:13100).',
      'VIBECODING_APP_BASE_URL (https://api.vibecoding.local.dofe.ai) must match E2E_API_ORIGIN (http://127.0.0.1:13100).',
      'VIBECODING_APP_FRONTEND_URL (http://127.0.0.1:3004) must match E2E_WEB_BASE_URL (http://127.0.0.1:3003).',
      'NEXT_PUBLIC_SSO_BASE_URL (https://api.sso.local.dofe.ai) must match E2E_SSO_ORIGIN (http://127.0.0.1:3100).',
      'SSO_ISSUER (https://api.sso.test.dofe.ai) must match E2E_SSO_ORIGIN (http://127.0.0.1:3100).',
      'SSO_INTERNAL_API_URL (https://internal.sso.test.dofe.ai) must match E2E_SSO_ORIGIN (http://127.0.0.1:3100).',
    ]);
  });

  it('reports invalid URL values as preflight issues instead of throwing', () => {
    expect(
      validateSsoE2eEnv({
        enabled: true,
        webBaseUrl: 'http://127.0.0.1:3003',
        apiOrigin: 'http://127.0.0.1:13100',
        ssoOrigin: 'http://127.0.0.1:3100',
        ssoLoginOrigin: 'http://127.0.0.1:3000',
        serverBaseUrl: 'not a url',
        ssoIssuer: 'also not a url',
      }),
    ).toEqual([
      'NEXT_PUBLIC_SERVER_BASE_URL (not a url) must be a valid URL.',
      'SSO_ISSUER (also not a url) must be a valid URL.',
    ]);
  });

  it('reports invalid required origin values as preflight issues', () => {
    expect(
      validateSsoE2eEnv({
        enabled: true,
        webBaseUrl: 'bad web',
        apiOrigin: 'bad api',
        ssoOrigin: 'bad sso',
        ssoLoginOrigin: 'http://127.0.0.1:3000',
        serverBaseUrl: 'http://127.0.0.1:13100',
        ssoIssuer: 'http://127.0.0.1:3100',
      }),
    ).toEqual([
      'E2E_API_ORIGIN (bad api) must be a valid URL.',
      'E2E_WEB_BASE_URL (bad web) must be a valid URL.',
      'E2E_SSO_ORIGIN (bad sso) must be a valid URL.',
    ]);
  });

  it('reports an invalid SSO login origin without requiring it to match the SSO API tier', () => {
    expect(
      validateSsoE2eEnv({
        enabled: true,
        webBaseUrl: 'http://127.0.0.1:3003',
        apiOrigin: 'http://127.0.0.1:13100',
        ssoOrigin: 'http://127.0.0.1:3100',
        ssoLoginOrigin: 'not a login url',
      }),
    ).toEqual(['E2E_SSO_LOGIN_ORIGIN (not a login url) must be a valid URL.']);
  });
});

describe('expectedOidcCallback', () => {
  it('derives the callback URL SSO must allow', () => {
    expect(expectedOidcCallback('http://127.0.0.1:13100/')).toBe(
      'http://127.0.0.1:13100/auth/oidc/callback',
    );
  });
});

describe('expectedLoopsNewUrl', () => {
  it('derives the Loops intake URL the SSO E2E preflight must reach', () => {
    expect(expectedLoopsNewUrl('https://vibecoding.test.dofe.ai/')).toBe(
      'https://vibecoding.test.dofe.ai/loops/new',
    );
  });
});

describe('isUsableLoopsRouteStatus', () => {
  it('accepts successful and redirect route responses', () => {
    expect(isUsableLoopsRouteStatus(200)).toBe(true);
    expect(isUsableLoopsRouteStatus(302)).toBe(true);
    expect(isUsableLoopsRouteStatus(308)).toBe(true);
  });

  it('rejects missing, client-error, and server-error route responses', () => {
    expect(isUsableLoopsRouteStatus(undefined)).toBe(false);
    expect(isUsableLoopsRouteStatus(404)).toBe(false);
    expect(isUsableLoopsRouteStatus(500)).toBe(false);
  });
});

describe('buildSsoE2eEnvFromProcess', () => {
  it('keeps the preflight disabled and applies local defaults when env is absent', () => {
    const env = buildSsoE2eEnvFromProcess({}, 'http://127.0.0.1:3003');

    expect(env).toEqual({
      enabled: false,
      webBaseUrl: 'http://127.0.0.1:3003',
      apiOrigin: 'http://127.0.0.1:13100',
      ssoOrigin: 'http://127.0.0.1:3100',
      ssoLoginOrigin: 'http://127.0.0.1:3000',
      serverBaseUrl: undefined,
      appBaseUrl: undefined,
      appFrontendUrl: undefined,
      ssoBaseUrl: undefined,
      ssoIssuer: undefined,
      ssoApiUrl: undefined,
      ssoInternalApiUrl: undefined,
    });
  });

  it('enables the preflight only when SSO_E2E_ENABLED is exactly "1"', () => {
    expect(buildSsoE2eEnvFromProcess({ SSO_E2E_ENABLED: '1' }, 'http://w').enabled).toBe(true);
    expect(buildSsoE2eEnvFromProcess({ SSO_E2E_ENABLED: 'true' }, 'http://w').enabled).toBe(false);
    expect(buildSsoE2eEnvFromProcess({ SSO_E2E_ENABLED: '0' }, 'http://w').enabled).toBe(false);
  });

  it('prefers E2E_API_ORIGIN over NEXT_PUBLIC_SERVER_BASE_URL and maps the SSO env keys', () => {
    const env = buildSsoE2eEnvFromProcess(
      {
        SSO_E2E_ENABLED: '1',
        E2E_API_ORIGIN: 'http://api.example',
        NEXT_PUBLIC_SERVER_BASE_URL: 'http://should-not-win.example',
        E2E_SSO_ORIGIN: 'http://sso.example',
        E2E_SSO_LOGIN_ORIGIN: 'http://login.example',
        NEXT_PUBLIC_SSO_BASE_URL: 'http://sso.example',
        SSO_ISSUER: 'http://sso.example',
        SSO_API_URL: 'http://sso.example',
        SSO_INTERNAL_API_URL: 'http://sso.example',
        VIBECODING_APP_BASE_URL: 'http://api.example',
        VIBECODING_APP_FRONTEND_URL: 'http://web.example',
      },
      'http://web.example',
    );

    expect(env.enabled).toBe(true);
    expect(env.apiOrigin).toBe('http://api.example');
    expect(env.serverBaseUrl).toBe('http://should-not-win.example');
    expect(env.ssoOrigin).toBe('http://sso.example');
    expect(env.ssoLoginOrigin).toBe('http://login.example');
    expect(env.appBaseUrl).toBe('http://api.example');
    expect(env.appFrontendUrl).toBe('http://web.example');
    expect(env.ssoInternalApiUrl).toBe('http://sso.example');
  });

  it('falls back to NEXT_PUBLIC_SERVER_BASE_URL for the API origin when E2E_API_ORIGIN is unset', () => {
    const env = buildSsoE2eEnvFromProcess(
      { NEXT_PUBLIC_SERVER_BASE_URL: 'http://fallback-api.example' },
      'http://web.example',
    );

    expect(env.apiOrigin).toBe('http://fallback-api.example');
  });
});

describe('probeLoopsRoute', () => {
  const fetchResponse = (status: number) => ({ status }) as Response;

  it('reports a usable 2xx route with a manual-redirect GET and a timeout signal', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fetchResponse(200)) as unknown as typeof fetch;

    const result = await probeLoopsRoute('https://host.example/loops/new', fetchImpl);

    expect(result).toEqual({
      url: 'https://host.example/loops/new',
      status: 200,
      usable: true,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://host.example/loops/new',
      expect.objectContaining({
        method: 'GET',
        redirect: 'manual',
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('reports a timeout as not usable with a timedOut flag', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('signal timed out'), { name: 'TimeoutError' }),
      ) as unknown as typeof fetch;

    const result = await probeLoopsRoute('https://slow.example/loops/new', fetchImpl, {
      timeoutMs: 50,
    });

    expect(result.usable).toBe(false);
    expect(result.timedOut).toBe(true);
    expect(result.status).toBeUndefined();
  });

  it('accepts an expected 3xx auth redirect as usable', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fetchResponse(302)) as unknown as typeof fetch;

    const result = await probeLoopsRoute('https://host.example/loops/new', fetchImpl);

    expect(result.usable).toBe(true);
    expect(result.status).toBe(302);
  });

  it('rejects a 404 route as not usable', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fetchResponse(404)) as unknown as typeof fetch;

    const result = await probeLoopsRoute('https://host.example/loops/new', fetchImpl);

    expect(result.usable).toBe(false);
    expect(result.status).toBe(404);
  });

  it('reports a network failure as not usable with an error reason', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValue(new Error('getaddrinfo ENOTFOUND host')) as unknown as typeof fetch;

    const failed = await probeLoopsRoute('https://down.example/loops/new', fetchImpl);

    expect(failed.usable).toBe(false);
    expect(failed.status).toBeUndefined();
    expect(failed.error).toBe('getaddrinfo ENOTFOUND host');
  });
});
