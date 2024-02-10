import { SocialPlatform } from '@/types';
import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'edge';
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const username = searchParams.get('username');
  const platform = searchParams.get('platform') as SocialPlatform;

  let profilePicUrl = '/user.jpg';

  if (
    !username ||
    !platform ||
    !Object.values(SocialPlatform).includes(platform)
  ) {
    // just return back default image for now - not handling this kind of error yet
    return NextResponse.json({ profilePicUrl }, { status: 200 });
  }

  switch (platform) {
    case SocialPlatform.Twitter:
      profilePicUrl = await fetchTwitterProfilePic(username);
      break;
    case SocialPlatform.Github:
      profilePicUrl = await fetchGithubProfilePic(username);
      break;
    case SocialPlatform.Gitlab:
      profilePicUrl = await fetchGitlabProfilePic(username);
      break;
  }

  if (profilePicUrl === null) {
    return NextResponse.json({}, { status: 404 });
  }

  return NextResponse.json({ profilePicUrl }, { status: 200 });
}

const fetchTwitterProfilePic = async (username: string) => {
  const endpoint = `https://api.fxtwitter.com/${username}`;
  const response = await fetch(endpoint).then((res) =>
    res.ok ? res.json() : null,
  );

  if (response === null) {
    return null;
  }
  const smallImageUrl = response.user.avatar_url;

  return smallImageUrl.replace('_normal', '_400x400');
};

const fetchGithubProfilePic = async (username: string) => {
  const endpoint = `https://api.github.com/users/${username}`;
  const response = await fetch(endpoint).then((res) =>
    res.ok ? res.json() : null,
  );

  if (response === null) {
    return null;
  }
  return response.avatar_url;
};

const fetchGitlabProfilePic = async (username: string) => {
  const endpoint = `https://gitlab.com/api/v4/users?username=${username}`;
  const response = await fetch(endpoint).then((res) =>
    res.ok ? res.json() : null,
  );

  if (response === null) {
    return null;
  }
  return response[0].avatar_url;
};
