import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { env } from './fixtures/env';

const authDir = path.resolve(__dirname, '.auth');

export default defineConfig({
  testDir: '.',
  testMatch: ['admin/**/*.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
    ...(process.env.CI ? [['github'] as const] : []),
  ],
  outputDir: 'test-results',
  use: {
    baseURL: env.baseURL,
    locale: 'es-DO',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'no-auth',
      testMatch: ['admin/login.spec.ts'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'super-admin',
      testMatch: ['admin/beaches.spec.ts'],
      use: { ...devices['Desktop Chrome'], storageState: path.join(authDir, 'super-admin.json') },
      dependencies: ['setup'],
    },
    {
      name: 'store-admin',
      testMatch: ['admin/store-admin-access.spec.ts'],
      use: { ...devices['Desktop Chrome'], storageState: path.join(authDir, 'store-admin.json') },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'npx ng serve --port 4210 --host localhost --configuration development',
    url: env.baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
