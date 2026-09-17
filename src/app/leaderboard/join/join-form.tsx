'use client';
import { useEffect, useState } from 'react';
import { FaArrowsRotate, FaRegCopy } from 'react-icons/fa6';

import { ReferralEvent, trackEvent } from '@/lib/analytics';
import {
  readMyPromoter,
  saveMyPromoter,
  type MyPromoter,
} from '@/lib/my-promoter';
import {
  LINK_PLATFORMS,
  type LinkPlatform,
  type PromoterLinks,
} from '@/lib/promoters';
import {
  currentReferrer,
  generatePromoterCode,
  referralLink,
} from '@/lib/referral';
import { SHARE_MESSAGE } from '@/lib/share';
import { TURNSTILE_SITE_KEY } from '@/lib/turnstile';

import { PLATFORM_META } from '../social-links';
import TurnstileWidget from '../turnstile-widget';

const PLACEHOLDERS: Record<LinkPlatform, string> = {
  x: 'https://x.com/yourname',
  instagram: 'https://instagram.com/yourname',
  tiktok: 'https://tiktok.com/@yourname',
  linkedin: 'https://linkedin.com/in/yourname',
  bluesky: 'https://bsky.app/profile/yourname',
  facebook: 'https://facebook.com/yourname',
  youtube: 'https://youtube.com/@yourname',
  website: 'https://yoursite.example',
};

export const REVIEW_TIME_COPY = 'usually within a few hours, and at most a day';

type Submission =
  | { status: 'idle' }
  | { status: 'sending' }
  | { status: 'pending' }
  | { status: 'failed'; errors: string[] };

/**
 * Two steps. Step 1 makes a link and stores it in this browser only; nothing
 * reaches a server, and the link counts from the first click. Step 2 asks
 * for a public listing, which a volunteer reviews.
 */
export default function JoinForm() {
  const [displayName, setDisplayName] = useState('');
  const [code, setCode] = useState('');
  const [mine, setMine] = useState<MyPromoter>();
  const [loaded, setLoaded] = useState(false);
  const [links, setLinks] = useState<PromoterLinks>({});
  const [referredBy, setReferredBy] = useState<string>();
  const [turnstileToken, setTurnstileToken] = useState<string>();
  const [copied, setCopied] = useState<'link' | 'caption'>();
  const [submission, setSubmission] = useState<Submission>({ status: 'idle' });

  useEffect(() => {
    // localStorage is browser-only: neither the remembered link nor the
    // referrer can be known during SSR.
    const existing = readMyPromoter();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMine(existing);
    if (existing) {
      setDisplayName(existing.displayName);
      setCode(existing.code);
      if (existing.submittedAt) setSubmission({ status: 'pending' });
    }
    setReferredBy(currentReferrer());
    setLoaded(true);
  }, []);

  const onNameChange = (value: string) => {
    setDisplayName(value);
    setCode(value.trim() ? generatePromoterCode(value) : '');
  };

  const shuffle = () => setCode(generatePromoterCode(displayName));

  const createLink = () => {
    const name = displayName.trim();
    if (!name || !code) return;
    const promoter: MyPromoter = {
      code,
      displayName: name,
      createdAt: new Date().toISOString(),
    };
    saveMyPromoter(promoter);
    setMine(promoter);
    trackEvent(ReferralEvent.LinkGenerated, { format: 'created' });
  };

  const link = mine ? referralLink(mine.code) : undefined;
  const hasLink = Object.values(links).some(Boolean);

  const copy = async (format: 'link' | 'caption') => {
    if (!link) return;
    const text = format === 'link' ? link : `${SHARE_MESSAGE} ${link}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(format);
      setTimeout(() => setCopied(undefined), 2000);
      trackEvent(ReferralEvent.LinkGenerated, { format });
    } catch (error) {
      console.error('Error copying', error);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mine) return;
    setSubmission({ status: 'sending' });
    try {
      const res = await fetch('/api/promoters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: mine.code,
          displayName: mine.displayName,
          links,
          referredBy,
          turnstileToken,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        errors?: string[];
        error?: string;
      };
      if (res.status === 201) {
        trackEvent(ReferralEvent.JoinRequested, { outcome: 'pending' });
        const submitted = { ...mine, submittedAt: new Date().toISOString() };
        saveMyPromoter(submitted);
        setMine(submitted);
        setSubmission({ status: 'pending' });
        return;
      }
      const outcome =
        res.status === 400
          ? 'invalid'
          : res.status === 409
            ? 'taken'
            : res.status === 403
              ? 'bot'
              : res.status === 429
                ? 'full'
                : res.status === 503
                  ? 'paused'
                  : 'error';
      trackEvent(ReferralEvent.JoinRequested, { outcome });
      setSubmission({
        status: 'failed',
        errors: body.errors ?? [
          body.error ?? 'Something went wrong. Please try again.',
        ],
      });
    } catch {
      trackEvent(ReferralEvent.JoinRequested, { outcome: 'error' });
      setSubmission({
        status: 'failed',
        errors: ['Could not reach the server. Please try again.'],
      });
    }
  };

  // Nothing renders until localStorage has been read, so the first paint
  // never flashes an empty form at someone who already has a link.
  if (!loaded) return null;

  return (
    <form onSubmit={submit} className="text-left space-y-6">
      <section className="rounded-2xl border border-gray-300 bg-gray-50 px-5 py-5">
        <h2 className="font-semibold text-lg">1. Create your link</h2>
        {!mine ? (
          <>
            <label className="block text-sm mt-3" htmlFor="displayName">
              Your name, as you want it to appear
            </label>
            <input
              id="displayName"
              value={displayName}
              onChange={(e) => onNameChange(e.target.value)}
              maxLength={40}
              autoComplete="nickname"
              placeholder="e.g. Paul Biggar"
              className="mt-1 w-full rounded-lg border border-gray-400 bg-white px-3 py-2"
            />
            {code && (
              <p className="text-sm text-gray-600 mt-3">
                Your code will be{' '}
                <code data-testid="suggested-code" className="font-semibold">
                  {code}
                </code>{' '}
                <button
                  type="button"
                  onClick={shuffle}
                  aria-label="Pick a different code"
                  title="Pick a different code"
                  className="align-middle rounded-full p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-900"
                >
                  <FaArrowsRotate />
                </button>
              </p>
            )}
            <button
              type="button"
              onClick={createLink}
              disabled={!displayName.trim() || !code}
              className="mt-4 w-full rounded-full py-3 px-4 border border-gray-900 bg-gray-900 text-white text-lg disabled:opacity-50"
            >
              Create my link
            </button>
            <p className="text-xs text-gray-500 mt-2">
              Nothing is sent anywhere. The link is made in your browser and
              counts from the first click.
            </p>
          </>
        ) : (
          <div className="mt-3">
            <p className="text-sm text-gray-600">
              {mine.displayName}, your link
            </p>
            <code
              data-testid="referral-link"
              className="block mt-1 rounded-lg bg-white border px-3 py-2 text-sm break-all"
            >
              {link}
            </code>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => copy('link')}
                className="rounded-full px-4 py-1.5 border border-gray-900 bg-gray-900 text-white text-sm"
              >
                <FaRegCopy className="inline mb-0.5 mr-1" />
                {copied === 'link' ? 'Copied!' : 'Copy link'}
              </button>
              <button
                type="button"
                onClick={() => copy('caption')}
                className="rounded-full px-4 py-1.5 border border-gray-900 text-sm"
              >
                <FaRegCopy className="inline mb-0.5 mr-1" />
                {copied === 'caption' ? 'Copied!' : 'Copy a ready caption'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Share it anywhere: post captions, your bio link, group chats. The
              leaderboard already shows you your own count, marked as pending.
            </p>
          </div>
        )}
      </section>

      {mine && submission.status === 'pending' ? (
        <section
          role="status"
          className="rounded-2xl border border-gray-300 bg-gray-50 px-5 py-5"
        >
          <p className="font-semibold text-lg">Listing requested 🇵🇸</p>
          <p className="text-sm text-gray-600 mt-1">
            A Tech for Palestine volunteer will review it, {REVIEW_TIME_COPY}.
            Until then only you can see your row on the leaderboard. Keep
            sharing, every download already counts.
          </p>
        </section>
      ) : (
        <section
          className={`rounded-2xl border border-gray-300 bg-gray-50 px-5 py-5 ${
            mine ? '' : 'opacity-50'
          }`}
        >
          <h2 className="font-semibold text-lg">
            2. Appear on the leaderboard for everyone (optional)
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Add at least one public profile so people can find you. A volunteer
            checks every entry before it goes live, {REVIEW_TIME_COPY}.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {LINK_PLATFORMS.map((platform) => {
              const { label, Icon } = PLATFORM_META[platform];
              return (
                <label key={platform} className="block text-sm">
                  <span className="inline-flex items-center gap-1.5">
                    <Icon /> {label}
                  </span>
                  <input
                    type="url"
                    inputMode="url"
                    disabled={!mine}
                    value={links[platform] ?? ''}
                    onChange={(e) =>
                      setLinks({ ...links, [platform]: e.target.value })
                    }
                    placeholder={PLACEHOLDERS[platform]}
                    maxLength={200}
                    className="mt-1 w-full rounded-lg border border-gray-400 bg-white px-3 py-2 disabled:bg-gray-100"
                  />
                </label>
              );
            })}
          </div>
          {referredBy && (
            <p className="text-xs text-gray-500 mt-3">
              You arrived through <code>{referredBy}</code>&apos;s link, so they
              get credit for bringing you on board.
            </p>
          )}
          {mine && TURNSTILE_SITE_KEY && (
            <TurnstileWidget
              siteKey={TURNSTILE_SITE_KEY}
              onToken={setTurnstileToken}
            />
          )}
          {submission.status === 'failed' && (
            <ul
              role="alert"
              className="mt-3 rounded-lg bg-red-100 px-3 py-2 text-sm list-disc pl-6"
            >
              {submission.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
          <button
            type="submit"
            disabled={
              !mine ||
              !hasLink ||
              submission.status === 'sending' ||
              (Boolean(TURNSTILE_SITE_KEY) && !turnstileToken)
            }
            className="mt-4 w-full rounded-full py-3 px-4 border border-gray-900 bg-gray-900 text-white text-lg disabled:opacity-50"
          >
            {submission.status === 'sending' ? 'Sending…' : 'Ask to be listed'}
          </button>
        </section>
      )}
    </form>
  );
}
