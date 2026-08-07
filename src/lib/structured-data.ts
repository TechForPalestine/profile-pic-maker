import { APP_URL } from './share';
import { SITE_NAME } from './seo';

/**
 * schema.org JSON-LD builders. Shapes follow the schema.org vocabulary and
 * Google's structured-data requirements:
 *  - WebApplication: https://schema.org/WebApplication
 *  - FAQPage / Question / Answer: https://schema.org/FAQPage
 *
 * A free tool still needs an `offers` node with `price: '0'` and a currency,
 * because Google's "free" signal comes from the price, not from omitting the
 * offer.
 */

interface FaqItem {
  question: string;
  answer: string;
}

export function webApplicationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: SITE_NAME,
    url: APP_URL,
    description:
      'A free browser-based tool that frames your profile picture with the Palestinian flag. Your photo is processed in your browser and never uploaded.',
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires a modern browser with JavaScript enabled',
    isAccessibleForFree: true,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    author: {
      '@type': 'Organization',
      name: 'Tech For Palestine',
      url: 'https://techforpalestine.org',
    },
  };
}

export function faqPageSchema(items: readonly FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: answer,
      },
    })),
  };
}
