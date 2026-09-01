import type { Metadata } from 'next';
import Link from 'next/link';

import { buildFaqStructuredData, FAQ_ENTRIES } from '@/lib/faq';

import FaqList from '../faq';

export const metadata: Metadata = {
  title: 'FAQ - Palestine Profile Pic Maker 🇵🇸',
  description:
    'Answers about the free Palestine Profile Pic Maker: how to add the Palestinian flag frame to your profile picture, whether your photo is uploaded, and how to use the framed photo on X, Instagram, WhatsApp, LinkedIn, and Facebook.',
  alternates: {
    canonical: '/faq',
  },
};

export default function FaqPage() {
  return (
    <main className="min-h-screen flex flex-col text-center">
      {/* All entries are visible here, so this is where the FAQPage
          structured data belongs (Google requires them to match). */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildFaqStructuredData()),
        }}
      />
      <div className="flex-1 flex flex-col px-8 py-12 max-w-xl mx-auto w-full">
        <h1 className="text-3xl font-bold mb-6">Frequently Asked Questions</h1>
        <FaqList entries={FAQ_ENTRIES} />
        <p className="mt-8">
          <Link
            href="/"
            className="inline-block rounded-full py-3 px-6 border border-gray-900 text-xl"
          >
            Make your profile picture
          </Link>
        </p>
      </div>
      <footer className="bg-[#303846] text-center py-8 px-4">
        <div className="container max-w-xl mx-auto">
          <div className="mb-4">
            <a
              href="https://techforpalestine.org"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block"
            >
              <img
                src="/img/logo.svg"
                alt="Tech For Palestine Logo"
                width={320}
                height={180}
                className="mx-auto"
              />
            </a>
          </div>
          <p className="text-sm text-[#ebedf0]">
            An open source initiative of the Tech For Palestine collective
          </p>
        </div>
      </footer>
    </main>
  );
}
