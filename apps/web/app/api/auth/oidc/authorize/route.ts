import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getOidcApiBaseUrl, isSafeCallbackUrl } from '../internal';

const AUTHORIZE_PATH = '/auth/oidc/authorize';

export async function GET(request: NextRequest) {
  const redirectUri = request.nextUrl.searchParams.get('redirect_uri') || '/';
  const safeRedirectUri = isSafeCallbackUrl(redirectUri) ? redirectUri : '/';
  const apiUrl = new URL(`${getOidcApiBaseUrl()}${AUTHORIZE_PATH}`);
  apiUrl.searchParams.set('redirect_uri', safeRedirectUri);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(apiUrl, {
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to get SSO authorize URL' }, { status: 502 });
    }

    const body = await response.json();
    const authorizeUrl = body?.data?.url;

    if (typeof authorizeUrl !== 'string' || !authorizeUrl) {
      return NextResponse.json(
        { error: 'SSO authorize URL missing from API response' },
        { status: 502 },
      );
    }

    return NextResponse.redirect(authorizeUrl);
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'AbortError'
        ? 'SSO authorize request timed out'
        : 'SSO authorize request failed';

    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
