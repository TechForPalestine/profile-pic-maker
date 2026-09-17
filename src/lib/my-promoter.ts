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
}

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
