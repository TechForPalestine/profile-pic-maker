'use client';
import { useCallback, useEffect, useState } from 'react';

import type { Promoter } from '@/lib/promoters';
import { referralLink } from '@/lib/referral';

const TOKEN_KEY = 'ppm-admin-token';

interface Registry {
  pending: Promoter[];
  approved: Promoter[];
  rejected: Promoter[];
}

function readToken(): string {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export default function AdminPanel() {
  const [token, setToken] = useState('');
  const [draftToken, setDraftToken] = useState('');
  const [registry, setRegistry] = useState<Registry>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState<string>();

  useEffect(() => {
    // sessionStorage is browser-only; the token can't be known during SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(readToken());
  }, []);

  const load = useCallback(async (activeToken: string) => {
    const res = await fetch('/api/admin/promoters', {
      headers: { Authorization: `Bearer ${activeToken}` },
      cache: 'no-store',
    });
    // Every state update below follows the await, so calling this from an
    // effect never sets state synchronously during render.
    setError(undefined);
    if (res.status === 401) {
      setRegistry(undefined);
      setError('That token was not accepted.');
      return;
    }
    if (!res.ok) {
      setError(`Could not load the registry (${res.status}).`);
      return;
    }
    setRegistry((await res.json()) as Registry);
  }, []);

  useEffect(() => {
    // `load` only sets state after its fetch resolves; the rule can't see
    // through the async boundary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (token) load(token);
  }, [token, load]);

  const saveToken = () => {
    const next = draftToken.trim();
    try {
      sessionStorage.setItem(TOKEN_KEY, next);
    } catch {
      // Private mode: the token just lives in React state for this visit.
    }
    setToken(next);
  };

  const forgetToken = () => {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      // Nothing to clean up.
    }
    setToken('');
    setRegistry(undefined);
  };

  const act = async (action: 'approve' | 'reject', code: string) => {
    setBusy(`${action}:${code}`);
    setError(undefined);
    try {
      const res = await fetch('/api/admin/promoters', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, code }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(body.error ?? `The ${action} failed (${res.status}).`);
        return;
      }
      await load(token);
    } finally {
      setBusy(undefined);
    }
  };

  if (!token) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          saveToken();
        }}
        className="rounded-2xl border border-gray-300 bg-gray-50 p-5"
      >
        <label className="block text-sm font-semibold mb-2" htmlFor="token">
          Admin token
        </label>
        <input
          id="token"
          type="password"
          autoComplete="off"
          value={draftToken}
          onChange={(e) => setDraftToken(e.target.value)}
          className="w-full rounded-lg border border-gray-400 px-3 py-2 mb-3"
        />
        <button
          type="submit"
          className="rounded-full py-2 px-5 border border-gray-900 bg-gray-900 text-white"
        >
          Unlock
        </button>
        <p className="text-xs text-gray-500 mt-3">
          Kept in this tab only. Close the tab and it is gone.
        </p>
      </form>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 text-sm">
        <button onClick={() => load(token)} className="underline">
          Refresh
        </button>
        <button onClick={forgetToken} className="underline text-gray-600">
          Forget token
        </button>
      </div>
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-lg bg-red-100 px-3 py-2 text-sm"
        >
          {error}
        </p>
      )}
      {registry && (
        <>
          <Section
            title={`Waiting for review (${registry.pending.length})`}
            entries={registry.pending}
            empty="Nothing waiting. Nice."
            actions={(p) => (
              <>
                <ActionButton
                  label="Approve"
                  primary
                  busy={busy === `approve:${p.code}`}
                  disabled={!!busy}
                  onClick={() => act('approve', p.code)}
                />
                <ActionButton
                  label="Reject"
                  busy={busy === `reject:${p.code}`}
                  disabled={!!busy}
                  onClick={() => act('reject', p.code)}
                />
              </>
            )}
          />
          <Section
            title={`On the leaderboard (${registry.approved.length})`}
            entries={registry.approved}
            empty="Nobody is approved yet."
            actions={(p) => (
              <ActionButton
                label="Take down"
                busy={busy === `reject:${p.code}`}
                disabled={!!busy}
                onClick={() => act('reject', p.code)}
              />
            )}
          />
          <Section
            title={`Rejected (${registry.rejected.length})`}
            entries={registry.rejected}
            empty="No rejections."
            actions={(p) => (
              <ActionButton
                label="Approve after all"
                busy={busy === `approve:${p.code}`}
                disabled={!!busy}
                onClick={() => act('approve', p.code)}
              />
            )}
          />
        </>
      )}
    </div>
  );
}

function Section({
  title,
  entries,
  empty,
  actions,
}: {
  title: string;
  entries: Promoter[];
  empty: string;
  actions: (promoter: Promoter) => React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      {entries.length === 0 ? (
        <p className="text-sm text-gray-500">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {entries.map((p) => (
            <li
              key={p.code}
              className="rounded-2xl border border-gray-300 bg-white p-4 text-sm"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold text-base">{p.displayName}</span>
                <code className="text-xs text-gray-600">
                  {referralLink(p.code)}
                </code>
              </div>
              <ul className="my-2 flex flex-wrap gap-x-4 gap-y-1">
                {Object.entries(p.links).map(([platform, href]) => (
                  <li key={platform}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="underline break-all"
                    >
                      {platform}: {href}
                    </a>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-gray-500">
                Requested {new Date(p.createdAt).toLocaleString()}
                {p.referredBy && <> · referred by {p.referredBy}</>}
              </p>
              <div className="mt-3 flex gap-2">{actions(p)}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ActionButton({
  label,
  onClick,
  busy,
  disabled,
  primary,
}: {
  label: string;
  onClick: () => void;
  busy: boolean;
  disabled: boolean;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-4 py-1.5 border border-gray-900 disabled:opacity-60 ${
        primary ? 'bg-gray-900 text-white' : ''
      }`}
    >
      {busy ? 'Working…' : label}
    </button>
  );
}
