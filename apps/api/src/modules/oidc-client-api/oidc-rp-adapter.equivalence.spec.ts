/**
 * F.1 OIDC RP — SDK adapter equivalence spec (vibecoding.dofe.ai pilot)
 *
 * Purpose: mirror the agents adapter equivalence proof (docs/0626/sso-opz
 * IMPLEMENTATION-LOG Cycle 6) for the vibecoding pilot, using vibecoding's
 * option shape, AND surface the concrete pilot migration considerations where
 * vibecoding's hand-rolled `OidcClientApiService` behavior must be reconciled
 * with the SDK adapter.
 *
 * This is Step 1 / Step 2 prep of docs/0626/sso-opz/NEXT-STEPS.md. It does NOT
 * replace production code. Findings are fed back into
 * docs/0626/sso-opz/OIDC-RP-ADAPTER-CHECKLIST.md.
 *
 * Covered (SDK-owned behaviors, same matrix as agents):
 *  - Internal issuer rewrite  → token endpoint uses `internalIssuerUrl`.
 *  - PKCE state               → stored once with 600s TTL, one-time consume.
 *  - One-time exchange code   → 300s TTL (AUTH_CODE_EXPIRE_SECONDS); second
 *                                exchange throws.
 *  - Duplicate callback       → second callback with same state throws, no
 *                                second token exchange.
 *  - Refresh                  → grant_type=refresh_token to internal endpoint.
 *  - Logout                   → id_token_hint + post_logout_redirect_uri.
 *
 * vibecoding pilot findings pinned below (consumer reconciliation required):
 *  - vibecoding resolves a SEPARATE API base (`resolveOidcApiBaseUrl()`) for the
 *    `/auth/oidc/callback` redirect_uri and frontend base
 *    (`resolveOidcFrontendBaseUrl()`) for `/auth/oidc/success`. The SDK
 *    `resolveOidcUrls()` derives both from a single `frontendOrigin`/`appBaseUrl`,
 *    so the pilot must pass the API-base redirect_uri as an explicit override to
 *    `getAuthorizationUrl()` and ensure `handleCallback()`'s token exchange
 *    redirect_uri agrees (or the callback route must move to the resolved base).
 *  - vibecoding logout uses `post_logout_redirect_uri=${appBaseUrl}/login` (path
 *    suffix). The SDK appends no path. The pilot must reconcile the `/login`
 *    suffix (consumer-side redirect or SDK logout-redirect-path option).
 *
 * Cycle 15 update: the SDK fix landed in ../sso.dofe.ai (Cycle 14) adds optional
 * `apiBaseUrl` and `postLogoutRedirectPath` options that close both gaps. The
 * "gap-closed" tests below assert the post-fix behavior. They are guarded by a
 * feature-detect (typeof (options as any) — the published @dofe/sso-nestjs@0.1.57
 * does NOT yet ship these options, so the gap-closed tests skip until a newer
 * version is published and pinned here).
 */

import { of } from 'rxjs';
import {
  SsoOidcRelyingPartyService,
  type OidcRpModuleOptions,
  type OidcStateStore,
} from '@dofe/sso-nestjs';

// ─── Fixtures ───────────────────────────────────────────────────────

const TOKEN_FIXTURE = {
  access_token: 'access-abc',
  expires_in: 3600,
  token_type: 'Bearer',
  refresh_token: 'refresh-abc',
  id_token: 'id-abc',
};

// vibecoding option shape: appBaseUrl / frontendOrigin come from
// resolveOidcFrontendBaseUrl(); the API-base callback is reconciled via an
// explicit redirectUri override (see pilot findings below).
const VIBECODING_OPTIONS: OidcRpModuleOptions = {
  clientId: 'vibecoding-client-id',
  clientSecret: 'vibecoding-secret',
  issuerUrl: 'https://sso.dofe.ai',
  internalIssuerUrl: 'http://sso:3100',
  redirectPath: '/auth/oidc/callback',
  successPath: '/auth/oidc/success',
  frontendOrigin: 'https://vibecoding.dofe.ai',
  appBaseUrl: 'https://vibecoding.dofe.ai',
  serviceName: 'vibecoding',
};

interface RecordedSet {
  key: string;
  value: string;
  ttlSeconds: number;
}

function createRecordingStateStore(): { store: OidcStateStore; sets: RecordedSet[] } {
  const db = new Map<string, string>();
  const sets: RecordedSet[] = [];
  const store: OidcStateStore = {
    async set(key, value, ttlSeconds) {
      db.set(key, value);
      sets.push({ key, value, ttlSeconds });
    },
    async get(key) {
      const value = db.get(key) ?? null;
      db.delete(key); // one-time read
      return value;
    },
    async delete(key) {
      db.delete(key);
    },
  };
  return { store, sets };
}

function createFakeHttp(
  responseFactory: () => Record<string, unknown> = () => ({
    ...TOKEN_FIXTURE,
  }),
) {
  const posts: Array<{ url: string; body: string; config: unknown }> = [];
  const post = jest.fn((url: string, body: string, config: unknown) => {
    posts.push({ url, body, config });
    return of({ data: responseFactory() });
  });
  return { http: { post } as never, posts };
}

function extractQuery(url: string): URLSearchParams {
  return new URLSearchParams(url.split('?')[1] ?? '');
}

// ─── Core SDK adapter equivalence (vibecoding options) ──────────────

describe('F.1 SDK RP adapter equivalence (vibecoding pilot options)', () => {
  it('routes the token endpoint to the internal issuer while keeping authorize/logout public', async () => {
    const { store } = createRecordingStateStore();
    const { http, posts } = createFakeHttp();
    const service = new SsoOidcRelyingPartyService(VIBECODING_OPTIONS, store, http);

    expect(service.redirectUri).toBe('https://vibecoding.dofe.ai/auth/oidc/callback');
    expect(service.successUrl).toBe('https://vibecoding.dofe.ai/auth/oidc/success');

    const { state } = await service.getAuthorizationUrl();
    await service.handleCallback('auth-code', state);

    expect(posts[0].url).toBe('http://sso:3100/oidc/token');
  });

  it('builds the authorization URL with PKCE (S256) and stores state once (600s TTL)', async () => {
    const { store, sets } = createRecordingStateStore();
    const { http } = createFakeHttp();
    const service = new SsoOidcRelyingPartyService(VIBECODING_OPTIONS, store, http);

    const { state, authorizationUrl } = await service.getAuthorizationUrl();

    expect(authorizationUrl.startsWith('https://sso.dofe.ai/oidc/auth?')).toBe(true);
    const params = extractQuery(authorizationUrl);
    expect(params.get('response_type')).toBe('code');
    expect(params.get('client_id')).toBe('vibecoding-client-id');
    expect(params.get('scope')).toContain('openid');
    expect(params.get('code_challenge_method')).toBe('S256');
    expect((params.get('code_challenge') ?? '').length).toBeGreaterThan(0);

    const stateSet = sets.find((s) => s.key === `oidc:state:${state}`);
    expect(stateSet?.ttlSeconds).toBe(600);
  });

  it('exchanges the auth code at the internal token endpoint and issues a one-time exchange code (300s TTL)', async () => {
    const { store, sets } = createRecordingStateStore();
    const { http, posts } = createFakeHttp();
    const service = new SsoOidcRelyingPartyService(VIBECODING_OPTIONS, store, http);

    const { state } = await service.getAuthorizationUrl();
    const { redirectUrl } = await service.handleCallback('auth-code', state);

    expect(redirectUrl.startsWith('https://vibecoding.dofe.ai/auth/oidc/success?code=')).toBe(true);
    expect(posts[0].url).toBe('http://sso:3100/oidc/token');
    expect(posts[0].body).toContain('grant_type=authorization_code');
    expect(posts[0].body).toContain('code_verifier=');

    const exchangeSet = sets.find((s) => s.key.startsWith('oidc:exchange:'));
    expect(exchangeSet?.ttlSeconds).toBe(300); // AUTH_CODE_EXPIRE_SECONDS
  });

  it('consumes the exchange code exactly once', async () => {
    const { store } = createRecordingStateStore();
    const { http } = createFakeHttp();
    const service = new SsoOidcRelyingPartyService(VIBECODING_OPTIONS, store, http);

    const { state } = await service.getAuthorizationUrl();
    const { redirectUrl } = await service.handleCallback('auth-code', state);
    const code = extractQuery(redirectUrl).get('code')!;

    const first = await service.exchangeCode(code);
    expect(first.access_token).toBe('access-abc');
    await expect(service.exchangeCode(code)).rejects.toThrow(/exchange code/i);
  });

  it('does not exchange tokens twice for a duplicate callback (one-time state)', async () => {
    const { store } = createRecordingStateStore();
    const { http, posts } = createFakeHttp();
    const service = new SsoOidcRelyingPartyService(VIBECODING_OPTIONS, store, http);

    const { state } = await service.getAuthorizationUrl();
    await service.handleCallback('auth-code', state);
    await expect(service.handleCallback('auth-code', state)).rejects.toThrow(/state/i);

    expect(posts.filter((p) => p.body.includes('grant_type=authorization_code'))).toHaveLength(1);
  });

  it('refreshes via the internal token endpoint with grant_type=refresh_token', async () => {
    const { store } = createRecordingStateStore();
    const { http, posts } = createFakeHttp(() => ({
      ...TOKEN_FIXTURE,
      access_token: 'refreshed-access',
    }));
    const service = new SsoOidcRelyingPartyService(VIBECODING_OPTIONS, store, http);

    const result = await service.refreshToken('rt-123');
    expect(result.access_token).toBe('refreshed-access');
    expect(posts[0].url).toBe('http://sso:3100/oidc/token');
    expect(posts[0].body).toContain('grant_type=refresh_token');
  });

  it('builds the logout URL with id_token_hint and post_logout_redirect_uri', () => {
    const { store } = createRecordingStateStore();
    const { http } = createFakeHttp();
    const service = new SsoOidcRelyingPartyService(VIBECODING_OPTIONS, store, http);

    const logoutUrl = service.getLogoutUrl('id-token-hint-xyz');
    const params = extractQuery(logoutUrl);
    expect(params.get('id_token_hint')).toBe('id-token-hint-xyz');
    expect(params.get('post_logout_redirect_uri')).toBe('https://vibecoding.dofe.ai');
  });
});

// ─── vibecoding pilot adapter findings (pinned for migration) ───────

describe('F.1 vibecoding pilot adapter findings (reconciliation required)', () => {
  it('accepts an explicit API-base redirect_uri override on authorize (vibecoding keeps its API-base callback)', async () => {
    const { store } = createRecordingStateStore();
    const { http } = createFakeHttp();
    const service = new SsoOidcRelyingPartyService(VIBECODING_OPTIONS, store, http);

    // vibecoding's real callback lives on the API base (resolveOidcApiBaseUrl).
    const apiBaseRedirectUri = 'https://api.vibecoding.dofe.ai/auth/oidc/callback';
    const { authorizationUrl } = await service.getAuthorizationUrl(apiBaseRedirectUri);

    expect(extractQuery(authorizationUrl).get('redirect_uri')).toBe(apiBaseRedirectUri);
  });

  it('pins that the token-exchange redirect_uri uses the single resolved base (pilot must reconcile)', async () => {
    const { store } = createRecordingStateStore();
    const { http, posts } = createFakeHttp();
    const service = new SsoOidcRelyingPartyService(VIBECODING_OPTIONS, store, http);

    // Authorize with an API-base override…
    const { state } = await service.getAuthorizationUrl(
      'https://api.vibecoding.dofe.ai/auth/oidc/callback',
    );
    await service.handleCallback('auth-code', state);

    // …but the token exchange sends the SDK-resolved redirect_uri (frontend
    // base). Finding: vibecoding's API-base callback + frontend-base success
    // cannot both be expressed via the current single-base resolveOidcUrls.
    // The pilot must either move the callback to the resolved base or obtain
    // SDK split-base support before deleting the hand-rolled service.
    const exchangeBody = posts[0].body;
    expect(exchangeBody).toContain(
      'redirect_uri=' + encodeURIComponent('https://vibecoding.dofe.ai/auth/oidc/callback'),
    );
  });

  it('pins that logout post_logout_redirect_uri has no path suffix (vibecoding /login must be reconciled)', () => {
    const { store } = createRecordingStateStore();
    const { http } = createFakeHttp();
    const service = new SsoOidcRelyingPartyService(VIBECODING_OPTIONS, store, http);

    // vibecoding hand-rolled logout uses `${appBaseUrl}/login`; the SDK appends
    // no path. Finding: the pilot must redirect to /login consumer-side, or the
    // SDK must add a logout-redirect-path option.
    const logoutUrl = service.getLogoutUrl();
    expect(extractQuery(logoutUrl).get('post_logout_redirect_uri')).toBe(
      'https://vibecoding.dofe.ai',
    );
  });
});

// ─── Cycle 15: gap-closed behavior (post SDK fix) ───────────────────
//
// ../sso.dofe.ai Cycle 14 added optional `apiBaseUrl` + `postLogoutRedirectPath`
// to OidcRpModuleOptions. These tests assert the post-fix behavior. They
// feature-detect the published SDK: @dofe/sso-nestjs@0.1.57 does not yet ship
// these options, so the tests SKIP until a newer version is published and
// pinned. Once pinned, the skip is removed and the pre-fix findings tests above
// can be deleted.

const SDK_HAS_SPLIT_BASE_OPTIONS = (() => {
  // The options type is structural; detect at runtime by checking whether the
  // service honors apiBaseUrl. Cheap detection: build a service with apiBaseUrl
  // and read redirectUri.
  try {
    const svc = new SsoOidcRelyingPartyService(
      { ...VIBECODING_OPTIONS, apiBaseUrl: 'https://api.vibecoding.dofe.ai' } as never,
      createRecordingStateStore().store,
      createFakeHttp().http,
    );
    return svc.redirectUri.startsWith('https://api.vibecoding.dofe.ai');
  } catch {
    return false;
  }
})();

const describeGapClosed = SDK_HAS_SPLIT_BASE_OPTIONS ? describe : describe.skip;

describeGapClosed(
  'F.1 vibecoding gap-closed behavior (SDK apiBaseUrl + postLogoutRedirectPath)',
  () => {
    it('puts redirect_uri on the API base for BOTH authorize and token exchange', async () => {
      const { store } = createRecordingStateStore();
      const { http, posts } = createFakeHttp();
      const service = new SsoOidcRelyingPartyService(
        {
          ...VIBECODING_OPTIONS,
          apiBaseUrl: 'https://api.vibecoding.dofe.ai',
        } as never,
        store,
        http,
      );

      expect(service.redirectUri).toBe('https://api.vibecoding.dofe.ai/auth/oidc/callback');
      expect(service.successUrl).toBe('https://vibecoding.dofe.ai/auth/oidc/success');

      const { state } = await service.getAuthorizationUrl();
      await service.handleCallback('auth-code', state);

      expect(posts[0].body).toContain(
        'redirect_uri=' + encodeURIComponent('https://api.vibecoding.dofe.ai/auth/oidc/callback'),
      );
    });

    it('appends the /login post-logout path when postLogoutRedirectPath is set', () => {
      const { store } = createRecordingStateStore();
      const { http } = createFakeHttp();
      const service = new SsoOidcRelyingPartyService(
        {
          ...VIBECODING_OPTIONS,
          postLogoutRedirectPath: '/login',
        } as never,
        store,
        http,
      );

      expect(extractQuery(service.getLogoutUrl()).get('post_logout_redirect_uri')).toBe(
        'https://vibecoding.dofe.ai/login',
      );
    });
  },
);
