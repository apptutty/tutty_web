import { test as setup, expect } from '@playwright/test';
import path from 'node:path';
import { qaAccounts } from '../fixtures/env';

/**
 * Playwright "setup" project: logs in once per role via the real UI (not a
 * mocked API) and persists the authenticated browser storage state
 * (Supabase session lives in localStorage) so admin spec files can reuse it
 * via `dependencies: ['setup']` + a project-level `storageState`, instead of
 * re-logging-in via the UI in every test.
 */

const authDir = path.resolve(__dirname, '../.auth');

async function loginAs(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /Ingresar al panel/ }).click();
}

setup('authenticate as super_admin', async ({ page }) => {
  const { email, password } = qaAccounts.superAdmin();
  await loginAs(page, email, password);
  await page.waitForURL('**/dashboard', { timeout: 20_000 });
  await expect(page.locator('body')).toBeVisible();
  await page.context().storageState({ path: path.join(authDir, 'super-admin.json') });
});

setup('authenticate as store_admin', async ({ page }) => {
  const { email, password } = qaAccounts.storeAdmin();
  await loginAs(page, email, password);
  await page.waitForURL('**/store/**', { timeout: 20_000 });
  await expect(page.locator('body')).toBeVisible();
  await page.context().storageState({ path: path.join(authDir, 'store-admin.json') });
});
