import { createHash } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { MY_PROMOTER_STORAGE_KEY } from '../src/lib/my-promoter';

// Same fingerprint the app computes with Web Crypto (first 12 hex of SHA-256).
const fingerprint = (code: string) =>
  createHash('sha256').update(code).digest('hex').slice(0, 12);

// The public board, driven against a mocked /api/leaderboard. Only approved
// promoters ever reach this page (the API guarantees it, see the integration
// suite); these specs cover what the page does with what it gets.

const board = (window: string) => ({
  window,
  generatedAt: '2026-09-14T12:00:00.000Z',
  promoters: [
    {
      code: 'paul',
      displayName: 'Paul Biggar',
      links: { x: 'https://x.com/paulbiggar', website: 'https://paul.example' },
      recruits: 2,
      rank: 1,
      downloads: window === 'day' ? 5 : 120,
      visits: window === 'day' ? 9 : 300,
    },
    {
      code: 'zaher',
      displayName: 'Zaher',
      links: { instagram: 'https://instagram.com/zaher' },
      recruits: 0,
      rank: 2,
      downloads: window === 'day' ? 1 : 80,
      visits: window === 'day' ? 4 : 150,
    },
  ],
  channels: [
    { bucket: 'organic', label: 'Direct and organic', downloads: 700 },
    { bucket: 'shared', label: 'Shared by users', downloads: 180 },
    { bucket: 'promoters', label: 'Promoter links', downloads: 200 },
  ],
  pendingCounts: { [fingerprint('newbie-7k2q')]: { downloads: 3, visits: 11 } },
});

const rememberMine = (
  page: import('@playwright/test').Page,
  record: Record<string, unknown>,
) =>
  page.addInitScript(([key, value]) => localStorage.setItem(key, value), [
    MY_PROMOTER_STORAGE_KEY,
    JSON.stringify(record),
  ] as const);

test.describe('The leaderboard page', () => {
  test('ranks promoters, links to their profiles, and shows the channel mix', async ({
    page,
  }) => {
    const windows: string[] = [];
    await page.route('**/api/leaderboard**', (route) => {
      const window = new URL(route.request().url()).searchParams.get('window');
      windows.push(window ?? '');
      return route.fulfill({ json: board(window ?? '7d') });
    });
    await page.goto('/leaderboard');

    const rows = page.getByRole('list', { name: 'Promoters' }).locator('li');
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText('Paul Biggar');
    await expect(rows.first()).toContainText('120');
    await expect(rows.first().getByTestId('visits')).toHaveText('300 visits');
    await expect(rows.first()).toContainText('brought 2 promoters on board');
    await expect(
      rows.first().getByRole('link', { name: 'Paul Biggar on X' }),
    ).toHaveAttribute('href', 'https://x.com/paulbiggar');
    await expect(
      rows.first().getByRole('link', { name: 'Paul Biggar on X' }),
    ).toHaveAttribute('rel', /nofollow/);

    await expect(
      page.getByRole('heading', { name: 'Where downloads come from' }),
    ).toBeVisible();
    await expect(page.getByText('Shared by users')).toBeVisible();

    await page.getByRole('tab', { name: 'Today' }).click();
    await expect(rows.first()).toContainText('5');
    expect(windows).toEqual(['7d', 'day']);
  });

  test('shows a promoter their own pending row, and only to them', async ({
    page,
  }) => {
    await page.route('**/api/leaderboard**', (route) =>
      route.fulfill({ json: board('7d') }),
    );
    await rememberMine(page, {
      code: 'newbie-7k2q',
      displayName: 'Newbie',
      createdAt: '2026-09-17T10:00:00.000Z',
      submittedAt: '2026-09-17T10:05:00.000Z',
    });
    await page.goto('/leaderboard');

    const own = page.getByTestId('my-pending-row');
    await expect(own).toContainText('Newbie');
    await expect(own).toContainText('pending review');
    await expect(own).toContainText('3');
    await expect(own.getByTestId('visits')).toHaveText('11 visits');
    await expect(own).toContainText('at most a day');
    // The public ranking is unchanged: the pending code is not in it.
    await expect(
      page.getByRole('list', { name: 'Promoters' }).locator('li'),
    ).toHaveCount(2);
    // And the API response never names the code.
    const res = await page.request.get('/api/leaderboard?window=7d');
    expect(await res.text()).not.toContain('newbie');
  });

  test('tags the approved promoter’s own row', async ({ page }) => {
    await page.route('**/api/leaderboard**', (route) =>
      route.fulfill({ json: board('7d') }),
    );
    await rememberMine(page, {
      code: 'zaher',
      displayName: 'Zaher',
      createdAt: '2026-09-01T10:00:00.000Z',
      submittedAt: '2026-09-01T10:05:00.000Z',
    });
    await page.goto('/leaderboard');
    await expect(page.getByTestId('my-pending-row')).toHaveCount(0);
    await expect(page.locator('li[data-mine]')).toContainText('Zaher');
    await expect(page.locator('li[data-mine]')).toContainText('you');
  });

  test('explains itself while analytics access is not configured', async ({
    page,
  }) => {
    await page.route('**/api/leaderboard**', (route) =>
      route.fulfill({
        status: 503,
        json: { error: 'leaderboard-unavailable' },
      }),
    );
    await page.goto('/leaderboard');
    await expect(page.getByText('The board is warming up.')).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Get your link' }),
    ).toBeVisible();
  });

  test('invites the first promoter when nobody is listed', async ({ page }) => {
    await page.route('**/api/leaderboard**', (route) =>
      route.fulfill({ json: { ...board('7d'), promoters: [] } }),
    );
    await page.goto('/leaderboard');
    await expect(page.getByText('Nobody is listed yet.')).toBeVisible();
  });

  test('is reachable from the home page and explains the rules', async ({
    page,
  }) => {
    await page.route('**/api/gaza-status', (route) =>
      route.fulfill({ json: { summary: 'Test status summary' } }),
    );
    await page.route('**/api/leaderboard**', (route) =>
      route.fulfill({ json: board('7d') }),
    );
    await page.goto('/');
    await page
      .getByRole('link', { name: 'See the promoter leaderboard' })
      .click();
    await expect(page).toHaveURL(/\/leaderboard$/);
    await page.getByRole('link', { name: 'How it works' }).click();
    await expect(page).toHaveURL(/\/leaderboard\/how-it-works$/);
    await expect(
      page.getByRole('heading', { name: 'What is never tracked' }),
    ).toBeVisible();
  });
});
