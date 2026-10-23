import { NextResponse, type NextRequest } from 'next/server';
import { supabaseService } from '@/lib/supabase/server';
import { runSync, type Scope } from '@/lib/meta/sync';

export const maxDuration = 60;
const SCOPES: Scope[] = ['recent', 'daily', 'competitors'];

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 });
  }
  const scope = req.nextUrl.searchParams.get('scope') as Scope;
  if (!SCOPES.includes(scope)) return NextResponse.json({ error: 'scope inválido' }, { status: 400 });

  const sb = supabaseService();
  const { data: accounts } = await sb.from('ig_account').select('id,username');
  const results: Record<string, unknown> = {};
  for (const a of accounts ?? []) {
    try {
      results[a.username] = await runSync(a.id, scope);
    } catch (e) {
      results[a.username] = { error: e instanceof Error ? e.message : String(e) };
    }
  }
  return NextResponse.json({ ok: true, results });
}
