import { expect, test } from '@playwright/test';

// The approvals page against a mocked admin API: unlock with a token, see the
// queue, approve with one click. Authorization itself is covered by the
// integration suite; here the point is that the page sends the right calls.

const pending = {
  code: 'paul',
  displayName: 'Paul Biggar',
  links: { x: 'https://x.com/paulbiggar' },
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
      page.getByRole('link', { name: /x: https:\/\/x.com\/paulbiggar/ }),
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
