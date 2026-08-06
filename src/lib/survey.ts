/**
 * Post-download micro-survey.
 *
 * Why this exists: the app spreads mostly through dark social (WhatsApp and
 * Telegram groups, Instagram DMs), all of which reaches Plausible as "Direct".
 * Referrers also can't see the organic loop — people who came *because they
 * saw someone else's framed picture*. Two one-tap questions close both gaps.
 *
 * Design rules, deliberately narrow:
 * - Fixed choices only. Answers ride along as Plausible custom props, so every
 *   value here must be low-cardinality and free of anything personal. Free
 *   text goes to Tally instead (see `tallyFormUrl`), never to Plausible.
 * - Two questions maximum per visitor: everyone gets `SOURCE_QUESTION`, plus
 *   one rotating question. Six questions' worth of coverage, two taps of cost.
 * - Asked once, after the picture is downloaded — never before the person got
 *   what they came for.
 */

/** Bump to re-ask everyone (e.g. a new wave with different questions). */
export const SURVEY_VERSION = 'v1';

/** Set once the survey is answered or dismissed, so it's never asked twice. */
export const SURVEY_STORAGE_KEY = `ppm-survey-${SURVEY_VERSION}`;

export interface SurveyOption {
  /** Stable, low-cardinality token — this is what reaches Plausible. */
  value: string;
  /** What the person actually reads. */
  label: string;
}

export interface SurveyQuestion {
  /** Sent as the `question` prop, so answers can be grouped in Plausible. */
  id: string;
  prompt: string;
  options: SurveyOption[];
}

/**
 * Question 1, asked of everyone: attribution, including the two things
 * analytics cannot see — private group chats and the organic loop.
 */
export const SOURCE_QUESTION: SurveyQuestion = {
  id: 'source',
  prompt: 'How did you find this?',
  options: [
    { value: 'group-chat', label: 'A WhatsApp or Telegram group' },
    { value: 'instagram-tiktok', label: 'Instagram or TikTok' },
    { value: 'x', label: 'X' },
    { value: 'facebook', label: 'Facebook' },
    { value: 'linkedin', label: 'LinkedIn' },
    { value: 'friend', label: 'A friend sent it to me' },
    { value: 'saw-framed-pic', label: "I saw someone's framed picture" },
    { value: 'search', label: 'A search engine' },
    { value: 'other', label: 'Somewhere else' },
  ],
};

/**
 * Question 2, one at random per visitor.
 *
 * `blocker` is the one worth watching. Everyone measures who shares; almost
 * nobody measures the people who make the picture and then quietly never post
 * it. Each answer maps to a fix — "how it lands at work" argues for a subtler
 * frame, "not sure what to say" argues for a caption library.
 */
export const ROTATING_QUESTIONS: SurveyQuestion[] = [
  {
    id: 'blocker',
    prompt: 'Anything making you hesitate to post it?',
    options: [
      { value: 'none', label: "Nothing — it's going up" },
      { value: 'work', label: 'How it might land at work' },
      { value: 'backlash', label: 'Worried about backlash' },
      { value: 'not-political', label: "I don't post political things" },
      { value: 'what-to-say', label: 'Not sure what to say with it' },
      { value: 'profile-only', label: 'I only wanted the picture' },
    ],
  },
  {
    id: 'improve',
    prompt: 'What would make this better?',
    options: [
      { value: 'frame-styles', label: 'More frame styles' },
      { value: 'add-text', label: 'Add my name or a slogan' },
      { value: 'quality', label: 'Higher quality output' },
      { value: 'platforms', label: 'Support for more platforms' },
      { value: 'languages', label: 'Other languages' },
      { value: 'nothing', label: "It's good as it is" },
    ],
  },
];

/**
 * Ways to go further than a profile picture, shown once the questions are
 * answered. This is the part that turns a 30-second visit into something
 * durable, so it earns its place next to the research.
 */
export const NEXT_STEPS: { value: string; label: string; href: string }[] = [
  {
    value: 'get-involved',
    label: 'Find a way to get involved',
    href: 'https://techforpalestine.org/get-involved',
  },
  {
    value: 'volunteer',
    label: 'Volunteer your skills',
    href: 'https://techforpalestine.org/volunteer',
  },
  {
    value: 'donate',
    label: 'Donate',
    href: 'https://techforpalestine.org/donate',
  },
  {
    value: 'updates',
    label: 'Get the updates',
    href: 'https://updates.techforpalestine.org',
  },
];

/** Pick this visitor's rotating question. Client-only (SSR must not diverge). */
export function pickRotatingQuestion(
  random: number = Math.random(),
): SurveyQuestion {
  const index = Math.min(
    ROTATING_QUESTIONS.length - 1,
    Math.floor(random * ROTATING_QUESTIONS.length),
  );
  return ROTATING_QUESTIONS[index];
}

/** The optional free-text follow-up, hosted on Tally. Unset = link hidden. */
export const TALLY_FORM_ID = process.env.NEXT_PUBLIC_TALLY_FORM_ID;

/**
 * Tally form URL carrying the chip answers as hidden fields, so a written
 * comment can be read next to the taps that preceded it. Only our own fixed
 * tokens are ever passed — nothing the visitor typed, nothing identifying.
 */
export function tallyFormUrl(
  formId: string,
  answers: Record<string, string>,
): string {
  const params = new URLSearchParams({ ...answers, from: 'ppm' });
  return `https://tally.so/r/${formId}?${params.toString()}`;
}
