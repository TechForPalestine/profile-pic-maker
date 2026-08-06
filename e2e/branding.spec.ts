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
  const image = PNG.sync.read(bytes);
  // Normalise to the 300-unit frame the ring is drawn in, so the check holds
  // whatever devicePixelRatio the browser rasterised at.
  const unit = 150 / (image.width / 2);
  let count = 0;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const dx = (x - image.width / 2) * unit;
      const dy = (y - image.height / 2) * unit;
      const radius = Math.hypot(dx, dy);
      // The photo sits at a 7.5% inset, so the ring spans r 127.5 -> 150.
      if (radius < 126 || radius > 150 || dy < 100 || Math.abs(dx) > 80) {
        continue;
      }
      const { r, g, b, a } = pixelAt(image, x, y);
      if (r > 200 && g > 200 && b > 200 && a > 200) count++;
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

  test('is on by default and rasterises into the downloaded picture', async ({
    page,
  }) => {
    await expect(page.getByRole('checkbox')).toBeChecked();
    expect(labelPixels(await downloadPicture(page))).toBeGreaterThan(50);
  });

  test('leaves the frame untouched when switched off', async ({ page }) => {
    await page.getByRole('checkbox').uncheck();
    await expect(page.getByRole('checkbox')).not.toBeChecked();
    expect(labelPixels(await downloadPicture(page))).toBe(0);
  });
});
