import { LANDING_PAGES } from '@/lib/seo';
import Link from 'next/link';

/**
 * Cross-links between the landing pages, the tool and the FAQ. Every page
 * links to every other one, so someone who arrived on the "flag border" page
 * can reach the Facebook page — and so crawlers find all of them from any
 * single entry point.
 *
 * `currentPath` is the route rendering the links: that page is left out, and
 * on the homepage the tool and FAQ links are dropped too, since both are
 * already on the page.
 */
export default function RelatedLinks({ currentPath }: { currentPath: string }) {
  const isHome = currentPath === '/';
  const others = LANDING_PAGES.filter(({ path }) => path !== currentPath);

  return (
    <nav className="px-8 pb-12 max-w-xl mx-auto w-full text-left">
      <h2 className="font-semibold text-2xl text-center mb-6">
        {isHome ? 'More about the frame' : 'Related pages'}
      </h2>
      <ul className="flex flex-col gap-3">
        {!isHome && (
          <li>
            <Link
              href="/"
              className="block border rounded-lg p-4 underline hover:text-gray-900"
            >
              Palestine Profile Pic Maker — open the tool
            </Link>
          </li>
        )}
        {others.map(({ path, label }) => (
          <li key={path}>
            <Link
              href={path}
              className="block border rounded-lg p-4 underline hover:text-gray-900"
            >
              {label}
            </Link>
          </li>
        ))}
        {!isHome && (
          <li>
            <Link
              href="/#faq"
              className="block border rounded-lg p-4 underline hover:text-gray-900"
            >
              FAQ — privacy, file formats and where the picture works
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}
