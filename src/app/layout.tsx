import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';

import { buildSiteStructuredData } from '@/lib/faq';

import './globals.css';
import DomSafety from './dom-safety';

const inter = Inter({ subsets: ['latin'] });

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
        <Script
          src="https://plausible.io/js/pa-jox6Nfcg5lE6Iifkj-HHE.js"
          strategy="afterInteractive"
        />
        <Script id="plausible-init" strategy="afterInteractive">
          {`window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};plausible.init()`}
        </Script>
      </body>
    </html>
  );
}
