import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  workers: 1,
  retries: 3,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  webServer: [
    {
      command: 'npm run start',
      cwd: './frontend',
      url: 'http://localhost:3000',
      reuseExistingServer: true,
      timeout: 120000,
    },
    {
      command: 'php artisan serve --host=127.0.0.1 --port=8002',
      cwd: './backend',
      url: 'http://127.0.0.1:8002',
      reuseExistingServer: true,
      timeout: 120000,
      env: {
        PHP_CLI_SERVER_WORKERS: '8',
      },
    }
  ],
});
