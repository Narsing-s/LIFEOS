import { encryptSecret } from '../services/crypto.js';

export const GOOGLE_SCOPES = [
  'openid', 'email', 'profile',
  'https://www.googleapis.com/auth/photoslibrary.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/contacts.readonly',
];

export function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);
}

export function googleAuthorizationUrl(state: string) {
  if (!googleConfigured()) throw new Error('Google integration is not configured');
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID!);
  url.searchParams.set('redirect_uri', process.env.GOOGLE_REDIRECT_URI!);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('scope', GOOGLE_SCOPES.join(' '));
  url.searchParams.set('state', state);
  return url.toString();
}

export async function exchangeGoogleCode(code: string) {
  if (!googleConfigured()) throw new Error('Google integration is not configured');
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: {'content-type':'application/x-www-form-urlencoded'},
    body: new URLSearchParams({code, client_id:process.env.GOOGLE_CLIENT_ID!, client_secret:process.env.GOOGLE_CLIENT_SECRET!, redirect_uri:process.env.GOOGLE_REDIRECT_URI!, grant_type:'authorization_code'}),
  });
  if (!response.ok) throw new Error(`Google token exchange failed: ${response.status}`);
  const token = await response.json() as {access_token:string;refresh_token?:string;expires_in?:number;scope?:string};
  const userinfoResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${token.access_token}` } });
  if (!userinfoResponse.ok) throw new Error(`Google userinfo lookup failed: ${userinfoResponse.status}`);
  const userinfo = await userinfoResponse.json() as {sub?:string;email?:string};
  if (!userinfo.sub) throw new Error('Google account identity was not returned');
  return {
    accountId: userinfo.sub,
    accountEmail: userinfo.email,
    accessTokenEncrypted: encryptSecret(token.access_token),
    refreshTokenEncrypted: token.refresh_token ? encryptSecret(token.refresh_token) : undefined,
    expiresAt: token.expires_in ? new Date(Date.now()+token.expires_in*1000) : undefined,
    scopes: token.scope?.split(' ') ?? GOOGLE_SCOPES,
  };
}
