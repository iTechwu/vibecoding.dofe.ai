import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: process.env.E2E_WEB_BASE_URL ?? 'http://127.0.0.1:3003',
    ignoreHTTPSErrors: process.env.E2E_IGNORE_HTTPS_ERRORS === '1',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
