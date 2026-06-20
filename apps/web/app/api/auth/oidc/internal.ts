const DEFAULT_API_BASE_URL = 'http://localhost:13100';

export function getOidcApiBaseUrl(): string {
  return (
    process.env.VIBECODING_INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_SERVER_BASE_URL ||
    DEFAULT_API_BASE_URL
  ).replace(/\/+$/, '');
}

export function isSafeCallbackUrl(url: string): boolean {
  if (!url.startsWith('/')) return false;
  if (url.startsWith('//')) return false;
  if (url.startsWith('/\\')) return false;
  if (/^(\/[^/]*):/.test(url)) return false;
  return true;
}
