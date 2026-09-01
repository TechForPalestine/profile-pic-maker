import type { MetadataRoute } from 'next';

import { APP_URL } from '@/lib/share';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // The API routes and the Sentry tunnel carry no indexable content.
      disallow: ['/api/', '/monitoring'],
    },
    sitemap: `${APP_URL}sitemap.xml`,
  };
}
