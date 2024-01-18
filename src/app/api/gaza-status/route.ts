import dayjs from 'dayjs';
import { NextResponse, type NextRequest } from 'next/server';
import abbreviate from 'number-abbreviate';


export const runtime = 'edge';
export async function GET(request: NextRequest) {
    const res = await fetch('https://data.techforpalestine.org/api/v1/summary.json')
    if (!res.ok) {
        throw new Error('Failed to fetch data')
    }
    const { martyred } = await res.json()
    const daysOfWarCrimes = dayjs().diff('2023-10-07', 'day')

    return NextResponse.json({ summary: `${abbreviate(martyred.total)}+ killed after ${daysOfWarCrimes} days  of genocide` }, { status: 200 });
}
