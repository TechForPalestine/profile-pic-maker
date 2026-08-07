import { pageUrl } from '@/lib/seo';
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Nothing to index: the API routes are JSON, and /monitoring is the
      // Sentry tunnel configured in next.config.js.
      disallow: ['/api/', '/monitoring'],
    },
    sitemap: pageUrl('/sitemap.xml'),
  };
}
