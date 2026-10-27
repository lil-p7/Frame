import { test, expect } from '@playwright/test';

test('critical journey: dashboard → create project → edit → preview → export', async ({ page }) => {
  // 1. Open dashboard
  await page.goto('http://localhost:4321/');

  // Wait for page to load
  await expect(page).toHaveTitle(/Frame/);

  // 2. Create a project
  await page.click('button:has-text("Create your first project")');

  // Fill in project name
  const nameInput = page.locator('input[placeholder="Portfolio Website"]');
  await expect(nameInput).toBeVisible();
  await nameInput.fill('Test Portfolio');

  // Submit project creation
  await page.click('button:has-text("Create project")');

  // Wait for editor to load - check for Undo button
  await expect(page.locator('text=Undo')).toBeVisible({ timeout: 10000 });

  // 3. Insert a section from component library
  await page.click('text=Components');

  // Find and click Section item by aria-label
  const libraryItems = page.locator('button[role="button"]');
  const itemCount = await libraryItems.count();

  for (let i = 0; i < itemCount; i++) {
    const label = await libraryItems.nth(i).getAttribute('aria-label');
    if (label && label.includes('Section')) {
      await libraryItems.nth(i).click();
      break;
    }
  }

  // 4. Insert a heading item
  for (let i = 0; i < itemCount; i++) {
    const label = await libraryItems.nth(i).getAttribute('aria-label');
    if (label && label.includes('Heading')) {
      await libraryItems.nth(i).click();
      break;
    }
  }

  // 5. Change heading text - use specific selector
  await page.evaluate(() => {
    const heading = document.querySelector('h2[data-component="heading"]');
    if (heading) {
      heading.textContent = 'My Portfolio';
    }
  });

  // 6. Add a button
  await page.click('text=Button');

  // 7. Undo and redo
  await page.click('text=Undo');
  await expect(page.locator('h2[data-component="heading"]')).toBeVisible();
  await page.click('text=Redo');
  await expect(page.locator('text=Button')).toBeVisible();

  // 8. Switch to Tablet preview
  await page.click('text=Tablet');

  // 9. Save and reload
  await page.click('text=Save');
  await expect(page.locator('text=Saved')).toBeVisible({ timeout: 10000 });

  await page.reload();
  await expect(page).toHaveURL(/http:\/\/localhost:4321\/editor\//);

  // 10. Verify design intact
  await expect(page.locator('h2[data-component="heading"]')).toContainText('My Portfolio');

  // 11. Export project
  await page.click('text=Export');

  // 12. Verify download
  await expect(page.locator('text=Download')).toBeVisible();
  await page.click('text=Download');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('text=Download'),
  ]);
  await download.saveAs('/tmp/frame-export.zip');

  console.log('Critical journey test completed');
});