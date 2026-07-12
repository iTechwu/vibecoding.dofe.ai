import { expect, test, type Page, type Response } from '@playwright/test';

const AUTH_SESSION_DURATION_MS = 60 * 60 * 1000;

async function authenticateWorkbench(page: Page, baseURL: string): Promise<void> {
  const expiresAt = Date.now() + AUTH_SESSION_DURATION_MS;

  // The proxy checks these cookie names before serving protected routes. The
  // client restores this synthetic, non-secret session from local storage.
  await page.context().addCookies([
    {
      name: 'tokenPresence',
      value: '1',
      url: baseURL,
      expires: Math.floor(expiresAt / 1000),
    },
    {
      name: 'tokenExpire',
      value: String(expiresAt),
      url: baseURL,
      expires: Math.floor(expiresAt / 1000),
    },
  ]);

  await page.addInitScript((sessionExpiresAt) => {
    window.localStorage.setItem(
      'user',
      JSON.stringify({
        id: 'playwright-workbench-user',
        email: 'playwright-workbench@example.test',
        nickname: 'Playwright',
        headerImg: null,
        isAdmin: false,
      }),
    );
    window.localStorage.setItem(
      'tokens',
      JSON.stringify({
        access: 'playwright-synthetic-access-token',
        accessExpire: sessionExpiresAt,
        expire: sessionExpiresAt,
      }),
    );
  }, expiresAt);
}

async function expectAuthenticatedWorkbench(page: Page, response: Response | null): Promise<void> {
  expect(response?.status()).toBeLessThan(400);
  await expect(page).not.toHaveURL(/\/login(?:[/?#]|$)/);
  await expect(page.locator('[data-workbench]')).toBeVisible();
}

test.beforeEach(async ({ page, baseURL }) => {
  expect(baseURL, 'Playwright baseURL must be configured').toBeTruthy();
  await page.setViewportSize({ width: 1440, height: 900 });
  await authenticateWorkbench(page, baseURL!);
});

test('desktop workbench exposes all sidebar destinations without horizontal overflow', async ({
  page,
}) => {
  const response = await page.goto('/en/loops');

  await expectAuthenticatedWorkbench(page, response);
  const desktopSidebar = page.locator('[data-slot="sidebar-container"]');
  await expect(desktopSidebar).toBeVisible();

  for (const [label, href] of [
    ['Home', '/en'],
    ['Issues', '/en/loops'],
    ['Review', '/en/loops#review-inbox'],
    ['Runtime', '/en/loops#agent-runtime'],
    ['New Issue', '/en/loops/new'],
    ['Settings', '/en/settings'],
  ] as const) {
    await expect(desktopSidebar.getByRole('link', { name: label, exact: true })).toHaveAttribute(
      'href',
      href,
    );
  }

  expect(await page.locator('body').evaluate((body) => body.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(await page.locator('html').evaluate((html) => html.scrollWidth <= html.clientWidth)).toBe(
    true,
  );
});

test.describe('default zh-CN locale', () => {
  test.use({ locale: 'zh-CN' });

  test('workbench keeps sidebar destinations unprefixed', async ({ page }) => {
    const response = await page.goto('/loops');

    await expectAuthenticatedWorkbench(page, response);
    const desktopSidebar = page.locator('[data-slot="sidebar-container"]');
    await expect(desktopSidebar).toBeVisible();

    for (const [label, href] of [
      ['首页', '/'],
      ['问题', '/loops'],
      ['审查', '/loops#review-inbox'],
      ['运行时', '/loops#agent-runtime'],
      ['新建问题', '/loops/new'],
      ['设置', '/settings'],
    ] as const) {
      await expect(desktopSidebar.getByRole('link', { name: label, exact: true })).toHaveAttribute(
        'href',
        href,
      );
    }
  });
});

test('mobile sidebar Sheet reaches New Issue', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  const response = await page.goto('/en/loops');

  await expectAuthenticatedWorkbench(page, response);

  await page.getByRole('button', { name: 'Toggle Sidebar' }).first().click();

  const mobileSidebar = page.locator('[data-sidebar="sidebar"][data-mobile="true"]');
  await expect(mobileSidebar).toBeVisible();
  const newIssue = mobileSidebar.getByRole('link', { name: 'New Issue', exact: true });
  await expect(newIssue).toHaveAttribute('href', '/en/loops/new');
  await newIssue.click();
  await expect(page).toHaveURL(/\/en\/loops\/new$/);
});
