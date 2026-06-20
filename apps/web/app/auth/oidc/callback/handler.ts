import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getOidcApiBaseUrl } from '@/app/api/auth/oidc/internal';

const CALLBACK_PATH = '/auth/oidc/callback';

function buildErrorRedirect(request: NextRequest, error: string, description: string) {
  const url = new URL('/auth/oidc/success', request.url);
  url.searchParams.set('error', error);
  url.searchParams.set('error_description', description);
  return NextResponse.redirect(url);
}

export async function handleOidcCallback(request: NextRequest) {
  const callbackUrl = new URL(`${getOidcApiBaseUrl()}${CALLBACK_PATH}`);
  for (const [key, value] of request.nextUrl.searchParams.entries()) {
    callbackUrl.searchParams.append(key, value);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(callbackUrl, {
      cache: 'no-store',
      redirect: 'manual',
      signal: controller.signal,
    });

    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      return NextResponse.redirect(location);
    }

    return buildErrorRedirect(request, 'server_error', 'Failed to complete authentication');
  } catch (error) {
    const description =
      error instanceof Error && error.name === 'AbortError'
        ? 'Authentication callback timed out'
        : 'Authentication callback failed';
    return buildErrorRedirect(request, 'server_error', description);
  } finally {
    clearTimeout(timeout);
  }
}
