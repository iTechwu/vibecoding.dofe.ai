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
  const apiOrigin = requiredOriginOf('E2E_API_ORIGIN', env.apiOrigin, issues);
  const webOrigin = requiredOriginOf('E2E_WEB_BASE_URL', env.webBaseUrl, issues);
  const ssoOrigin = requiredOriginOf('E2E_SSO_ORIGIN', env.ssoOrigin, issues);

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
  processEnv: NodeJS.ProcessEnv,
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
