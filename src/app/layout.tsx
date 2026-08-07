import { APP_URL } from '@/lib/share';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';

import './globals.css';
import DomSafety from './dom-safety';

const inter = Inter({ subsets: ['latin'] });

// Defaults for the site. The homepage inherits all of this; the landing pages
// under src/app/* each export their own title, description, canonical and
// Open Graph block, which replace these.
export const metadata: Metadata = {
  title: 'Palestine Profile Pic Maker 🇵🇸',
  description:
    'Free tool to frame your profile picture with the colors of Palestine. Your photo is framed in your browser and never uploaded. No account needed. #IStandWithPalestine',
  metadataBase: new URL(APP_URL),
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Palestine Profile Pic Maker 🇵🇸',
    description:
      'Create your Palestine profile picture to show your support. Free, no sign-up, and your photo never leaves your browser.',
    siteName: 'Palestine Profile Pic Maker 🇵🇸',
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
