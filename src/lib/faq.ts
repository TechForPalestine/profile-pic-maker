import { APP_URL } from '@/lib/share';

export interface FaqEntry {
  question: string;
  answer: string;
  link?: { href: string; label: string };
  // Featured entries also render on the home page; everything renders on /faq.
  featured?: boolean;
}

// Single source of truth for the FAQ: the visible sections (home teaser and
// the /faq page) and the FAQPage JSON-LD all render from this list, so the
// structured data can never drift from what visitors actually read (a
// requirement for Google's rich results).
//
// Answers lead with a direct one-sentence answer and stay self-contained, so
// search and AI answer engines can quote them without surrounding context.
export const FAQ_ENTRIES: FaqEntry[] = [
  {
    question: 'How do I add a Palestine flag frame to my profile picture?',
    answer:
      'Pick a photo from your device or import your current avatar, and the Palestine Profile Pic Maker instantly wraps it in a Palestinian flag ring, right in your browser. Save the framed picture as a PNG, then set it as your profile photo on any platform. The whole process takes under a minute and requires no account.',
    featured: true,
  },
  {
    question: 'Is the Palestine Profile Pic Maker free?',
    answer:
      'Yes. The Palestine Profile Pic Maker is completely free, with no sign-up, no ads, and no watermark by default. It is an open source project built by the Tech for Palestine collective, and the full source code is publicly available on GitHub.',
  },
  {
    question: 'Is my photo uploaded anywhere? Is this safe to use?',
    answer:
      'Your photo never leaves your device: the image is processed entirely in your browser, and no images are uploaded or saved by the app. The tool is open source, so anyone can inspect the code on GitHub to verify exactly how it works.',
    featured: true,
  },
  {
    question:
      'Can I use my existing X (Twitter), GitHub, GitLab, or Bluesky avatar?',
    answer:
      'Yes. Instead of choosing a file, enter your username and the tool fetches your current avatar from X (Twitter), GitHub, GitLab, or Bluesky automatically, then applies the Palestine flag frame to it. You do not need a copy of the original image.',
  },
  {
    question: "Why doesn't it work inside the Instagram or Facebook app?",
    answer:
      'The in-app browsers built into Instagram and Facebook block the step that saves the framed image to your device. Open ppm.techforpalestine.org in a regular browser such as Chrome or Safari instead, and everything works normally.',
    featured: true,
  },
  {
    question:
      'How do I set the framed photo as my profile picture on X, Instagram, WhatsApp, LinkedIn, or Facebook?',
    answer:
      'First save the framed PNG to your device. On X, open your profile, tap Edit profile, then the camera icon. On Instagram, tap Edit profile, then Change photo. On WhatsApp, open Settings, tap your photo, then Edit. On LinkedIn and Facebook, open your profile and tap your current photo to replace it.',
  },
  {
    question: 'Can I go back to my original photo later?',
    answer:
      'Yes. The tool never changes your original file; it creates a new framed copy. Whenever you want to switch back, set your previous picture as your profile photo again on the platform.',
  },
  {
    question: 'What is the ppm.t4p.al text I can add to the frame?',
    answer:
      'It is an optional short link to this tool, drawn along the bottom of the flag ring so people who see your picture can make their own. It is off by default, and the framed picture is yours either way.',
  },
  {
    question: 'Who built the Palestine Profile Pic Maker?',
    answer:
      'The Palestine Profile Pic Maker was built by Tech for Palestine, an open source collective of engineers, founders, and technologists. The live casualty figures shown on the page come from the collective’s data project at data.techforpalestine.org.',
    link: {
      href: 'https://techforpalestine.org',
      label: 'techforpalestine.org',
    },
  },
  {
    question: 'Can I report a bug or contribute?',
    answer:
      'Yes. Report bugs or request features by opening an issue, or contribute directly with a pull request on the TechForPalestine/profile-pic-maker repository on GitHub.',
    link: {
      href: 'https://github.com/TechForPalestine/profile-pic-maker',
      label: 'View the project on GitHub',
    },
  },
];

export const FEATURED_FAQ_ENTRIES = FAQ_ENTRIES.filter(
  (entry) => entry.featured,
);

const ORGANIZATION_ID = 'https://techforpalestine.org/#organization';

/**
 * Site-wide schema.org JSON-LD (the app and its publisher), rendered once in
 * the root layout so every page carries the who/what/cost.
 */
export function buildSiteStructuredData(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        '@id': `${APP_URL}#app`,
        name: 'Palestine Profile Pic Maker',
        url: APP_URL,
        description:
          'Free in-browser tool that frames your profile picture with the colors of the Palestinian flag. No account, no upload: images are processed entirely on your device.',
        applicationCategory: 'DesignApplication',
        operatingSystem: 'Any',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        publisher: { '@id': ORGANIZATION_ID },
      },
      {
        '@type': 'Organization',
        '@id': ORGANIZATION_ID,
        name: 'Tech for Palestine',
        url: 'https://techforpalestine.org',
        sameAs: ['https://github.com/TechForPalestine'],
      },
    ],
  };
}

/**
 * FAQPage JSON-LD, rendered only on /faq where all the entries are visible:
 * Google requires the marked-up Q&A to appear on the same page.
 */
export function buildFaqStructuredData(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${APP_URL}faq#faq`,
    mainEntity: FAQ_ENTRIES.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: { '@type': 'Answer', text: entry.answer },
    })),
  };
}
