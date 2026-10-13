(() => {
  const paths = {
    'layout-dashboard': '<rect x="3" y="3" width="7" height="7" rx="1.2"/><rect x="14" y="3" width="7" height="4" rx="1.2"/><rect x="14" y="11" width="7" height="10" rx="1.2"/><rect x="3" y="14" width="7" height="7" rx="1.2"/>',
    'folder-kanban': '<path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H9l2 2h7.5A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z"/><path d="M8 10v5M12 10v3M16 10v6"/>',
    'building-2': '<path d="M4 21V5l8-3v19M12 8h8v13M7 7h2M7 11h2M7 15h2M15 11h2M15 15h2M2 21h20"/>',
    'badge-check': '<path d="M12 3.5 14.2 5l2.6-.1.8 2.5 2.2 1.4-.9 2.5.9 2.5-2.2 1.4-.8 2.5-2.6-.1L12 19l-2.2-1.4-2.6.1-.8-2.5-2.2-1.4.9-2.5-.9-2.5 2.2-1.4.8-2.5 2.6.1z"/><path d="m9.1 11.4 1.8 1.8 4-4"/>',
    'circle-alert': '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5M12 16.5h.01"/>',
    'file-text': '<path d="M6 2.8h8l4 4V21H6z"/><path d="M14 2.8v4h4M9 11h6M9 14.5h6M9 18h4"/>',
    plug: '<path d="M8 3v5M16 3v5M6 8h12v2a6 6 0 0 1-6 6v5M9 21h6"/>',
    wallet: '<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a3 3 0 0 1-3-3V7.5A2.5 2.5 0 0 1 5.5 5H19"/><path d="M15 10h6v5h-6a2.5 2.5 0 0 1 0-5z"/><path d="M16.5 12.5h.01"/>',
    'chart-column': '<path d="M4 20V10h4v10M10 20V4h4v16M16 20v-7h4v7M2 20h20"/>',
    'book-open': '<path d="M3 5.5A3.5 3.5 0 0 1 6.5 2H11v17H6.5A3.5 3.5 0 0 0 3 22zM21 5.5A3.5 3.5 0 0 0 17.5 2H13v17h4.5A3.5 3.5 0 0 1 21 22z"/>',
    presentation: '<path d="M4 4h16v11H4zM2 4h20M8 20l4-5 4 5"/>',
    users: '<path d="M16 20v-1.5A3.5 3.5 0 0 0 12.5 15h-5A3.5 3.5 0 0 0 4 18.5V20"/><circle cx="10" cy="8" r="3"/><path d="M17 11a3 3 0 1 0-1-5.8M20 20v-1.5a3.5 3.5 0 0 0-2.6-3.4"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.86 2.86-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.88.34l-.06.06-2.86-2.86.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.34-1.88l-.06-.06L7.16 3.7l.06.06A1.7 1.7 0 0 0 9.1 4.1a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V2h4v.1a1.7 1.7 0 0 0 1.1 1.6 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.86 2.86-.06.06A1.7 1.7 0 0 0 20 8.1a1.7 1.7 0 0 0 .6 1 1.7 1.7 0 0 0 1.1.4h.3v4h-.1a1.7 1.7 0 0 0-1.6 1.1z"/>',
    'folder-open': '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v.5"/><path d="M4.5 10h17l-2.2 8a2 2 0 0 1-1.9 1.5H5.9A2 2 0 0 1 4 18z"/>',
    'triangle-alert': '<path d="M10.2 4.3 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.8 4.3a2.1 2.1 0 0 0-3.6 0z"/><path d="M12 9v4M12 17h.01"/>',
    'messages-square': '<path d="M5 5h11a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H9l-4 3v-3a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z"/><path d="M8 9h6M8 13h4"/>',
    receipt: '<path d="M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
    'chevron-down': '<path d="m7 9.5 5 5 5-5"/>',
    'menu': '<path d="M4 7h16M4 12h16M4 17h16"/>',
    'bell': '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    'log-out': '<path d="M10 17l5-5-5-5M15 12H3M14 4h4a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3h-4"/>',
    'plus': '<path d="M12 5v14M5 12h14"/>'
  };

  const pageIcons = {
    dashboard: 'layout-dashboard',
    processos: 'folder-kanban',
    clientes: 'building-2',
    licencas: 'badge-check',
    exigencias: 'circle-alert',
    documentos: 'file-text',
    integracoes: 'plug',
    custos: 'wallet',
    relatorios: 'chart-column',
    conhecimento: 'book-open',
    treinamento: 'presentation',
    usuarios: 'users',
    config: 'settings'
  };

  function svg(name, className = '') {
    const body = paths[name] || paths['circle-alert'];
    return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
  }

  function applySidebarIcons() {
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
      const iconName = pageIcons[item.dataset.page];
      const host = item.querySelector('.nav-ico');
      if (!iconName || !host || host.dataset.atlasIcon === iconName) return;
      host.dataset.atlasIcon = iconName;
      host.innerHTML = svg(iconName, 'atlas-nav-line-icon');
    });

    document.querySelectorAll('.nav-group-chevron').forEach(host => {
      if (host.dataset.atlasIcon === 'chevron-down') return;
      host.dataset.atlasIcon = 'chevron-down';
      host.innerHTML = svg('chevron-down', 'atlas-chevron-line-icon');
    });
  }

  function applyTopbarIcons() {
    const controls = [
      ['#mobile-menu-btn', 'menu'],
      ['.top-actions .bell', 'bell'],
      ['#logout-btn', 'log-out']
    ];

    controls.forEach(([selector, iconName]) => {
      const host = document.querySelector(selector);
      if (!host) return;
      host.classList.add('atlas-topbar-icon-button');
      if (host.dataset.atlasIcon === iconName && host.querySelector('svg')) return;
      host.dataset.atlasIcon = iconName;
      host.innerHTML = svg(iconName, 'atlas-topbar-line-icon');
    });

    const newProcess = document.querySelector('#new-process-btn');
    if (newProcess) {
      newProcess.classList.add('atlas-action-with-icon');
      if (newProcess.dataset.atlasIcon !== 'plus' || !newProcess.querySelector('svg')) {
        newProcess.dataset.atlasIcon = 'plus';
        newProcess.innerHTML = `${svg('plus', 'atlas-action-line-icon')}<span class="atlas-action-label">Novo processo</span>`;
      }
    }
  }

  function refreshDashboardIcons(root = document) {
    root.querySelectorAll?.('[data-atlas-icon]').forEach(host => {
      const name = host.dataset.atlasIcon;
      if (!name || host.querySelector('svg')) return;
      host.innerHTML = svg(name, 'atlas-kpi-line-icon');
    });
  }

  function applyAll() {
    applySidebarIcons();
    applyTopbarIcons();
    refreshDashboardIcons();
    setTimeout(() => {
      applySidebarIcons();
      applyTopbarIcons();
    }, 0);
  }

  window.AtlasV51Icons = { svg, pageIcons, applySidebarIcons, applyTopbarIcons, refreshDashboardIcons };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyAll);
  else applyAll();
})();
