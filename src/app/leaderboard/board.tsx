'use client';
import { useEffect, useState } from 'react';
import { FaUserGroup } from 'react-icons/fa6';

import { ReferralEvent, trackEvent } from '@/lib/analytics';
import { WINDOW_LABELS, type LeaderboardResponse } from '@/lib/leaderboard';
import {
  LEADERBOARD_WINDOWS,
  type LeaderboardWindow,
} from '@/lib/plausible-stats';

import SocialLinks from './social-links';

type BoardState =
  | { status: 'loading' }
  | { status: 'ready'; board: LeaderboardResponse }
  | { status: 'unavailable' }
  | { status: 'error' };

export default function Board() {
  const [window, setWindow] = useState<LeaderboardWindow>('7d');
  const [state, setState] = useState<BoardState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ status: 'loading' });
    trackEvent(ReferralEvent.LeaderboardViewed, { window });
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
      {state.status === 'ready' && <BoardTable board={state.board} />}
    </div>
  );
}

function BoardTable({ board }: { board: LeaderboardResponse }) {
  const topDownloads = board.promoters[0]?.downloads ?? 0;
  const channelTotal = board.channels.reduce((sum, c) => sum + c.downloads, 0);

  return (
    <div className="text-left">
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
              className="rounded-2xl border border-gray-300 bg-white px-4 py-3"
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
                    <SocialLinks name={row.displayName} links={row.links} />
                  </div>
                  {row.recruits > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                      <FaUserGroup />
                      brought {row.recruits}{' '}
                      {row.recruits === 1 ? 'promoter' : 'promoters'} on board
                    </span>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <span className="block text-xl font-bold">
                    {row.downloads.toLocaleString()}
                  </span>
                  <span className="block text-xs text-gray-500">
                    {row.downloads === 1 ? 'download' : 'downloads'}
                  </span>
                </div>
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

      {board.channels.length > 0 && (
        <section className="mt-10" aria-labelledby="channels-heading">
          <h2 id="channels-heading" className="text-lg font-semibold">
            Where downloads come from
          </h2>
          <p className="text-xs text-gray-500 mb-3">
            By the source of the visit,{' '}
            {WINDOW_LABELS[board.window].toLowerCase()}. Promoter counts above
            credit the first link a person opened in the last 30 days, so the
            two views need not add up.
          </p>
          <ul className="space-y-2">
            {board.channels.map((channel) => (
              <li key={channel.bucket} className="text-sm">
                <div className="flex justify-between gap-3">
                  <span>{channel.label}</span>
                  <span className="font-semibold">
                    {channel.downloads.toLocaleString()}
                    <span className="text-gray-500 font-normal">
                      {' '}
                      (
                      {channelTotal
                        ? Math.round((channel.downloads / channelTotal) * 100)
                        : 0}
                      %)
                    </span>
                  </span>
                </div>
                <div
                  className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden"
                  aria-hidden="true"
                >
                  <div
                    className="h-full bg-gray-700"
                    style={{
                      width: `${channelTotal ? (channel.downloads / channelTotal) * 100 : 0}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="mt-6 text-xs text-gray-400 text-center">
        Updated {new Date(board.generatedAt).toLocaleString()} · refreshes every
        few minutes
      </p>
    </div>
  );
}
