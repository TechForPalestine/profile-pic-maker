import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { MY_PROMOTER_STORAGE_KEY } from '../src/lib/my-promoter';
import { hashReferralCode } from '../src/lib/referral';

// The link-first share variant (see src/lib/share-variant.ts), forced with
// ?share=link-first since builds default to classic. A download makes an
// anonymous personal link, every share button carries it, the person sees
// their count, and naming the link on the join page keeps its code.

const PHOTO = path.join(process.cwd(), 'public', 'user.jpg');

const captureEvents = (page: Page) =>
  page.addInitScript(() => {
    const events: [string, unknown][] = [];
    (window as unknown as { __events: typeof events }).__events = events;
    Object.defineProperty(window, 'plausible', {
      value: (name: string, options?: { props?: unknown }) =>
        events.push([name, options?.props]),
    });
  });

const events = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __events: [string, unknown][] }).__events,
  );

const storedCode = (page: Page) =>
  page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? '{}').code as string,
    MY_PROMOTER_STORAGE_KEY,
  );

/** Answers the board with `downloads` for whichever code this browser has. */
const mockBoard = (page: Page, downloads: number) =>
  page.route('**/api/leaderboard?window=all', async (route) => {
    const code = await storedCode(page);
    await route.fulfill({
      json: {
        window: 'all',
        generatedAt: new Date().toISOString(),
        promoters: [],
        channels: [],
        pendingCounts: code
          ? { [await hashReferralCode(code)]: { downloads, visits: 9 } }
          : {},
      },
    });
  });

const download = async (page: Page) => {
  await page.setInputFiles('#fileInput', PHOTO);
  await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Download Image/ }).click(),
  ]);
};

test.describe('Link-first share variant', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/gaza-status', (route) =>
      route.fulfill({ json: { summary: 'Test status summary' } }),
    );
  });

  test('makes a personal link on download and puts it on every share', async ({
    page,
  }) => {
    await captureEvents(page);
    await mockBoard(page, 3);
    await page.goto('/?share=link-first');
    await download(page);

    const card = page.getByTestId('my-link-card');
    await expect(card).toBeVisible();
    const code = await storedCode(page);
    expect(code).toMatch(/^pal-[a-z0-9]{6}$/);
    await expect(page.getByTestId('my-link')).toContainText(`ref=${code}`);
    await expect(page.getByTestId('my-reach')).toHaveText(
      '3 people have made their picture through your link.',
    );

    const whatsapp = page.getByRole('link', { name: 'Share on WhatsApp' });
    const href = decodeURIComponent((await whatsapp.getAttribute('href'))!);
    expect(href).toContain(`ref=${code}&utm_medium=share-whatsapp`);
    // The classic prompt gives way to the card's own call to action.
    await expect(
      page.getByRole('link', { name: /Get your own link/ }),
    ).toBeHidden();

    const tracked = await events(page);
    expect(tracked).toContainEqual([
      'Funnel: 1 Landed',
      { referrer: 'none', variant: 'link-first' },
    ]);
    expect(tracked).toContainEqual([
      'Leaderboard: 2 Link Created',
      { origin: 'auto', variant: 'link-first' },
    ]);
    expect(tracked).toContainEqual([
      'Share: 1 Options Shown',
      { method: 'user-upload', variant: 'link-first' },
    ]);
  });

  test('shows the count on a return visit, and naming the link keeps its code', async ({
    page,
  }) => {
    await mockBoard(page, 0);
    await page.goto('/?share=link-first');
    await download(page);
    const code = await storedCode(page);

    // The variant sticks without the query parameter.
    await page.goto('/');
    await expect(page.getByTestId('my-link-card')).toContainText(
      'Welcome back',
    );
    await expect(page.getByTestId('my-reach')).toContainText('Nobody yet');

    await page
      .getByRole('link', { name: 'Add your name and join the leaderboard' })
      .click();
    await expect(page).toHaveURL(/\/leaderboard\/join$/);
    await expect(page.getByTestId('referral-link')).toContainText(code);
    const ask = page.getByRole('button', { name: 'Ask to be listed' });
    await expect(ask).toBeDisabled();

    await page.getByLabel(/Add your name/).fill('Layla');
    await page.getByRole('button', { name: 'Save my name' }).click();
    await expect(page.getByText('Layla, your link')).toBeVisible();
    await expect(ask).toBeEnabled();
    expect(await storedCode(page)).toBe(code);
  });

  test('classic stays the default', async ({ page }) => {
    await captureEvents(page);
    await page.goto('/');
    await download(page);
    await expect(page.getByTestId('my-link-card')).toBeHidden();
    const whatsapp = page.getByRole('link', { name: 'Share on WhatsApp' });
    expect(
      decodeURIComponent((await whatsapp.getAttribute('href'))!),
    ).toContain('ref=share-whatsapp');
    expect(await events(page)).toContainEqual([
      'Funnel: 1 Landed',
      { referrer: 'none', variant: 'classic' },
    ]);
  });
});
