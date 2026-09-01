import { describe, expect, it } from 'vitest';

import { buildStructuredData, FAQ_ENTRIES } from '@/lib/faq';

interface GraphNode {
  '@type': string;
  mainEntity?: {
    '@type': string;
    name: string;
    acceptedAnswer: { '@type': string; text: string };
  }[];
}

function graph(): GraphNode[] {
  return (buildStructuredData() as { '@graph': GraphNode[] })['@graph'];
}

describe('FAQ_ENTRIES', () => {
  it('has non-empty questions and answers', () => {
    for (const entry of FAQ_ENTRIES) {
      expect(entry.question.trim()).not.toBe('');
      expect(entry.answer.trim()).not.toBe('');
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

describe('buildStructuredData', () => {
  it('survives a JSON round-trip unchanged', () => {
    const data = buildStructuredData();
    expect(JSON.parse(JSON.stringify(data))).toEqual(data);
  });

  it('contains a FAQPage mirroring every visible FAQ entry', () => {
    const faqPage = graph().find((node) => node['@type'] === 'FAQPage');
    expect(faqPage).toBeDefined();
    expect(faqPage?.mainEntity).toHaveLength(FAQ_ENTRIES.length);
    faqPage?.mainEntity?.forEach((question, i) => {
      expect(question['@type']).toBe('Question');
      expect(question.name).toBe(FAQ_ENTRIES[i].question);
      expect(question.acceptedAnswer['@type']).toBe('Answer');
      expect(question.acceptedAnswer.text).toBe(FAQ_ENTRIES[i].answer);
    });
  });

  it('declares the app and its publisher', () => {
    const types = graph().map((node) => node['@type']);
    expect(types).toContain('WebApplication');
    expect(types).toContain('Organization');
  });
});
