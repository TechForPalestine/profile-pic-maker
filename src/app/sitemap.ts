import { LANDING_PAGES, pageUrl } from '@/lib/seo';
import type { MetadataRoute } from 'next';

/**
 * Every indexable page. Static routes only — nothing here reads from the
 * network or the request, so Next renders the sitemap at build time.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: pageUrl('/'),
      changeFrequency: 'weekly',
      priority: 1,
    },
    ...LANDING_PAGES.map(({ path }) => ({
      url: pageUrl(path),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
  ];
}
