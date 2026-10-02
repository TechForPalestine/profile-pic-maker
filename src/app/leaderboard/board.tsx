'use client';
import { useEffect, useState } from 'react';
import { FaUserGroup } from 'react-icons/fa6';

import { ReferralEvent, trackEvent } from '@/lib/analytics';
import { WINDOW_LABELS, type LeaderboardResponse } from '@/lib/leaderboard';
import {
  fetchOwnListingStatus,
  readMyPromoter,
  type MyPromoter,
  type OwnListingStatus,
} from '@/lib/my-promoter';
import {
  LEADERBOARD_WINDOWS,
  type LeaderboardWindow,
} from '@/lib/plausible-stats';
import { hashReferralCode } from '@/lib/referral';

import ProfileLink from './social-links';

type BoardState =
  | { status: 'loading' }
  | { status: 'ready'; board: LeaderboardResponse }
  | { status: 'unavailable' }
  | { status: 'error' };

/**
 * The link this browser created, with its fingerprint for `pendingCounts`
 * and where its listing request stands according to the server.
 */
interface Mine extends MyPromoter {
  hash: string;
  listing: OwnListingStatus;
}

/** Badge and one-line explanation for the promoter's own unlisted row. */
const OWN_ROW_COPY: Record<
  OwnListingStatus,
  { badge: string; text: string; joinLink?: string }
> = {
  'not-sent': {
    badge: 'only you can see this',
    text: 'Ask to be listed and your name appears here for everyone once approved.',
    joinLink: 'Ask to be listed',
  },
  none: {
    badge: 'request not found',
    text: 'Your listing request never reached a volunteer. Please send it again; your count is safe.',
    joinLink: 'Send it again',
  },
  pending: {
    badge: 'pending review',
    text: 'Your name appears for everyone once a volunteer approves it, usually within a few hours and at most a day.',
  },
  unknown: {
    badge: 'pending review',
    text: 'Your name appears for everyone once a volunteer approves it, usually within a few hours and at most a day.',
  },
  approved: {
    badge: 'approved',
    text: 'Approved. Your name appears for everyone within a few minutes.',
  },
  rejected: {
    badge: 'not approved',
    text: 'The public listing was declined, but your link still works and every download still counts for you.',
  },
};

export default function Board() {
  const [window, setWindow] = useState<LeaderboardWindow>('7d');
  const [state, setState] = useState<BoardState>({ status: 'loading' });
  const [mine, setMine] = useState<Mine>();

  useEffect(() => {
    // Browser-only: the promoter's own code lives in localStorage.
    const own = readMyPromoter();
    if (!own) return;
    let cancelled = false;
    Promise.all([hashReferralCode(own.code), fetchOwnListingStatus(own)]).then(
      ([hash, listing]) => {
        if (!cancelled) setMine({ ...own, hash, listing });
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ status: 'loading' });
    trackEvent(ReferralEvent.BoardViewed, { window });
    fetch(`/api/leaderboard?window=${window}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 503) {
          setState({ status: 'unavailable' });
        } else if (!res.ok) {
          setState({ status: 'error' });
        } else {
          setState({
            status: 'ready',
            board: (await res.json()) as LeaderboardResponse,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [window]);

  return (
    <div>
      <div
        role="tablist"
        aria-label="Time window"
        className="inline-flex rounded-full border border-gray-300 p-1 bg-gray-50 mb-6"
      >
        {LEADERBOARD_WINDOWS.map((option) => (
          <button
            key={option}
            role="tab"
            aria-selected={option === window}
            onClick={() => setWindow(option)}
            className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
              option === window
                ? 'bg-gray-900 text-white'
                : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            {WINDOW_LABELS[option]}
          </button>
        ))}
      </div>

      {state.status === 'loading' && (
        <p className="text-gray-500 py-8" aria-live="polite">
          Counting…
        </p>
      )}
      {state.status === 'unavailable' && (
        <div className="rounded-2xl border border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-600">
          <p className="font-semibold text-gray-900">
            The board is warming up.
          </p>
          <p>
            Referral links already count. The numbers appear here as soon as the
            analytics connection is switched on.
          </p>
        </div>
      )}
      {state.status === 'error' && (
        <p role="alert" className="text-sm text-gray-600 py-8">
          The leaderboard could not be loaded right now. Try again in a minute.
        </p>
      )}
      {state.status === 'ready' && (
        <BoardTable board={state.board} mine={mine} />
      )}
    </div>
  );
}

function BoardTable({
  board,
  mine,
}: {
  board: LeaderboardResponse;
  mine?: Mine;
}) {
  const topDownloads = board.promoters[0]?.downloads ?? 0;
  const mineIsListed = mine
    ? board.promoters.some((row) => row.code === mine.code)
    : false;
  const pending =
    mine && !mineIsListed
      ? (board.pendingCounts[mine.hash] ?? { downloads: 0, visits: 0 })
      : undefined;

  return (
    <div className="text-left">
      {mine && pending && (
        <div
          data-testid="my-pending-row"
          className="mb-4 rounded-2xl border-2 border-dashed border-[#149954] bg-white px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <span
              className="w-8 shrink-0 text-center text-lg"
              aria-hidden="true"
            >
              👋
            </span>
            <div className="flex-1 min-w-0">
              <span className="font-semibold">
                {mine.displayName || 'Your link'}
              </span>{' '}
              <span
                data-testid="my-listing-badge"
                className="text-xs rounded-full bg-gray-100 px-2 py-0.5 text-gray-700"
              >
                {OWN_ROW_COPY[mine.listing].badge}
              </span>
              <p className="text-xs text-gray-600 mt-0.5">
                {OWN_ROW_COPY[mine.listing].text}{' '}
                {OWN_ROW_COPY[mine.listing].joinLink && (
                  <a href="/leaderboard/join" className="underline">
                    {OWN_ROW_COPY[mine.listing].joinLink}
                  </a>
                )}
              </p>
            </div>
            <Counts downloads={pending.downloads} visits={pending.visits} />
          </div>
        </div>
      )}
      {board.promoters.length === 0 ? (
        <div className="rounded-2xl border border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-600 text-center">
          <p className="font-semibold text-gray-900">Nobody is listed yet.</p>
          <p>Get your link below and be the first name here.</p>
        </div>
      ) : (
        <ol className="space-y-2" aria-label="Promoters">
          {board.promoters.map((row) => (
            <li
              key={row.code}
              data-mine={mine?.code === row.code || undefined}
              className={`rounded-2xl border bg-white px-4 py-3 ${
                mine?.code === row.code
                  ? 'border-2 border-[#149954]'
                  : 'border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-8 shrink-0 text-center text-lg font-bold ${
                    row.rank <= 3 ? 'text-gray-900' : 'text-gray-400'
                  }`}
                  aria-label={`Rank ${row.rank}`}
                >
                  {row.rank === 1
                    ? '🥇'
                    : row.rank === 2
                      ? '🥈'
                      : row.rank === 3
                        ? '🥉'
                        : row.rank}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2">
                    <span className="font-semibold truncate">
                      {row.displayName}
                    </span>
                    {mine?.code === row.code && (
                      <span className="text-xs rounded-full bg-[#149954] px-2 py-0.5 text-white">
                        you
                      </span>
                    )}
                    <ProfileLink name={row.displayName} link={row.link} />
                  </div>
                  {row.recruits > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                      <FaUserGroup />
                      brought {row.recruits}{' '}
                      {row.recruits === 1 ? 'promoter' : 'promoters'} on board
                    </span>
                  )}
                </div>
                <Counts downloads={row.downloads} visits={row.visits} />
              </div>
              {topDownloads > 0 && (
                <div
                  className="mt-2 h-1 rounded-full bg-gray-100 overflow-hidden"
                  aria-hidden="true"
                >
                  <div
                    className="h-full bg-[#149954]"
                    style={{
                      width: `${Math.max(2, (row.downloads / topDownloads) * 100)}%`,
                    }}
                  />
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
      <p className="mt-6 text-xs text-gray-400 text-center">
        Ranked by people who downloaded. Visits are people who opened the link.
        Updated {new Date(board.generatedAt).toLocaleString()} · refreshes every
        few minutes
      </p>
    </div>
  );
}

/** Downloads large (the rank), visits small underneath (the context). */
function Counts({ downloads, visits }: { downloads: number; visits: number }) {
  return (
    <div className="text-right shrink-0">
      <span className="block text-xl font-bold">
        {downloads.toLocaleString()}
      </span>
      <span className="block text-xs text-gray-500">
        {downloads === 1 ? 'download' : 'downloads'}
      </span>
      <span className="block text-xs text-gray-400" data-testid="visits">
        {visits.toLocaleString()} {visits === 1 ? 'visit' : 'visits'}
      </span>
    </div>
  );
}
