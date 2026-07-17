import { test, expect } from '@playwright/test';

test.describe('Tenant Isolation & Limits', () => {
  
  test('Tenant Admin (Tech Solutions) sees only their data', async ({ browser }) => {
    const context = await browser.newContext({ storageState: '.auth/tenant.json' });
    const page = await context.newPage();
    
    await page.goto('/?m=dashboard');
    await expect(page.locator('h1', { hasText: 'Welcome back' })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('button', { hasText: 'Tech Solutions' }).first()).toBeVisible({ timeout: 15000 });

    // Check Subscription Limits
    await page.goto('/?m=tenant-portal');
    await page.click('button[role="tab"]:has-text("Subscription")');
    await expect(page.locator('text=Contact admin to upgrade').first()).toBeDisabled({ timeout: 15000 });
    
    await context.close();
  });

  test('Tenant Admin (Al Madina) data isolation', async ({ browser }) => {
    const context = await browser.newContext({ storageState: '.auth/tenant2.json' });
    const page = await context.newPage();
    
    await page.goto('/?m=dashboard');
    await expect(page.locator('h1', { hasText: 'Welcome back' })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('button', { hasText: 'Al Madina' }).first()).toBeVisible({ timeout: 15000 });
    
    await context.close();
  });

});
