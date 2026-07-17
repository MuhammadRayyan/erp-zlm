import { test, expect } from '@playwright/test';

test.use({ storageState: '.auth/accountant.json' });

test.describe('Refunds & Credit Notes', () => {

  test('Create and Post Credit Note', async ({ page }) => {
    await page.goto('/?m=credit-notes&action=new');
    
    // Select Customer
    await page.click('button[role="combobox"]');
    await page.click('div[role="option"]:has-text("E2E Customer LLC")');
    
    const creditRow = page.locator('table tbody tr').first();
    await creditRow.locator('td').nth(0).locator('input').fill('E2E Test Credit Note');
    await creditRow.locator('td').nth(1).locator('input').fill('1');
    await creditRow.locator('td').nth(2).locator('input').fill('50');

    // Save as draft
    await page.click('button:has-text("Save Draft")');
    
    // Wait for the View page to load
    await expect(page.locator('div').filter({ hasText: 'DRAFT' }).first()).toBeVisible({ timeout: 15000 });
    
    await page.waitForTimeout(1000); // Wait for React to attach event listeners

    // Post it
    await page.getByRole('button', { name: 'Post' }).click();
    
    // Verify status
    await expect(page.locator('h2', { hasText: 'Credit Note' }).first()).toBeVisible({ timeout: 15000 });
  });

});
