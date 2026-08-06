import { expect, test } from '@playwright/test';

// The SEO landing pages are content pages: each targets one search intent,
// carries its own title/description/canonical, and sends people to the tool on
// the homepage. These tests pin the two things that are easy to break silently
// — metadata that quietly duplicates across pages, and a call to action that
// no longer reaches the tool.

const PAGES = [
  {
    path: '/palestine-profile-picture-frame',
    title: 'Palestine Profile Picture Frame — Free, No Sign-Up',
    heading: 'Palestine Profile Picture Frame',
  },
  {
    path: '/palestine-flag-border',
    title: 'Palestine Flag Border for Your Profile Pic',
    heading: 'Palestine Flag Border for Your Profile Pic',
  },
  {
    path: '/palestine-facebook-frame',
    title: 'Palestine Facebook Profile Frame (Frames Feature Replacement)',
    heading: 'Palestine Facebook Profile Frame',
  },
];

const ORIGIN = 'https://ppm.techforpalestine.org';

test.beforeEach(async ({ page }) => {
  // Keep the homepage's Gaza-status banner deterministic / offline.
  await page.route('**/api/gaza-status', (route) =>
    route.fulfill({ json: { summary: 'Test status summary' } }),
  );
});

function metaContent(page: import('@playwright/test').Page, name: string) {
  return page.locator(`meta[name="${name}"]`).getAttribute('content');
}

for (const { path, title, heading } of PAGES) {
  test.describe(`Landing page ${path}`, () => {
    test('has its own title, description and canonical', async ({ page }) => {
      await page.goto(path);

      await expect(page).toHaveTitle(title);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);

      const description = await metaContent(page, 'description');
      expect(description?.length).toBeGreaterThan(50);

      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        `${ORIGIN}${path}`,
      );
    });

    test('leads to the tool and to the other landing pages', async ({
      page,
    }) => {
      await page.goto(path);

      // Every other landing page, plus the FAQ, is reachable from here.
      for (const other of PAGES.filter((p) => p.path !== path)) {
        await expect(page.locator(`a[href="${other.path}"]`)).toHaveCount(1);
      }
      await expect(page.locator('a[href="/#faq"]')).toHaveCount(1);

      // The call to action lands on the homepage, where the tool lives.
      await page
        .getByRole('link', { name: /Make my|Add the|Frame my/ })
        .click();
      await expect(page).toHaveURL('/');
      await expect(
        page.getByRole('button', { name: 'Upload Image' }),
      ).toBeVisible();
    });
  });
}

test('landing pages do not share a title or a description', async ({
  page,
}) => {
  const seen: { titles: string[]; descriptions: string[] } = {
    titles: [],
    descriptions: [],
  };

  for (const { path } of [{ path: '/' }, ...PAGES]) {
    await page.goto(path);
    seen.titles.push(await page.title());
    seen.descriptions.push((await metaContent(page, 'description')) ?? '');
  }

  expect(new Set(seen.titles).size).toBe(seen.titles.length);
  expect(new Set(seen.descriptions).size).toBe(seen.descriptions.length);
});

test('the homepage carries the FAQ and its structured data', async ({
  page,
}) => {
  await page.goto('/');

  const privacyQuestion = page.getByText('Is my photo uploaded anywhere?');
  await expect(privacyQuestion).toBeVisible();
  // The answer sits inside a collapsed <details>; open it the way a reader
  // would and check the text is really there.
  await privacyQuestion.click();
  await expect(page.getByText(/never sent to our servers/)).toBeVisible();

  const blocks = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  const schemas = blocks.map((block) => JSON.parse(block));

  const app = schemas.find((schema) => schema['@type'] === 'WebApplication');
  expect(app.offers.price).toBe('0');

  const faq = schemas.find((schema) => schema['@type'] === 'FAQPage');
  expect(faq.mainEntity.length).toBeGreaterThanOrEqual(5);

  // Structured-data answers must be the ones people can actually read on the
  // page, so assert one of them against the rendered text.
  const [first] = faq.mainEntity;
  await expect(page.getByText(first.acceptedAnswer.text)).toBeAttached();
});
