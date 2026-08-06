import { expect, test } from '@playwright/test';

import { solidPng } from './png-utils';

// Drives the real post-download survey: it must stay out of the way until the
// picture is downloaded, then take two taps and remember it was answered.
//
// Plausible is never loaded in tests, so `trackEvent` no-ops — these assertions
// are about the UI contract, not the analytics payload (covered by unit tests).
test.describe('Post-download survey', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/gaza-status', (route) =>
      route.fulfill({ json: { summary: 'Test status summary' } }),
    );

    const avatarResponse = {
      status: 200,
      contentType: 'image/png',
      headers: { 'access-control-allow-origin': '*' },
      body: solidPng(64, 64, [255, 0, 255, 255]),
    } as const;
    await page.route('**/api/retrieve-profile-pic**', (route) =>
      route.fulfill({
        json: { profilePicUrl: 'https://example.test/avatar.png' },
      }),
    );
    await page.route('**/_next/image**', (route) =>
      route.fulfill(avatarResponse),
    );
    await page.route('https://example.test/avatar.png', (route) =>
      route.fulfill(avatarResponse),
    );

    // handleRetrieveProfilePicture() asks for the username via prompt().
    // Registered once per test: a second handler would try to accept an
    // already-handled dialog when a spec picks a photo twice.
    page.on('dialog', (dialog) => dialog.accept('tech4palestine'));
  });

  const pickAPhoto = async (page: import('@playwright/test').Page) => {
    await page.goto('/');
    await page
      .getByRole('button', { name: /Use.*Profile Pic/ })
      .first()
      .click();
    const downloadButton = page.getByRole('button', { name: /Download Image/ });
    await expect(downloadButton).toBeVisible();
    return downloadButton;
  };

  const sourceQuestion = /How did you find this\?/;

  test('stays hidden until the picture has been downloaded', async ({
    page,
  }) => {
    const downloadButton = await pickAPhoto(page);
    await expect(page.getByText(sourceQuestion)).toBeHidden();

    await Promise.all([page.waitForEvent('download'), downloadButton.click()]);
    await expect(page.getByText(sourceQuestion)).toBeVisible();
  });

  test('asks two questions, then offers ways to do more', async ({ page }) => {
    const downloadButton = await pickAPhoto(page);
    await Promise.all([page.waitForEvent('download'), downloadButton.click()]);

    await page
      .getByRole('button', { name: "I saw someone's framed picture" })
      .click();

    // The second question is one of two, picked at random per visitor.
    await expect(page.getByText(sourceQuestion)).toBeHidden();
    const secondQuestion = page.getByText(
      /Anything making you hesitate to post it\?|What would make this better\?/,
    );
    await expect(secondQuestion).toBeVisible();

    // Answer whichever one came up.
    await page
      .getByRole('button', {
        name: /Nothing — it's going up|More frame styles/,
      })
      .click();

    await expect(
      page.getByText('Want to do more than a profile picture?'),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /Volunteer your skills/ }),
    ).toBeVisible();
  });

  test('is not asked again once it has been answered or dismissed', async ({
    page,
  }) => {
    const downloadButton = await pickAPhoto(page);
    await Promise.all([page.waitForEvent('download'), downloadButton.click()]);

    await expect(page.getByText(sourceQuestion)).toBeVisible();
    await page.getByRole('button', { name: 'Dismiss the survey' }).click();
    await expect(page.getByText(sourceQuestion)).toBeHidden();

    // A fresh visit shares the same origin, so the stored flag applies.
    const secondDownload = await pickAPhoto(page);
    await Promise.all([page.waitForEvent('download'), secondDownload.click()]);
    await expect(page.getByText(sourceQuestion)).toBeHidden();
  });
});
