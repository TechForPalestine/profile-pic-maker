import { expect, test } from '@playwright/test';

// The FAQ earns its keep in search results and AI answers only if the text is
// really on the page and the structured data really ships with it.

test.describe('FAQ section', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/gaza-status', (route) =>
      route.fulfill({ json: { summary: 'Test status summary' } }),
    );
    await page.goto('/');
  });

  test('lists the questions and reveals an answer on click', async ({
    page,
  }) => {
    await expect(
      page.getByRole('heading', { name: 'Frequently Asked Questions' }),
    ).toBeVisible();

    const first = page.locator('details').first();
    const answer = first.locator('p');
    await expect(answer).toBeHidden();
    await first.locator('summary').click();
    await expect(answer).toBeVisible();
  });

  test('ships FAQPage structured data in the HTML', async ({ page }) => {
    const jsonLd = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    expect(jsonLd.join('')).toContain('"FAQPage"');
  });
});
