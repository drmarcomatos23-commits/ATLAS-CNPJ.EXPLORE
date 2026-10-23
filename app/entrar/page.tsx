import type { Metadata } from 'next';
import { SignInForm } from './form';

export const metadata: Metadata = { title: 'Entrar' };

export default async function Entrar({ searchParams }: { searchParams: Promise<{ acesso?: string }> }) {
  const { acesso } = await searchParams;
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-card">
        <h1 className="text-lg font-semibold">ATLAS Social</h1>
        <p className="mt-1 text-sm text-text-muted">Entre com o mesmo login do Atlas Família.</p>
        {acesso === 'negado' && (
          <p role="alert" className="mt-4 text-sm text-danger">Seu usuário não tem acesso ao ATLAS Social.</p>
        )}
        <SignInForm />
      </div>
    </main>
  );
}
