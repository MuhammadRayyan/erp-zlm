import { test, expect } from '@playwright/test';

test.use({ storageState: '.auth/accountant.json' });

test.describe('Purchases Cycle', () => {

  test('Create Supplier', async ({ page }) => {
    await page.goto('/?m=suppliers');
    await page.click('button:has-text("New Supplier")');
    
    // Some elements might be loaded lazily
    await expect(page.locator('h2', { hasText: 'New Supplier' })).toBeVisible({ timeout: 15000 });

    await page.locator('xpath=//label[text()="Name *"]/following-sibling::input').fill('E2E Supplier General');
    await page.click('button:has-text("Save")');
    await expect(page.locator('h2', { hasText: 'Suppliers' })).toBeVisible({ timeout: 15000 });
  });

  test('Create and Post Purchase Bill', async ({ page }) => {
    await page.goto('/?m=bills&action=new');
    
    // Select supplier
    await page.click('button[role="combobox"]');
    await page.click('div[role="option"]:has-text("E2E Supplier General")');
    
    const billRow = page.locator('table tbody tr').first();
    await billRow.locator('td').nth(0).locator('input').fill('E2E Test Purchase Bill');
    await billRow.locator('td').nth(1).locator('input').fill('1');
    await billRow.locator('td').nth(2).locator('input').fill('100');
    
    // Save as draft
    await page.click('button:has-text("Save Draft")');

    // Wait for the View page to load (it shows DRAFT badge)
    await expect(page.locator('div').filter({ hasText: 'DRAFT' }).first()).toBeVisible({ timeout: 15000 });
    
    await page.waitForTimeout(1000); // Wait for React to attach event listeners
    
    // Now click Post
    await page.getByRole('button', { name: 'Post' }).click();
    
    // Verify status
    await expect(page.locator('div').filter({ hasText: 'POSTED' }).first()).toBeVisible({ timeout: 15000 });
  });

});
