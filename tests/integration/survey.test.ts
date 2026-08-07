import {
  NEXT_STEPS,
  PARKED_QUESTIONS,
  ROTATING_QUESTIONS,
  SURVEY_STORAGE_KEY,
  SURVEY_VERSION,
  SurveyQuestion,
  pickRotatingQuestion,
  tallyFormUrl,
} from '@/lib/survey';
import { describe, expect, it } from 'vitest';

const ALL_QUESTIONS: SurveyQuestion[] = [
  ...ROTATING_QUESTIONS,
  ...PARKED_QUESTIONS,
];

describe('survey questions', () => {
  it('keeps every answer token low-cardinality and safe to send to Plausible', () => {
    for (const question of ALL_QUESTIONS) {
      expect(question.id).toMatch(/^[a-z-]+$/);
      for (const option of question.options) {
        // Fixed tokens only: anything free-form here would leak into
        // analytics props, which is exactly what the survey must not do.
        expect(option.value).toMatch(/^[a-z0-9-]+$/);
        expect(option.label.length).toBeGreaterThan(0);
      }
    }
  });

  it('has unique option values within each question', () => {
    for (const question of ALL_QUESTIONS) {
      const values = question.options.map((option) => option.value);
      expect(new Set(values).size).toBe(values.length);
    }
  });

  it('has unique question ids so answers group correctly', () => {
    const ids = ALL_QUESTIONS.map((question) => question.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps the wave small enough for each question to collect a readable sample', () => {
    // Each visitor answers exactly one question, so the wave splits the same
    // downloads N ways. Past four, answers arrive too thinly to act on.
    expect(ROTATING_QUESTIONS.length).toBeGreaterThan(0);
    expect(ROTATING_QUESTIONS.length).toBeLessThanOrEqual(4);
  });

  it('does not ask a parked question and a live one at the same time', () => {
    const live = new Set(ROTATING_QUESTIONS.map((question) => question.id));
    for (const parked of PARKED_QUESTIONS) {
      expect(live.has(parked.id)).toBe(false);
    }
  });
});

describe('pickRotatingQuestion', () => {
  it('covers every question in the wave across the random range', () => {
    const picked = new Set(
      Array.from({ length: ROTATING_QUESTIONS.length }, (_, i) =>
        pickRotatingQuestion(i / ROTATING_QUESTIONS.length),
      ).map((question) => question.id),
    );
    expect(picked.size).toBe(ROTATING_QUESTIONS.length);
  });

  it('stays in range at the boundaries', () => {
    expect(pickRotatingQuestion(0)).toBe(ROTATING_QUESTIONS[0]);
    // Math.random() never returns 1, but a rounding edge must not overflow.
    expect(pickRotatingQuestion(0.999999)).toBe(
      ROTATING_QUESTIONS[ROTATING_QUESTIONS.length - 1],
    );
    expect(pickRotatingQuestion(1)).toBe(
      ROTATING_QUESTIONS[ROTATING_QUESTIONS.length - 1],
    );
  });
});

describe('next steps', () => {
  it('links only to Tech For Palestine properties over https', () => {
    for (const next of NEXT_STEPS) {
      const url = new URL(next.href);
      expect(url.protocol).toBe('https:');
      expect(url.hostname.endsWith('techforpalestine.org')).toBe(true);
    }
  });
});

describe('tallyFormUrl', () => {
  it('passes the tapped answer through as a hidden field', () => {
    const url = new URL(tallyFormUrl('abc123', { friction: 'too-slow' }));
    expect(url.origin + url.pathname).toBe('https://tally.so/r/abc123');
    expect(url.searchParams.get('friction')).toBe('too-slow');
    expect(url.searchParams.get('from')).toBe('ppm');
  });

  it('works with no answer recorded', () => {
    const url = new URL(tallyFormUrl('abc123', {}));
    expect(url.searchParams.get('from')).toBe('ppm');
  });
});

describe('storage key', () => {
  it('is versioned so a new wave can re-ask everyone', () => {
    expect(SURVEY_STORAGE_KEY).toBe(`ppm-survey-${SURVEY_VERSION}`);
  });
});
