import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';

import { pixelAt } from './png-utils';

// The short URL baked into the ring is the whole point of the toggle: it has to
// survive the rasterisation, not just look right on screen. These tests upload a
// local photo (no network needed beyond the status banner), download with the
// option on and off, and read the pixels back out of both PNGs.

const PHOTO = path.join(process.cwd(), 'public', 'user.jpg');

// The label is white, drawn inside the flag ring at the bottom of the circle.
// The sampled wedge (bottom 80 units of the ring, centred on 6 o'clock) is
// solid green on the flag, so any near-white pixel there is the label.
function labelPixels(bytes: Buffer): number {
  return countPixels(
    bytes,
    (dx, dy, radius) =>
      // The photo sits at a 7.5% inset, so the ring spans r 127.5 -> 150.
      radius >= 126 && radius <= 150 && dy >= 100 && Math.abs(dx) <= 80,
    (r, g, b) => r > 200 && g > 200 && b > 200,
  );
}

// The name tag's red sticker sits over the bottom of the photo, inside the
// ring. The placeholder photo has no red, so red pixels there are the sticker.
function stickerPixels(bytes: Buffer): number {
  return countPixels(
    bytes,
    (dx, dy, radius) => radius < 120 && dy > 50 && Math.abs(dx) < 70,
    (r, g, b) => r > 170 && g < 70 && b < 80,
  );
}

// Below the photo, at 6 o'clock just inside the ring: covered by the photo at
// full size, and the flag's green stripe once the photo is shrunk.
function flagPixelsBelowPhoto(bytes: Buffer): number {
  return countPixels(
    bytes,
    (dx, dy) => dy >= 90 && dy <= 115 && Math.abs(dx) <= 20,
    (r, g, b) => g > 100 && r < 60 && b < 90,
  );
}

function countPixels(
  bytes: Buffer,
  inRegion: (dx: number, dy: number, radius: number) => boolean,
  matches: (r: number, g: number, b: number) => boolean,
): number {
  const image = PNG.sync.read(bytes);
  // Normalise to the 300-unit frame the overlays are drawn in, so the check
  // holds whatever devicePixelRatio the browser rasterised at.
  const unit = 150 / (image.width / 2);
  let count = 0;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const dx = (x - image.width / 2) * unit;
      const dy = (y - image.height / 2) * unit;
      if (!inRegion(dx, dy, Math.hypot(dx, dy))) continue;
      const { r, g, b, a } = pixelAt(image, x, y);
      if (a > 200 && matches(r, g, b)) count++;
    }
  }
  return count;
}

async function downloadPicture(page: Page): Promise<Buffer> {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Download Image/ }).click(),
  ]);
  return readFile(await download.path());
}

test.describe('Short URL on the frame', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/gaza-status', (route) =>
      route.fulfill({ json: { summary: 'Test status summary' } }),
    );
    await page.goto('/');
    await page.setInputFiles('#fileInput', PHOTO);
    await expect(
      page.getByRole('button', { name: /Download Image/ }),
    ).toBeVisible();
  });

  test('rasterises into the downloaded picture once switched on', async ({
    page,
  }) => {
    await page.getByRole('checkbox', { name: /ppm\.t4p\.al/ }).check();
    expect(labelPixels(await downloadPicture(page))).toBeGreaterThan(50);
  });

  test('is off by default, leaving the frame untouched', async ({ page }) => {
    await expect(
      page.getByRole('checkbox', { name: /ppm\.t4p\.al/ }),
    ).not.toBeChecked();
    expect(labelPixels(await downloadPicture(page))).toBe(0);
  });
});

test.describe('Co-brand link', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/gaza-status', (route) =>
      route.fulfill({ json: { summary: 'Test status summary' } }),
    );
    // Which code unlocks which brand is a server secret; the page only needs
    // the answer.
    await page.route('**/api/brand?code=*', (route) =>
      new URL(route.request().url()).searchParams.get('code') === 'members'
        ? route.fulfill({
            json: { brand: 't4p-member', text: { link: 'join at t4p.al/e2e' } },
          })
        : route.fulfill({ status: 404 }),
    );
  });

  test('turns the name tag on by default and replaces the short URL', async ({
    page,
  }) => {
    await page.goto('/?b=members');
    await page.setInputFiles('#fileInput', PHOTO);
    await expect(
      page.getByRole('checkbox', { name: /name tag/ }),
    ).toBeChecked();
    // Text from the secret overrides the brand's default.
    await expect(page.locator('textPath').first()).toHaveText(
      'join at t4p.al/e2e',
    );
    await expect(
      page.getByRole('checkbox', { name: /ppm\.t4p\.al/ }),
    ).toHaveCount(0);
    const png = await downloadPicture(page);
    expect(stickerPixels(png)).toBeGreaterThan(500);
    expect(labelPixels(png)).toBeGreaterThan(50);
  });

  test('can be switched off', async ({ page }) => {
    await page.goto('/?b=members');
    await page.setInputFiles('#fileInput', PHOTO);
    await page.getByRole('checkbox', { name: /name tag/ }).uncheck();
    expect(stickerPixels(await downloadPicture(page))).toBe(0);
  });

  test('offers a photo size slider that shrinks the photo upwards', async ({
    page,
  }) => {
    await page.goto('/?b=members');
    await page.setInputFiles('#fileInput', PHOTO);
    // Tag off, so the sampled spot shows only the photo or the flag.
    await page.getByRole('checkbox', { name: /name tag/ }).uncheck();
    expect(flagPixelsBelowPhoto(await downloadPicture(page))).toBe(0);
    await page.getByRole('slider', { name: 'Photo size' }).fill('0.6');
    expect(flagPixelsBelowPhoto(await downloadPicture(page))).toBeGreaterThan(
      200,
    );
  });

  test('is not offered without a valid link', async ({ page }) => {
    for (const url of ['/', '/?b=nope']) {
      await page.goto(url);
      await page.setInputFiles('#fileInput', PHOTO);
      await expect(
        page.getByRole('checkbox', { name: /ppm\.t4p\.al/ }),
      ).toBeVisible();
      await expect(
        page.getByRole('checkbox', { name: /name tag/ }),
      ).toHaveCount(0);
      await expect(
        page.getByRole('slider', { name: 'Photo size' }),
      ).toHaveCount(0);
    }
  });
});
