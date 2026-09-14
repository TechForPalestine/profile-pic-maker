import * as Sentry from '@sentry/nextjs';
import { NextResponse, type NextRequest } from 'next/server';

import {
  MAX_PENDING,
  getPromoterStore,
  isJoinEnabled,
  toPublicPromoter,
  validateJoinRequest,
  type Promoter,
} from '@/lib/promoters';
import { verifyTurnstile } from '@/lib/turnstile';

export const runtime = 'edge';

/** Approved promoters only: the leaderboard joins these onto its counts. */
export async function GET() {
  const store = getPromoterStore();
  const approved = await store.listApproved();
  return NextResponse.json(
    { promoters: approved.map((p) => toPublicPromoter(p, approved)) },
    {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    },
  );
}

/** A request to be listed. Lands as `pending` until an approver reviews it. */
export async function POST(request: NextRequest) {
  if (!isJoinEnabled()) {
    return NextResponse.json(
      { error: 'Joining the leaderboard is paused right now.' },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ errors: ['Invalid JSON.'] }, { status: 400 });
  }

  const validation = validateJoinRequest(body);
  if (!validation.ok) {
    return NextResponse.json({ errors: validation.errors }, { status: 400 });
  }

  const turnstileToken = (body as { turnstileToken?: unknown }).turnstileToken;
  const passed = await verifyTurnstile(
    typeof turnstileToken === 'string' ? turnstileToken : undefined,
    request.headers.get('cf-connecting-ip') ?? undefined,
  );
  if (!passed) {
    return NextResponse.json(
      { errors: ['The bot check did not pass. Please try again.'] },
      { status: 403 },
    );
  }

  const store = getPromoterStore();
  const { code, displayName, links, referredBy } = validation.value;

  if (await store.get(code)) {
    return NextResponse.json(
      { errors: ['That code is already taken. Pick another one.'] },
      { status: 409 },
    );
  }

  const pending = (await store.list()).filter((p) => p.status === 'pending');
  if (pending.length >= MAX_PENDING) {
    Sentry.captureMessage('Promoter queue is full', { level: 'warning' });
    return NextResponse.json(
      {
        errors: ['Too many requests are waiting for review. Try again later.'],
      },
      { status: 429 },
    );
  }

  const promoter: Promoter = {
    code,
    displayName,
    links,
    referredBy,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  await store.put(promoter);

  return NextResponse.json({ status: 'pending', code }, { status: 201 });
}
