import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <h1 className="text-lg font-semibold">Página não encontrada</h1>
        <Link href="/" className="mt-2 inline-block text-sm text-accent">Voltar para a visão geral</Link>
      </div>
    </main>
  );
}
