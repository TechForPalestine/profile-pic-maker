import { LANDING_PAGES } from '@/lib/seo';
import Link from 'next/link';

/**
 * Cross-links shown at the foot of the landing pages, never on the homepage:
 * someone who searched their way onto one of these pages may want a different
 * one, but a visitor who came for the tool should not be sent on a tour of
 * keyword pages.
 *
 * `currentPath` is the page rendering the links, which is left out of the list.
 */
export default function RelatedLinks({ currentPath }: { currentPath: string }) {
  const others = LANDING_PAGES.filter(({ path }) => path !== currentPath);

  return (
    <nav className="px-8 pb-12 max-w-xl mx-auto w-full text-left">
      <h2 className="font-semibold text-2xl text-center mb-6">Related pages</h2>
      <ul className="flex flex-col gap-3">
        <li>
          <Link
            href="/"
            className="block border rounded-lg p-4 underline hover:text-gray-900"
          >
            Open the Palestine Profile Pic Maker
          </Link>
        </li>
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
        <li>
          <Link
            href="/#faq"
            className="block border rounded-lg p-4 underline hover:text-gray-900"
          >
            FAQ: privacy, file formats and where the picture works
          </Link>
        </li>
      </ul>
    </nav>
  );
}
