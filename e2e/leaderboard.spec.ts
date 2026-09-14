import { expect, test } from '@playwright/test';

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
    },
    {
      code: 'zaher',
      displayName: 'Zaher',
      links: { instagram: 'https://instagram.com/zaher' },
      recruits: 0,
      rank: 2,
      downloads: window === 'day' ? 1 : 80,
    },
  ],
  channels: [
    { bucket: 'organic', label: 'Direct and organic', downloads: 700 },
    { bucket: 'shared', label: 'Shared by users', downloads: 180 },
    { bucket: 'promoters', label: 'Promoter links', downloads: 200 },
  ],
});

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
