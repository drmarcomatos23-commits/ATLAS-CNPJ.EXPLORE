import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, EmptyState, PageHeader } from '@/components/ui';
import { AddCompetitor } from './add';
import { getAccount, listCompetitors, listPosts } from '@/lib/data';
import { postsPerWeek } from '@/lib/metrics';
import { fmtInt } from '@/lib/format';

export const metadata: Metadata = { title: 'Concorrentes' };

export default async function Concorrentes() {
  const [comps, me, mine] = await Promise.all([listCompetitors(), getAccount(), listPosts({ days: 28 })]);
  const myInter = mine.filter((p) => p.likes !== null || p.comments !== null).map((p) => (p.likes ?? 0) + (p.comments ?? 0));
  const myPpw = me ? postsPerWeek(mine.map((p) => p.publishedAt), new Date()) : null;
  const myAvg = myInter.length ? myInter.reduce((a, b) => a + b, 0) / myInter.length : null;
  const rows = [
    ...(me ? [{ id: 'eu', username: me.username, followers: me.followers, followersDelta30d: null as number | null, postsPerWeek: myPpw, avgInteractions: myAvg, status: 'active' as const, self: true }] : []),
    ...comps.map((c) => ({ ...c, self: false })),
  ];
  return (
    <>
      <PageHeader title="Concorrentes" subtitle="Dados públicos de contas comerciais e de criador (atualizados 1×/dia)" />
      <AddCompetitor />
      {comps.length === 0 ? (
        <EmptyState title="Adicione o primeiro concorrente" body="Digite o @ de um escritório ou advogado que fala de holding, sucessão ou tributário." />
      ) : (
        <>
        <ul className="space-y-3 md:hidden">
          {rows.map((c) => {
            const body = (
              <>
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">@{c.username}{c.self && <span className="text-xs text-accent"> (você)</span>}</span>
                  <span className="num text-sm font-semibold">{fmtInt(c.followers)}</span>
                </span>
                {c.status === 'not_supported' && <span className="mt-1 block text-xs text-warning">perfil pessoal: o Instagram não libera dados</span>}
                <span className="num mt-3 grid grid-cols-3 gap-2 text-center">
                  {[
                    ['Ganho 30d', c.followersDelta30d === null ? '—' : `${c.followersDelta30d >= 0 ? '+' : ''}${fmtInt(c.followersDelta30d)}`],
                    ['Posts/sem.', c.postsPerWeek === null ? '—' : c.postsPerWeek.toLocaleString('pt-BR', { maximumFractionDigits: 1 })],
                    ['Interações', fmtInt(c.avgInteractions)],
                  ].map(([l, v]) => (
                    <span key={l} className="rounded-md bg-surface-2 py-2">
                      <span className="block text-sm font-semibold">{v}</span>
                      <span className="block text-[11px] text-text-muted">{l}</span>
                    </span>
                  ))}
                </span>
              </>
            );
            return (
              <li key={c.id}>
                {c.self
                  ? <div className="rounded-lg border border-accent bg-accent-soft p-4">{body}</div>
                  : <Link href={`/concorrentes/${c.id}`} className="block rounded-lg border border-border bg-surface p-4 shadow-card">{body}</Link>}
              </li>
            );
          })}
        </ul>
        <Card className="hidden overflow-x-auto p-0 sm:p-0 md:block">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">Comparativo com concorrentes</caption>
            <thead className="border-b border-border text-left text-xs text-text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Perfil</th>
                <th scope="col" className="px-3 py-3 text-right font-medium">Seguidores</th>
                <th scope="col" className="px-3 py-3 text-right font-medium">Ganho em 30 dias</th>
                <th scope="col" className="px-3 py-3 text-right font-medium">Posts por semana</th>
                <th scope="col" className="px-3 py-3 text-right font-medium">Interações por post</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((c) => (
                <tr key={c.id} className={c.self ? 'bg-accent-soft' : 'hover:bg-surface-2'}>
                  <td className="px-4 py-3">
                    {c.self ? <span className="font-medium">@{c.username} <span className="text-xs text-accent">(você)</span></span>
                      : <Link href={`/concorrentes/${c.id}`} className="font-medium hover:underline">@{c.username}</Link>}
                    {c.status === 'not_supported' && <span className="block text-xs text-warning">perfil pessoal: o Instagram não libera dados</span>}
                  </td>
                  <td className="num px-3 py-3 text-right">{fmtInt(c.followers)}</td>
                  <td className="num px-3 py-3 text-right">{c.followersDelta30d === null ? '—' : `${c.followersDelta30d >= 0 ? '+' : ''}${fmtInt(c.followersDelta30d)}`}</td>
                  <td className="num px-3 py-3 text-right">{c.postsPerWeek === null ? '—' : c.postsPerWeek.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                  <td className="num px-3 py-3 text-right">{fmtInt(c.avgInteractions)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        </>
      )}
      <p className="mt-3 text-xs text-text-muted">Alcance e salvamentos de outras contas não são públicos; o comparativo usa seguidores, frequência, curtidas e comentários.</p>
    </>
  );
}
