import path from 'node:path';

import { expect, test } from '@playwright/test';

import { REFERRER_STORAGE_KEY } from '../src/lib/referral';

// The referral loop end to end: a link with ?ref= is remembered, the person
// downloads, is invited to get a link of their own, and the join page knows
// who brought them. The API is mocked at the network boundary; the store and
// route logic are covered by the integration suite.

const PHOTO = path.join(process.cwd(), 'public', 'user.jpg');

// The code is remembered in a React effect after hydration, so poll rather
// than read once right after navigation.
const storedReferrer = (page: import('@playwright/test').Page) =>
  expect.poll(async () => {
    const raw = await page.evaluate(
      (key) => localStorage.getItem(key),
      REFERRER_STORAGE_KEY,
    );
    return raw ? (JSON.parse(raw) as { code: string }).code : null;
  }).toBe;

test.describe('Referral links', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/gaza-status', (route) =>
      route.fulfill({ json: { summary: 'Test status summary' } }),
    );
  });

  test('remembers the code, shows the CTA after download, and credits the referrer on the join page', async ({
    page,
  }) => {
    await page.goto('/?ref=zaher');
    await storedReferrer(page)('zaher');

    await page.setInputFiles('#fileInput', PHOTO);
    const cta = page.getByRole('link', {
      name: /Get your own link and join the leaderboard/,
    });
    await expect(cta).toBeHidden();

    await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /Download Image/ }).click(),
    ]);
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/leaderboard\/join$/);
    await expect(page.getByText(/arrived through/)).toContainText('zaher');
  });

  test('keeps the first referrer and ignores share-button refs', async ({
    page,
  }) => {
    await page.goto('/?ref=zaher');
    await storedReferrer(page)('zaher');
    await page.goto('/?ref=paul');
    await page.goto('/?ref=share-whatsapp');
    await expect(
      page.getByRole('heading', { name: 'Show Solidarity' }),
    ).toBeVisible();
    await storedReferrer(page)('zaher');
  });

  test('does not remember malformed codes', async ({ page }) => {
    await page.goto('/?ref=<script>');
    await expect(
      page.getByRole('heading', { name: 'Show Solidarity' }),
    ).toBeVisible();
    await storedReferrer(page)(null);
  });
});

test.describe('The join page', () => {
  test('suggests a code from the name and shows the link instantly', async ({
    page,
  }) => {
    await page.goto('/leaderboard/join');
    await page.getByLabel('Display name').fill('Paul Biggar');
    await expect(page.getByLabel('Your code')).toHaveValue('paul-biggar');
    await expect(page.getByTestId('referral-link')).toHaveText(
      'https://ppm.techforpalestine.org/?ref=paul-biggar',
    );
    await expect(page.getByRole('button', { name: 'Copy link' })).toBeVisible();
  });

  test('rejects reserved and malformed codes inline', async ({ page }) => {
    await page.goto('/leaderboard/join');
    await page.getByLabel('Your code').fill('admin');
    await expect(page.getByText(/not a reserved word/)).toBeVisible();
    await expect(page.getByTestId('referral-link')).toHaveCount(0);
    await page.getByLabel('Your code').fill('Paul Biggar');
    await expect(page.getByTestId('referral-link')).toHaveCount(0);
  });

  test('submits a listing request and confirms it is pending', async ({
    page,
  }) => {
    let posted: unknown;
    await page.route('**/api/promoters', async (route) => {
      posted = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        json: { status: 'pending', code: 'paul-biggar' },
      });
    });
    await page.goto('/leaderboard/join');
    await page.getByLabel('Display name').fill('Paul Biggar');
    const submit = page.getByRole('button', { name: 'Ask to be listed' });
    await expect(submit).toBeDisabled();
    await page
      .getByLabel('X', { exact: true })
      .fill('https://x.com/paulbiggar');
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(page.getByRole('status')).toContainText('Request received');
    expect(posted).toMatchObject({
      code: 'paul-biggar',
      displayName: 'Paul Biggar',
      links: { x: 'https://x.com/paulbiggar' },
    });
  });

  test('shows the server’s reason when a request is refused', async ({
    page,
  }) => {
    await page.route('**/api/promoters', (route) =>
      route.fulfill({
        status: 409,
        json: { errors: ['That code is already taken. Pick another one.'] },
      }),
    );
    await page.goto('/leaderboard/join');
    await page.getByLabel('Display name').fill('Paul');
    await page.getByLabel('X', { exact: true }).fill('https://x.com/paul');
    await page.getByRole('button', { name: 'Ask to be listed' }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'already taken' }),
    ).toBeVisible();
  });
});
