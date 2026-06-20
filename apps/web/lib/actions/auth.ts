'use server';
import request from '@/lib/requests';
import type { TikTokAccessToken } from '@repo/types/auth';

export async function getOAuthUrl(provider: string) {
  const now = new Date().getTime();
  switch (provider) {
    case 'tiktok':
      return `${process.env.TIKTOK_ENDPOINT_OAUTH}?client_key=${process.env.TIKTOK_CLIENT_KEY}&response_type=code&scope=${process.env.TIKTOK_AUTH_SCOPES}&redirect_uri=${process.env.TIKTOK_REDIRECT_URI}&state=${now}`;
    case 'instagram':
    default:
      return;
  }
}

// Fetch an access token using an authorization code
export async function getTiktokAccessToken(code: string) {
  const resp = await request.post<TikTokAccessToken>(
    `${process.env.TIKTOK_API_ENDPOINT}/v2/oauth/token/`,
    {
      params: {
        client_key: process.env.TIKTOK_CLIENT_KEY,
        client_secret: process.env.TIKTOK_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: process.env.TIKTOK_REDIRECT_URI,
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    },
  );
  return resp;
}

// Refresh an access token using a refresh token
export async function refreshTiktokAccessToken(refreshToken: string) {
  const fields = '';
  const resp = await request.post<TikTokAccessToken>(
    `${process.env.TIKTOK_API_ENDPOINT}/v2/oauth/token/?fields=${fields}`,
    {
      params: {
        client_key: process.env.TIKTOK_CLIENT_KEY,
        client_secret: process.env.TIKTOK_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    },
  );
  return resp;
}

// Get User Info
export async function getTiktokUserProfile(accessToken: string) {
  const resp = await request.get(`${process.env.TIKTOK_API_ENDPOINT}/v2/user/info/`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return resp;
}
