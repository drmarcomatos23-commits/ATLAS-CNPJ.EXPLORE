// Melhor horário: 50% seguidores online + 50% desempenho dos seus posts naquela janela.
// Todas as horas em America/Sao_Paulo. Testado em tests/best-times.test.ts.

export interface OnlineSample { weekday: number; hour: number; value: number } // weekday 0=dom
export interface PostSample { publishedAt: string; views: number | null; followersAtTime: number | null }

export interface Cell { weekday: number; hour: number; score: number | null; posts: number }

const TZ = 'America/Sao_Paulo';
const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function localWeekdayHour(iso: string): { weekday: number; hour: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', hour: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(iso));
  const wd = parts.find((p) => p.type === 'weekday')!.value;
  const h = Number(parts.find((p) => p.type === 'hour')!.value);
  return { weekday: WD[wd], hour: h };
}

function normalize(values: (number | null)[]): (number | null)[] {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length === 0) return values.map(() => null);
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  return values.map((v) => (v === null ? null : max === min ? 1 : (v - min) / (max - min)));
}

export function bestTimes(online: OnlineSample[], posts: PostSample[], minPosts = 1): Cell[] {
  const idx = (wd: number, h: number) => wd * 24 + h;

  const onlineSum = new Array<number>(168).fill(0);
  const onlineCnt = new Array<number>(168).fill(0);
  for (const s of online) {
    onlineSum[idx(s.weekday, s.hour)] += s.value;
    onlineCnt[idx(s.weekday, s.hour)] += 1;
  }
  const onlineAvg = onlineSum.map((s, i) => (onlineCnt[i] ? s / onlineCnt[i] : null));

  const perfSum = new Array<number>(168).fill(0);
  const perfCnt = new Array<number>(168).fill(0);
  for (const p of posts) {
    if (p.views === null || !p.followersAtTime) continue;
    const { weekday, hour } = localWeekdayHour(p.publishedAt);
    perfSum[idx(weekday, hour)] += p.views / p.followersAtTime;
    perfCnt[idx(weekday, hour)] += 1;
  }
  const perfAvg = perfSum.map((s, i) => (perfCnt[i] >= minPosts ? s / perfCnt[i] : null));

  const on = normalize(onlineAvg);
  const pf = normalize(perfAvg);

  // Janela sem posts recebe o desempenho MÉDIO (não o máximo), para não ganhar de horários já testados.
  const pfKnown = pf.filter((v): v is number => v !== null);
  const pfMean = pfKnown.length ? pfKnown.reduce((s, v) => s + v, 0) / pfKnown.length : null;

  const cells: Cell[] = [];
  for (let wd = 0; wd < 7; wd++) {
    for (let h = 0; h < 24; h++) {
      const i = idx(wd, h);
      const a = on[i];
      const b = pf[i] ?? pfMean;
      let score: number | null = null;
      if (a !== null && b !== null) score = 0.5 * a + 0.5 * b;
      else if (a !== null) score = a; // ainda não há nenhum post medido
      else if (pf[i] !== null) score = pf[i];
      cells.push({ weekday: wd, hour: h, score: score === null ? null : Math.round(score * 100), posts: perfCnt[i] });
    }
  }
  return cells;
}

export function topSlots(cells: Cell[], n = 3): Cell[] {
  return cells.filter((c) => c.score !== null).sort((a, b) => (b.score! - a.score!) || a.weekday - b.weekday || a.hour - b.hour).slice(0, n);
}

export const WEEKDAY_LABEL = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const WEEKDAY_FULL = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
