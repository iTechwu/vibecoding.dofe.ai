import { expect, test } from '@playwright/test';

test('Loops route returns a usable application shell', async ({ page }) => {
  const response = await page.goto('/loops');

  expect(response?.status()).toBeLessThan(500);
  await expect(page.locator('body')).not.toBeEmpty();
});
