import Link from 'next/link';
import { delta, fmtInt, fmtPct } from '@/lib/format';
import { MEDIA_LABEL, PILLARS, type MediaType, type Pillar } from '@/lib/types';

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function Card({ children, className = '', as: Tag = 'section' }: { children: React.ReactNode; className?: string; as?: 'section' | 'div' | 'article' }) {
  return <Tag className={`rounded-lg border border-border bg-surface p-4 shadow-card sm:p-5 ${className}`}>{children}</Tag>;
}

export function CardTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-2">
      <h2 className="text-md font-semibold">{children}</h2>
      {hint && <span className="text-xs text-text-muted">{hint}</span>}
    </div>
  );
}

export function KpiCard({ label, value, previous, format = 'int' }: { label: string; value: number | null; previous: number | null; format?: 'int' | 'pct' }) {
  const d = delta(value, previous);
  const up = d !== null && d >= 0;
  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-card">
      <p className="text-sm text-text-muted">{label}</p>
      <p className="num mt-1 text-xl font-semibold">{format === 'pct' ? fmtPct(value) : fmtInt(value)}</p>
      <p className={`num mt-1 text-xs ${d === null ? 'text-text-muted' : up ? 'text-success' : 'text-danger'}`}>
        {d === null ? 'sem período anterior' : `${up ? '▲' : '▼'} ${up ? 'subiu' : 'caiu'} ${fmtPct(Math.abs(d), 0)} vs. período anterior`}
      </p>
    </div>
  );
}

export function TypeBadge({ type }: { type: MediaType }) {
  return <span className="inline-flex shrink-0 items-center rounded-sm bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">{MEDIA_LABEL[type]}</span>;
}

export function PillarBadge({ pillar }: { pillar: Pillar | null }) {
  if (!pillar) return <span className="text-xs text-text-muted">sem pilar</span>;
  const label = PILLARS.find((p) => p.value === pillar)?.label ?? pillar;
  return <span className="inline-flex shrink-0 items-center rounded-sm border border-border px-2 py-0.5 text-xs text-text-muted">{label}</span>;
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border-input bg-surface px-6 py-10 text-center">
      <h2 className="text-md font-semibold">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-text-muted">{body}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

const BTN = {
  primary: 'bg-accent text-on-accent hover:opacity-90',
  secondary: 'border border-border-input bg-surface text-text hover:bg-surface-2',
  ghost: 'text-text hover:bg-surface-2',
  danger: 'border border-border-input bg-surface text-danger hover:bg-surface-2',
};

export function buttonClass(variant: keyof typeof BTN = 'secondary', size: 'sm' | 'md' = 'md') {
  return `inline-flex items-center justify-center gap-2 rounded-md font-medium transition-[opacity,background-color] duration-[var(--dur-fast)] disabled:cursor-not-allowed disabled:opacity-50 ${size === 'sm' ? 'h-8 px-3 text-sm' : 'h-10 px-4 text-sm'} ${BTN[variant]}`;
}

export function ButtonLink({ href, children, variant = 'secondary' }: { href: string; children: React.ReactNode; variant?: keyof typeof BTN }) {
  return <Link href={href} className={buttonClass(variant)}>{children}</Link>;
}

export function Alert({ tone = 'info', children }: { tone?: 'info' | 'success' | 'warning' | 'danger'; children: React.ReactNode }) {
  const color = { info: 'text-accent', success: 'text-success', warning: 'text-warning', danger: 'text-danger' }[tone];
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={`mb-4 rounded-md border border-border bg-surface px-4 py-3 text-sm ${color}`}>
      {children}
    </div>
  );
}

export const inputClass = 'h-10 w-full rounded-md border border-border-input bg-surface px-3 text-sm text-text placeholder:text-text-muted';
