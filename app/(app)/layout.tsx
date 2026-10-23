import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { currentMember, isDemo } from '@/lib/supabase/server';
import { getAccount } from '@/lib/data';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const demo = isDemo();
  if (!demo) {
    const me = await currentMember();
    if (!me) redirect('/entrar?acesso=negado');
  }
  const account = await getAccount();
  return <AppShell username={account?.username ?? null} demo={demo}>{children}</AppShell>;
}
