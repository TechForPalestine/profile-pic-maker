import { expect, test } from '@playwright/test';

// A tiny but valid 1x1 PNG, served same-origin in place of the real Twitter
// CDN image. Keeping it same-origin avoids canvas tainting so html-to-image
// can rasterise the frame into a downloadable PNG.
const ONE_BY_ONE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64',
);

const AVATAR_URL =
  'https://pbs.twimg.com/profile_images/test/tech4palestine_400x400.png';

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
    // the bytes are served same-origin instead of from the Twitter CDN.
    await page.route('**/_next/image**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'image/png',
        headers: { 'access-control-allow-origin': '*' },
        body: ONE_BY_ONE_PNG,
      }),
    );
  });

  test('fetches the avatar and downloads a generated PNG', async ({ page }) => {
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

    const filePath = await download.path();
    expect(filePath).toBeTruthy();

    const { readFile } = await import('node:fs/promises');
    const bytes = await readFile(filePath!);
    // PNG magic number: 89 50 4E 47.
    expect(bytes.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    expect(bytes.byteLength).toBeGreaterThan(100);
  });
});
