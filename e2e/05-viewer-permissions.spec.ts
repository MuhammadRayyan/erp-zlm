import { test, expect } from '@playwright/test';

test.use({ storageState: '.auth/viewer.json' });

test.describe('Viewer Permissions', () => {

  test('Cannot create invoices', async ({ page }) => {
    await page.goto('/?m=invoices');
    
    // The "New Invoice" button should not exist
    const newButton = page.locator('button:has-text("New Invoice")');
    await expect(newButton).toBeHidden({ timeout: 15000 });
  });

  test('Can view dashboard', async ({ page }) => {
    await page.goto('/?m=dashboard');
    // Just verify something loads
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15000 });
  });

});
