import dayjs from 'dayjs';
import { NextResponse } from 'next/server';
import abbreviate from 'number-abbreviate';

export const runtime = 'edge';
export async function GET() {
  const res = await fetch(
    'https://data.techforpalestine.org/api/v3/summary.json',
    { next: { revalidate: 3600 } },
  );
  if (!res.ok) {
    throw new Error('Failed to fetch data');
  }
  const { gaza, west_bank } = await res.json();
  const moreRecentUpdate =
    dayjs(gaza.last_update) > dayjs(west_bank.last_update)
      ? dayjs(gaza.last_update)
      : dayjs(west_bank.last_update);

  const daysOfWarCrimes = moreRecentUpdate.diff('2023-10-07', 'day');

  return NextResponse.json(
    {
      summary: `${abbreviate(gaza.killed.total + west_bank.killed.total)} killed in ${daysOfWarCrimes} days`,
    },
    { status: 200 },
  );
}
