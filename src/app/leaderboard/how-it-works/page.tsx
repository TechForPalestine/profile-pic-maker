import type { Metadata } from 'next';
import Link from 'next/link';

import SiteFooter from '../../site-footer';
import { notFound } from 'next/navigation';

import { leaderboardEnabled } from '@/lib/referral';

export const metadata: Metadata = {
  title: 'How the leaderboard works - Palestine Profile Pic Maker 🇵🇸',
  description:
    'What counts on the promoter leaderboard, how referral links are attributed, how listing is approved, and what is never tracked.',
  alternates: {
    canonical: '/leaderboard/how-it-works',
  },
};

const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: 'What counts',
    body: (
      <>
        One point for every <strong>person</strong> who opens the tool through
        your link and saves a framed picture. Ten downloads by the same person
        count once. Visits without a download count for nothing.
      </>
    ),
  },
  {
    title: 'Visits are shown, downloads are ranked',
    body: (
      <>
        Each row also shows how many people opened your link. That number is for
        you, to see how well your audience converts. It never changes the
        ranking.
      </>
    ),
  },
  {
    title: 'How long your link follows someone',
    body: (
      <>
        The first referral link a browser opens is remembered for 30 days.
        Someone who saves your link today and makes their picture next week
        still counts for you. If they opened another promoter&apos;s link first,
        that promoter keeps the credit.
      </>
    ),
  },
  {
    title: 'Three views',
    body: (
      <>
        <strong>Today</strong>, <strong>Last 7 days</strong> and{' '}
        <strong>All time</strong>. The first two reset on their own, so a new
        promoter can top the daily board on their first day. Numbers refresh
        every few minutes.
      </>
    ),
  },
  {
    title: 'Bringing other promoters on board',
    body: (
      <>
        When someone opens your link, then creates their own link within 30 days
        in the same browser and asks to be listed, your row shows that you
        brought them on board once you are both listed. It is a badge, not
        points: the ranking is downloads only.
      </>
    ),
  },
  {
    title: 'Getting listed',
    body: (
      <>
        Your link works the moment you create it, and the leaderboard shows you
        your own count right away, marked as pending. To appear on the board for
        everyone, with your name and profiles, ask to be listed and a Tech for
        Palestine volunteer reviews the request, usually within a few hours and
        at most a day. We check that the name is not impersonating someone, that
        the links go to real public profiles, and that nothing on them is
        hateful or abusive. Entries can be taken down at any time for the same
        reasons.
      </>
    ),
  },
  {
    title: 'What is never tracked',
    body: (
      <>
        Nothing about the people who use your link. No accounts, no photos
        (pictures never leave the visitor&apos;s device), no personal data. The
        only value that travels with a download is your public code, and
        analytics run on Plausible, which sets no cookies.
      </>
    ),
  },
  {
    title: 'Fair play',
    body: (
      <>
        One person, one code. No bots, no paid clicks, no automation. Counts
        that look inorganic are removed and the entry with them. If you think a
        count is wrong, open an issue on GitHub and a maintainer will look.
      </>
    ),
  },
];

export default function HowItWorksPage() {
  if (!leaderboardEnabled()) notFound();
  return (
    <main className="min-h-screen flex flex-col text-center">
      <div className="flex-1 flex flex-col px-6 py-12 max-w-xl mx-auto w-full">
        <h1 className="text-3xl font-bold">How the leaderboard works</h1>
        <p className="text-gray-600 mt-2 mb-8">
          A friendly competition to get more people to show solidarity.
        </p>
        <div className="space-y-5 text-left">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="font-semibold text-lg">{section.title}</h2>
              <p className="text-gray-700 text-sm mt-1">{section.body}</p>
            </section>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            href="/leaderboard/join"
            className="rounded-full py-3 px-6 border border-gray-900 bg-gray-900 text-white text-lg"
          >
            Get your link
          </Link>
          <Link
            href="/leaderboard"
            className="rounded-full py-3 px-6 border border-gray-900 text-lg"
          >
            See the leaderboard
          </Link>
        </div>
        <p className="mt-6 text-sm text-gray-600">
          Questions or a dispute?{' '}
          <a
            href="https://github.com/TechForPalestine/profile-pic-maker/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Open an issue on GitHub
          </a>
        </p>
      </div>
      <SiteFooter />
    </main>
  );
}
