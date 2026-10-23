// Funções puras de métricas (testadas em tests/metrics.test.ts).

export interface ConvertiblePost {
  views: number | null;
  follows: number | null;
  saved: number | null;
  shares: number | null;
}

/** Seguidores ganhos a cada 1.000 visualizações — mede se o post converte, não só se viraliza. */
export function followsPerThousand(p: ConvertiblePost): number | null {
  if (p.views === null || p.follows === null || p.views <= 0) return null;
  return (p.follows / p.views) * 1000;
}

/** Salvamentos + compartilhamentos sobre visualizações, em %. */
export function valueRate(p: ConvertiblePost): number | null {
  if (p.views === null || p.views <= 0) return null;
  const s = (p.saved ?? 0) + (p.shares ?? 0);
  if (p.saved === null && p.shares === null) return null;
  return (s / p.views) * 100;
}

/** Ordena sem perder nulos: nulos sempre no fim, independente da direção. */
export function sortBy<T>(rows: T[], key: (r: T) => number | string | null, dir: 'asc' | 'desc'): T[] {
  return [...rows].sort((a, b) => {
    const va = key(a);
    const vb = key(b);
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    const cmp = va < vb ? -1 : va > vb ? 1 : 0;
    return dir === 'asc' ? cmp : -cmp;
  });
}

/** Média de posts por semana dentro da janela de dias informada. */
export function postsPerWeek(publishedAt: string[], now: Date, windowDays = 28): number | null {
  if (publishedAt.length === 0) return null;
  const from = now.getTime() - windowDays * 86_400_000;
  const n = publishedAt.filter((d) => {
    const t = new Date(d).getTime();
    return t >= from && t <= now.getTime();
  }).length;
  return (n / windowDays) * 7;
}
