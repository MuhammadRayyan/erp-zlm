import { test, expect } from '@playwright/test';

test.use({ storageState: '.auth/accountant.json' });

test.describe('Accounting & Reports', () => {

  test('Generate Profit & Loss Report', async ({ page }) => {
    await page.goto('/?m=reports');
    
    await page.locator('button', { hasText: 'Profit & Loss' }).click();
    
    await expect(page.locator('text=Total Income').first()).toBeVisible({ timeout: 15000 });
  });

  test('View Chart of Accounts', async ({ page }) => {
    await page.goto('/?m=accounts');
    await expect(page.locator('h2', { hasText: 'Chart of Accounts' })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Assets').first()).toBeVisible({ timeout: 15000 });
  });

});
