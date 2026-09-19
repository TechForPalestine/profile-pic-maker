import type { MetadataRoute } from 'next';

import { APP_URL, IS_PRODUCTION_URL } from '@/lib/share';

export default function robots(): MetadataRoute.Robots {
  // Previews (NEXT_PUBLIC_APP_URL set to another origin) stay out of search.
  if (!IS_PRODUCTION_URL) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }
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
