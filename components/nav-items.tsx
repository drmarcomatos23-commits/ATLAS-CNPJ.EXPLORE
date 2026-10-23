export interface NavItem { href: string; label: string; icon: string }

export const NAV: NavItem[] = [
  { href: '/', label: 'Visão geral', icon: 'M3 12l9-8 9 8M5 10v10h14V10' },
  { href: '/posts', label: 'Posts', icon: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z' },
  { href: '/horarios', label: 'Melhor horário', icon: 'M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { href: '/concorrentes', label: 'Concorrentes', icon: 'M16 19v-1a4 4 0 00-4-4H6a4 4 0 00-4 4v1M9 10a3 3 0 100-6 3 3 0 000 6zM22 19v-1a4 4 0 00-3-3.9M16 4.1a3 3 0 010 5.8' },
  { href: '/agenda', label: 'Agenda', icon: 'M8 3v3M16 3v3M4 8h16M5 5h14v15H5z' },
  { href: '/publico', label: 'Público', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  { href: '/stories', label: 'Stories', icon: 'M12 3a9 9 0 109 9M12 7a5 5 0 105 5' },
  { href: '/ideias', label: 'Ideias', icon: 'M9 18h6M10 21h4M12 3a6 6 0 00-4 10.5c.6.6 1 1.4 1 2.5h6c0-1.1.4-1.9 1-2.5A6 6 0 0012 3z' },
  { href: '/relatorios', label: 'Relatórios', icon: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6' },
  { href: '/config', label: 'Configurações', icon: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z' },
];

export const MOBILE_NAV: NavItem[] = [NAV[0], NAV[1], NAV[2], NAV[3], { href: '/mais', label: 'Mais', icon: 'M5 12h.01M12 12h.01M19 12h.01' }];

export function Icon({ d, className = 'h-5 w-5' }: { d: string; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={d} />
    </svg>
  );
}

