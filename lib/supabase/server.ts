import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export const SCHEMA = 'social';

export function isDemo(): boolean {
  return process.env.SOCIAL_DEMO === '1' || !process.env.NEXT_PUBLIC_SUPABASE_URL;
}

/** Cliente com a sessão do usuário (respeita RLS). */
export async function supabaseUser() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    db: { schema: SCHEMA },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // chamado de Server Component: o middleware renova a sessão
        }
      },
    },
  });
}

/** Cliente de serviço — só para jobs e callback OAuth. Nunca chegar ao navegador. */
export function supabaseService() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    db: { schema: SCHEMA },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Usuário logado e membro do ATLAS Social, ou null. */
export async function currentMember(): Promise<{ id: string; email: string | null } | null> {
  const sb = await supabaseUser();
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  const { data: m } = await sb.from('member').select('user_id').eq('user_id', data.user.id).maybeSingle();
  if (!m) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}
