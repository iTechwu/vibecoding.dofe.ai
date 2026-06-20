import { expect, test, type Page } from '@playwright/test';

const enabled = process.env.SSO_E2E_ENABLED === '1';
const email = process.env.E2E_SSO_EMAIL;
const mobile = process.env.E2E_SSO_MOBILE;
const password = process.env.E2E_SSO_PASSWORD;
const callbackUrl = process.env.E2E_CALLBACK_URL ?? '/';
const ssoOrigin = process.env.E2E_SSO_ORIGIN ?? 'http://127.0.0.1:3100';

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
      ['#login-email', 'input[name="email"]', 'input[type="email"]', 'input[autocomplete="email"]'],
      email,
    );
  } else if (mobile) {
    await fillIfVisible(
      page,
      ['#login-mobile', 'input[name="mobile"]', 'input[type="tel"]', 'input[autocomplete="tel"]'],
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

test('login -> callback -> refresh -> logout and upload/CDN through SSO', async ({
  page,
  baseURL,
}) => {
  expect(baseURL, 'Playwright baseURL must be configured').toBeTruthy();

  await page.goto(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);

  await expect
    .poll(() => page.url(), { timeout: 20_000 })
    .toMatch(
      new RegExp(
        `(${ssoOrigin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|${baseURL!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
      ),
    );

  if (new URL(page.url()).origin === new URL(ssoOrigin).origin) {
    await completeSsoLogin(page);
  }

  await expect.poll(() => page.url(), { timeout: 45_000 }).toContain(baseURL!);
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

  const refreshResponse = await page.request.post('/auth/oidc/token', {
    data: {},
  });
  expect(refreshResponse.ok(), `refresh failed: ${refreshResponse.status()}`).toBeTruthy();
  const refreshBody = await refreshResponse.json();
  expect(refreshBody?.data?.access_token).toBeTruthy();
  expect(JSON.stringify(refreshBody)).not.toContain('refresh_token');

  const uploadResult = await page.evaluate(async () => {
    const { FileUploader } = await import('@dofe/file-sdk-web');
    const uploader = new FileUploader({ apiBase: '/api/proxy/sso', timeout: 60_000 });
    const file = new File(['vibecoding-sso-e2e'], `vibecoding-sso-e2e-${Date.now()}.txt`, {
      type: 'text/plain',
    });
    return uploader.upload(file, {
      scope: 'avatar',
      metadata: { source: 'vibecoding-sso-e2e' },
    });
  });

  expect(uploadResult.fileId).toBeTruthy();
  expect(uploadResult.cdnUrl, 'avatar scope should return a CDN URL').toBeTruthy();

  const cdnResponse = await page.request.get(uploadResult.cdnUrl!);
  expect(cdnResponse.ok(), `CDN URL failed: ${cdnResponse.status()}`).toBeTruthy();

  const logoutResponse = await page.request.post('/auth/oidc/logout', {
    data: {
      access_token: refreshBody.data.access_token,
    },
  });
  expect(logoutResponse.ok(), `logout failed: ${logoutResponse.status()}`).toBeTruthy();
  const logoutBody = await logoutResponse.json();
  expect(logoutBody?.data?.logoutUrl).toBeTruthy();

  const clearResponse = await page.request.post('/auth/oidc/clear-session', {
    data: {},
  });
  expect(clearResponse.ok(), `clear-session failed: ${clearResponse.status()}`).toBeTruthy();

  const refreshAfterLogout = await page.request.post('/auth/oidc/token', {
    data: {},
  });
  expect(refreshAfterLogout.ok()).toBeFalsy();
});
