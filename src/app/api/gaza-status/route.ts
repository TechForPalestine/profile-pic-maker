import dayjs from 'dayjs';
import { NextResponse, type NextRequest } from 'next/server';
import abbreviate from 'number-abbreviate';


export const runtime = 'edge';
export async function GET(request: NextRequest) {
    const res = await fetch('https://data.techforpalestine.org/api/v1/summary.json')
    if (!res.ok) {
        throw new Error('Failed to fetch data')
    }
    const { martyred, lastDailyUpdate } = await res.json()
    const daysOfWarCrimes = dayjs(lastDailyUpdate).diff('2023-10-07', 'day')

    return NextResponse.json({ summary: `${abbreviate(martyred.total)}+ killed in ${daysOfWarCrimes} days` }, { status: 200 });
}
