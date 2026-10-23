import { NextResponse, type NextRequest } from 'next/server';
import { currentMember, supabaseService } from '@/lib/supabase/server';
import { graph } from '@/lib/meta/graph';
import { runSync } from '@/lib/meta/sync';

export const maxDuration = 60;

const back = (q: string) => NextResponse.redirect(new URL(`/conectar?${q}`, process.env.APP_URL));

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const saved = req.cookies.get('meta_oauth_state')?.value;
  if (req.nextUrl.searchParams.get('error')) return back('erro=negado');
  if (!code || !state || !saved || state !== saved) return back('erro=estado');

  const me = await currentMember();
  if (!me) return NextResponse.redirect(new URL('/entrar', process.env.APP_URL));

  try {
    const app = { client_id: process.env.META_APP_ID!, client_secret: process.env.META_APP_SECRET! };
    const short = await graph<{ access_token: string }>('oauth/access_token', '', {
      ...app, redirect_uri: `${process.env.APP_URL}/api/meta/oauth/callback`, code,
    });
    const long = await graph<{ access_token: string; expires_in?: number }>('oauth/access_token', '', {
      ...app, grant_type: 'fb_exchange_token', fb_exchange_token: short.access_token,
    });
    const pages = await graph<{ data: { id: string; name: string; access_token: string; instagram_business_account?: { id: string; username: string } }[] }>(
      'me/accounts', long.access_token, { fields: 'id,name,access_token,instagram_business_account{id,username}' },
    );
    const page = pages.data.find((p) => p.instagram_business_account);
    if (!page?.instagram_business_account) return back('erro=sem_pagina');

    const sb = supabaseService();
    const ig = page.instagram_business_account;
    const { data: acc, error } = await sb.from('ig_account').upsert({
      owner_id: me.id, ig_user_id: ig.id, fb_page_id: page.id, username: ig.username, account_type: 'business',
    }, { onConflict: 'ig_user_id' }).select('id').single();
    if (error || !acc) throw new Error(error?.message ?? 'falha ao salvar conta');

    // Token de Página obtido com token de usuário de longa duração não expira.
    const { error: e2 } = await sb.rpc('set_account_token', { p_account: acc.id, p_token: page.access_token, p_expires_at: null });
    if (e2) throw new Error(e2.message);

    await runSync(acc.id, 'initial').catch(() => undefined); // primeira coleta; o cron completa se estourar o tempo
    const res = NextResponse.redirect(new URL('/posts?conectado=1', process.env.APP_URL));
    res.cookies.delete('meta_oauth_state');
    return res;
  } catch (e) {
    console.error('oauth callback', e instanceof Error ? e.message : e);
    return back('erro=meta');
  }
}
