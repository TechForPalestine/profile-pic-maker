'use client';
import { useEffect, useState } from 'react';
import { FaArrowsRotate, FaRegCopy } from 'react-icons/fa6';

import { ReferralEvent, trackEvent } from '@/lib/analytics';
import {
  clearMyPromoter,
  fetchOwnListingStatus,
  forgetSubmission,
  readMyPromoter,
  saveMyPromoter,
  type MyPromoter,
} from '@/lib/my-promoter';
import { normalizeLink } from '@/lib/promoters';
import {
  currentReferrer,
  generatePromoterCode,
  isPromoterCode,
  referralLink,
} from '@/lib/referral';
import { SHARE_MESSAGE } from '@/lib/share';
import { TURNSTILE_SITE_KEY } from '@/lib/turnstile';

import TurnstileWidget from '../turnstile-widget';

export const REVIEW_TIME_COPY = 'usually within a few hours, and at most a day';

type Submission =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'sending' }
  | { status: 'pending' }
  | { status: 'approved' }
  | { status: 'rejected' }
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
  // One optional link, typed the way people read it (no https:// needed).
  const [profileLink, setProfileLink] = useState('');
  const [referredBy, setReferredBy] = useState<string>();
  const [turnstileToken, setTurnstileToken] = useState<string>();
  const [copied, setCopied] = useState<'link' | 'caption'>();
  const [submission, setSubmission] = useState<Submission>({ status: 'idle' });
  /** Shown above step 2 when a request we sent is no longer on the server. */
  const [lostRequest, setLostRequest] = useState(false);

  useEffect(() => {
    // localStorage is browser-only: neither the remembered link nor the
    // referrer can be known during SSR.
    const existing = readMyPromoter();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMine(existing);
    if (existing) {
      setDisplayName(existing.displayName);
      setCode(existing.code);
      if (existing.submittedAt) {
        // Ask the server rather than trusting what this browser remembers:
        // the request may have been approved, rejected or lost since.
        setSubmission({ status: 'checking' });
        fetchOwnListingStatus(existing).then((status) => {
          if (status === 'none') {
            setMine(forgetSubmission(existing));
            setLostRequest(true);
            setSubmission({ status: 'idle' });
          } else if (status === 'approved' || status === 'rejected') {
            setSubmission({ status });
          } else {
            // pending, or the server could not be reached right now.
            setSubmission({ status: 'pending' });
          }
        });
      }
    }
    setReferredBy(currentReferrer());
    setLoaded(true);
  }, []);

  /** Throw away this browser's link and start again with a new one. */
  const startOver = () => {
    clearMyPromoter();
    setMine(undefined);
    setDisplayName('');
    setCode('');
    setProfileLink('');
    setLostRequest(false);
    setSubmission({ status: 'idle' });
  };

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
    trackEvent(ReferralEvent.LinkCreated);
  };

  /** Save a name onto a link that was made without one, keeping its code. */
  const nameLink = () => {
    const name = displayName.trim();
    if (!mine || !name) return;
    const named = { ...mine, displayName: name };
    saveMyPromoter(named);
    setMine(named);
    trackEvent(ReferralEvent.LinkNamed);
  };

  const link = mine ? referralLink(mine.code) : undefined;
  // A link made automatically after a download has no name yet, and a
  // listing needs one.
  const named = Boolean(mine?.displayName);
  // Who gets the recruit credit. Only another promoter's code counts: not
  // your own (people test their link in the same browser), and not a
  // channel link like ?ref=ch-newsletter, which the server would refuse.
  const recruiter =
    referredBy && isPromoterCode(referredBy) && referredBy !== mine?.code
      ? referredBy
      : undefined;
  // Empty is fine; anything else must be a web address. Same check as the
  // server, so a bad link is flagged before sending.
  const linkInvalid = profileLink.trim() !== '' && !normalizeLink(profileLink);

  const copy = async (format: 'link' | 'caption') => {
    if (!link) return;
    const text = format === 'link' ? link : `${SHARE_MESSAGE} ${link}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(format);
      setTimeout(() => setCopied(undefined), 2000);
      trackEvent(ReferralEvent.LinkCopied, { format });
    } catch (error) {
      console.error('Error copying', error);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mine || !named) return;
    setSubmission({ status: 'sending' });
    try {
      const res = await fetch('/api/promoters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: mine.code,
          displayName: mine.displayName,
          link: profileLink.trim() || undefined,
          referredBy: recruiter,
          turnstileToken,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        errors?: string[];
        error?: string;
        ownerKey?: string;
      };
      if (res.status === 201) {
        trackEvent(ReferralEvent.ListingRequested, { outcome: 'pending' });
        setLostRequest(false);
        const submitted = {
          ...mine,
          submittedAt: new Date().toISOString(),
          ownerKey: body.ownerKey,
        };
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
      trackEvent(ReferralEvent.ListingRequested, { outcome });
      setSubmission({
        status: 'failed',
        errors: body.errors ?? [
          body.error ?? 'Something went wrong. Please try again.',
        ],
      });
    } catch {
      trackEvent(ReferralEvent.ListingRequested, { outcome: 'error' });
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
              {named ? `${mine.displayName}, your link` : 'Your link'}
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
            {!named && (
              <div className="mt-4">
                <label className="block text-sm" htmlFor="displayName">
                  Add your name to appear on the leaderboard. Your link and
                  everyone it already brought stay the same.
                </label>
                <input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={40}
                  autoComplete="nickname"
                  placeholder="e.g. Paul Biggar"
                  className="mt-1 w-full rounded-lg border border-gray-400 bg-white px-3 py-2"
                />
                <button
                  type="button"
                  onClick={nameLink}
                  disabled={!displayName.trim()}
                  className="mt-2 rounded-full px-4 py-1.5 border border-gray-900 bg-gray-900 text-white text-sm disabled:opacity-50"
                >
                  Save my name
                </button>
              </div>
            )}
            <p className="text-xs text-gray-500 mt-2">
              {named ? 'Wrong name?' : 'Want a different link?'}{' '}
              <button
                type="button"
                onClick={startOver}
                className="underline hover:text-gray-900"
              >
                Start over with a new link
              </button>{' '}
              (people who already used this link keep counting for it).
            </p>
          </div>
        )}
      </section>

      {mine && submission.status === 'checking' ? (
        <section
          role="status"
          className="rounded-2xl border border-gray-300 bg-gray-50 px-5 py-5 text-sm text-gray-600"
        >
          Checking your listing…
        </section>
      ) : mine && submission.status === 'pending' ? (
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
      ) : mine && submission.status === 'approved' ? (
        <section
          role="status"
          className="rounded-2xl border border-gray-300 bg-gray-50 px-5 py-5"
        >
          <p className="font-semibold text-lg">You are on the leaderboard 🎉</p>
          <p className="text-sm text-gray-600 mt-1">
            A volunteer approved your listing. Your name and profiles are public
            on the leaderboard. Keep sharing your link.
          </p>
        </section>
      ) : mine && submission.status === 'rejected' ? (
        <section
          role="status"
          className="rounded-2xl border border-gray-300 bg-gray-50 px-5 py-5"
        >
          <p className="font-semibold text-lg">Your listing was not approved</p>
          <p className="text-sm text-gray-600 mt-1">
            Your link still works and every download through it still counts for
            you. Only the public listing was declined, usually because the link
            did not open or the name looked like someone else. If you think it
            was a mistake, start over with a new link and check the link before
            sending.
          </p>
        </section>
      ) : (
        <section
          className={`rounded-2xl border border-gray-300 bg-gray-50 px-5 py-5 ${
            named ? '' : 'opacity-50'
          }`}
        >
          {lostRequest && (
            <p
              role="alert"
              className="mb-3 rounded-lg bg-yellow-100 px-3 py-2 text-sm"
            >
              We could not find your earlier listing request, so it was never
              reviewed. Please send it again below. Your link and its count are
              unaffected.
            </p>
          )}
          <h2 className="font-semibold text-lg">
            2. Appear on the leaderboard for everyone (optional)
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Add a link so people can find you, if you like: a profile or your
            website. A volunteer checks every entry before it goes live,{' '}
            {REVIEW_TIME_COPY}.
          </p>
          <label className="mt-3 block text-sm" htmlFor="profileLink">
            Your link (optional)
          </label>
          <input
            id="profileLink"
            type="text"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={!named}
            value={profileLink}
            onChange={(e) => setProfileLink(e.target.value)}
            placeholder="instagram.com/yourname or yoursite.com"
            maxLength={200}
            aria-invalid={linkInvalid}
            className="mt-1 w-full rounded-lg border border-gray-400 bg-white px-3 py-2 disabled:bg-gray-100"
          />
          {linkInvalid && (
            <p className="text-xs text-red-700 mt-1">
              That does not look like a web address. Try something like
              instagram.com/yourname, or leave it empty.
            </p>
          )}
          {recruiter && (
            <p className="text-xs text-gray-500 mt-3">
              You arrived through <code>{recruiter}</code>&apos;s link, so they
              get credit for bringing you on board.
            </p>
          )}
          {named && TURNSTILE_SITE_KEY && (
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
              !named ||
              linkInvalid ||
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
