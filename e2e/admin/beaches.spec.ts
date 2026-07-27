import { test, expect } from '@playwright/test';

/**
 * Admin "Beach Delivery" (beaches) management smoke tests. Runs as
 * super_admin (only role allowed on /beaches — see roleGuard(['super_admin'])
 * in app.routes.ts). Reads whatever beaches/points already exist instead of
 * assuming fixed seed data, since no dedicated beach-delivery seed data has
 * been confirmed to exist yet.
 */
test.describe('Admin: Beach Delivery management', () => {
  test('super_admin can open the beaches management screen', async ({ page }) => {
    await page.goto('/beaches');
    await expect(page.getByRole('heading', { name: 'Beach Delivery', level: 1 })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('button', { name: '+ Nueva playa' })).toBeVisible();
  });

  test('lists existing beaches or shows the empty state', async ({ page }) => {
    await page.goto('/beaches');
    await expect(page.getByRole('heading', { name: 'Beach Delivery', level: 1 })).toBeVisible({
      timeout: 15_000,
    });

    const emptyState = page.getByText('Aún no hay playas registradas');
    const table = page.getByRole('table');

    // Either the table (with rows) or the empty-state message must render —
    // whichever is true depends on real, pre-existing data we don't control.
    await expect(emptyState.or(table)).toBeVisible({ timeout: 15_000 });
  });

  test('selecting a beach shows its delivery points panel', async ({ page }) => {
    await page.goto('/beaches');
    await expect(page.getByRole('heading', { name: 'Beach Delivery', level: 1 })).toBeVisible({
      timeout: 15_000,
    });

    const firstRow = page.getByRole('row').nth(1); // nth(0) is the header row
    const hasBeaches = await firstRow.isVisible().catch(() => false);
    test.skip(!hasBeaches, 'No beaches exist yet in this environment — nothing to select.');

    await firstRow.click();
    await expect(page.getByRole('button', { name: '+ Nuevo punto' })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('validation prevents creating a beach without a name', async ({ page }) => {
    await page.goto('/beaches');
    await page.getByRole('button', { name: '+ Nueva playa' }).click();

    await expect(page.getByRole('heading', { name: 'Nueva playa' })).toBeVisible();
    // Leave the name empty and try to save directly.
    await page.getByRole('button', { name: 'Guardar' }).click();

    await expect(page.getByText('El nombre es obligatorio')).toBeVisible({ timeout: 10_000 });
    // The dialog must remain open — the invalid submission was rejected, not silently accepted.
    await expect(page.getByRole('heading', { name: 'Nueva playa' })).toBeVisible();
  });

  test('validation prevents creating a delivery point without coordinates', async ({ page }) => {
    await page.goto('/beaches');
    await expect(page.getByRole('heading', { name: 'Beach Delivery', level: 1 })).toBeVisible({
      timeout: 15_000,
    });

    const firstRow = page.getByRole('row').nth(1);
    const hasBeaches = await firstRow.isVisible().catch(() => false);
    test.skip(!hasBeaches, 'No beaches exist yet in this environment — cannot open a point form.');

    await firstRow.click();
    await page.getByRole('button', { name: '+ Nuevo punto' }).click();
    await expect(page.getByRole('heading', { name: 'Nuevo punto' })).toBeVisible();

    // Clear the lat/lng fields that come pre-filled with a default coordinate,
    // and also clear the name, to exercise the real "missing data" validation
    // in savePoint() (the app does not validate coordinate *ranges*, only
    // presence — so this reproduces the actual guarded behavior, not an
    // invented one).
    await page.getByLabel('Nombre *').fill('');
    await page.getByLabel('Lat *').fill('');
    await page.getByLabel('Lng *').fill('');
    await page.getByRole('button', { name: 'Guardar' }).click();

    await expect(page.getByText('Completa nombre y coordenadas del punto')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole('heading', { name: 'Nuevo punto' })).toBeVisible();
  });
});
