import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';

import { buildSiteStructuredData } from '@/lib/faq';

import './globals.css';
import DomSafety from './dom-safety';

const inter = Inter({ subsets: ['latin'] });

// Plausible's per-site script. Previews point this at a staging site, or set
// it to `off` so test traffic never lands in the production dashboard (every
// `trackEvent` then no-ops, since `window.plausible` is never defined).
// The init snippet runs before hydration so events fired on mount (Landed)
// queue until the script loads instead of being dropped.
const DEFAULT_PLAUSIBLE_SCRIPT_SRC =
  'https://plausible.io/js/pa-jox6Nfcg5lE6Iifkj-HHE.js';
const PLAUSIBLE_SCRIPT_SRC =
  process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_SRC?.trim() ||
  DEFAULT_PLAUSIBLE_SCRIPT_SRC;
const PLAUSIBLE_ENABLED = PLAUSIBLE_SCRIPT_SRC !== 'off';

export const metadata: Metadata = {
  title: 'Palestine Profile Pic Maker 🇵🇸',
  description:
    'Frame your profile with the colors of Palestine. Let your profile picture speak volumes for peace and justice. #IStandWithPalestine',
  metadataBase: new URL('https://ppm.techforpalestine.org'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Palestine Profile Pic Maker 🇵🇸',
    description: 'Create your Palestine profile picture to show your support',
    siteName: 'Palestine Profile Pic Maker 🇵🇸',
    images: '/social-card.png',
    url: '/',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Palestine Profile Pic Maker 🇵🇸',
    description: 'Create your Palestine profile picture to show your support',
    images: '/social-card.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <DomSafety />
        {/* schema.org data (app and publisher) for search and AI engines;
            rendered server-side so it's always in the initial HTML. The
            FAQPage schema lives on /faq, next to the visible questions. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(buildSiteStructuredData()),
          }}
        />
        {children}
        {/* Privacy-friendly analytics by Plausible */}
        {PLAUSIBLE_ENABLED && (
          <>
            <Script src={PLAUSIBLE_SCRIPT_SRC} strategy="afterInteractive" />
            <Script id="plausible-init" strategy="beforeInteractive">
              {`window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};plausible.init()`}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
