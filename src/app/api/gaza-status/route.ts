import dayjs from 'dayjs';
import { NextResponse } from 'next/server';
import abbreviate from 'number-abbreviate';

export const runtime = 'edge';
export async function GET() {
  const res = await fetch(
    'https://data.techforpalestine.org/api/v2/summary.json',
    { next: { revalidate: 3600 } },
  );
  if (!res.ok) {
    throw new Error('Failed to fetch data');
  }
  const { killed, lastDailyUpdate } = await res.json();
  const daysOfWarCrimes = dayjs(lastDailyUpdate).diff('2023-10-07', 'day');

  return NextResponse.json(
    {
      summary: `${abbreviate(killed.total)} killed in ${daysOfWarCrimes} days`,
    },
    { status: 200 },
  );
}
