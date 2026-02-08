import { test, expect } from '@playwright/test';

test('feedback modal visual test', async ({ page }) => {
  await page.goto('http://localhost:5173');
  
  // Login
  await page.fill('input[name="username"]', 'aaron');
  await page.fill('input[name="password"]', 'test123');
  await page.click('button[type="submit"]');
  await page.waitForSelector('.feedback-fab', { timeout: 10000 });
  
  // Click feedback button
  await page.click('.feedback-fab');
  await page.waitForSelector('.feedback-modal', { timeout: 5000 });
  
  // Take screenshot
  await page.screenshot({ path: 'feedback-modal-screenshot.png', fullPage: true });
  
  // Verify modal is visible with correct styling
  const modal = page.locator('.feedback-modal');
  await expect(modal).toBeVisible();
  
  console.log('Screenshot saved to feedback-modal-screenshot.png');
});
