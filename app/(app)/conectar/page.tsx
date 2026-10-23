import type { Metadata } from 'next';
import { Alert, buttonClass, Card, CardTitle, PageHeader } from '@/components/ui';
import { getAccount } from '@/lib/data';
import { fmtDateTime } from '@/lib/format';
import { isDemo } from '@/lib/supabase/server';
import { syncNowAction } from '@/app/actions';

export const metadata: Metadata = { title: 'Conectar Instagram' };

const ERROS: Record<string, string> = {
  negado: 'Você cancelou ou não deu as permissões no Facebook.',
  estado: 'A sessão de login expirou. Tente de novo.',
  sem_pagina: 'Nenhuma Página do Facebook com Instagram comercial foi encontrada. Ligue o @matos_advogado a uma Página e tente de novo.',
  meta: 'A Meta recusou a conexão. Confira o app no Meta for Developers e tente de novo.',
  demo: 'No modo demonstração a conexão fica desativada.',
};

export default async function Conectar({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const account = await getAccount();
  return (
    <>
      <PageHeader title="Conexão com o Instagram" />
      {erro && <Alert tone="danger">{ERROS[erro] ?? 'Não foi possível conectar.'}</Alert>}
      {account && !isDemo() && (
        <Card className="mb-6">
          <CardTitle>Conta conectada</CardTitle>
          <p className="text-sm">@{account.username}</p>
          <p className="mt-1 text-xs text-text-muted">Última coleta: {account.lastSyncedAt ? fmtDateTime(account.lastSyncedAt) : 'ainda não'}</p>
          <form action={syncNowAction} className="mt-4"><button className={buttonClass('secondary', 'sm')}>Coletar agora</button></form>
        </Card>
      )}
      <Card>
        <CardTitle>Antes de conectar</CardTitle>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>O @matos_advogado precisa ser <strong>conta comercial</strong> (Configurações → Tipo de conta).</li>
          <li>A conta precisa estar <strong>ligada a uma Página do Facebook</strong>.</li>
          <li>O app do ATLAS Social precisa estar criado no Meta for Developers, com você como administrador.</li>
        </ol>
        <a href="/api/meta/oauth/start" className={`${buttonClass('primary')} mt-5`} aria-disabled={isDemo()}>
          {account ? 'Reconectar com o Facebook' : 'Conectar com o Facebook'}
        </a>
        <p className="mt-3 text-xs text-text-muted">Permissões pedidas: ler perfil e métricas, publicar posts e ver as Páginas que você administra. O token fica criptografado.</p>
      </Card>
    </>
  );
}
