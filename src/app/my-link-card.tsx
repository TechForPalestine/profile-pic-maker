'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FaRegCopy } from 'react-icons/fa6';

import { ReferralEvent, ShareEvent, trackEvent } from '@/lib/analytics';
import type { MyPromoter } from '@/lib/my-promoter';
import { fetchMyReach, reachCopy } from '@/lib/my-reach';
import { personalShareUrl, referralLink } from '@/lib/referral';

/**
 * The link-first variant's personal link (see `@/lib/share-variant`): the
 * link, a copy button, and how many people it has brought so far. Shown in
 * the share panel right after a download, and at the top of the page when
 * the person comes back.
 */
export default function MyLinkCard({
  promoter,
  placement,
  method,
}: {
  promoter: MyPromoter;
  /** `share`: inside the share panel. `return`: a later visit. */
  placement: 'share' | 'return';
  /** Photo source, mirrored into the share events like the other buttons. */
  method?: string;
}) {
  // undefined while loading or when the board cannot be read; the card then
  // explains what the link does instead of showing a number.
  const [reach, setReach] = useState<number>();
  const [copied, setCopied] = useState(false);
  const link = personalShareUrl(promoter.code, 'copy');
  // Shown without the scheme and the utm tag so the code itself stays
  // visible on a phone; the copy button still copies the full link.
  const shown = referralLink(promoter.code).replace(/^https?:\/\//, '');

  useEffect(() => {
    let cancelled = false;
    fetchMyReach(promoter.code).then((count) => {
      if (!cancelled) setReach(count);
    });
    return () => {
      cancelled = true;
    };
  }, [promoter.code]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      if (placement === 'share') {
        trackEvent(ShareEvent.Clicked, {
          channel: 'copy',
          format: 'link',
          method: method ?? 'unknown',
          variant: 'link-first',
        });
      } else {
        trackEvent(ReferralEvent.LinkCopied, {
          format: 'link',
          variant: 'link-first',
        });
      }
    } catch (error) {
      console.error('Error copying link', error);
    }
  };

  return (
    <div
      data-testid="my-link-card"
      className="rounded-xl border-2 border-[#149954] bg-white px-4 py-3 text-left"
    >
      <p className="text-sm font-semibold">
        {placement === 'share'
          ? 'Your personal link'
          : `Welcome back${promoter.displayName ? `, ${promoter.displayName}` : ''} 🇵🇸`}
      </p>
      <p data-testid="my-reach" className="text-sm text-gray-700 mt-0.5">
        {reachCopy(reach)}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <code
          data-testid="my-link"
          className="flex-1 min-w-0 break-all rounded-lg bg-gray-50 border px-2 py-1.5 text-xs"
        >
          {shown}
        </code>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-full px-3 py-1.5 border border-gray-900 bg-gray-900 text-white text-sm"
        >
          <FaRegCopy className="inline mb-0.5 mr-1" />
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <p className="text-xs text-gray-600 mt-2">
        {promoter.displayName ? (
          <Link href="/leaderboard" className="underline">
            See the leaderboard
          </Link>
        ) : (
          <Link
            href="/leaderboard/join"
            onClick={() =>
              trackEvent(ReferralEvent.CtaClicked, {
                method: method ?? placement,
                variant: 'link-first',
              })
            }
            className="underline font-semibold text-gray-900"
          >
            Add your name and join the leaderboard
          </Link>
        )}
      </p>
    </div>
  );
}
