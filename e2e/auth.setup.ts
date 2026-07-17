import { test as setup, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const authDir = path.join(__dirname, '../.auth');
if (!fs.existsSync(authDir)) fs.mkdirSync(authDir);

const users = [
  { role: 'admin', email: 'admin@accounterp.com', password: 'Admin@123456' },
  { role: 'tenant', email: 'owner@techsolutions.ae', password: 'Owner@123456' },
  { role: 'accountant', email: 'accountant@techsolutions.ae', password: 'Account@123' },
  { role: 'viewer', email: 'viewer@techsolutions.ae', password: 'Viewer@123' },
  { role: 'tenant2', email: 'owner@almadina.ae', password: 'Madina@123' } // Secondary tenant
];

for (const user of users) {
  setup(`authenticate as ${user.role}`, async ({ page }) => {
    await page.goto('/');
    
    // Wait for the login form to appear
    await page.waitForSelector('input[type="email"]', { timeout: 15000 });
    
    // Fill the login form
    await page.fill('input[type="email"]', user.email);
    await page.fill('input[type="password"]', user.password);
    
    // Submit and wait for API
    const responsePromise = page.waitForResponse('**/api/auth/login');
    await page.click('button[type="submit"]');
    const response = await responsePromise;
    console.log(`Login status for ${user.role}: ${response.status()} ${await response.text()}`);
    
    // Wait for AppShell to load (Logout button is only visible after successful login)
    await expect(page.locator('button:has-text("Logout")').first()).toBeVisible({ timeout: 15000 });

    // Save storage state to a unique file per role
    await page.context().storageState({ path: path.join(authDir, `${user.role}.json`) });
  });
}
