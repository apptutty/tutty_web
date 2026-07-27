import { test, expect } from '@playwright/test';
import { qaAccounts } from '../fixtures/env';

/**
 * Admin login smoke tests. Runs unauthenticated (no storageState) so each
 * test starts from a clean session.
 */
test.describe('Admin login', () => {
  test('the login screen loads without critical errors', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Bienvenido de vuelta' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();

    expect(pageErrors, `Unexpected page errors: ${pageErrors.join(', ')}`).toHaveLength(0);
  });

  test('a super_admin can sign in and reach the dashboard', async ({ page }) => {
    const { email, password } = qaAccounts.superAdmin();

    await page.goto('/login');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: /Ingresar al panel/ }).click();

    await page.waitForURL('**/dashboard', { timeout: 20_000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('a store_admin is redirected to the store panel, not the super_admin dashboard', async ({
    page,
  }) => {
    const { email, password } = qaAccounts.storeAdmin();

    await page.goto('/login');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: /Ingresar al panel/ }).click();

    await page.waitForURL('**/store/**', { timeout: 20_000 });
    await expect(page).toHaveURL(/\/store\//);
  });

  test('shows an error message for invalid credentials and does not navigate away', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.locator('#email').fill('not-a-real-qa-user@qa.tutty.do');
    await page.locator('#password').fill('WrongPassword123!');
    await page.getByRole('button', { name: /Ingresar al panel/ }).click();

    await expect(page.getByText('Correo o contraseña incorrectos')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page).toHaveURL(/\/login/);
  });

  test('the submit button is disabled until email and password are valid', async ({ page }) => {
    await page.goto('/login');
    const submit = page.getByRole('button', { name: /Ingresar al panel/ });
    await expect(submit).toBeDisabled();

    await page.locator('#email').fill('someone@qa.tutty.do');
    await page.locator('#password').fill('short');
    // Password requires min length 6 — "short" is 5 chars, so still invalid.
    await page.locator('#password').blur();
    await expect(submit).toBeDisabled();

    await page.locator('#password').fill('longenough');
    await expect(submit).toBeEnabled();
  });
});
