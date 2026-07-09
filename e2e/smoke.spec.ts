import { test, expect } from '@playwright/test';

const testEmail = process.env.E2E_TEST_EMAIL?.trim();
const testPassword = process.env.E2E_TEST_PASSWORD?.trim();
const hasCredentials = Boolean(testEmail && testPassword);

test.describe('Smoke — unauthenticated', () => {
  test('auth page loads', async ({ page }) => {
    await page.goto('/auth');
    await expect(page).toHaveURL(/\/auth/);
    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
  });
});

test.describe('Smoke — authenticated', () => {
  test.skip(!hasCredentials, 'Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run authenticated smoke tests');

  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
    await page.getByLabel(/e-?mail/i).fill(testEmail!);
    await page.getByLabel(/mot de passe|password/i).fill(testPassword!);
    await page.getByRole('button', { name: /connexion|se connecter|log in/i }).click();
    await page.waitForURL(/\/(dashboard|boss)/, { timeout: 30_000 });
  });

  test('dashboard is reachable after login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('inventory products page loads', async ({ page }) => {
    await page.goto('/inventory/products');
    await expect(page).toHaveURL(/\/inventory\/products/);
  });

  test('sales quotations page loads', async ({ page }) => {
    await page.goto('/sales/quotations');
    await expect(page).toHaveURL(/\/sales\/quotations/);
  });
});
