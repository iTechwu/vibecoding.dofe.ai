import { describe, expect, it } from 'vitest';
import {
  expectedLoopsNewUrl,
  expectedOidcCallback,
  isUsableLoopsRouteStatus,
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
