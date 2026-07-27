import { test, expect } from '@playwright/test';

/**
 * Role-based access control smoke test: a store_admin session must never
 * reach super_admin-only screens like /beaches. `operatorGuard` redirects
 * store_admin to /store before the per-route roleGuard(['super_admin'])
 * even runs (see core/auth/operator.guard.ts).
 */
test.describe('Admin: store_admin access control', () => {
  test('store_admin is redirected away from /beaches (super_admin only)', async ({ page }) => {
    await page.goto('/beaches');
    await page.waitForURL('**/store/**', { timeout: 15_000 });
    await expect(page).toHaveURL(/\/store\//);
    await expect(page).not.toHaveURL(/\/beaches/);
  });
});
