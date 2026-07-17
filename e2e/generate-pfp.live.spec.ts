import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';

import { distinctColors, pixelAt } from './png-utils';

// LIVE end-to-end — one per supported platform. Drives the full UI against the
// REAL upstreams: our API route calls the provider, and next/image fetches the
// real avatar from the provider's CDN. Tagged @live so the default e2e run skips
// these; they execute in their own required CI step. Playwright retries (CI)
// absorb transient network flakes.
//
// Because the real photos are unknown and mutable, the assertions verify that a
// valid, non-blank, correctly-framed PNG is produced — not exact pixels.
// Accounts match the live integration suite (Tech For Palestine's own where they
// exist; a long-standing GitLab maintainer for GitLab).
const CASES: {
  platform: string;
  username: string;
  // Icon-only "Use … Profile Pic" buttons render in this fixed order.
  buttonIndex: number;
}[] = [
  { platform: 'twitter', username: 'tech4palestine', buttonIndex: 0 },
  { platform: 'github', username: 'TechForPalestine', buttonIndex: 1 },
  { platform: 'gitlab', username: 'stanhu', buttonIndex: 2 },
  { platform: 'bluesky', username: 'techforpalestine.org', buttonIndex: 3 },
];

for (const { platform, username, buttonIndex } of CASES) {
  test.describe(`LIVE: generate the real ${platform} profile picture`, () => {
    test(`produces a valid, non-blank framed PNG @live`, async ({
      page,
    }, testInfo) => {
      // Real network round-trips (our API -> provider -> CDN -> image optimizer
      // -> rasterise) need generous headroom.
      test.setTimeout(90_000);

      // handleRetrieveProfilePicture() asks for the username via prompt().
      page.on('dialog', (dialog) => dialog.accept(username));

      await page.goto('/');

      await page
        .getByRole('button', { name: /Use.*Profile Pic/ })
        .nth(buttonIndex)
        .click();

      // Wait for the real fetch to resolve and the download view to appear.
      const downloadButton = page.getByRole('button', {
        name: /Download Image/,
      });
      await expect(downloadButton).toBeVisible({ timeout: 45_000 });

      const [download] = await Promise.all([
        page.waitForEvent('download'),
        downloadButton.click(),
      ]);

      expect(download.suggestedFilename()).toBe(`profile-pic-${platform}.png`);

      const outputDir = path.join(process.cwd(), 'playwright-artifacts');
      await mkdir(outputDir, { recursive: true });
      const filePath = path.join(
        outputDir,
        `generated-profile-pic-${platform}-live.png`,
      );
      await download.saveAs(filePath);
      await testInfo.attach(`generated-profile-pic-${platform}-live`, {
        path: filePath,
        contentType: 'image/png',
      });

      const bytes = await readFile(filePath);

      // It's a real PNG.
      expect(bytes.subarray(0, 4)).toEqual(
        Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      );

      const image = PNG.sync.read(bytes);

      // Square frame.
      expect(image.width).toBeGreaterThan(0);
      expect(image.width).toBe(image.height);

      // CENTER is opaque -> the real avatar was composited into the frame.
      const center = pixelAt(image, image.width >> 1, image.height >> 1);
      expect(center.a).toBeGreaterThan(200);

      // CORNERS are transparent -> the circular profile frame was applied.
      expect(pixelAt(image, 3, 3).a).toBeLessThan(60);

      // The output is a real image, not a blank/uniform fill.
      expect(distinctColors(image)).toBeGreaterThanOrEqual(8);
    });
  });
}
