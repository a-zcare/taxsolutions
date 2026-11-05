import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  workers: 1,
  fullyParallel: false,
  use: { baseURL: 'http://localhost:3000', trace: 'retain-on-failure' },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: process.env.GITHUB_ACTIONS === 'true' ? 'chrome' : undefined,
      },
    },
  ],
  reporter: [['list'], ['html', { open: 'never' }]],
  webServer: process.env.CI
    ? {
        command: 'npm start',
        url: 'http://localhost:3000/api/health',
        reuseExistingServer: false,
        timeout: 60000,
      }
    : undefined,
});
