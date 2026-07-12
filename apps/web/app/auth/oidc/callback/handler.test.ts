import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { handleOidcCallback } from './handler';

describe('handleOidcCallback', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('redirects callback errors to the configured public frontend origin', async () => {
    vi.stubEnv('VIBECODING_APP_FRONTEND_URL', 'https://vibecoding.local.dofe.ai');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 502 })));

    const response = await handleOidcCallback(
      new NextRequest('http://localhost:3003/auth/callback?code=unused'),
    );

    expect(response.headers.get('location')).toContain(
      'https://vibecoding.local.dofe.ai/auth/oidc/success',
    );
  });
});
