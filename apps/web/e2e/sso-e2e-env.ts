export interface SsoE2eEnv {
  enabled: boolean;
  webBaseUrl: string;
  apiOrigin: string;
  ssoOrigin: string;
  ssoLoginOrigin: string;
  serverBaseUrl?: string;
  appBaseUrl?: string;
  appFrontendUrl?: string;
  ssoBaseUrl?: string;
  ssoIssuer?: string;
  ssoApiUrl?: string;
  ssoInternalApiUrl?: string;
}

function originOf(value: string): string | undefined {
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

function requiredOriginOf(name: string, value: string, issues: string[]): string | undefined {
  const origin = originOf(value);
  if (!origin) {
    issues.push(`${name} (${value}) must be a valid URL.`);
  }
  return origin;
}

function assertHttpOrigin(name: string, value: string, issues: string[]): string | undefined {
  const origin = requiredOriginOf(name, value, issues);
  // Local E2E uses http://127.0.0.1 and production uses https; any other scheme
  // (ftp/file/ssh/...) is never a reachable web origin for the preflight.
  if (origin && !/^https?:\/\//.test(origin)) {
    issues.push(`${name} (${value}) must use the http or https scheme.`);
  }
  return origin;
}

function compareOptionalOrigin(input: {
  name: string;
  value?: string;
  expectedName: string;
  expectedValue: string;
  expectedOrigin: string | undefined;
  issues: string[];
}): void {
  if (!input.value) return;
  const origin = originOf(input.value);
  if (!origin) {
    input.issues.push(`${input.name} (${input.value}) must be a valid URL.`);
    return;
  }
  if (input.expectedOrigin && origin !== input.expectedOrigin) {
    input.issues.push(
      `${input.name} (${input.value}) must match ${input.expectedName} (${input.expectedValue}).`,
    );
  }
}

export function expectedOidcCallback(apiOrigin: string): string {
  return `${apiOrigin.replace(/\/+$/, '')}/auth/oidc/callback`;
}

export function expectedLoopsNewUrl(webBaseUrl: string): string {
  return `${webBaseUrl.replace(/\/+$/, '')}/loops/new`;
}

export function isUsableLoopsRouteStatus(status: number | undefined): boolean {
  return typeof status === 'number' && status >= 200 && status < 400;
}

export function validateSsoE2eEnv(env: SsoE2eEnv): string[] {
  if (!env.enabled) return [];

  const issues: string[] = [];
  const apiOrigin = assertHttpOrigin('E2E_API_ORIGIN', env.apiOrigin, issues);
  const webOrigin = assertHttpOrigin('E2E_WEB_BASE_URL', env.webBaseUrl, issues);
  const ssoOrigin = assertHttpOrigin('E2E_SSO_ORIGIN', env.ssoOrigin, issues);
  // The SSO login portal may live on a different origin than the SSO API, so it
  // is not compared against `ssoOrigin`; it only needs to be a reachable http(s) URL.
  const loginOrigin = originOf(env.ssoLoginOrigin);
  if (!loginOrigin) {
    issues.push(`E2E_SSO_LOGIN_ORIGIN (${env.ssoLoginOrigin}) must be a valid URL.`);
  } else if (!/^https?:\/\//.test(loginOrigin)) {
    issues.push(`E2E_SSO_LOGIN_ORIGIN (${env.ssoLoginOrigin}) must use the http or https scheme.`);
  }

  compareOptionalOrigin({
    name: 'NEXT_PUBLIC_SERVER_BASE_URL',
    value: env.serverBaseUrl,
    expectedName: 'E2E_API_ORIGIN',
    expectedValue: env.apiOrigin,
    expectedOrigin: apiOrigin,
    issues,
  });
  compareOptionalOrigin({
    name: 'VIBECODING_APP_BASE_URL',
    value: env.appBaseUrl,
    expectedName: 'E2E_API_ORIGIN',
    expectedValue: env.apiOrigin,
    expectedOrigin: apiOrigin,
    issues,
  });
  compareOptionalOrigin({
    name: 'VIBECODING_APP_FRONTEND_URL',
    value: env.appFrontendUrl,
    expectedName: 'E2E_WEB_BASE_URL',
    expectedValue: env.webBaseUrl,
    expectedOrigin: webOrigin,
    issues,
  });

  for (const [name, value] of [
    ['NEXT_PUBLIC_SSO_BASE_URL', env.ssoBaseUrl],
    ['SSO_ISSUER', env.ssoIssuer],
    ['SSO_API_URL', env.ssoApiUrl],
    ['SSO_INTERNAL_API_URL', env.ssoInternalApiUrl],
  ] as const) {
    compareOptionalOrigin({
      name,
      value,
      expectedName: 'E2E_SSO_ORIGIN',
      expectedValue: env.ssoOrigin,
      expectedOrigin: ssoOrigin,
      issues,
    });
  }

  return issues;
}

export function buildSsoE2eEnvFromProcess(
  processEnv: Readonly<Record<string, string | undefined>>,
  webBaseUrl: string,
): SsoE2eEnv {
  return {
    enabled: processEnv.SSO_E2E_ENABLED === '1',
    webBaseUrl,
    apiOrigin:
      processEnv.E2E_API_ORIGIN ??
      processEnv.NEXT_PUBLIC_SERVER_BASE_URL ??
      'http://127.0.0.1:13100',
    ssoOrigin: processEnv.E2E_SSO_ORIGIN ?? 'http://127.0.0.1:3100',
    ssoLoginOrigin: processEnv.E2E_SSO_LOGIN_ORIGIN ?? 'http://127.0.0.1:3000',
    serverBaseUrl: processEnv.NEXT_PUBLIC_SERVER_BASE_URL,
    appBaseUrl: processEnv.VIBECODING_APP_BASE_URL,
    appFrontendUrl: processEnv.VIBECODING_APP_FRONTEND_URL,
    ssoBaseUrl: processEnv.NEXT_PUBLIC_SSO_BASE_URL,
    ssoIssuer: processEnv.SSO_ISSUER,
    ssoApiUrl: processEnv.SSO_API_URL,
    ssoInternalApiUrl: processEnv.SSO_INTERNAL_API_URL,
  };
}

export interface LoopsRouteProbe {
  url: string;
  status: number | undefined;
  usable: boolean;
  timedOut?: boolean;
  error?: string;
}

const DEFAULT_ROUTE_PROBE_TIMEOUT_MS = 10_000;

/**
 * Probe whether a Loops intake route (typically `/loops/new`) is reachable and
 * returns a usable status. Intended for deployment/release verification of a
 * remote domain (e.g. `vibecoding.test.dofe.ai`) without starting the full
 * local Web/API/SSO stack. A 2xx page or an expected 3xx auth redirect is
 * usable; 4xx/5xx, a network failure, or a timeout is not. `fetchImpl` is
 * injectable so the logic stays unit-testable. A timeout guards against a hung
 * endpoint so CI/release scripts cannot stall indefinitely.
 */
export async function probeLoopsRoute(
  url: string,
  fetchImpl: typeof fetch,
  options: { timeoutMs?: number } = {},
): Promise<LoopsRouteProbe> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_ROUTE_PROBE_TIMEOUT_MS;
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });
    const status = response.status;
    return { url, status, usable: isUsableLoopsRouteStatus(status) };
  } catch (error) {
    const name = (error as { name?: string } | null)?.name;
    const isTimeout = name === 'TimeoutError' || name === 'AbortError';
    return {
      url,
      status: undefined,
      usable: false,
      timedOut: isTimeout || undefined,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
