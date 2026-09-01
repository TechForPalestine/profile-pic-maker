import { expect, test } from '@playwright/test';

// The FAQ earns its keep in search results and AI answers only if the text is
// really on the pages and the structured data really ships with it. The home
// page carries a three-question teaser; /faq carries the full list plus the
// FAQPage JSON-LD (which must sit on the page where the questions are
// visible).

test.describe('FAQ teaser on the home page', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/gaza-status', (route) =>
      route.fulfill({ json: { summary: 'Test status summary' } }),
    );
    await page.goto('/');
  });

  test('shows three questions and links to the full list', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Frequently Asked Questions' }),
    ).toBeVisible();
    await expect(page.locator('details')).toHaveCount(3);

    await page.getByRole('link', { name: 'Read all FAQs' }).click();
    await expect(page).toHaveURL(/\/faq$/);
  });

  test('reveals an answer on click', async ({ page }) => {
    const first = page.locator('details').first();
    const answer = first.locator('p');
    await expect(answer).toBeHidden();
    await first.locator('summary').click();
    await expect(answer).toBeVisible();
  });
});

test.describe('The /faq page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/faq');
  });

  test('lists the full FAQ', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Frequently Asked Questions' }),
    ).toBeVisible();
    expect(await page.locator('details').count()).toBeGreaterThan(3);
    await expect(
      page.getByRole('link', { name: 'Make your profile picture' }),
    ).toBeVisible();
  });

  test('ships FAQPage structured data in the HTML', async ({ page }) => {
    const jsonLd = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    expect(jsonLd.join('')).toContain('"FAQPage"');
  });
});
