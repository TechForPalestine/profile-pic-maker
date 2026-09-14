import type { Metadata } from 'next';
import Link from 'next/link';

import SiteFooter from '../site-footer';
import Board from './board';

export const metadata: Metadata = {
  title: 'Promoter Leaderboard - Palestine Profile Pic Maker 🇵🇸',
  description:
    'The people bringing the most others to frame their profile picture in solidarity with Palestine. Today, this week, and all time.',
  alternates: {
    canonical: '/leaderboard',
  },
};

export default function LeaderboardPage() {
  return (
    <main className="min-h-screen flex flex-col text-center">
      <div className="flex-1 flex flex-col px-6 py-12 max-w-xl mx-auto w-full">
        <h1 className="text-3xl font-bold">Promoter Leaderboard 🏆</h1>
        <p className="text-gray-600 mt-2 mb-6">
          Who is bringing the most people to frame their picture. Counted from
          referral links, one download per person.
        </p>
        <Board />
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/leaderboard/join"
            className="rounded-full py-3 px-6 border border-gray-900 bg-gray-900 text-white text-lg"
          >
            Get your link
          </Link>
          <Link
            href="/leaderboard/how-it-works"
            className="rounded-full py-3 px-6 border border-gray-900 text-lg"
          >
            How it works
          </Link>
        </div>
        <p className="mt-8">
          <Link href="/" className="underline text-gray-600">
            Make your profile picture
          </Link>
        </p>
      </div>
      <SiteFooter />
    </main>
  );
}
