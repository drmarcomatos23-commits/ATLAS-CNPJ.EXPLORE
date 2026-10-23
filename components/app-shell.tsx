import { BottomNav, SideNav } from './nav';
import { signOutAction } from '@/app/actions';

export function AppShell({ username, demo, children }: { username: string | null; demo: boolean; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2">
        Pular para o conteúdo
      </a>
      <aside className="hidden border-r border-border bg-surface px-4 py-5 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <div className="mb-6 px-3">
          <p className="text-md font-semibold tracking-tight">ATLAS Social</p>
          <p className="text-xs text-text-muted">{username ? `@${username}` : 'Instagram não conectado'}</p>
        </div>
        <SideNav />
        {!demo && (
          <form action={signOutAction} className="mt-auto px-3">
            <button className="text-sm text-text-muted hover:text-text">Sair</button>
          </form>
        )}
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface px-4 py-3 lg:hidden">
          <p className="font-semibold tracking-tight">ATLAS Social</p>
          <p className="text-xs text-text-muted">{username ? `@${username}` : 'não conectado'}</p>
        </header>
        {demo && (
          <p role="status" className="border-b border-border bg-accent-soft px-4 py-2 text-xs text-accent">
            Modo demonstração: visualizações reais do seu grid; seguidores ganhos, salvamentos e concorrentes são simulados.
          </p>
        )}
        <main id="conteudo" className="mx-auto max-w-[1280px] px-4 pb-28 pt-6 sm:px-6 lg:pb-10">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
