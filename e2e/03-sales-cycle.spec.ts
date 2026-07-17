import { test, expect } from '@playwright/test';

test.use({ storageState: '.auth/accountant.json' });

test.describe('Sales Cycle (Quote-to-Cash)', () => {

  test('Create Customer', async ({ page }) => {
    await page.goto('/?m=customers');
    await page.click('button:has-text("New Customer")');
    
    await page.locator('xpath=//label[text()="Name *"]/following-sibling::input').fill('E2E Customer LLC');
    await page.click('button:has-text("Save")');
    // We can just verify we go back to the list
    await expect(page.locator('h2', { hasText: 'Customers' })).toBeVisible({ timeout: 15000 });
  });

  test('Create Quotation', async ({ page }) => {
    await page.goto('/?m=quotations&action=new');
    
    
    await page.click('button[role="combobox"]'); 
    await page.click('div[role="option"]:has-text("E2E Customer LLC")');
    
    const quoteRow = page.locator('table tbody tr').first();
    await quoteRow.locator('td').nth(0).locator('input').fill('E2E Test Quotation Service');
    await quoteRow.locator('td').nth(1).locator('input').fill('1'); // qty
    await quoteRow.locator('td').nth(2).locator('input').fill('10'); // price

    await page.click('button:has-text("Save")');
    
    await expect(page.locator('h2', { hasText: 'Quotation' })).toBeVisible({ timeout: 15000 });
  });

  test('Create and Post Invoice', async ({ page }) => {
    await page.goto('/?m=invoices&action=new');
    
    
    await page.click('button[role="combobox"]');
    await page.click('div[role="option"]:has-text("E2E Customer LLC")');
    
    const invRow = page.locator('table tbody tr').first();
    await invRow.locator('td').nth(0).locator('input').fill('E2E Test Invoice Service');
    await invRow.locator('td').nth(1).locator('input').fill('1');
    await invRow.locator('td').nth(2).locator('input').fill('10');

    await page.click('button:has-text("Save Draft")');
    
    // Wait for the View page to load (it shows DRAFT badge)
    await expect(page.locator('div').filter({ hasText: 'DRAFT' }).first()).toBeVisible({ timeout: 15000 });
    
    await page.waitForTimeout(1000); // Wait for React to attach event listeners
    
    // Now click Post
    await page.getByRole('button', { name: 'Post' }).click();
    
    // Verify status badge
    await expect(page.locator('div').filter({ hasText: 'POSTED' }).first()).toBeVisible({ timeout: 15000 });
  });
});
