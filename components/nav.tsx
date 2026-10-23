'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Icon, MOBILE_NAV, NAV } from './nav-items';

function isActive(path: string, href: string) {
  return href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`);
}

export function SideNav() {
  const path = usePathname();
  return (
    <nav aria-label="Principal" className="flex flex-col gap-1">
      {NAV.map((n) => {
        const active = isActive(path, n.href);
        return (
          <Link key={n.href} href={n.href} aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${active ? 'bg-accent-soft font-medium text-accent' : 'text-text-muted hover:bg-surface-2 hover:text-text'}`}>
            <Icon d={n.icon} />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav() {
  const path = usePathname();
  const moreActive = !MOBILE_NAV.slice(0, 4).some((n) => isActive(path, n.href));
  return (
    <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
      <ul className="grid grid-cols-5">
        {MOBILE_NAV.map((n, i) => {
          const active = i === 4 ? moreActive : isActive(path, n.href);
          return (
            <li key={n.href}>
              <Link href={n.href} aria-current={active ? 'page' : undefined}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] ${active ? 'font-medium text-accent' : 'text-text-muted'}`}>
                <Icon d={n.icon} />
                {n.label === 'Melhor horário' ? 'Horários' : n.label === 'Visão geral' ? 'Início' : n.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
