import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';

import './globals.css';
import DomReconciliationPatch from './dom-reconciliation-patch';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Palestine Profile Pic Maker 🇵🇸',
  description:
    'Frame your profile with the colors of Palestine. Let your profile picture speak volumes for peace and justice. #IStandWithPalestine',
  metadataBase: new URL('https://ppm.techforpalestine.org'),
  openGraph: {
    title: 'Palestine Profile Pic Maker 🇵🇸',
    description: 'Create your Palestine profile picture to show your support',
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
        <DomReconciliationPatch />
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
