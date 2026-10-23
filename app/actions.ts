'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { currentMember, isDemo, supabaseUser } from '@/lib/supabase/server';
import { setPillar } from '@/lib/data';
import { contextFor, runSync, syncCompetitor } from '@/lib/meta/sync';
import { PILLARS } from '@/lib/types';

const pillarSchema = z.enum(PILLARS.map((p) => p.value) as [string, ...string[]]).nullable();

export async function setPillarAction(form: FormData) {
  const id = z.string().min(1).parse(form.get('id'));
  const raw = form.get('pillar');
  const pillar = pillarSchema.parse(raw === '' || raw === null ? null : raw);
  if (!isDemo() && !(await currentMember())) redirect('/entrar');
  await setPillar(id, pillar as never);
  revalidatePath(`/posts/${id}`);
  revalidatePath('/posts');
}

export async function addCompetitorAction(_: unknown, form: FormData): Promise<{ ok: boolean; message: string }> {
  const parsed = z.string().trim().regex(/^@?[A-Za-z0-9._]{1,30}$/, 'Use só o @ do perfil (letras, números, ponto e _).')
    .safeParse(form.get('username'));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const username = parsed.data.replace(/^@/, '').toLowerCase();
  if (isDemo()) return { ok: false, message: 'No modo demonstração não é possível adicionar concorrentes.' };

  const me = await currentMember();
  if (!me) redirect('/entrar');
  const sb = await supabaseUser();
  const { data: acc } = await sb.from('ig_account').select('id').limit(1).maybeSingle();
  if (!acc) return { ok: false, message: 'Conecte seu Instagram antes de adicionar concorrentes.' };
  const { count } = await sb.from('competitor').select('id', { count: 'exact', head: true });
  if ((count ?? 0) >= 30) return { ok: false, message: 'Limite de 30 concorrentes atingido.' };

  const { data: comp, error } = await sb.from('competitor').insert({ owner_id: me.id, account_id: acc.id, username }).select('id,username').single();
  if (error) return { ok: false, message: error.code === '23505' ? 'Esse perfil já está na lista.' : 'Não foi possível salvar.' };

  try {
    const ctx = await contextFor(acc.id);
    const status = await syncCompetitor(ctx, comp);
    revalidatePath('/concorrentes');
    return status === 'active'
      ? { ok: true, message: `@${username} adicionado.` }
      : { ok: false, message: `@${username} é perfil pessoal ou não existe: o Instagram só libera dados de contas comerciais ou de criador.` };
  } catch {
    revalidatePath('/concorrentes');
    return { ok: true, message: `@${username} salvo. Os números aparecem na próxima coleta.` };
  }
}

export async function removeCompetitorAction(form: FormData) {
  const id = z.string().uuid().parse(form.get('id'));
  if (isDemo()) return;
  if (!(await currentMember())) redirect('/entrar');
  const sb = await supabaseUser();
  await sb.from('competitor').delete().eq('id', id);
  revalidatePath('/concorrentes');
  redirect('/concorrentes');
}

export async function syncNowAction() {
  if (isDemo()) return;
  if (!(await currentMember())) redirect('/entrar');
  const sb = await supabaseUser();
  const { data: acc } = await sb.from('ig_account').select('id').limit(1).maybeSingle();
  if (acc) await runSync(acc.id, 'recent');
  revalidatePath('/', 'layout');
}

export async function signInAction(_: unknown, form: FormData): Promise<{ message: string }> {
  const email = z.string().trim().email().safeParse(form.get('email'));
  const password = z.string().min(1).safeParse(form.get('password'));
  if (!email.success || !password.success) return { message: 'Informe e-mail e senha.' };
  const sb = await supabaseUser();
  const { error } = await sb.auth.signInWithPassword({ email: email.data, password: password.data });
  if (error) return { message: 'E-mail ou senha incorretos.' };
  redirect('/');
}

export async function signOutAction() {
  if (isDemo()) return;
  const sb = await supabaseUser();
  await sb.auth.signOut();
  redirect('/entrar');
}
