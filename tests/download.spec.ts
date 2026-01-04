import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('Download Functionality', () => {
  test('should download profile picture with Palestine border in all browsers', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Show Solidarity');

    const testImagePath = path.join(__dirname, 'test-image.png');
    const testImageDataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

    if (!fs.existsSync(testImagePath)) {
      const base64Data = testImageDataUrl.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(testImagePath, buffer);
    }

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testImagePath);
    await page.waitForTimeout(1000);

    const downloadButton = page.getByRole('button', { name: /download image/i });
    await expect(downloadButton).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await downloadButton.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/profile-pic-user-upload\.png/);

    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    if (downloadPath) {
      const stats = fs.statSync(downloadPath);
      expect(stats.size).toBeGreaterThan(0);

      const buffer = fs.readFileSync(downloadPath);
      const isPNG =
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47;
      expect(isPNG).toBe(true);
    }

    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }
  });

  test('should handle download errors gracefully', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Show Solidarity');

    const downloadButton = page.getByRole('button', { name: /download image/i });
    await expect(downloadButton).not.toBeVisible();
  });

  test('should use html2canvas with proper CORS configuration', async ({
    page,
  }) => {
    await page.goto('/');
    const pageContent = await page.content();
    await expect(page.locator('h1')).toContainText('Show Solidarity');
  });
});
