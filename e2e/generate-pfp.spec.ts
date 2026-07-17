import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';

import { pixelAt, solidPng } from './png-utils';

// One deterministic e2e per supported platform. Each drives the full UI flow —
// pick platform -> fetch -> render -> rasterise -> download — but mocks only the
// network boundary (our API + the avatar image) so it's fast and offline. The
// real server-side upstream calls are covered by the integration + live suites.
//
// Each platform uses a DISTINCT solid avatar colour so the pixel assertions
// prove the fetched image for *that* platform was composited into the frame.
const CASES: {
  platform: string;
  username: string;
  // The platform buttons are icon-only and share the accessible name
  // "Use … Profile Pic"; they render in this fixed order.
  buttonIndex: number;
  avatarUrl: string;
  rgba: [number, number, number, number];
}[] = [
  {
    platform: 'twitter',
    username: 'tech4palestine',
    buttonIndex: 0,
    avatarUrl:
      'https://pbs.twimg.com/profile_images/test/tech4palestine_400x400.png',
    rgba: [255, 0, 255, 255], // magenta
  },
  {
    platform: 'github',
    username: 'TechForPalestine',
    buttonIndex: 1,
    avatarUrl: 'https://avatars.githubusercontent.com/u/151086389?v=4',
    rgba: [0, 255, 0, 255], // green
  },
  {
    platform: 'gitlab',
    username: 'stanhu',
    buttonIndex: 2,
    avatarUrl:
      'https://gitlab.com/uploads/-/system/user/avatar/64248/stanhu.jpg',
    rgba: [255, 128, 0, 255], // orange
  },
  {
    platform: 'bluesky',
    username: 'techforpalestine.org',
    buttonIndex: 3,
    avatarUrl:
      'https://cdn.bsky.app/img/avatar/plain/did:plc:test/bafkreitest@jpeg',
    rgba: [0, 128, 255, 255], // blue
  },
];

for (const { platform, username, buttonIndex, avatarUrl, rgba } of CASES) {
  test.describe(`Generate a profile picture from a ${platform} account`, () => {
    test.beforeEach(async ({ page }) => {
      // Keep the Gaza-status banner deterministic / offline.
      await page.route('**/api/gaza-status', (route) =>
        route.fulfill({ json: { summary: 'Test status summary' } }),
      );

      // Mock our own API at the network boundary and assert the UI sends the
      // right handle/platform.
      await page.route('**/api/retrieve-profile-pic**', (route) => {
        const url = new URL(route.request().url());
        expect(url.searchParams.get('username')).toBe(username);
        expect(url.searchParams.get('platform')).toBe(platform);
        return route.fulfill({ json: { profilePicUrl: avatarUrl } });
      });

      // The avatar may be rendered through next/image's optimizer or loaded
      // directly from the CDN. Mock both so the bytes are served same-origin
      // (keeps the canvas untainted so html-to-image can rasterise it).
      const avatarResponse = {
        status: 200,
        contentType: 'image/png',
        headers: { 'access-control-allow-origin': '*' },
        body: solidPng(64, 64, rgba),
      } as const;

      await page.route('**/_next/image**', (route) =>
        route.fulfill(avatarResponse),
      );
      await page.route(avatarUrl, (route) => route.fulfill(avatarResponse));
    });

    test('composites the avatar into the frame and downloads it', async ({
      page,
    }, testInfo) => {
      // handleRetrieveProfilePicture() asks for the username via prompt().
      page.on('dialog', (dialog) => dialog.accept(username));

      await page.goto('/');

      await page
        .getByRole('button', { name: /Use.*Profile Pic/ })
        .nth(buttonIndex)
        .click();

      // Once the avatar resolves, the UI swaps to the download/start-over view.
      const downloadButton = page.getByRole('button', {
        name: /Download Image/,
      });
      await expect(downloadButton).toBeVisible();

      const [download] = await Promise.all([
        page.waitForEvent('download'),
        downloadButton.click(),
      ]);

      expect(download.suggestedFilename()).toBe(`profile-pic-${platform}.png`);

      // Persist the generated image to a stable folder CI uploads as an
      // artifact, and attach it to the Playwright report.
      const outputDir = path.join(process.cwd(), 'playwright-artifacts');
      await mkdir(outputDir, { recursive: true });
      const filePath = path.join(
        outputDir,
        `generated-profile-pic-${platform}.png`,
      );
      await download.saveAs(filePath);
      await testInfo.attach(`generated-profile-pic-${platform}`, {
        path: filePath,
        contentType: 'image/png',
      });

      const bytes = await readFile(filePath);

      // It's a real PNG.
      expect(bytes.subarray(0, 4)).toEqual(
        Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      );

      const image = PNG.sync.read(bytes);

      // The frame is square (300x300 source) — rasterised square.
      expect(image.width).toBeGreaterThan(0);
      expect(image.width).toBe(image.height);

      // CENTER must be the avatar colour -> the fetched image was composited in.
      const [r, g, b] = rgba;
      const center = pixelAt(image, image.width >> 1, image.height >> 1);
      expect(center.a).toBeGreaterThan(200); // opaque
      expect(Math.abs(center.r - r)).toBeLessThan(60);
      expect(Math.abs(center.g - g)).toBeLessThan(60);
      expect(Math.abs(center.b - b)).toBeLessThan(60);

      // CORNERS must be transparent -> the circular profile frame was applied.
      const corner = pixelAt(image, 3, 3);
      expect(corner.a).toBeLessThan(60);
    });
  });
}
