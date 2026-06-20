import { expect, test, type Page } from '@playwright/test';

const enabled = process.env.SSO_E2E_ENABLED === '1';
const email = process.env.E2E_SSO_EMAIL;
const mobile = process.env.E2E_SSO_MOBILE;
const password = process.env.E2E_SSO_PASSWORD;
const callbackUrl = process.env.E2E_CALLBACK_URL ?? '/';
const ssoOrigin = process.env.E2E_SSO_ORIGIN ?? 'http://127.0.0.1:3100';
const ssoLoginOrigin = process.env.E2E_SSO_LOGIN_ORIGIN ?? 'http://127.0.0.1:3000';
const apiOrigin =
  process.env.E2E_API_ORIGIN ?? process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? 'http://127.0.0.1:13100';

test.skip(!enabled, 'Set SSO_E2E_ENABLED=1 to run the real vibecoding <-> sso.dofe.ai E2E flow.');

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is required for SSO_E2E_ENABLED=1`);
  }
  return value;
}

async function fillIfVisible(page: Page, selectors: string[], value: string): Promise<boolean> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      await locator.fill(value);
      return true;
    }
  }
  return false;
}

async function clickFirstVisible(page: Page, selectors: string[]): Promise<boolean> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      await locator.click();
      return true;
    }
  }
  return false;
}

async function completeSsoLogin(page: Page): Promise<void> {
  const credential = email ?? mobile;
  requireEnv('E2E_SSO_EMAIL or E2E_SSO_MOBILE', credential);
  requireEnv('E2E_SSO_PASSWORD', password);

  await page.waitForLoadState('domcontentloaded');

  if (email) {
    await fillIfVisible(
      page,
      [
        '#login-email',
        'input[name="email"]',
        'input[type="email"]',
        'input[autocomplete="email"]',
        'input[placeholder*="email" i]',
      ],
      email,
    );
  } else if (mobile) {
    await fillIfVisible(
      page,
      [
        '#login-mobile',
        'input[name="mobile"]',
        'input[type="tel"]',
        'input[autocomplete="tel"]',
        'input[placeholder="Enter your mobile number"]',
        'input[placeholder*="mobile" i]',
      ],
      mobile,
    );
  }

  await fillIfVisible(
    page,
    [
      '#login-password',
      'input[name="password"]',
      'input[type="password"]',
      'input[autocomplete="current-password"]',
      'input[placeholder="Enter your password"]',
      'input[placeholder*="password" i]',
    ],
    password!,
  );

  const submitted = await clickFirstVisible(page, [
    'button[type="submit"]',
    'button:has-text("登录")',
    'button:has-text("Sign in")',
    'button:has-text("Log in")',
  ]);

  if (!submitted) {
    await page.keyboard.press('Enter');
  }

  await clickFirstVisible(page, [
    'button:has-text("允许")',
    'button:has-text("同意")',
    'button:has-text("Authorize")',
    'button:has-text("Allow")',
    'button:has-text("Continue")',
  ]);
}

function apiUrl(path: string): string {
  return `${apiOrigin.replace(/\/+$/, '')}${path}`;
}

test('login -> callback -> refresh -> logout and upload token/CDN metadata through SSO', async ({
  page,
  baseURL,
}) => {
  expect(baseURL, 'Playwright baseURL must be configured').toBeTruthy();

  await page.goto(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);

  await expect
    .poll(
      () => {
        const url = page.url();
        const parsed = new URL(url);
        if (parsed.origin === new URL(baseURL!).origin && parsed.pathname.includes('/login')) {
          return 'pending-login';
        }
        return url;
      },
      { timeout: 20_000 },
    )
    .toMatch(
      new RegExp(
        `(${ssoOrigin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|${ssoLoginOrigin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|${baseURL!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
      ),
    );

  const currentOrigin = new URL(page.url()).origin;
  if (
    currentOrigin === new URL(ssoOrigin).origin ||
    currentOrigin === new URL(ssoLoginOrigin).origin
  ) {
    await completeSsoLogin(page);
  }

  await expect
    .poll(
      () => {
        const url = page.url();
        if (new URL(url).origin !== new URL(baseURL!).origin) return 'not-app';
        if (url.includes('/login')) return 'pending-login';
        if (url.includes('/auth/oidc/')) return 'pending-callback';
        return url;
      },
      { timeout: 45_000 },
    )
    .toContain(baseURL!);
  await page.waitForLoadState('networkidle');

  const tokens = await page.evaluate(() => {
    const raw = window.localStorage.getItem('tokens');
    return raw
      ? (JSON.parse(raw) as { access?: string; accessExpire?: number; expire?: number })
      : null;
  });
  expect(
    tokens?.access,
    'access token should be stored locally after callback exchange',
  ).toBeTruthy();

  const refreshResponse = await page.request.post(apiUrl('/auth/oidc/token'), {
    data: {},
  });
  expect(refreshResponse.ok(), `refresh failed: ${refreshResponse.status()}`).toBeTruthy();
  const refreshBody = await refreshResponse.json();
  expect(refreshBody?.data?.access_token).toBeTruthy();
  expect(JSON.stringify(refreshBody)).not.toContain('refresh_token');

  const uploadContent = Buffer.from('vibecoding-sso-e2e', 'utf8');
  const uploadFilename = `vibecoding-sso-e2e-${Date.now()}.txt`;
  const tokenResponse = await page.request.post('/api/proxy/sso/api/uploader/token/private', {
    data: {
      filename: uploadFilename,
      fsize: uploadContent.byteLength,
      mimeType: 'text/plain',
      scope: 'avatar',
      signature: 'browser-upload',
      metadata: { source: 'vibecoding-sso-e2e' },
    },
  });
  expect(tokenResponse.ok(), `upload token failed: ${tokenResponse.status()}`).toBeTruthy();
  const tokenBody = await tokenResponse.json();
  const tokenData = tokenBody?.data ?? tokenBody;
  expect(tokenData?.token, `upload token missing: ${JSON.stringify(tokenBody)}`).toBeTruthy();

  const uploadResult = {
    fileId: tokenData?.fileId,
    key: tokenData?.key,
    url: tokenData?.url ?? tokenData.token,
    cdnUrl: tokenData?.cdnUrl,
    bucket: tokenData?.bucket,
  };

  expect(uploadResult.fileId).toBeTruthy();
  expect(uploadResult.key).toBeTruthy();
  expect(uploadResult.bucket).toBe('dofe-public');
  expect(uploadResult.cdnUrl, 'avatar scope should return a CDN URL').toBeTruthy();

  const logoutResponse = await page.request.post(apiUrl('/auth/oidc/logout'), {
    data: {
      access_token: refreshBody.data.access_token,
    },
  });
  expect(logoutResponse.ok(), `logout failed: ${logoutResponse.status()}`).toBeTruthy();
  const logoutBody = await logoutResponse.json();
  expect(logoutBody?.data?.logoutUrl).toBeTruthy();

  const clearResponse = await page.request.post(apiUrl('/auth/oidc/clear-session'), {
    data: {},
  });
  expect(clearResponse.ok(), `clear-session failed: ${clearResponse.status()}`).toBeTruthy();

  const refreshAfterLogout = await page.request.post(apiUrl('/auth/oidc/token'), {
    data: {},
  });
  expect(refreshAfterLogout.ok()).toBeFalsy();
});
