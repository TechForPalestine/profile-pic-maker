import { SocialPlatform } from "@/types";
import axios from "axios";
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const username = searchParams.get('username');
    const platform = searchParams.get('platform') as SocialPlatform;

    let profilePicUrl = "/user.jpg"

    if (!username || !platform || !Object.values(SocialPlatform).includes(platform)) {
        // just return back default image for now - not handling this kind of error yet
        return NextResponse.json({ profilePicUrl }, { status: 200 })
    }

    switch (platform) {
        case SocialPlatform.Twitter:
            profilePicUrl = await fetchTwitterProfilePic(username);
            break;
        case SocialPlatform.Github:
            profilePicUrl = await fetchGithubProfilePic(username);
            break;
    }

    if (profilePicUrl === null) {
        return NextResponse.json({}, { status: 404 });
    }
    return NextResponse.json({ profilePicUrl }, { status: 200 });
}


const fetchTwitterProfilePic = async (username: string) => {
    const endpoint = `https://api.fxtwitter.com/${username}`
    try {
        const response = await axios.get(endpoint);

        const smallImageUrl = response.data.user.avatar_url;

        return smallImageUrl.replace('_normal', '_400x400');
    } catch (error) {
        return null;
    }
}

const fetchGithubProfilePic = async (username: string) => {
    const endpoint = `https://api.github.com/users/${username}`
    try {
        const response = await axios.get(endpoint);

        return response.data.avatar_url;
    } catch (error) {
        return null;
    }

}
