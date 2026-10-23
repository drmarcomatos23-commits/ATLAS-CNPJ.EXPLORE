import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buttonClass, Card, CardTitle, KpiCard, PageHeader } from '@/components/ui';
import { TrendChart } from '@/components/charts';
import { removeCompetitorAction } from '@/app/actions';
import { getCompetitor } from '@/lib/data';
import { fmtDate, fmtInt, truncate } from '@/lib/format';
import { isDemo } from '@/lib/supabase/server';

export default async function Competitor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getCompetitor(id);
  if (!c) notFound();
  return (
    <>
      <Link href="/concorrentes" className="mb-3 inline-block text-sm text-text-muted hover:text-text">← Concorrentes</Link>
      <PageHeader title={`@${c.username}`} subtitle="Dados públicos, atualizados 1×/dia"
        action={!isDemo() ? (
          <form action={removeCompetitorAction}>
            <input type="hidden" name="id" value={c.id} />
            <button className={buttonClass('danger', 'sm')}>Remover</button>
          </form>
        ) : undefined} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Seguidores" value={c.followers} previous={c.followers !== null && c.followersDelta30d !== null ? c.followers - c.followersDelta30d : null} />
        <KpiCard label="Posts no perfil" value={c.mediaCount} previous={null} />
        <div className="rounded-lg border border-border bg-surface p-4 shadow-card">
          <p className="text-sm text-text-muted">Posts por semana</p>
          <p className="num mt-1 text-xl font-semibold">{c.postsPerWeek === null ? '—' : c.postsPerWeek.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</p>
        </div>
        <KpiCard label="Interações por post" value={c.avgInteractions} previous={null} />
      </div>
      <Card className="mt-6">
        <CardTitle>Seguidores</CardTitle>
        {c.history.length > 1 ? (
          <TrendChart data={c.history as never} xKey="day" xFormat="day" height={200} series={[{ key: 'followers', label: 'Seguidores', color: 'var(--accent)' }]} />
        ) : <p className="py-6 text-center text-sm text-text-muted">O histórico começa a partir de hoje.</p>}
      </Card>
      <Card className="mt-6">
        <CardTitle hint="por curtidas">Posts com mais interação</CardTitle>
        <ul className="divide-y divide-border">
          {c.topMedia.map((m) => (
            <li key={m.id} className="flex items-start justify-between gap-4 py-3 text-sm">
              <span className="min-w-0">
                {m.permalink ? <a href={m.permalink} target="_blank" rel="noreferrer" className="hover:underline">{truncate(m.caption || 'Sem legenda', 90)}</a> : truncate(m.caption || 'Sem legenda', 90)}
                <span className="block text-xs text-text-muted">{fmtDate(m.publishedAt)}</span>
              </span>
              <span className="num shrink-0 text-right text-xs text-text-muted">
                <span className="block text-sm font-medium text-text">{fmtInt(m.likes)} curtidas</span>
                {fmtInt(m.comments)} coment. · {m.views === null ? 'views n/d' : `${fmtInt(m.views)} views`}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
