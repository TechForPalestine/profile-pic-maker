import { FAQ_ITEMS } from '@/lib/faq';
import { LANDING_PAGES, pageUrl } from '@/lib/seo';
import { faqPageSchema, webApplicationSchema } from '@/lib/structured-data';
import { describe, expect, it } from 'vitest';

// The JSON-LD is only worth shipping if it matches the schema.org shapes search
// engines actually parse, so the required nodes are pinned here.

describe('WebApplication schema', () => {
  const schema = webApplicationSchema();

  it('declares the schema.org context and type', () => {
    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('WebApplication');
  });

  it('carries the properties Google requires for a software app', () => {
    expect(schema.name).toBeTruthy();
    expect(schema.url).toMatch(/^https:\/\/ppm\.techforpalestine\.org\/?$/);
    expect(schema.description.length).toBeGreaterThan(50);
    expect(schema.applicationCategory).toBe('MultimediaApplication');
  });

  it('prices the app as free rather than omitting the offer', () => {
    expect(schema.offers['@type']).toBe('Offer');
    expect(schema.offers.price).toBe('0');
    expect(schema.offers.priceCurrency).toBe('USD');
    expect(schema.isAccessibleForFree).toBe(true);
  });
});

describe('FAQPage schema', () => {
  const schema = faqPageSchema(FAQ_ITEMS);

  it('wraps every FAQ entry as a Question with an accepted Answer', () => {
    expect(schema['@type']).toBe('FAQPage');
    expect(schema.mainEntity).toHaveLength(FAQ_ITEMS.length);

    for (const [index, entry] of schema.mainEntity.entries()) {
      expect(entry['@type']).toBe('Question');
      expect(entry.name).toBe(FAQ_ITEMS[index].question);
      expect(entry.acceptedAnswer['@type']).toBe('Answer');
      // The text has to be the same string the page renders, since a mismatch
      // is what gets FAQ rich results dropped.
      expect(entry.acceptedAnswer.text).toBe(FAQ_ITEMS[index].answer);
    }
  });

  it('answers the privacy question people search for', () => {
    const privacy = schema.mainEntity[0];
    expect(privacy.name).toMatch(/uploaded anywhere/i);
    expect(privacy.acceptedAnswer.text).toMatch(/never sent to our servers/i);
  });
});

describe('landing page URLs', () => {
  it('builds absolute canonical URLs for the sitemap', () => {
    expect(pageUrl('/')).toBe('https://ppm.techforpalestine.org');
    for (const { path } of LANDING_PAGES) {
      expect(pageUrl(path)).toBe(`https://ppm.techforpalestine.org${path}`);
    }
  });

  it('keeps the landing page list unique', () => {
    const paths = LANDING_PAGES.map(({ path }) => path);
    expect(new Set(paths).size).toBe(paths.length);
  });
});
