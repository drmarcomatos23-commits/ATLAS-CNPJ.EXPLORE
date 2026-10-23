import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PUBLIC = ['/entrar', '/api/cron', '/api/meta/oauth/callback', '/privacidade'];

export async function middleware(req: NextRequest) {
  if (process.env.SOCIAL_DEMO === '1' || !process.env.NEXT_PUBLIC_SUPABASE_URL) return NextResponse.next();
  if (PUBLIC.some((p) => req.nextUrl.pathname.startsWith(p))) return NextResponse.next();

  let res = NextResponse.next({ request: req });
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await sb.auth.getUser();
  if (!data.user) {
    const url = req.nextUrl.clone();
    url.pathname = '/entrar';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.svg|icon.svg).*)'],
};
