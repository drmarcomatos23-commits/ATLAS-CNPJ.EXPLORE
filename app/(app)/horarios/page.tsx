import type { Metadata } from 'next';
import { Card, CardTitle, PageHeader } from '@/components/ui';
import { getBestTimes } from '@/lib/data';
import { topSlots, WEEKDAY_FULL, WEEKDAY_LABEL } from '@/lib/best-times';

export const metadata: Metadata = { title: 'Melhor horário' };

const HOURS = Array.from({ length: 17 }, (_, i) => i + 7); // 7h às 23h

function shade(score: number | null) {
  if (score === null) return { background: 'repeating-linear-gradient(45deg, var(--surface-2) 0 4px, var(--surface) 4px 8px)' };
  const alpha = 0.12 + (score / 100) * 0.88;
  return { background: `color-mix(in srgb, var(--accent) ${Math.round(alpha * 100)}%, var(--surface))` };
}

export default async function Horarios() {
  const cells = await getBestTimes();
  const top = topSlots(cells, 3);
  const at = (wd: number, h: number) => cells.find((c) => c.weekday === wd && c.hour === h)!;
  return (
    <>
      <PageHeader title="Melhor horário" subtitle="Seguidores online (30 dias) + desempenho dos seus posts, em horário de Brasília" />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {top.length ? top.map((c, i) => (
          <div key={`${c.weekday}-${c.hour}`} className="rounded-lg border border-border bg-surface p-4 shadow-card">
            <p className="text-xs text-text-muted">{i + 1}º melhor</p>
            <p className="mt-1 text-lg font-semibold capitalize">{WEEKDAY_FULL[c.weekday]}, {c.hour}h</p>
            <p className="num text-xs text-text-muted">nota {c.score} · {c.posts} {c.posts === 1 ? 'post' : 'posts'} nesse horário</p>
          </div>
        )) : <p className="text-sm text-text-muted">Ainda não há dados suficientes.</p>}
      </div>

      <Card className="overflow-x-auto">
        <CardTitle hint="quanto mais escuro, melhor">Mapa da semana</CardTitle>
        <table className="w-full min-w-[560px] border-separate border-spacing-1 text-xs">
          <caption className="sr-only">Nota de 0 a 100 por dia da semana e hora</caption>
          <thead>
            <tr>
              <th scope="col" className="w-10" />
              {HOURS.map((h) => <th key={h} scope="col" className="num font-normal text-text-muted">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5, 6, 0].map((wd) => (
              <tr key={wd}>
                <th scope="row" className="pr-1 text-left font-normal text-text-muted">{WEEKDAY_LABEL[wd]}</th>
                {HOURS.map((h) => {
                  const c = at(wd, h);
                  return (
                    <td key={h} className="h-8 min-w-[26px] rounded-sm" style={shade(c.score)}
                      aria-label={`${WEEKDAY_FULL[wd]} ${h}h: ${c.score === null ? 'sem dados' : `nota ${c.score}`}`}
                      title={`${WEEKDAY_FULL[wd]} ${h}h · ${c.score === null ? 'sem dados' : `nota ${c.score}`}`} />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-text-muted">Células hachuradas: sem dados suficientes. Madrugada (0h–6h) oculta.</p>
      </Card>
    </>
  );
}
