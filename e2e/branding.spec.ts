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

// How many pixels differ between two downloads, inside the photo's circle
// (r < 120) or on the flag ring around it (r 130 -> 148).
function changedPixels(a: Buffer, b: Buffer, where: 'photo' | 'ring'): number {
  const before = PNG.sync.read(a);
  return countPixels(
    b,
    (dx, dy, radius) =>
      where === 'photo' ? radius < 120 : radius > 130 && radius < 148,
    (r, g, bl, x, y) => {
      const p = pixelAt(before, x, y);
      return Math.abs(p.r - r) + Math.abs(p.g - g) + Math.abs(p.b - bl) > 60;
    },
  );
}

function countPixels(
  bytes: Buffer,
  inRegion: (dx: number, dy: number, radius: number) => boolean,
  matches: (r: number, g: number, b: number, x: number, y: number) => boolean,
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
      if (a > 200 && matches(r, g, b, x, y)) count++;
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

  test('lets the photo be zoomed and moved, keeping the ring even', async ({
    page,
  }) => {
    await page.goto('/?b=members');
    await page.setInputFiles('#fileInput', PHOTO);
    // Tag off, so only the photo and the flag are in the picture.
    await page.getByRole('checkbox', { name: /name tag/ }).uncheck();
    const before = await downloadPicture(page);

    await page.getByRole('slider', { name: 'Zoom' }).fill('0.6');
    const zoomed = await downloadPicture(page);
    expect(changedPixels(before, zoomed, 'photo')).toBeGreaterThan(1000);
    expect(changedPixels(before, zoomed, 'ring')).toBe(0);

    const photo = page.locator('#userImage').locator('..');
    // Downloading scrolled the page down to the buttons.
    await photo.scrollIntoViewIfNeeded();
    const box = (await photo.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 40, {
      steps: 5,
    });
    await page.mouse.up();
    const moved = await downloadPicture(page);
    expect(changedPixels(zoomed, moved, 'photo')).toBeGreaterThan(1000);
    expect(changedPixels(zoomed, moved, 'ring')).toBe(0);
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
      await expect(page.getByRole('slider', { name: 'Zoom' })).toHaveCount(0);
    }
  });
});
