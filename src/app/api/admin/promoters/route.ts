import { NextResponse, type NextRequest } from 'next/server';

import { isAuthorized } from '@/lib/admin-auth';
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import {
  getPromoterStore,
  isValidDisplayName,
  normalizeDisplayName,
  normalizeLink,
  promoterStorage,
  toAdminPromoter,
  type Promoter,
} from '@/lib/promoters';
import { leaderboardEnabled } from '@/lib/referral';

export const runtime = 'edge';

const ACTIONS = ['approve', 'unapprove', 'reject', 'edit'] as const;
type Action = (typeof ACTIONS)[number];

interface AdminBody {
  action?: Action;
  code?: string;
  displayName?: unknown;
  /** The one optional link; an empty string removes it. */
  link?: unknown;
}

const unauthorized = () =>
  NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

/** Everything in the registry, grouped by status, for the admin page. */
export async function GET(request: NextRequest) {
  if (!leaderboardEnabled()) return new NextResponse(null, { status: 404 });
  const limited = rateLimit(request, LIMITS.admin);
  if (limited) return limited;
  if (!isAuthorized(request.headers.get('authorization'))) {
    return unauthorized();
  }
  const all = await getPromoterStore().list();
  return NextResponse.json(
    {
      pending: all.filter((p) => p.status === 'pending').map(toAdminPromoter),
      approved: all.filter((p) => p.status === 'approved').map(toAdminPromoter),
      rejected: all.filter((p) => p.status === 'rejected').map(toAdminPromoter),
      storage: promoterStorage(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

/**
 * approve: publish the entry. `referredBy` is kept; the public recruit
 *   count only includes approved entries, so it never credits a stranger.
 * unapprove: pull a published entry back into the review queue, for example
 *   while a question about it is sorted out. Nothing is lost.
 * reject: hide the entry for good (also how an approved entry is taken down).
 * edit: fix the display name or the link on any entry, approved ones
 *   included, e.g. to remove a bad link but keep the person. Approved entries stay
 *   approved; the public board picks the change up within ten minutes.
 */
export async function POST(request: NextRequest) {
  if (!leaderboardEnabled()) return new NextResponse(null, { status: 404 });
  const limited = rateLimit(request, LIMITS.admin);
  if (limited) return limited;
  if (!isAuthorized(request.headers.get('authorization'))) {
    return unauthorized();
  }

  let body: AdminBody;
  try {
    body = (await request.json()) as AdminBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }
  if (!body.action || !ACTIONS.includes(body.action) || !body.code) {
    return NextResponse.json(
      { error: 'Expected { action, code }.' },
      { status: 400 },
    );
  }

  const store = getPromoterStore();
  const promoter = await store.get(body.code);
  if (!promoter) {
    return NextResponse.json({ error: 'Unknown code.' }, { status: 404 });
  }

  const now = new Date().toISOString();
  let updated: Promoter = promoter;

  switch (body.action) {
    case 'approve':
      // referredBy is kept as sent: recruits are counted only among approved
      // entries, for approved promoters, so the order in which two people are
      // approved does not matter and credit is never lost.
      updated = { ...promoter, status: 'approved', reviewedAt: now };
      break;
    case 'unapprove':
      updated = { ...promoter, status: 'pending', reviewedAt: now };
      break;
    case 'reject':
      updated = { ...promoter, status: 'rejected', reviewedAt: now };
      break;
    case 'edit': {
      const edits: Partial<Promoter> = {};
      if (body.displayName !== undefined) {
        const displayName = normalizeDisplayName(body.displayName);
        if (!isValidDisplayName(displayName)) {
          return NextResponse.json(
            { error: 'Invalid display name.' },
            { status: 400 },
          );
        }
        edits.displayName = displayName;
      }
      let removeLink = false;
      if (body.link !== undefined) {
        const raw = typeof body.link === 'string' ? body.link.trim() : '';
        if (!raw) {
          removeLink = true;
        } else {
          const link = normalizeLink(raw);
          if (!link) {
            return NextResponse.json(
              { error: 'Invalid link: use a web address like yoursite.com.' },
              { status: 400 },
            );
          }
          edits.link = link;
        }
      }
      updated = { ...promoter, ...edits };
      if (removeLink) delete updated.link;
      break;
    }
  }

  await store.put(updated);
  // Any of these can change what the public sees, so refresh the one
  // document the public routes read.
  await store.rebuildApproved();

  return NextResponse.json({ promoter: toAdminPromoter(updated) });
}
