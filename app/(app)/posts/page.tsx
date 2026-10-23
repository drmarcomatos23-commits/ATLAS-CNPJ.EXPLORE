import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, buttonClass, ButtonLink, Card, EmptyState, PageHeader, PillarBadge, TypeBadge } from '@/components/ui';
import { getAccount, listPosts } from '@/lib/data';
import { fmtCompact, fmtDate, fmtInt, truncate } from '@/lib/format';
import { followsPerThousand } from '@/lib/metrics';
import { PILLARS, type MediaType, type Pillar, type SortKey } from '@/lib/types';

export const metadata: Metadata = { title: 'Posts' };

const COLS: { key: SortKey; label: string; title: string }[] = [
  { key: 'views', label: 'Views', title: 'Visualizações' },
  { key: 'reach', label: 'Alcance', title: 'Contas alcançadas' },
  { key: 'saved', label: 'Salvos', title: 'Salvamentos' },
  { key: 'shares', label: 'Compart.', title: 'Compartilhamentos' },
  { key: 'follows', label: 'Seguidores', title: 'Seguidores ganhos com o post' },
  { key: 'conversion', label: 'Seg./mil', title: 'Seguidores ganhos a cada mil visualizações' },
];
const SORTS: SortKey[] = ['publishedAt', ...COLS.map((c) => c.key)];
const TYPES: { v: MediaType | 'all'; l: string }[] = [
  { v: 'all', l: 'Todos' }, { v: 'REELS', l: 'Reels' }, { v: 'CAROUSEL_ALBUM', l: 'Carrosséis' }, { v: 'IMAGE', l: 'Imagens' },
];

type SP = { ordem?: string; dir?: string; tipo?: string; pilar?: string; dias?: string; conectado?: string };

export default async function Posts({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const sort: SortKey = SORTS.includes(sp.ordem as SortKey) ? (sp.ordem as SortKey) : 'follows';
  const dir = sp.dir === 'asc' ? 'asc' : 'desc';
  const type = TYPES.some((t) => t.v === sp.tipo) ? (sp.tipo as MediaType | 'all') : 'all';
  const pillar = PILLARS.some((p) => p.value === sp.pilar) ? (sp.pilar as Pillar) : 'all';
  const days = [30, 90, 365].includes(Number(sp.dias)) ? Number(sp.dias) : undefined;

  const account = await getAccount();
  if (!account) {
    return (
      <>
        <PageHeader title="Posts" />
        <EmptyState title="Nenhum post ainda" body="Conecte o Instagram para trazer seus posts e métricas."
          action={<ButtonLink href="/conectar" variant="primary">Conectar Instagram</ButtonLink>} />
      </>
    );
  }
  const posts = await listPosts({ sort, dir, type, pillar, days });

  const href = (patch: Partial<SP>) => {
    const q = new URLSearchParams();
    const merged = { ordem: sort, dir, tipo: type, pilar: pillar, dias: days ? String(days) : undefined, ...patch };
    Object.entries(merged).forEach(([k, v]) => v && v !== 'all' && q.set(k, v));
    return `/posts?${q.toString()}`;
  };
  const sortHref = (k: SortKey) => href({ ordem: k, dir: sort === k && dir === 'desc' ? 'asc' : 'desc' });
  const aria = (k: SortKey) => (sort === k ? (dir === 'asc' ? 'ascending' : 'descending') : 'none') as 'ascending' | 'descending' | 'none';
  const arrow = (k: SortKey) => (sort === k ? (dir === 'asc' ? ' ↑' : ' ↓') : '');

  return (
    <>
      {sp.conectado && <Alert tone="success">Instagram conectado. A primeira coleta já trouxe seus posts.</Alert>}
      <PageHeader title="Posts" subtitle={`${posts.length} posts · ordenado por ${sort === 'publishedAt' ? 'data' : COLS.find((c) => c.key === sort)!.title.toLowerCase()}`} />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3" aria-label="Filtros">
        <input type="hidden" name="ordem" value={sort} />
        <input type="hidden" name="dir" value={dir} />
        <label className="text-sm">
          <span className="mb-1 block text-text-muted">Tipo</span>
          <select name="tipo" defaultValue={type} className="h-10 rounded-md border border-border-input bg-surface px-3">
            {TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-text-muted">Pilar</span>
          <select name="pilar" defaultValue={pillar} className="h-10 rounded-md border border-border-input bg-surface px-3">
            <option value="all">Todos</option>
            {PILLARS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-text-muted">Período</span>
          <select name="dias" defaultValue={days ?? ''} className="h-10 rounded-md border border-border-input bg-surface px-3">
            <option value="">Tudo</option>
            <option value="30">30 dias</option>
            <option value="90">90 dias</option>
            <option value="365">1 ano</option>
          </select>
        </label>
        <button className={buttonClass('secondary')}>Filtrar</button>
      </form>

      {posts.length === 0 ? (
        <EmptyState title="Nada com esses filtros" body="Tente outro tipo, pilar ou período." action={<ButtonLink href="/posts">Limpar filtros</ButtonLink>} />
      ) : (
        <>
          {/* Celular: cartões */}
          <nav aria-label="Ordenar" className="mb-3 flex gap-2 overflow-x-auto pb-1 md:hidden">
            {COLS.map((c) => (
              <Link key={c.key} href={sortHref(c.key)} aria-current={sort === c.key ? 'true' : undefined}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs ${sort === c.key ? 'border-accent bg-accent-soft text-accent' : 'border-border bg-surface text-text-muted'}`}>
                {c.label}{arrow(c.key)}
              </Link>
            ))}
          </nav>
          <ul className="space-y-3 md:hidden">
            {posts.map((p) => (
              <li key={p.id}>
                <Link href={`/posts/${p.id}`} className="block rounded-lg border border-border bg-surface p-4 shadow-card">
                  <span className="flex items-center gap-2 text-xs text-text-muted"><TypeBadge type={p.mediaType} /> {fmtDate(p.publishedAt)} <PillarBadge pillar={p.pillar} /></span>
                  <span className="mt-2 block text-sm">{truncate(p.caption || 'Sem legenda', 90)}</span>
                  <span className="num mt-3 grid grid-cols-4 gap-2 text-center">
                    {[['Views', fmtCompact(p.views)], ['Salvos', fmtInt(p.saved)], ['Compart.', fmtInt(p.shares)], ['Seguid.', `+${fmtInt(p.follows)}`]].map(([l, v]) => (
                      <span key={l} className="rounded-md bg-surface-2 py-2">
                        <span className="block text-sm font-semibold">{v}</span>
                        <span className="block text-[11px] text-text-muted">{l}</span>
                      </span>
                    ))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {/* Desktop: tabela */}
          <Card className="hidden overflow-x-auto p-0 md:block sm:p-0">
            <table className="w-full min-w-[860px] text-sm">
              <caption className="sr-only">Posts e métricas</caption>
              <thead className="border-b border-border text-left text-xs text-text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Post</th>
                  <th scope="col" aria-sort={aria('publishedAt')} className="px-3 py-3 font-medium">
                    <Link href={sortHref('publishedAt')} className="hover:text-text">Data{arrow('publishedAt')}</Link>
                  </th>
                  {COLS.map((c) => (
                    <th key={c.key} scope="col" aria-sort={aria(c.key)} className="px-3 py-3 text-right font-medium">
                      <Link href={sortHref(c.key)} title={c.title} className="hover:text-text">{c.label}{arrow(c.key)}</Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {posts.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-2">
                    <td className="max-w-[360px] px-4 py-3">
                      <Link href={`/posts/${p.id}`} className="block">
                        <span className="flex items-center gap-2"><TypeBadge type={p.mediaType} /><PillarBadge pillar={p.pillar} /></span>
                        <span className="mt-1 block truncate">{p.caption || 'Sem legenda'}</span>
                      </Link>
                    </td>
                    <td className="num whitespace-nowrap px-3 py-3 text-text-muted">{fmtDate(p.publishedAt)}</td>
                    <td className="num px-3 py-3 text-right">{fmtInt(p.views)}</td>
                    <td className="num px-3 py-3 text-right">{fmtInt(p.reach)}</td>
                    <td className="num px-3 py-3 text-right">{fmtInt(p.saved)}</td>
                    <td className="num px-3 py-3 text-right">{fmtInt(p.shares)}</td>
                    <td className="num px-3 py-3 text-right font-semibold">{p.follows === null ? '—' : `+${fmtInt(p.follows)}`}</td>
                    <td className="num px-3 py-3 text-right">{(() => { const c = followsPerThousand(p); return c === null ? '—' : c.toLocaleString('pt-BR', { maximumFractionDigits: 1 }); })()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </>
  );
}
