import path from 'node:path';

import { expect, test } from '@playwright/test';

import { MY_PROMOTER_STORAGE_KEY } from '../src/lib/my-promoter';
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
  test('queues the Landed visit even before the analytics script loads', async ({
    page,
  }) => {
    // Never let the script load: the event must wait in Plausible's queue
    // with the referral code, not be dropped.
    await page.route('**/plausible.io/**', (route) => route.abort());
    await page.goto('/?ref=paul-biggar-5s7m');
    await expect
      .poll(() =>
        page.evaluate(() =>
          Array.from(
            (window as unknown as { plausible?: { q?: unknown[][] } }).plausible
              ?.q ?? [],
          ).map((args) => Array.from(args as ArrayLike<unknown>)),
        ),
      )
      .toContainEqual([
        'Funnel: 1 Landed',
        { props: expect.objectContaining({ referrer: 'paul-biggar-5s7m' }) },
      ]);
  });

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
  const createLink = async (
    page: import('@playwright/test').Page,
    name = 'Paul Biggar',
  ) => {
    await page.goto('/leaderboard/join');
    await page.getByLabel(/Your name/).fill(name);
    await page.getByRole('button', { name: 'Create my link' }).click();
    return (await page.getByTestId('referral-link').textContent()) ?? '';
  };

  test('makes the code from the name, with a random tail, and can shuffle it', async ({
    page,
  }) => {
    await page.goto('/leaderboard/join');
    await page.getByLabel(/Your name/).fill('Paul Biggar');
    const suggested = page.getByTestId('suggested-code');
    await expect(suggested).toHaveText(/^paul-biggar-[a-z0-9]{4}$/);
    const before = await suggested.textContent();
    await page.getByRole('button', { name: 'Pick a different code' }).click();
    await expect(suggested).toHaveText(/^paul-biggar-[a-z0-9]{4}$/);
    expect(await suggested.textContent()).not.toBe(before);
  });

  test('creates the link in the browser only and remembers it', async ({
    page,
  }) => {
    const link = await createLink(page);
    expect(link).toMatch(
      /^https:\/\/ppm\.techforpalestine\.org\/\?ref=paul-biggar-[a-z0-9]{4}$/,
    );
    await expect(page.getByRole('button', { name: 'Copy link' })).toBeVisible();

    const stored = await page.evaluate(
      (key) => localStorage.getItem(key),
      MY_PROMOTER_STORAGE_KEY,
    );
    expect(JSON.parse(stored ?? '{}')).toMatchObject({
      displayName: 'Paul Biggar',
      code: expect.stringMatching(/^paul-biggar-/),
    });

    await page.reload();
    await expect(page.getByTestId('referral-link')).toHaveText(link);
  });

  test('submits a listing request with the created code and confirms it is pending', async ({
    page,
  }) => {
    let posted: unknown;
    await page.route('**/api/promoters', async (route) => {
      posted = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        json: {
          status: 'pending',
          code: 'paul-biggar-x',
          ownerKey: 'b2'.repeat(24),
        },
      });
    });
    const link = await createLink(page);
    const code = new URL(link).searchParams.get('ref');

    const submit = page.getByRole('button', { name: 'Ask to be listed' });
    await page
      .getByLabel('Your link (optional)')
      .fill('https://x.com/paulbiggar');
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(page.getByRole('status')).toContainText('Listing requested');
    await expect(page.getByRole('status')).toContainText('at most a day');
    // The private key is kept so this browser can check the status later.
    const saved = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? '{}'),
      MY_PROMOTER_STORAGE_KEY,
    );
    expect(saved.ownerKey).toBe('b2'.repeat(24));
    expect(posted).toMatchObject({
      code,
      displayName: 'Paul Biggar',
      link: 'https://x.com/paulbiggar',
    });
  });

  test('reports the join funnel to analytics with fixed props only', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const events: [string, unknown][] = [];
      (window as unknown as { __events: typeof events }).__events = events;
      // Clipboard permissions differ per engine; the copy itself is not
      // what this test is about.
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: async () => {} },
      });
      Object.defineProperty(window, 'plausible', {
        value: (name: string, options?: { props?: unknown }) =>
          events.push([name, options?.props]),
      });
    });
    await page.route('**/api/promoters', (route) =>
      route.fulfill({
        status: 201,
        json: { status: 'pending', code: 'x', ownerKey: 'e5'.repeat(24) },
      }),
    );
    await createLink(page);
    await page.getByRole('button', { name: 'Copy link' }).click();
    await page.getByRole('button', { name: 'Ask to be listed' }).click();
    await expect(page.getByRole('status')).toContainText('Listing requested');

    const events = await page.evaluate(
      () => (window as unknown as { __events: [string, unknown][] }).__events,
    );
    expect(events.filter(([name]) => name.startsWith('Leaderboard:'))).toEqual([
      ['Leaderboard: 2 Link Created', undefined],
      ['Leaderboard: 3 Link Copied', { format: 'link' }],
      ['Leaderboard: 4 Listing Requested', { outcome: 'pending' }],
    ]);
  });

  const captureListing = async (page: import('@playwright/test').Page) => {
    const posted: { body?: Record<string, unknown> } = {};
    await page.route('**/api/promoters', async (route) => {
      posted.body = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        json: { status: 'pending', code: 'x', ownerKey: 'd4'.repeat(24) },
      });
    });
    return posted;
  };

  test('accepts a link typed without https://', async ({ page }) => {
    const posted = await captureListing(page);
    await createLink(page);
    await page.getByLabel('Your link (optional)').fill('mostafazh.me');
    await page.getByRole('button', { name: 'Ask to be listed' }).click();
    await expect(page.getByRole('status')).toContainText('Listing requested');
    // The browser no longer blocks it; the server fills in the scheme.
    expect(posted.body?.link).toBe('mostafazh.me');
  });

  test('asks to be listed without a link', async ({ page }) => {
    const posted = await captureListing(page);
    await createLink(page);
    await page.getByRole('button', { name: 'Ask to be listed' }).click();
    await expect(page.getByRole('status')).toContainText('Listing requested');
    expect(posted.body?.link).toBeUndefined();
  });

  test('flags a link that is not a web address', async ({ page }) => {
    await createLink(page);
    const field = page.getByLabel('Your link (optional)');
    const submit = page.getByRole('button', { name: 'Ask to be listed' });
    await field.fill('not a link');
    await expect(submit).toBeDisabled();
    await field.fill('');
    await expect(submit).toBeEnabled();
  });

  test('does not credit you for your own link', async ({ page }) => {
    const posted = await captureListing(page);
    const link = await createLink(page);
    const code = new URL(link).searchParams.get('ref');
    // Testing your own link in the same browser remembers you as referrer.
    await page.goto(`/?ref=${code}`);
    await page.goto('/leaderboard/join');
    await expect(page.getByText(/arrived through/)).toHaveCount(0);
    await page.getByLabel('Your link (optional)').fill('x.com/paulbiggar');
    await page.getByRole('button', { name: 'Ask to be listed' }).click();
    await expect(page.getByRole('status')).toContainText('Listing requested');
    expect(posted.body?.referredBy).toBeUndefined();
  });

  test('does not send a channel link as the recruiter', async ({ page }) => {
    const posted = await captureListing(page);
    await page.goto('/?ref=ch-mighty-missions');
    await createLink(page);
    await expect(page.getByText(/arrived through/)).toHaveCount(0);
    await page.getByLabel('Your link (optional)').fill('x.com/paulbiggar');
    await page.getByRole('button', { name: 'Ask to be listed' }).click();
    await expect(page.getByRole('status')).toContainText('Listing requested');
    expect(posted.body?.referredBy).toBeUndefined();
  });

  test('credits the promoter whose link you arrived through', async ({
    page,
  }) => {
    const posted = await captureListing(page);
    await page.goto('/?ref=zaher-7k2q');
    await createLink(page);
    await expect(page.getByText(/arrived through/)).toContainText('zaher-7k2q');
    await page.getByLabel('Your link (optional)').fill('x.com/paulbiggar');
    await page.getByRole('button', { name: 'Ask to be listed' }).click();
    await expect(page.getByRole('status')).toContainText('Listing requested');
    expect(posted.body?.referredBy).toBe('zaher-7k2q');
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
    await createLink(page, 'Paul');
    await page.getByLabel('Your link (optional)').fill('https://x.com/paul');
    await page.getByRole('button', { name: 'Ask to be listed' }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'already taken' }),
    ).toBeVisible();
  });

  const remembered = {
    code: 'paul-biggar-7k2q',
    displayName: 'Paul Biggar',
    createdAt: '2026-09-17T10:00:00.000Z',
    submittedAt: '2026-09-17T10:05:00.000Z',
    ownerKey: 'c3'.repeat(24),
  };
  const rememberJoin = (page: import('@playwright/test').Page) =>
    page.addInitScript(([key, value]) => localStorage.setItem(key, value), [
      MY_PROMOTER_STORAGE_KEY,
      JSON.stringify(remembered),
    ] as const);

  test('asks to send again when the server has no record of the request', async ({
    page,
  }) => {
    await page.route('**/api/promoters/status', (route) =>
      route.fulfill({ json: { status: 'none' } }),
    );
    await rememberJoin(page);
    await page.goto('/leaderboard/join');

    await expect(
      page.getByRole('alert').filter({ hasText: 'could not find' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Ask to be listed' }),
    ).toBeVisible();
    // Same link kept, lost request forgotten.
    await expect(page.getByTestId('referral-link')).toContainText(
      'paul-biggar-7k2q',
    );
    const saved = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? '{}'),
      MY_PROMOTER_STORAGE_KEY,
    );
    expect(saved.submittedAt).toBeUndefined();
    expect(saved.ownerKey).toBeUndefined();
  });

  test('says so when the listing was not approved', async ({ page }) => {
    await page.route('**/api/promoters/status', (route) =>
      route.fulfill({ json: { status: 'rejected' } }),
    );
    await rememberJoin(page);
    await page.goto('/leaderboard/join');
    await expect(page.getByRole('status')).toContainText(
      'Your listing was not approved',
    );
  });

  test('can start over with a new link', async ({ page }) => {
    await page.route('**/api/promoters/status', (route) =>
      route.fulfill({ json: { status: 'pending' } }),
    );
    await rememberJoin(page);
    await page.goto('/leaderboard/join');
    await expect(page.getByTestId('referral-link')).toBeVisible();

    await page
      .getByRole('button', { name: 'Start over with a new link' })
      .click();
    await expect(page.getByLabel(/Your name/)).toHaveValue('');
    await expect(page.getByTestId('referral-link')).toHaveCount(0);
    const saved = await page.evaluate(
      (key) => localStorage.getItem(key),
      MY_PROMOTER_STORAGE_KEY,
    );
    expect(saved).toBeNull();
  });
});
