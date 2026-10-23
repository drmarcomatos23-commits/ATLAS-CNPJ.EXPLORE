import { NextResponse } from 'next/server';
import { currentMember, isDemo } from '@/lib/supabase/server';

const SCOPES = [
  'instagram_basic', 'instagram_manage_insights', 'instagram_content_publish',
  'pages_show_list', 'pages_read_engagement', 'business_management',
].join(',');

export async function GET() {
  if (isDemo()) return NextResponse.redirect(new URL('/conectar?erro=demo', process.env.APP_URL || 'http://localhost:3000'));
  const me = await currentMember();
  if (!me) return NextResponse.redirect(new URL('/entrar', process.env.APP_URL));
  const state = crypto.randomUUID();
  const v = process.env.META_GRAPH_VERSION || 'v26.0';
  const url = new URL(`https://www.facebook.com/${v}/dialog/oauth`);
  url.search = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    redirect_uri: `${process.env.APP_URL}/api/meta/oauth/callback`,
    state,
    scope: SCOPES,
    response_type: 'code',
  }).toString();
  const res = NextResponse.redirect(url);
  res.cookies.set('meta_oauth_state', state, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/' });
  return res;
}
