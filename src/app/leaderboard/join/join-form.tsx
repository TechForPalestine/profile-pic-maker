'use client';
import { useEffect, useState } from 'react';
import { FaRegCopy } from 'react-icons/fa6';

import { ReferralEvent, trackEvent } from '@/lib/analytics';
import {
  LINK_PLATFORMS,
  type LinkPlatform,
  type PromoterLinks,
} from '@/lib/promoters';
import {
  currentReferrer,
  isPromoterCode,
  referralLink,
  slugifyDisplayName,
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

type Submission =
  | { status: 'idle' }
  | { status: 'sending' }
  | { status: 'pending'; code: string }
  | { status: 'failed'; errors: string[] };

export default function JoinForm() {
  const [displayName, setDisplayName] = useState('');
  const [code, setCode] = useState('');
  const [codeTouched, setCodeTouched] = useState(false);
  const [links, setLinks] = useState<PromoterLinks>({});
  const [referredBy, setReferredBy] = useState<string>();
  const [turnstileToken, setTurnstileToken] = useState<string>();
  const [copied, setCopied] = useState<'link' | 'caption'>();
  const [submission, setSubmission] = useState<Submission>({ status: 'idle' });

  useEffect(() => {
    // Whoever's link brought this person here gets the recruit credit.
    // localStorage is browser-only, so this can't be known during SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReferredBy(currentReferrer());
  }, []);

  const onNameChange = (value: string) => {
    setDisplayName(value);
    if (!codeTouched) setCode(slugifyDisplayName(value));
  };

  const codeValid = isPromoterCode(code);
  const link = codeValid ? referralLink(code) : undefined;
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
    if (!codeValid) return;
    setSubmission({ status: 'sending' });
    try {
      const res = await fetch('/api/promoters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          displayName,
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
        setSubmission({ status: 'pending', code });
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

  if (submission.status === 'pending') {
    return (
      <div
        role="status"
        className="rounded-2xl border border-gray-300 bg-gray-50 px-5 py-6 text-left"
      >
        <p className="font-semibold text-lg">Request received 🇵🇸</p>
        <p className="text-sm text-gray-600 mt-1">
          A Tech for Palestine volunteer will review it, usually within two
          days. Your link is already counting, so start sharing:
        </p>
        <code className="block mt-3 rounded-lg bg-white border px-3 py-2 text-sm break-all">
          {referralLink(submission.code)}
        </code>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="text-left space-y-6">
      <section className="rounded-2xl border border-gray-300 bg-gray-50 px-5 py-5">
        <h2 className="font-semibold text-lg">1. Pick your name and code</h2>
        <label className="block text-sm mt-3" htmlFor="displayName">
          Display name
        </label>
        <input
          id="displayName"
          value={displayName}
          onChange={(e) => onNameChange(e.target.value)}
          maxLength={40}
          autoComplete="nickname"
          placeholder="How you want to appear"
          className="mt-1 w-full rounded-lg border border-gray-400 bg-white px-3 py-2"
        />
        <label className="block text-sm mt-3" htmlFor="code">
          Your code
        </label>
        <input
          id="code"
          value={code}
          onChange={(e) => {
            setCodeTouched(true);
            setCode(e.target.value.toLowerCase().trim());
          }}
          maxLength={24}
          autoComplete="off"
          spellCheck={false}
          placeholder="lowercase letters, digits, hyphens"
          aria-invalid={code.length > 0 && !codeValid}
          className="mt-1 w-full rounded-lg border border-gray-400 bg-white px-3 py-2 font-mono"
        />
        {code.length > 0 && !codeValid && (
          <p className="text-xs text-red-700 mt-1">
            3 to 24 lowercase letters, digits or hyphens, and not a reserved
            word.
          </p>
        )}
        {link && (
          <div className="mt-4">
            <p className="text-sm text-gray-600">Your link</p>
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
              This link works right away. Nothing is saved until you ask to be
              listed below.
            </p>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-gray-300 bg-gray-50 px-5 py-5">
        <h2 className="font-semibold text-lg">
          2. Appear on the leaderboard (optional)
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Add at least one public profile so people can find you. A volunteer
          checks every entry before it goes live.
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
                  value={links[platform] ?? ''}
                  onChange={(e) =>
                    setLinks({ ...links, [platform]: e.target.value })
                  }
                  placeholder={PLACEHOLDERS[platform]}
                  maxLength={200}
                  className="mt-1 w-full rounded-lg border border-gray-400 bg-white px-3 py-2"
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
        {TURNSTILE_SITE_KEY && (
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
            !codeValid ||
            !displayName.trim() ||
            !hasLink ||
            submission.status === 'sending' ||
            (Boolean(TURNSTILE_SITE_KEY) && !turnstileToken)
          }
          className="mt-4 w-full rounded-full py-3 px-4 border border-gray-900 bg-gray-900 text-white text-lg disabled:opacity-50"
        >
          {submission.status === 'sending' ? 'Sending…' : 'Ask to be listed'}
        </button>
      </section>
    </form>
  );
}
