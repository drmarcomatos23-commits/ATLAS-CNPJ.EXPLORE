import Link from 'next/link';
import { Card, CardTitle, EmptyState, ButtonLink, KpiCard, PageHeader, TypeBadge } from '@/components/ui';
import { TrendChart } from '@/components/charts';
import { getAccount, getOverview } from '@/lib/data';
import { fmtDate, fmtInt, truncate } from '@/lib/format';

const PERIODS = [7, 30, 90];

export default async function Overview({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const { dias } = await searchParams;
  const days = PERIODS.includes(Number(dias)) ? Number(dias) : 30;
  const account = await getAccount();
  if (!account) {
    return (
      <>
        <PageHeader title="Visão geral" />
        <EmptyState title="Conecte seu Instagram" body="Ligue a conta @matos_advogado para começar a guardar o histórico de métricas."
          action={<ButtonLink href="/conectar" variant="primary">Conectar Instagram</ButtonLink>} />
      </>
    );
  }
  const o = await getOverview(days);
  return (
    <>
      <PageHeader
        title="Visão geral"
        subtitle={`@${account.username} · últimos ${days} dias`}
        action={
          <nav aria-label="Período" className="flex rounded-md border border-border bg-surface p-0.5">
            {PERIODS.map((p) => (
              <Link key={p} href={`/?dias=${p}`} aria-current={p === days ? 'page' : undefined}
                className={`rounded-sm px-3 py-1.5 text-sm ${p === days ? 'bg-accent-soft font-medium text-accent' : 'text-text-muted hover:text-text'}`}>
                {p} dias
              </Link>
            ))}
          </nav>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {o.kpis.map((k) => <KpiCard key={k.key} label={k.label} value={k.value} previous={k.previous} />)}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardTitle hint="por dia">Visualizações</CardTitle>
          {o.series.length ? (
            <TrendChart data={o.series as never} xKey="day" xFormat="day" series={[{ key: 'views', label: 'Visualizações', color: 'var(--accent)' }]} />
          ) : (
            <p className="py-10 text-center text-sm text-text-muted">Os dados diários aparecem em até 48 h depois de conectar.</p>
          )}
        </Card>
        <Card>
          <CardTitle hint="no período">Posts que mais trouxeram seguidores</CardTitle>
          {o.topPosts.length ? (
            <ol className="divide-y divide-border">
              {o.topPosts.map((p, i) => (
                <li key={p.id}>
                  <Link href={`/posts/${p.id}`} className="flex items-start gap-3 py-3 hover:bg-surface-2">
                    <span className="num w-5 shrink-0 pt-0.5 text-sm text-text-muted">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm">{truncate(p.caption || 'Sem legenda', 70)}</span>
                      <span className="mt-1 flex items-center gap-2 text-xs text-text-muted">
                        <TypeBadge type={p.mediaType} /> {fmtDate(p.publishedAt)}
                      </span>
                    </span>
                    <span className="num shrink-0 text-right text-sm font-semibold">+{fmtInt(p.follows)}<span className="block text-xs font-normal text-text-muted">seguidores</span></span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-text-muted">Nenhum post no período.</p>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <CardTitle>Seguidores</CardTitle>
        <TrendChart data={o.series as never} xKey="day" xFormat="day" height={200} series={[{ key: 'followers', label: 'Seguidores', color: 'var(--success)' }]} />
      </Card>
    </>
  );
}
