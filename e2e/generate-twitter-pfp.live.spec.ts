import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';

import { distinctColors, pixelAt } from './png-utils';

// LIVE end-to-end — drives the full UI against the REAL upstreams: our API
// route calls api.fxtwitter.com, and next/image fetches the real avatar from
// the Twitter CDN. Tagged @live so the default e2e run skips it; it executes
// in its own `e2e-live` CI job. Playwright retries (CI) absorb transient
// network flakes so this required job stays stable.
//
// Because the real photo is unknown and mutable, the assertions verify that a
// valid, non-blank, correctly-framed PNG is produced — not exact pixels.
test.describe('LIVE: generate the real tech4palestine profile picture', () => {
  test('produces a valid, non-blank framed PNG @live', async ({
    page,
  }, testInfo) => {
    // Real network round-trips (our API -> fxtwitter -> Twitter CDN -> image
    // optimizer -> rasterise) need generous headroom.
    test.setTimeout(90_000);

    // handleRetrieveProfilePicture() asks for the username via prompt().
    page.on('dialog', (dialog) => dialog.accept('tech4palestine'));

    await page.goto('/');

    // Twitter is the first of the icon-only "Use … Profile Pic" buttons.
    await page
      .getByRole('button', { name: /Use.*Profile Pic/ })
      .first()
      .click();

    // Wait for the real fetch to resolve and the download view to appear.
    const downloadButton = page.getByRole('button', { name: /Download Image/ });
    await expect(downloadButton).toBeVisible({ timeout: 45_000 });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      downloadButton.click(),
    ]);

    expect(download.suggestedFilename()).toBe('profile-pic-twitter.png');

    const outputDir = path.join(process.cwd(), 'playwright-artifacts');
    await mkdir(outputDir, { recursive: true });
    const filePath = path.join(outputDir, 'generated-profile-pic-live.png');
    await download.saveAs(filePath);
    await testInfo.attach('generated-profile-pic-live', {
      path: filePath,
      contentType: 'image/png',
    });

    const bytes = await readFile(filePath);

    // It's a real PNG.
    expect(bytes.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const image = PNG.sync.read(bytes);

    // Square frame.
    expect(image.width).toBeGreaterThan(0);
    expect(image.width).toBe(image.height);

    // CENTER is opaque -> the real avatar was composited into the frame.
    const center = pixelAt(image, image.width >> 1, image.height >> 1);
    expect(center.a).toBeGreaterThan(200);

    // CORNERS are transparent -> the circular profile frame was applied.
    expect(pixelAt(image, 3, 3).a).toBeLessThan(60);

    // The output is a real photo, not a blank/uniform fill.
    expect(distinctColors(image)).toBeGreaterThanOrEqual(8);
  });
});
