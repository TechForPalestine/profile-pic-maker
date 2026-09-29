import { createHash } from 'node:crypto';

import { expect, test } from '@playwright/test';

const fingerprint = (code: string) =>
  createHash('sha256').update(code).digest('hex').slice(0, 12);

// The approvals page against a mocked admin API: unlock with a token, see the
// queue, approve with one click. Authorization itself is covered by the
// integration suite; here the point is that the page sends the right calls.

const pending = {
  code: 'paul',
  displayName: 'Paul Biggar',
  link: 'https://x.com/paulbiggar',
  status: 'pending',
  createdAt: '2026-09-14T10:00:00.000Z',
};

test.describe('Promoter approvals page', () => {
  test('unlocks with a token, lists the queue, and approves an entry', async ({
    page,
  }) => {
    const calls: { auth: string | undefined; body?: unknown }[] = [];
    let approved = false;
    await page.route('**/api/admin/promoters', async (route) => {
      const request = route.request();
      calls.push({
        auth: request.headers()['authorization'],
        body: request.method() === 'POST' ? request.postDataJSON() : undefined,
      });
      if (request.method() === 'POST') {
        approved = true;
        return route.fulfill({
          json: { promoter: { ...pending, status: 'approved' } },
        });
      }
      return route.fulfill({
        json: approved
          ? {
              pending: [],
              approved: [{ ...pending, status: 'approved' }],
              rejected: [],
            }
          : { pending: [pending], approved: [], rejected: [] },
      });
    });

    await page.goto('/admin/promoters');
    await page
      .getByLabel('Admin token')
      .fill('a-very-long-admin-token-for-tests');
    await page.getByRole('button', { name: 'Unlock' }).click();

    await expect(
      page.getByRole('heading', { name: 'Waiting for review (1)' }),
    ).toBeVisible();
    await expect(page.getByText('Paul Biggar')).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'https://x.com/paulbiggar' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Approve', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'On the leaderboard (1)' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Waiting for review (0)' }),
    ).toBeVisible();

    expect(calls[0].auth).toBe('Bearer a-very-long-admin-token-for-tests');
    expect(calls.find((c) => c.body)?.body).toEqual({
      action: 'approve',
      code: 'paul',
    });
  });

  test('edits an approved entry in place and can send it back to review', async ({
    page,
  }) => {
    let current: {
      code: string;
      displayName: string;
      link?: string;
      status: string;
      createdAt: string;
    } = { ...pending, status: 'approved' };
    const posts: unknown[] = [];
    await page.route('**/api/admin/promoters', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        const body = request.postDataJSON() as {
          action: string;
          displayName?: string;
          link?: string;
        };
        posts.push(body);
        if (body.action === 'edit') {
          current = {
            ...current,
            displayName: body.displayName ?? current.displayName,
            link: body.link ?? current.link,
          };
        }
        if (body.action === 'unapprove')
          current = { ...current, status: 'pending' };
        return route.fulfill({ json: { promoter: current } });
      }
      return route.fulfill({
        json:
          current.status === 'approved'
            ? { pending: [], approved: [current], rejected: [] }
            : { pending: [current], approved: [], rejected: [] },
      });
    });

    await page.addInitScript(() =>
      sessionStorage.setItem(
        'ppm-admin-token',
        'a-very-long-admin-token-for-tests',
      ),
    );
    await page.goto('/admin/promoters');
    await expect(
      page.getByRole('heading', { name: 'On the leaderboard (1)' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Edit' }).click();
    const form = page.getByRole('form', { name: 'Edit Paul Biggar' });
    await form.getByLabel('Display name').fill('Paul B.');
    await form.getByLabel('Link (optional)').fill('paul.example');
    await form.getByRole('button', { name: 'Save changes' }).click();

    await expect(page.getByText('Paul B.', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'paul.example' }),
    ).toBeVisible();
    // Still on the board: an edit never changes status.
    await expect(
      page.getByRole('heading', { name: 'On the leaderboard (1)' }),
    ).toBeVisible();
    expect(posts[0]).toEqual({
      action: 'edit',
      code: 'paul',
      displayName: 'Paul B.',
      link: 'paul.example',
    });

    await page.getByRole('button', { name: 'Back to review' }).click();
    await expect(
      page.getByRole('heading', { name: 'Waiting for review (1)' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'On the leaderboard (0)' }),
    ).toBeVisible();
    expect(posts[1]).toEqual({ action: 'unapprove', code: 'paul' });
  });

  test('shows last-7-day numbers per entry and flags unusual ones', async ({
    page,
  }) => {
    const shady = {
      code: 'shady',
      displayName: 'Shady',
      link: 'https://x.com/shady',
      status: 'pending',
      createdAt: '2026-09-17T10:00:00.000Z',
    };
    await page.route('**/api/admin/promoters', (route) =>
      route.fulfill({
        json: {
          pending: [shady],
          approved: [{ ...pending, status: 'approved' }],
          rejected: [],
        },
      }),
    );
    await page.route('**/api/leaderboard**', (route) =>
      route.fulfill({
        json: {
          window: '7d',
          generatedAt: '2026-09-17T12:00:00.000Z',
          source: 'plausible',
          promoters: [
            {
              code: 'paul',
              displayName: 'Paul Biggar',
              link: pending.link,
              recruits: 0,
              rank: 1,
              downloads: 40,
              visits: 90,
            },
          ],
          channels: [],
          pendingCounts: {
            [fingerprint('shady')]: { downloads: 50, visits: 2 },
          },
        },
      }),
    );
    await page.addInitScript(() =>
      sessionStorage.setItem(
        'ppm-admin-token',
        'a-very-long-admin-token-for-tests',
      ),
    );
    await page.goto('/admin/promoters');

    const stats = page.getByTestId('entry-stats');
    await expect(
      stats.filter({ hasText: '50 downloads, 2 visits' }),
    ).toContainText('check these numbers');
    await expect(
      stats.filter({ hasText: '40 downloads, 90 visits' }),
    ).not.toContainText('check these numbers');
  });

  test('warns when requests are only kept in memory', async ({ page }) => {
    const registry = (storage: string) => ({
      pending: [],
      approved: [],
      rejected: [],
      storage,
    });
    await page.addInitScript(() =>
      sessionStorage.setItem(
        'ppm-admin-token',
        'a-very-long-admin-token-for-tests',
      ),
    );

    await page.route('**/api/admin/promoters', (route) =>
      route.fulfill({ json: registry('memory') }),
    );
    await page.goto('/admin/promoters');
    await expect(page.getByTestId('memory-storage-warning')).toBeVisible();

    await page.unroute('**/api/admin/promoters');
    await page.route('**/api/admin/promoters', (route) =>
      route.fulfill({ json: registry('kv') }),
    );
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Waiting for review (0)' }),
    ).toBeVisible();
    await expect(page.getByTestId('memory-storage-warning')).toHaveCount(0);
  });

  test('reports a rejected token', async ({ page }) => {
    await page.route('**/api/admin/promoters', (route) =>
      route.fulfill({ status: 401, json: { error: 'Unauthorized' } }),
    );
    await page.goto('/admin/promoters');
    await page.getByLabel('Admin token').fill('wrong');
    await page.getByRole('button', { name: 'Unlock' }).click();
    // Next's route announcer is also role=alert, so match on the text.
    await expect(
      page.getByRole('alert').filter({ hasText: 'not accepted' }),
    ).toBeVisible();
  });
});
