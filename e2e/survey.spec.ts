import { expect, test } from '@playwright/test';

import { ROTATING_QUESTIONS } from '../src/lib/survey';
import { solidPng } from './png-utils';

const escapeForRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Drives the real post-download survey: it must stay out of the way until the
// picture is downloaded, then take a single tap and remember it was answered.
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

  // Which question a visitor gets is random, so the specs assert against the
  // real wave rather than hard-coded copy — editing a prompt in
  // `src/lib/survey.ts` must not break these.
  const askedQuestion = (page: import('@playwright/test').Page) =>
    page.getByText(
      new RegExp(
        ROTATING_QUESTIONS.map((question) =>
          escapeForRegExp(question.prompt),
        ).join('|'),
      ),
    );

  /** Answer whichever question came up, by clicking its first option. */
  const answerWhicheverAsked = async (
    page: import('@playwright/test').Page,
  ) => {
    for (const question of ROTATING_QUESTIONS) {
      const prompt = page.getByText(question.prompt, { exact: true });
      if (await prompt.isVisible()) {
        await page
          .getByRole('button', { name: question.options[0].label })
          .click();
        return question;
      }
    }
    throw new Error('No survey question was on screen');
  };

  test('stays hidden until the picture has been downloaded', async ({
    page,
  }) => {
    const downloadButton = await pickAPhoto(page);
    await expect(askedQuestion(page)).toBeHidden();

    await Promise.all([page.waitForEvent('download'), downloadButton.click()]);
    await expect(askedQuestion(page)).toBeVisible();
  });

  test('asks one question, then offers ways to do more', async ({ page }) => {
    const downloadButton = await pickAPhoto(page);
    await Promise.all([page.waitForEvent('download'), downloadButton.click()]);

    await expect(askedQuestion(page)).toBeVisible();
    await answerWhicheverAsked(page);

    // One tap is the whole survey — no second question follows.
    await expect(askedQuestion(page)).toBeHidden();
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

    await expect(askedQuestion(page)).toBeVisible();
    await page.getByRole('button', { name: 'Dismiss the survey' }).click();
    await expect(askedQuestion(page)).toBeHidden();

    // A fresh visit shares the same origin, so the stored flag applies.
    const secondDownload = await pickAPhoto(page);
    await Promise.all([page.waitForEvent('download'), secondDownload.click()]);
    await expect(askedQuestion(page)).toBeHidden();
  });
});
