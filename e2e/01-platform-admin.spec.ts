import { test, expect } from '@playwright/test';

test.use({ storageState: '.auth/admin.json' });

test.describe('Platform Admin Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/?m=admin-portal');
  });

  test('Dashboard loads platform metrics', async ({ page }) => {
    await expect(page.locator('h2', { hasText: 'Platform Admin Portal' })).toBeVisible({ timeout: 15000 });
    
    // Check that stats cards exist
    await expect(page.getByText('Total Tenants').first()).toBeVisible();
    await expect(page.getByText('Total Users').first()).toBeVisible();
    await expect(page.getByText('MRR').first()).toBeVisible();
    await expect(page.getByText('Active Licenses').first()).toBeVisible();
  });

  test('Global Tenants tab displays all tenants', async ({ page }) => {
    // Navigate to Global Tenants or click the Tenants tab
    await page.click('button:has-text("Tenants")');
    
    // Wait for the table to populate
    await expect(page.locator('table').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('table').first()).toContainText('Tech Solutions', { timeout: 15000 });
  });

  test('Business navigation is hidden', async ({ page }) => {
    // Platform admin should not see "Sales Invoices" in sidebar
    const salesInvoices = page.locator('text=Sales Invoices');
    await expect(salesInvoices).toBeHidden();
  });
});
