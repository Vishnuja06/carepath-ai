import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  expect: {
    // Generous: first query may trigger a SQL-warehouse cold start.
    timeout: 45_000,
  },
  use: {
    baseURL: `http://localhost:${process.env.DATABRICKS_APP_PORT || process.env.PORT || 8000}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // Use the production build (single node process) rather than `tsx watch`,
    // which starts deterministically under Playwright's process management.
    command: 'npm run build && npm start',
    url: `http://localhost:${process.env.DATABRICKS_APP_PORT || process.env.PORT || 8000}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180 * 1000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
