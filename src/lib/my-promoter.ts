import { isPromoterCode } from '@/lib/referral';

/**
 * The link this browser created, kept in localStorage.
 *
 * Creating a link stores nothing on a server: the code only exists in the
 * promoter's browser until (and unless) they ask to be listed. Remembering it
 * here lets the join page show the same link again, and lets the leaderboard
 * show this person their own count while their listing is under review.
 */

export const MY_PROMOTER_STORAGE_KEY = 'ppm-my-promoter';

export interface MyPromoter {
  code: string;
  displayName: string;
  createdAt: string;
  /** Set once the listing request was sent. */
  submittedAt?: string;
  /**
   * Private key the server returned with the listing request. Only this
   * browser holds it; it is what lets the promoter check the request's status.
   */
  ownerKey?: string;
}

/**
 * Where this browser's listing request stands.
 * - not-sent: a link exists but no listing was requested.
 * - none: a request was sent but the server has no record of it (lost, or
 *   sent from an older version without an owner key). Send it again.
 * - pending / approved / rejected: the server's answer.
 * - unknown: the server could not be reached; keep showing the last state.
 */
export type OwnListingStatus =
  'not-sent' | 'none' | 'pending' | 'approved' | 'rejected' | 'unknown';

const OWNER_KEY_PATTERN = /^[0-9a-f]{16,128}$/;

export function readMyPromoter(): MyPromoter | undefined {
  try {
    const raw = localStorage.getItem(MY_PROMOTER_STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<MyPromoter>;
    if (
      !isPromoterCode(parsed.code) ||
      typeof parsed.displayName !== 'string'
    ) {
      return undefined;
    }
    return {
      code: parsed.code,
      displayName: parsed.displayName,
      createdAt: parsed.createdAt ?? new Date(0).toISOString(),
      submittedAt: parsed.submittedAt,
      ownerKey:
        typeof parsed.ownerKey === 'string' &&
        OWNER_KEY_PATTERN.test(parsed.ownerKey)
          ? parsed.ownerKey
          : undefined,
    };
  } catch {
    return undefined;
  }
}

export function saveMyPromoter(promoter: MyPromoter): void {
  try {
    localStorage.setItem(MY_PROMOTER_STORAGE_KEY, JSON.stringify(promoter));
  } catch {
    // Private mode or blocked storage: the link still works, it just is not
    // remembered on the next visit.
  }
}

export function clearMyPromoter(): void {
  try {
    localStorage.removeItem(MY_PROMOTER_STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}

/** Ask the server where this browser's listing request stands. */
export async function fetchOwnListingStatus(
  promoter: MyPromoter,
): Promise<OwnListingStatus> {
  if (!promoter.submittedAt) return 'not-sent';
  if (!promoter.ownerKey) return 'none';
  try {
    const res = await fetch('/api/promoters/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: promoter.code,
        ownerKey: promoter.ownerKey,
      }),
      cache: 'no-store',
    });
    if (!res.ok) return 'unknown';
    const { status } = (await res.json()) as { status?: string };
    return status === 'none' ||
      status === 'pending' ||
      status === 'approved' ||
      status === 'rejected'
      ? status
      : 'unknown';
  } catch {
    return 'unknown';
  }
}

/** The same link, with the lost request forgotten so it can be sent again. */
export function forgetSubmission(promoter: MyPromoter): MyPromoter {
  const next = { ...promoter, submittedAt: undefined, ownerKey: undefined };
  saveMyPromoter(next);
  return next;
}
