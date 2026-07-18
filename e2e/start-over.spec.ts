import { readFile } from 'node:fs/promises';

import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';

import { pixelAt, solidPng } from './png-utils';

// Regression coverage for issue #35 ("New image [fetched via social] overrides
// the older image"): fetch an avatar, download, Start Over, fetch a *different*
// avatar, download — the second download used to be the *first* avatar.
//
// Root cause: social avatars all render through the next/image optimizer at
// `/_next/image?url=<avatar>&w=...`. html-to-image caches each embedded
// resource, and by default its cache key strips the query string — so every
// optimized avatar collapsed to the single key `/_next/image` and the second
// rasterisation reused the first avatar's cached bytes. `generateImage()` now
// passes `includeQueryParams: true`, keying the cache by the full URL.
//
// Each platform is given a distinct solid colour so the *content* of the
// downloaded PNG proves which avatar was actually composited in — this also
// validates that every social platform still fetches and downloads correctly.
const PLATFORMS = [
  { name: 'twitter', color: [255, 0, 0, 255] }, // red
  { name: 'github', color: [0, 255, 0, 255] }, // green
  { name: 'gitlab', color: [0, 0, 255, 255] }, // blue
  { name: 'bluesky', color: [255, 0, 255, 255] }, // magenta
] as const;

const avatarUrl = (platform: string) =>
  `https://pbs.twimg.com/profile_images/test/${platform}_400x400.png`;

function centerColor(bytes: Buffer) {
  const image = PNG.sync.read(bytes);
  return pixelAt(image, image.width >> 1, image.height >> 1);
}

async function setupRoutes(page: Page) {
  await page.route('**/api/gaza-status', (route) =>
    route.fulfill({ json: { summary: 'Test status summary' } }),
  );

  // Our API returns the avatar URL for the requested platform.
  await page.route('**/api/retrieve-profile-pic**', (route) => {
    const url = new URL(route.request().url());
    const platform = url.searchParams.get('platform') ?? '';
    return route.fulfill({ json: { profilePicUrl: avatarUrl(platform) } });
  });

  const pngFor = (platform: string) => {
    const entry = PLATFORMS.find((p) =>
      avatarUrl(p.name).endsWith(`${platform}_400x400.png`),
    );
    const color = (entry?.color ?? [0, 0, 0, 255]) as [
      number,
      number,
      number,
      number,
    ];
    return {
      status: 200,
      contentType: 'image/png',
      headers: { 'access-control-allow-origin': '*' },
      body: solidPng(64, 64, color),
    } as const;
  };

  // Serve each avatar's bytes same-origin, both through the next/image
  // optimizer (?url=...) and directly, coloured per platform.
  await page.route('**/_next/image**', (route) => {
    const inner = decodeURIComponent(
      new URL(route.request().url()).searchParams.get('url') ?? '',
    );
    const platform = inner.match(/test\/(\w+)_400x400/)?.[1] ?? '';
    return route.fulfill(pngFor(platform));
  });
  for (const { name } of PLATFORMS) {
    await page.route(avatarUrl(name), (route) => route.fulfill(pngFor(name)));
  }
}

async function fetchAvatarForPlatform(page: Page, index: number) {
  // The four "Use … Profile Pic" buttons are icon-only and share an
  // accessible name; they render in PLATFORMS order (twitter, github, …).
  await page
    .getByRole('button', { name: /Use.*Profile Pic/ })
    .nth(index)
    .click();
  await expect(
    page.getByRole('button', { name: /Download Image/ }),
  ).toBeVisible();
}

async function downloadImage(page: Page) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Download Image/ }).click(),
  ]);
  const path = await download.path();
  return {
    filename: download.suggestedFilename(),
    bytes: await readFile(path),
  };
}

test.describe('Start Over', () => {
  test.beforeEach(async ({ page }) => {
    await setupRoutes(page);
    // handleRetrieveProfilePicture() reads the username from a prompt().
    page.on('dialog', (dialog) => dialog.accept('tech4palestine'));
    await page.goto('/');
  });

  test('downloads the freshly fetched avatar after Start Over, per platform (issue #35)', async ({
    page,
  }) => {
    for (let i = 0; i < PLATFORMS.length; i++) {
      const { name, color } = PLATFORMS[i];

      await fetchAvatarForPlatform(page, i);
      const { filename, bytes } = await downloadImage(page);

      // The download is named for, and contains the colour of, the platform we
      // just picked — not a leftover from a previous Start Over cycle.
      expect(filename).toBe(`profile-pic-${name}.png`);
      const center = centerColor(bytes);
      expect(
        [center.r, center.g, center.b, center.a],
        `platform "${name}" should composite its own avatar, not a cached one`,
      ).toEqual(color);

      // Reset for the next platform (skip after the final one).
      if (i < PLATFORMS.length - 1) {
        await page.getByRole('button', { name: /Start Over/ }).click();
        await expect(
          page.getByRole('button', { name: /Upload Image/ }),
        ).toBeVisible();
      }
    }
  });
});
