import type { Metadata } from 'next';
import Link from 'next/link';

import SiteFooter from '../../site-footer';
import JoinForm from './join-form';

export const metadata: Metadata = {
  title: 'Get your referral link - Palestine Profile Pic Maker 🇵🇸',
  description:
    'Create a personal link to the Palestine Profile Pic Maker, share it, and get credit on the promoter leaderboard for everyone who frames their picture through it.',
  alternates: {
    canonical: '/leaderboard/join',
  },
};

export default function JoinPage() {
  return (
    <main className="min-h-screen flex flex-col text-center">
      <div className="flex-1 flex flex-col px-6 py-12 max-w-xl mx-auto w-full">
        <h1 className="text-3xl font-bold">Get your link 🔗</h1>
        <p className="text-gray-600 mt-2 mb-6">
          Share it anywhere. Everyone who frames their picture through your link
          counts for you, from the very first click.
        </p>
        <JoinForm />
        <p className="mt-8 text-sm text-gray-600">
          <Link href="/leaderboard/how-it-works" className="underline">
            How the leaderboard works
          </Link>
          {' · '}
          <Link href="/leaderboard" className="underline">
            See the leaderboard
          </Link>
        </p>
      </div>
      <SiteFooter />
    </main>
  );
}
