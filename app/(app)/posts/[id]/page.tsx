import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buttonClass, Card, CardTitle, PageHeader, TypeBadge } from '@/components/ui';
import { TrendChart } from '@/components/charts';
import { setPillarAction } from '@/app/actions';
import { getPost } from '@/lib/data';
import { fmtDateTime, fmtInt, fmtPct } from '@/lib/format';
import { followsPerThousand, valueRate } from '@/lib/metrics';
import { PILLARS } from '@/lib/types';

export default async function PostDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getPost(id);
  if (!data) notFound();
  const { post, snapshots } = data;
  const conv = followsPerThousand(post);
  const value = valueRate(post);
  const stats: [string, string][] = [
    ['Visualizações', fmtInt(post.views)], ['Alcance', fmtInt(post.reach)], ['Curtidas', fmtInt(post.likes)],
    ['Comentários', fmtInt(post.comments)], ['Salvamentos', fmtInt(post.saved)], ['Compartilhamentos', fmtInt(post.shares)],
    ['Seguidores ganhos', post.follows === null ? '—' : `+${fmtInt(post.follows)}`],
    ['Seguidores por mil views', conv === null ? '—' : conv.toLocaleString('pt-BR', { maximumFractionDigits: 1 })],
    ['Salvos + compart. / views', fmtPct(value)],
  ];
  return (
    <>
      <Link href="/posts" className="mb-3 inline-block text-sm text-text-muted hover:text-text">← Posts</Link>
      <PageHeader title="Detalhe do post" subtitle={`Publicado em ${fmtDateTime(post.publishedAt)}`}
        action={post.permalink ? <a href={post.permalink} target="_blank" rel="noreferrer" className={buttonClass('secondary', 'sm')}>Abrir no Instagram ↗</a> : undefined} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Card>
            <div className="mb-2 flex items-center gap-2"><TypeBadge type={post.mediaType} /></div>
            <p className="whitespace-pre-line text-sm">{post.caption || 'Sem legenda'}</p>
          </Card>
          <Card>
            <CardTitle hint="desde a publicação">Curva de visualizações</CardTitle>
            {snapshots.length > 1 ? (
              <TrendChart data={snapshots as never} xKey="capturedAt" xFormat="datetime"
                series={[{ key: 'views', label: 'Visualizações', color: 'var(--accent)' }, { key: 'follows', label: 'Seguidores ganhos', color: 'var(--success)' }]} />
            ) : (
              <p className="py-8 text-center text-sm text-text-muted">A curva aparece depois de duas coletas (posts novos são medidos de hora em hora nas primeiras 72 h).</p>
            )}
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardTitle>Métricas</CardTitle>
            <dl className="divide-y divide-border">
              {stats.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2 text-sm">
                  <dt className="text-text-muted">{k}</dt>
                  <dd className="num font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card>
            <CardTitle>Pilar de conteúdo</CardTitle>
            <form action={setPillarAction} className="flex gap-2">
              <input type="hidden" name="id" value={post.id} />
              <label htmlFor="pillar" className="sr-only">Pilar</label>
              <select id="pillar" name="pillar" defaultValue={post.pillar ?? ''} className="h-10 flex-1 rounded-md border border-border-input bg-surface px-3 text-sm">
                <option value="">Sem pilar</option>
                {PILLARS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <button className={buttonClass('secondary')}>Salvar</button>
            </form>
            <p className="mt-2 text-xs text-text-muted">Use para comparar quais temas (holding, sucessão…) trazem mais seguidores.</p>
          </Card>
        </div>
      </div>
    </>
  );
}
