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

async function mockWorkspaceSelection(page: Page): Promise<void> {
  await page.route('**/loops/workspaces', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      json: {
        code: 200,
        data: {
          current: 'api',
          workspaces: [
            {
              workspaceId: 'web',
              root: '/code/storefront',
              status: 'READY',
              isDefault: true,
              selected: { codex: 'local-cli', 'claude-code': 'local-cli' },
            },
            {
              workspaceId: 'api',
              root: '/code/api-service',
              status: 'READY',
              isDefault: false,
              selected: { codex: 'local-cli', 'claude-code': 'local-cli' },
            },
          ],
        },
      },
    });
  });
}

test.beforeEach(async ({ page, baseURL }) => {
  expect(baseURL, 'Playwright baseURL must be configured').toBeTruthy();
  await page.setViewportSize({ width: 1440, height: 900 });
  await authenticateWorkbench(page, baseURL!);
});

test('desktop workbench exposes core destinations and the More menu without horizontal overflow', async ({
  page,
}) => {
  await mockWorkspaceSelection(page);
  const response = await page.goto('/en/loops');

  await expectAuthenticatedWorkbench(page, response);
  const desktopSidebar = page.locator('[data-slot="sidebar-container"]');
  await expect(desktopSidebar).toBeVisible();

  for (const [label, href] of [
    ['Home', '/en'],
    ['Scheduled', '/en/loops?view=scheduled&workspace=api'],
    ['Search', '/en/loops?view=scheduled&workspace=api#scheduled-search'],
    ['New work', '/en/loops?workspace=api#loops-conversation-composer'],
  ] as const) {
    await expect(desktopSidebar.getByRole('link', { name: label, exact: true })).toHaveAttribute(
      'href',
      href,
    );
  }

  await desktopSidebar.getByRole('button', { name: 'More', exact: true }).click();
  for (const [label, href] of [
    ['Review', '/en/loops?view=operations#review-inbox'],
    ['Runtime', '/en/loops?view=operations#agent-runtime'],
    ['Dashboard', '/en/loops?view=operations'],
    ['Settings', '/en/settings'],
  ] as const) {
    await expect(page.getByRole('menuitem', { name: label, exact: true })).toHaveAttribute(
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
    await mockWorkspaceSelection(page);
    const response = await page.goto('/loops');

    await expectAuthenticatedWorkbench(page, response);
    const desktopSidebar = page.locator('[data-slot="sidebar-container"]');
    await expect(desktopSidebar).toBeVisible();

    for (const [label, href] of [
      ['首页', '/'],
      ['已安排', '/loops?view=scheduled&workspace=api'],
      ['搜索', '/loops?view=scheduled&workspace=api#scheduled-search'],
      ['新建任务', '/loops?workspace=api#loops-conversation-composer'],
    ] as const) {
      await expect(desktopSidebar.getByRole('link', { name: label, exact: true })).toHaveAttribute(
        'href',
        href,
      );
    }
  });
});

test('mobile sidebar Sheet reaches Scheduled work', async ({ page }) => {
  await mockWorkspaceSelection(page);
  await page.setViewportSize({ width: 320, height: 800 });
  const response = await page.goto('/en/loops');

  await expectAuthenticatedWorkbench(page, response);

  await page.getByRole('button', { name: 'Toggle Sidebar' }).first().click();

  const mobileSidebar = page.locator('[data-sidebar="sidebar"][data-mobile="true"]');
  await expect(mobileSidebar).toBeVisible();
  const scheduled = mobileSidebar.getByRole('link', { name: 'Scheduled', exact: true });
  await expect(scheduled).toHaveAttribute('href', '/en/loops?view=scheduled&workspace=api');
  await scheduled.click();
  await expect(page).toHaveURL(/\/en\/loops\?view=scheduled&workspace=api$/);
  await expect(page.getByRole('heading', { name: 'Scheduled' })).toBeVisible();
});
