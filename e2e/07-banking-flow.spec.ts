import { test, expect } from '@playwright/test';

test.use({ storageState: '.auth/accountant.json' });

test.describe('Banking Flow', () => {

  test('Create Bank Account', async ({ page }) => {
    await page.goto('/?m=banking');
    
    
    await page.click('button:has-text("New Account")');
    await expect(page.locator('h2', { hasText: 'New Bank Account' })).toBeVisible({ timeout: 15000 });
    
    await page.locator('xpath=//label[text()="Account Name *"]/following-sibling::input').fill('E2E Test Bank');
    await page.locator('xpath=//label[text()="Account Number"]/following-sibling::input').fill('123456789');
    await page.locator('xpath=//label[text()="Opening Balance"]/following-sibling::input').fill('10000');
    
    await page.click('button:has-text("Save")');
    await expect(page.locator('h2', { hasText: 'Bank Accounts' })).toBeVisible({ timeout: 15000 });
  });

  test('Create Manual Bank Payment (Expense)', async ({ page }) => {
    await page.goto('/?m=payments&action=new');
    
    
    // Select Type: PAYMENT
    await page.click('button:has-text("Receipt (from Customer)")'); // Open Select
    await page.click('div[role="option"]:has-text("Payment (to Supplier)")');

    // Select Party (Supplier)
    const partySelect = page.locator('button:has-text("Select")').first();
    if (await partySelect.isVisible()) {
      await partySelect.click();
      await page.click('div[role="option"]:has-text("E2E Supplier General")');
    }

    // Amount
    await page.locator('xpath=//label[text()="Amount *"]/following-sibling::input').fill('150');

    // Record Payment
    await page.click('button:has-text("Record Payment")');
    
    
    await expect(page.locator('h2', { hasText: 'Payments' })).toBeVisible({ timeout: 15000 });
  });

});
