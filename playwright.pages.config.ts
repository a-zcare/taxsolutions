import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/pages-e2e',
  outputDir: '.pages-build/browser-results',
  workers: 1,
  use: {
    baseURL: process.env.PAGES_TEST_URL ?? 'http://127.0.0.1:8087',
    trace: 'retain-on-failure',
    channel: process.env.GITHUB_ACTIONS === 'true' ? 'chrome' : undefined,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  reporter: [['list']],
  webServer: process.env.PAGES_TEST_URL
    ? undefined
    : {
        command: 'node scripts/serve-pages.mjs',
        url: 'http://127.0.0.1:8087/taxsolutions/lv/',
        reuseExistingServer: false,
        timeout: 30000,
      },
});
