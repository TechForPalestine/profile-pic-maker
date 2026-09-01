import { describe, expect, it } from 'vitest';

import {
  buildFaqStructuredData,
  buildSiteStructuredData,
  FAQ_ENTRIES,
  FEATURED_FAQ_ENTRIES,
} from '@/lib/faq';

interface Question {
  '@type': string;
  name: string;
  acceptedAnswer: { '@type': string; text: string };
}

describe('FAQ_ENTRIES', () => {
  it('has non-empty questions and answers', () => {
    for (const entry of FAQ_ENTRIES) {
      expect(entry.question.trim()).not.toBe('');
      expect(entry.answer.trim()).not.toBe('');
    }
  });

  it('features exactly the three entries shown on the home page', () => {
    expect(FEATURED_FAQ_ENTRIES).toHaveLength(3);
    for (const entry of FEATURED_FAQ_ENTRIES) {
      expect(FAQ_ENTRIES).toContain(entry);
    }
  });

  it('never collides with the accessible names the e2e suite locates by', () => {
    // <summary> exposes role "button", and the e2e specs find the app's real
    // buttons with unanchored name regexes — FAQ copy matching one of them
    // would break those locators under strict mode.
    const reserved = /Download Image|Start Over|Upload Image|Use.*Profile Pic/;
    for (const entry of FAQ_ENTRIES) {
      expect(entry.question).not.toMatch(reserved);
      expect(entry.answer).not.toMatch(reserved);
    }
  });
});

describe('buildFaqStructuredData', () => {
  it('survives a JSON round-trip unchanged', () => {
    const data = buildFaqStructuredData();
    expect(JSON.parse(JSON.stringify(data))).toEqual(data);
  });

  it('is a FAQPage mirroring every FAQ entry', () => {
    const data = buildFaqStructuredData() as {
      '@type': string;
      mainEntity: Question[];
    };
    expect(data['@type']).toBe('FAQPage');
    expect(data.mainEntity).toHaveLength(FAQ_ENTRIES.length);
    data.mainEntity.forEach((question, i) => {
      expect(question['@type']).toBe('Question');
      expect(question.name).toBe(FAQ_ENTRIES[i].question);
      expect(question.acceptedAnswer['@type']).toBe('Answer');
      expect(question.acceptedAnswer.text).toBe(FAQ_ENTRIES[i].answer);
    });
  });
});

describe('buildSiteStructuredData', () => {
  it('survives a JSON round-trip unchanged', () => {
    const data = buildSiteStructuredData();
    expect(JSON.parse(JSON.stringify(data))).toEqual(data);
  });

  it('declares the app and its publisher, but no FAQPage', () => {
    const graph = (
      buildSiteStructuredData() as { '@graph': { '@type': string }[] }
    )['@graph'];
    const types = graph.map((node) => node['@type']);
    expect(types).toContain('WebApplication');
    expect(types).toContain('Organization');
    // The FAQPage schema belongs on /faq, where all its questions are
    // visible — site-wide it would claim content the home page doesn't show.
    expect(types).not.toContain('FAQPage');
  });
});
