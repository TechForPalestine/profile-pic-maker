import { NextResponse, type NextRequest } from 'next/server';

import { isAuthorized } from '@/lib/admin-auth';
import {
  LINK_PLATFORMS,
  getPromoterStore,
  isValidDisplayName,
  normalizeDisplayName,
  normalizeLink,
  type Promoter,
  type PromoterLinks,
} from '@/lib/promoters';

export const runtime = 'edge';

const ACTIONS = ['approve', 'reject', 'edit'] as const;
type Action = (typeof ACTIONS)[number];

interface AdminBody {
  action?: Action;
  code?: string;
  displayName?: unknown;
  links?: unknown;
}

const unauthorized = () =>
  NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

/** Everything in the registry, grouped by status, for the admin page. */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request.headers.get('authorization'))) {
    return unauthorized();
  }
  const all = await getPromoterStore().list();
  return NextResponse.json(
    {
      pending: all.filter((p) => p.status === 'pending'),
      approved: all.filter((p) => p.status === 'approved'),
      rejected: all.filter((p) => p.status === 'rejected'),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

/**
 * approve: publish the entry. Clears `referredBy` unless it points at an
 *   approved promoter, so recruits are only ever credited to real entries.
 * reject: hide the entry (also how an approved entry is taken down).
 * edit: fix the display name or links, e.g. to strip a bad link but keep
 *   the person.
 */
export async function POST(request: NextRequest) {
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
    case 'approve': {
      const referrer = promoter.referredBy
        ? await store.get(promoter.referredBy)
        : undefined;
      updated = {
        ...promoter,
        status: 'approved',
        reviewedAt: now,
        referredBy:
          referrer?.status === 'approved' ? promoter.referredBy : undefined,
      };
      break;
    }
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
      if (body.links !== undefined) {
        const links: PromoterLinks = {};
        const raw = (body.links ?? {}) as Record<string, unknown>;
        for (const platform of LINK_PLATFORMS) {
          if (!raw[platform]) continue;
          const normalized = normalizeLink(platform, raw[platform]);
          if (!normalized) {
            return NextResponse.json(
              { error: `Invalid ${platform} link.` },
              { status: 400 },
            );
          }
          links[platform] = normalized;
        }
        if (Object.keys(links).length === 0) {
          return NextResponse.json(
            { error: 'Keep at least one link.' },
            { status: 400 },
          );
        }
        edits.links = links;
      }
      updated = { ...promoter, ...edits };
      break;
    }
  }

  await store.put(updated);
  // Any of these can change what the public sees, so refresh the one
  // document the public routes read.
  await store.rebuildApproved();

  return NextResponse.json({ promoter: updated });
}
