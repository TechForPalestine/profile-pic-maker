import Link from 'next/link';

import FramePreview from './frame-preview';
import RelatedLinks from './related-links';
import SiteFooter from './site-footer';

interface LandingShellProps {
  /** The page's single H1. */
  heading: string;
  /** One-line summary shown under the heading. */
  tagline: string;
  /** Wording of the button that sends people to the tool on the homepage. */
  ctaLabel: string;
  /** Route of this page, so it links to its siblings but not to itself. */
  path: string;
  /** The page's own copy, rendered under the call to action. */
  children: React.ReactNode;
}

/**
 * Shared chrome for the intent-based landing pages: heading, frame preview,
 * a button through to the tool, then the page's own copy and the cross-links.
 *
 * Only the structure is shared — every page writes its own heading, tagline
 * and body copy, so no two pages serve the same text.
 */
export default function LandingShell({
  heading,
  tagline,
  ctaLabel,
  path,
  children,
}: LandingShellProps) {
  return (
    <main className="min-h-screen flex flex-col text-center">
      <div className="flex-1 px-8 py-12 max-w-xl mx-auto w-full">
        <h1 className="font-semibold text-3xl mt-6">{heading}</h1>
        <p className="text-lg py-2">{tagline}</p>
        <FramePreview />
        <Link
          href="/"
          className="block rounded-full mb-8 py-3 px-2 w-full border border-gray-900 bg-gray-900 text-white text-xl"
        >
          {ctaLabel}
        </Link>
        <div className="text-left text-gray-600 flex flex-col gap-4">
          {children}
        </div>
        <p className="p-2 my-8 text-sm border rounded-lg">
          Note: Your image is processed entirely in your browser. No images are
          uploaded or saved by the app.
        </p>
      </div>
      <RelatedLinks currentPath={path} />
      <SiteFooter />
    </main>
  );
}
