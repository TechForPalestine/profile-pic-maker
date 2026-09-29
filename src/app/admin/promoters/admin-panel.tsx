'use client';
import { useCallback, useEffect, useState } from 'react';

import type { Promoter } from '@/lib/promoters';
import { referralLink } from '@/lib/referral';

const TOKEN_KEY = 'ppm-admin-token';

type Action = 'approve' | 'unapprove' | 'reject' | 'edit';

interface Registry {
  pending: Promoter[];
  approved: Promoter[];
  rejected: Promoter[];
  storage?: 'kv' | 'memory';
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

  /** Run one admin action. Resolves true when it succeeded. */
  const act = async (
    action: Action,
    code: string,
    edits: { displayName?: string; link?: string } = {},
  ): Promise<boolean> => {
    setBusy(`${action}:${code}`);
    setError(undefined);
    try {
      const res = await fetch('/api/admin/promoters', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, code, ...edits }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(body.error ?? `The ${action} failed (${res.status}).`);
        return false;
      }
      await load(token);
      return true;
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

  const buttons = (
    p: Promoter,
    actions: { action: Action; label: string; primary?: boolean }[],
  ) =>
    actions.map(({ action, label, primary }) => (
      <ActionButton
        key={action}
        label={label}
        primary={primary}
        busy={busy === `${action}:${p.code}`}
        disabled={!!busy}
        onClick={() => act(action, p.code)}
      />
    ));

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
      {registry?.storage === 'memory' && (
        <p
          role="alert"
          data-testid="memory-storage-warning"
          className="mb-4 rounded-lg bg-yellow-100 px-3 py-2 text-sm"
        >
          Listing requests on this deployment are kept in temporary memory and
          disappear on the next restart or deploy. Set the Cloudflare KV
          variables before inviting anyone to join.
        </p>
      )}
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
            busy={busy}
            onEdit={(code, edits) => act('edit', code, edits)}
            actions={(p) =>
              buttons(p, [
                { action: 'approve', label: 'Approve', primary: true },
                { action: 'reject', label: 'Reject' },
              ])
            }
          />
          <Section
            title={`On the leaderboard (${registry.approved.length})`}
            entries={registry.approved}
            empty="Nobody is approved yet."
            busy={busy}
            onEdit={(code, edits) => act('edit', code, edits)}
            actions={(p) =>
              buttons(p, [
                { action: 'unapprove', label: 'Back to review' },
                { action: 'reject', label: 'Take down' },
              ])
            }
          />
          <Section
            title={`Rejected (${registry.rejected.length})`}
            entries={registry.rejected}
            empty="No rejections."
            busy={busy}
            onEdit={(code, edits) => act('edit', code, edits)}
            actions={(p) =>
              buttons(p, [{ action: 'approve', label: 'Approve after all' }])
            }
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
  busy,
  onEdit,
  actions,
}: {
  title: string;
  entries: Promoter[];
  empty: string;
  busy?: string;
  onEdit: (
    code: string,
    edits: { displayName: string; link: string },
  ) => Promise<boolean>;
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
            <Entry
              key={p.code}
              promoter={p}
              busy={busy}
              onEdit={onEdit}
              actions={actions(p)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function Entry({
  promoter: p,
  busy,
  onEdit,
  actions,
}: {
  promoter: Promoter;
  busy?: string;
  onEdit: (
    code: string,
    edits: { displayName: string; link: string },
  ) => Promise<boolean>;
  actions: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(p.displayName);
  const [link, setLink] = useState(p.link ?? '');

  const startEditing = () => {
    setDisplayName(p.displayName);
    setLink(p.link ?? '');
    setEditing(true);
  };

  const save = async () => {
    // An empty link removes it; the server fills in https:// if missing.
    if (
      await onEdit(p.code, {
        displayName: displayName.trim(),
        link: link.trim(),
      })
    ) {
      setEditing(false);
    }
  };

  return (
    <li className="rounded-2xl border border-gray-300 bg-white p-4 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold text-base">{p.displayName}</span>
        <code className="text-xs text-gray-600">{referralLink(p.code)}</code>
      </div>
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className="mt-3 space-y-2"
          aria-label={`Edit ${p.displayName}`}
        >
          <label className="block">
            <span className="text-xs text-gray-600">Display name</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={40}
              className="mt-0.5 w-full rounded-lg border border-gray-400 px-3 py-1.5"
            />
          </label>
          <label className="block">
            <span className="text-xs text-gray-600">Link (optional)</span>
            <input
              type="text"
              inputMode="url"
              autoCapitalize="none"
              spellCheck={false}
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="instagram.com/name or yoursite.com"
              maxLength={200}
              className="mt-0.5 w-full rounded-lg border border-gray-400 px-3 py-1.5"
            />
          </label>
          <div className="flex gap-2 pt-1">
            <ActionButton
              label="Save changes"
              primary
              type="submit"
              busy={busy === `edit:${p.code}`}
              disabled={!!busy}
            />
            <ActionButton
              label="Cancel"
              busy={false}
              disabled={!!busy}
              onClick={() => setEditing(false)}
            />
          </div>
        </form>
      ) : (
        <>
          <p className="my-2">
            {p.link ? (
              <a
                href={p.link}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="underline break-all"
              >
                {p.link}
              </a>
            ) : (
              <span className="text-gray-500">No link</span>
            )}
          </p>
          <p className="text-xs text-gray-500">
            Requested {new Date(p.createdAt).toLocaleString()}
            {p.reviewedAt && (
              <> · reviewed {new Date(p.reviewedAt).toLocaleString()}</>
            )}
            {p.referredBy && <> · referred by {p.referredBy}</>}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {actions}
            <ActionButton
              label="Edit"
              busy={false}
              disabled={!!busy}
              onClick={startEditing}
            />
          </div>
        </>
      )}
    </li>
  );
}

function ActionButton({
  label,
  onClick,
  busy,
  disabled,
  primary,
  type = 'button',
}: {
  label: string;
  onClick?: () => void;
  busy: boolean;
  disabled: boolean;
  primary?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
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
