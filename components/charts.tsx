'use client';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface Series { key: string; label: string; color: string }

const tick = { fill: 'var(--text-muted)', fontSize: 12 };

export function TrendChart({ data, xKey, series, height = 240, xFormat }: {
  data: Record<string, string | number | null>[];
  xKey: string;
  series: Series[];
  height?: number;
  xFormat?: 'day' | 'datetime';
}) {
  const fmtX = (v: string) => {
    const d = new Date(xFormat === 'day' ? `${v}T12:00:00Z` : v);
    return xFormat === 'datetime'
      ? d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', hour: '2-digit' })
      : d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });
  };
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey={xKey} tickFormatter={fmtX} tick={tick} tickLine={false} axisLine={{ stroke: 'var(--border)' }} minTickGap={24} />
          <YAxis tick={tick} tickLine={false} axisLine={false} width={56}
            tickFormatter={(v: number) => new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(v)} />
          <Tooltip
            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13 }}
            labelFormatter={(v) => fmtX(String(v))}
            formatter={(v, name) => [new Intl.NumberFormat('pt-BR').format(Number(v)), series.find((s) => s.key === name)?.label ?? name]}
          />
          {series.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
