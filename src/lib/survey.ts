/**
 * Post-download micro-survey.
 *
 * One question, one tap, asked once — after the picture is downloaded, never
 * before the person got what they came for.
 *
 * Design rules, deliberately narrow:
 * - Fixed choices only. Answers ride along as Plausible custom props, so every
 *   value here must be low-cardinality and free of anything personal. Free
 *   text goes to Tally instead (see `tallyFormUrl`), never to Plausible.
 * - One question per visitor, drawn at random from the current wave. Four
 *   questions' worth of coverage at the cost of a single tap.
 * - Keep a wave to three or four questions. Every extra question splits the
 *   same downloads further, and a question nobody has answered enough times
 *   can't be read. Swap the set and bump `SURVEY_VERSION` for the next wave.
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
 * The current wave. Each visitor is asked exactly one of these.
 *
 * `destination` and `attention` look similar and are not: the first is where
 * the framed picture is going (which decides what we build — a LinkedIn answer
 * argues for a subtler frame, an Instagram answer for story sizes), the second
 * is where that person's attention actually lives (which decides where a
 * campaign should go). Someone can easily scroll TikTok all day and only
 * change their WhatsApp photo.
 */
export const ROTATING_QUESTIONS: SurveyQuestion[] = [
  {
    id: 'destination',
    prompt: 'Where will you use this picture?',
    options: [
      { value: 'whatsapp', label: 'WhatsApp' },
      { value: 'instagram', label: 'Instagram' },
      { value: 'linkedin', label: 'LinkedIn' },
      { value: 'x', label: 'X' },
      { value: 'facebook', label: 'Facebook' },
      { value: 'work-chat', label: 'Work Slack or Teams' },
      { value: 'keeping-it', label: 'Just keeping it for now' },
    ],
  },
  {
    id: 'attention',
    prompt: 'Where do you spend the most time online?',
    options: [
      { value: 'instagram', label: 'Instagram' },
      { value: 'tiktok', label: 'TikTok' },
      { value: 'whatsapp', label: 'WhatsApp or Telegram' },
      { value: 'x', label: 'X' },
      { value: 'facebook', label: 'Facebook' },
      { value: 'linkedin', label: 'LinkedIn' },
      { value: 'youtube', label: 'YouTube' },
    ],
  },
  {
    // Whether this spreads in clusters or reaches isolated individuals. Mostly
    // "none" would mean the organic loop is broken and every visitor is a
    // fresh acquisition — a very different growth problem.
    id: 'network',
    prompt: "Do you know other people who've framed their picture?",
    options: [
      { value: 'lots', label: 'Lots of them' },
      { value: 'a-few', label: 'A few' },
      { value: 'one-or-two', label: 'One or two' },
      { value: 'none', label: "None that I've seen" },
    ],
  },
  {
    // Friction on the path people *completed* — the cheapest wins live here.
    id: 'friction',
    prompt: 'What almost stopped you from finishing?',
    options: [
      { value: 'nothing', label: 'Nothing' },
      { value: 'how-it-looks', label: "Wasn't sure it'd look good" },
      {
        value: 'photo-privacy',
        label: 'Worried about my photo being uploaded',
      },
      { value: 'too-slow', label: 'It took too long' },
      { value: 'unclear', label: "Wasn't sure how it worked" },
    ],
  },
];

/**
 * Parked for a later wave. Kept here so they aren't lost — move one into
 * `ROTATING_QUESTIONS` (and bump `SURVEY_VERSION`) when the current wave has
 * collected enough answers to read.
 *
 * `hesitation` is the one worth coming back to: everyone measures who shares,
 * almost nobody measures the people who make the picture and then quietly
 * never post it, and each answer maps to a fix.
 */
export const PARKED_QUESTIONS: SurveyQuestion[] = [
  {
    id: 'hesitation',
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
];

/**
 * Ways to go further than a profile picture, shown once the question is
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

/** Pick this visitor's question. Client-only (SSR must not diverge). */
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
 * Tally form URL carrying the tapped answer as a hidden field, so a written
 * comment can be read next to it. Only our own fixed tokens are ever passed —
 * nothing the visitor typed, nothing identifying.
 */
export function tallyFormUrl(
  formId: string,
  answers: Record<string, string>,
): string {
  const params = new URLSearchParams({ ...answers, from: 'ppm' });
  return `https://tally.so/r/${formId}?${params.toString()}`;
}
