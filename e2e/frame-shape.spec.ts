import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';

import { pixelAt, solidPng } from './png-utils';

test('preserves a landscape upload in an original-shape frame', async ({
  page,
}) => {
  await page.route('**/api/gaza-status', (route) =>
    route.fulfill({ json: { summary: 'Test status summary' } }),
  );
  await page.goto('/');
  await page.setInputFiles('#fileInput', {
    name: 'landscape.png',
    mimeType: 'image/png',
    buffer: solidPng(160, 80, [40, 120, 220, 255]),
  });

  const originalShape = page.getByRole('button', { name: 'Original shape' });
  await expect(originalShape).toBeVisible();
  await originalShape.click();
  await expect(originalShape).toHaveAttribute('aria-pressed', 'true');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Download Image/ }).click(),
  ]);
  const image = PNG.sync.read(await readFile(await download.path()));

  // A 2:1 image stays 2:1 inside an even 18px border: 324x162 in 360x198.
  expect(image.width / image.height).toBeCloseTo(360 / 198, 2);

  const center = pixelAt(image, image.width >> 1, image.height >> 1);
  expect([center.r, center.g, center.b, center.a]).toEqual([40, 120, 220, 255]);

  // Unlike the circular frame, the rectangular flag border fills the corners.
  expect(pixelAt(image, 3, 3).a).toBeGreaterThan(200);
});
