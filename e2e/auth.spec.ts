import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should redirect to signin page when not authenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*signin/);
  });

  test('should display signin page correctly', async ({ page }) => {
    await page.goto('/auth/signin');

    // Check for main elements
    await expect(page.getByText('TimeSheet Manager')).toBeVisible();
    await expect(page.getByRole('button', { name: /microsoft/i })).toBeVisible();
  });

  test('should display error page when auth fails', async ({ page }) => {
    await page.goto('/auth/error?error=SignInError');

    await expect(page.getByText('Erreur de connexion')).toBeVisible();
    await expect(page.getByRole('link', { name: /retour/i })).toBeVisible();
  });
});

test.describe('Unauthorized Access', () => {
  test('should display unauthorized page', async ({ page }) => {
    await page.goto('/unauthorized');

    await expect(page.getByText('Accès non autorisé')).toBeVisible();
    await expect(page.getByRole('link', { name: /tableau de bord/i })).toBeVisible();
  });
});
