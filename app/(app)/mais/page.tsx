import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon, NAV } from '@/components/nav-items';
import { PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Mais' };

export default function Mais() {
  return (
    <>
      <PageHeader title="Mais" />
      <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
        {[...NAV.slice(4), { href: '/conectar', label: 'Conexão com o Instagram', icon: 'M10 14a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1M14 10a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1' }].map((n) => (
          <li key={n.href}>
            <Link href={n.href} className="flex min-h-[52px] items-center gap-3 px-4 text-sm hover:bg-surface-2">
              <Icon d={n.icon} /> {n.label}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
