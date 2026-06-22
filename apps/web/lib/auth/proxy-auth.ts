export const AUTH_PRESENCE_COOKIE = 'tokenPresence';
export const AUTH_EXPIRE_COOKIE = 'tokenExpire';

const LOCALE_PATTERN = /^\/(zh-CN|en)(?=\/|$)/;
const PUBLIC_PATHS = ['/login', '/auth/oidc/callback', '/auth/oidc/success'];

function stripLocale(pathname: string): string {
  const withoutLocale = pathname.replace(LOCALE_PATTERN, '') || '/';
  return withoutLocale.startsWith('/') ? withoutLocale : `/${withoutLocale}`;
}

function normalizeTimestampMs(value: number): number {
  return value < 10000000000 ? value * 1000 : value;
}

export function isPublicPath(pathname: string): boolean {
  const pathWithoutLocale = stripLocale(pathname);
  return PUBLIC_PATHS.some(
    (publicPath) =>
      pathWithoutLocale === publicPath || pathWithoutLocale.startsWith(`${publicPath}/`),
  );
}

export function hasValidAuthPresence(input: {
  tokenPresence?: string;
  tokenExpire?: string;
  now?: number;
}): boolean {
  if (input.tokenPresence !== '1') return false;

  const expire = Number(input.tokenExpire);
  if (!Number.isFinite(expire)) return false;

  return normalizeTimestampMs(expire) > (input.now ?? Date.now());
}

export function shouldRedirectToLogin(input: {
  pathname: string;
  tokenPresence?: string;
  tokenExpire?: string;
  now?: number;
}): boolean {
  if (isPublicPath(input.pathname)) return false;
  return !hasValidAuthPresence(input);
}
