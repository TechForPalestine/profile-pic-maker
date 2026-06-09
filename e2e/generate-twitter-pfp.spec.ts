import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';

import { pixelAt, solidPng } from './png-utils';

const AVATAR_URL =
  'https://pbs.twimg.com/profile_images/test/tech4palestine_400x400.png';

// A solid, fully-opaque MAGENTA avatar. Using a distinctive known colour lets
// us prove the avatar was actually fetched, rendered, and composited into the
// generated image (rather than just "some PNG came out").
const AVATAR_RGBA: [number, number, number, number] = [255, 0, 255, 255];

const AVATAR_PNG = solidPng(64, 64, AVATAR_RGBA);

test.describe('Generate a profile picture from the tech4palestine X handle', () => {
  test.beforeEach(async ({ page }) => {
    // Keep the Gaza-status banner deterministic / offline.
    await page.route('**/api/gaza-status', (route) =>
      route.fulfill({ json: { summary: 'Test status summary' } }),
    );

    // Mock our own API at the network boundary. The real server-side call to
    // api.fxtwitter.com is covered by the integration + live suites; here we
    // assert the UI sends the right handle/platform and feed back an avatar.
    await page.route('**/api/retrieve-profile-pic**', (route) => {
      const url = new URL(route.request().url());
      expect(url.searchParams.get('username')).toBe('tech4palestine');
      expect(url.searchParams.get('platform')).toBe('twitter');
      return route.fulfill({ json: { profilePicUrl: AVATAR_URL } });
    });

    // The avatar is rendered through next/image; intercept the optimizer so
    // the bytes are served same-origin instead of from the Twitter CDN. This
    // also keeps the canvas untainted so html-to-image can rasterise it.
    await page.route('**/_next/image**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'image/png',
        headers: { 'access-control-allow-origin': '*' },
        body: AVATAR_PNG,
      }),
    );
  });

  test('composites the avatar into the frame and downloads it', async ({
    page,
  }, testInfo) => {
    // handleRetrieveProfilePicture() asks for the username via prompt().
    page.on('dialog', (dialog) => dialog.accept('tech4palestine'));

    await page.goto('/');

    // The four platform buttons share the accessible name "Use … Profile Pic"
    // (icon-only); Twitter is the first, and the API mock above asserts
    // platform=twitter to prove we clicked the right one.
    await page
      .getByRole('button', { name: /Use.*Profile Pic/ })
      .first()
      .click();

    // Once the avatar resolves, the UI swaps to the download/start-over view.
    const downloadButton = page.getByRole('button', { name: /Download Image/ });
    await expect(downloadButton).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      downloadButton.click(),
    ]);

    expect(download.suggestedFilename()).toBe('profile-pic-twitter.png');

    // Persist the real generated image to a stable folder that CI uploads as
    // its own artifact, so it can be opened directly (the Playwright HTML
    // report can't render attachments from a file:// URL). Also attach it to
    // the report for when the report is served properly.
    const outputDir = path.join(process.cwd(), 'playwright-artifacts');
    await mkdir(outputDir, { recursive: true });
    const filePath = path.join(outputDir, 'generated-profile-pic.png');
    await download.saveAs(filePath);
    await testInfo.attach('generated-profile-pic', {
      path: filePath,
      contentType: 'image/png',
    });

    const bytes = await readFile(filePath);

    // It's a real PNG.
    expect(bytes.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const image = PNG.sync.read(bytes);

    // The frame is square (300x300 source) — rasterised square.
    expect(image.width).toBeGreaterThan(0);
    expect(image.width).toBe(image.height);

    // CENTER must be the avatar colour -> the fetched image was composited in.
    const center = pixelAt(image, image.width >> 1, image.height >> 1);
    expect(center.a).toBeGreaterThan(200); // opaque
    expect(center.r).toBeGreaterThan(200);
    expect(center.g).toBeLessThan(80);
    expect(center.b).toBeGreaterThan(200);

    // CORNERS must be transparent -> the circular profile frame was applied.
    const corner = pixelAt(image, 3, 3);
    expect(corner.a).toBeLessThan(60);
  });
});
