const TZ = 'America/Sao_Paulo';

export function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('pt-BR').format(Math.round(n));
}

export function fmtCompact(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

export function fmtPct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return `${n.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
}

export function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: '2-digit' }).format(new Date(iso));
}

export function fmtDateTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

/** Variação percentual; null quando não há base para comparar. */
export function delta(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function truncate(s: string, max: number): string {
  const clean = s.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}
