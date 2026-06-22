type CorsOriginInput = {
  origin?: string;
  corsDomains: string[];
  isDevEnv: boolean;
};

export const DEFAULT_CORS_ALLOWED_HEADERS = [
  'Accept',
  'Authorization',
  'Content-Type',
  'Origin',
  'X-Requested-With',
  'x-api-version',
  'x-app-build',
  'x-device-id',
  'x-os',
  'x-platform',
];

function wildcardToRegex(domain: string): RegExp {
  const escaped = domain
    .trim()
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^(.*\\.)?${escaped}$`);
}

function isLocalhost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

export function isCorsOriginAllowed({ origin, corsDomains, isDevEnv }: CorsOriginInput): boolean {
  if (!origin) {
    return true;
  }

  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    return false;
  }

  const { hostname } = url;
  if (isLocalhost(hostname)) {
    return true;
  }

  if (isDevEnv && hostname.endsWith('.local.dofe.ai')) {
    return true;
  }

  return corsDomains.some((domain) => wildcardToRegex(domain).test(hostname));
}
