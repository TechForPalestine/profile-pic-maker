import axios from "axios";
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    // const platform = searchParams.get('platform')
    const username = searchParams.get('username')

    const platformBaseUrl = "https://twitter.com"
    const platformPath = `/${username}/profile_image?size=original`

    const profilePicUrl = axios.get(`${platformBaseUrl}${platformPath}`);
    return NextResponse.json({ profilePicUrl }, { status: 200 });
}
