import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  timeout: 120_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  retries: isCI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4200',
    headless: true,
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: '.\\.venv\\Scripts\\python manage.py runserver 0.0.0.0:8000',
      cwd: '../backend',
      port: 8000,
      reuseExistingServer: !isCI,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 120_000,
    },
    {
      command: 'npm run start -- --host 0.0.0.0 --port 4200',
      cwd: '.',
      port: 4200,
      reuseExistingServer: !isCI,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
