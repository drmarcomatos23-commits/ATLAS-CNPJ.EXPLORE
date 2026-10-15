(() => {
  const APPROVED_SEARCH_PLACEHOLDER = 'Buscar empresas, processos, documentos...';

  const NAV_GROUPS = [
    { label: 'Visão Geral', pages: ['dashboard'] },
    { label: 'Operação', pages: ['processos', 'clientes', 'licencas', 'exigencias', 'documentos', 'integracoes'] },
    { label: 'Gestão', pages: ['custos', 'relatorios'] },
    { label: 'ATLAS', pages: ['conhecimento', 'treinamento'] },
    { label: 'Administração', pages: ['usuarios', 'config'] }
  ];

  const labelByPage = {
    dashboard: 'Dashboard',
    clientes: 'Empresas',
    processos: 'Processos',
    licencas: 'Licenças',
    documentos: 'Documentos',
    custos: 'Financeiro',
    relatorios: 'Relatórios',
    config: 'Configurações',
    exigencias: 'Exigências',
    integracoes: 'Integrações',
    conhecimento: 'Base de Conhecimento',
    treinamento: 'Treinamento',
    usuarios: 'Usuários'
  };

  const svg = paths => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

  const iconSvgByPage = {
    dashboard: svg('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),
    processos: svg('<path d="M7 3h8l4 4v14H7z"/><path d="M15 3v5h5"/><path d="M10 12h6M10 16h6"/>'),
    clientes: svg('<path d="M4 21V7l8-4 8 4v14"/><path d="M8 10h1M12 10h1M16 10h1M8 14h1M12 14h1M16 14h1M10 21v-4h4v4"/>'),
    licencas: svg('<path d="M12 3 19 6v5c0 4.6-2.7 8-7 10-4.3-2-7-5.4-7-10V6z"/><path d="m9 12 2 2 4-4"/>'),
    exigencias: svg('<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>'),
    documentos: svg('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 12h6M9 16h6"/>'),
    integracoes: svg('<path d="M9 7V3M15 7V3M8 7h8v4a4 4 0 0 1-4 4v0a4 4 0 0 1-4-4z"/><path d="M12 15v6M9 21h6"/>'),
    custos: svg('<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>'),
    relatorios: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
    conhecimento: svg('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5z"/>'),
    treinamento: svg('<path d="m3 8 9-5 9 5-9 5z"/><path d="M7 10.5v5c3 2 7 2 10 0v-5M21 9v6"/>'),
    usuarios: svg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>'),
    config: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.2 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H2.4v-4h.09A1.7 1.7 0 0 0 4.2 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 8.6 4.2a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V2.4h4v.09A1.7 1.7 0 0 0 15 4.2a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 8.6a1.7 1.7 0 0 0 .6 1 1.7 1.7 0 0 0 1.1.4h.09v4h-.09a1.7 1.7 0 0 0-1.7 1z"/>')
  };

  function initials(value = '') {
    const words = String(value).trim().split(/\s+/).filter(Boolean);
    if (!words.length) return 'MM';
    return `${words[0][0] || ''}${words.length > 1 ? words[words.length - 1][0] : ''}`.toUpperCase();
  }

  function normalizeButton(button, page) {
    if (!button) return;
    const icon = button.querySelector('.nav-ico');
    const spans = button.querySelectorAll('span');
    if (icon && iconSvgByPage[page]) icon.innerHTML = iconSvgByPage[page];
    if (spans.length > 1) spans[spans.length - 1].textContent = labelByPage[page] || spans[spans.length - 1].textContent;
    button.classList.add('v6-functional-nav-item');
  }

  function createGroup(label, pages, byPage) {
    const available = pages.map(page => byPage.get(page)).filter(Boolean);
    if (!available.length) return null;

    const group = document.createElement('section');
    group.className = 'v6-nav-group';
    group.dataset.navGroup = label;

    const title = document.createElement('div');
    title.className = 'nav-group-title v6-functional-group-title';
    title.textContent = label;
    group.appendChild(title);

    available.forEach(node => group.appendChild(node));
    return group;
  }

  function reorganizeNavigation() {
    const nav = document.getElementById('nav');
    if (!nav || nav.dataset.v6Organized === 'functional-atlas') return;

    const byPage = new Map();
    nav.querySelectorAll('.nav-item[data-page]').forEach(button => {
      byPage.set(button.dataset.page, button);
      normalizeButton(button, button.dataset.page);
    });

    const fragment = document.createDocumentFragment();
    NAV_GROUPS.forEach(({ label, pages }) => {
      const group = createGroup(label, pages, byPage);
      if (group) fragment.appendChild(group);
    });

    nav.replaceChildren(fragment);
    nav.dataset.v6Organized = 'functional-atlas';
  }

  function ensureSidebarAccount() {
    const footer = document.querySelector('#app-shell .sidebar-footer');
    if (!footer || footer.querySelector('.v6-account-card')) return;

    footer.innerHTML = `
      <div class="v6-account-card" role="group" aria-label="Minha Conta">
        <div class="v6-account-avatar" data-v6-user-avatar>MM</div>
        <div class="v6-account-copy">
          <strong class="v6-account-name" data-v6-user-name>Marco Matos</strong>
          <span class="v6-account-label">Minha Conta</span>
        </div>
        <span aria-hidden="true">›</span>
      </div>
      <button class="v6-sidebar-logout" type="button" data-v6-logout><span aria-hidden="true">↪</span><span>Sair</span></button>`;

    footer.querySelector('[data-v6-logout]')?.addEventListener('click', () => {
      document.getElementById('logout-btn')?.click();
    });
  }

  function syncSidebarIdentity() {
    const name = document.getElementById('user-name')?.textContent?.trim() || 'Marco Matos';
    document.querySelectorAll('[data-v6-user-name]').forEach(el => { el.textContent = name; });
    document.querySelectorAll('[data-v6-user-avatar]').forEach(el => { el.textContent = initials(name); });
  }

  function syncUserChrome(sessionUser = {}) {
    const name = sessionUser.name || sessionUser.full_name || sessionUser.user_metadata?.name || document.getElementById('user-name')?.textContent || 'Marco Matos';
    const topName = document.getElementById('user-name');
    const topRole = document.getElementById('user-role');
    const topAvatar = document.getElementById('user-avatar');
    if (topName && name) topName.textContent = name;
    if (topRole) topRole.textContent = 'ATLAS Legalização';
    if (topAvatar) topAvatar.textContent = initials(name);
    document.querySelectorAll('[data-v6-user-name]').forEach(el => { el.textContent = name; });
    document.querySelectorAll('[data-v6-user-avatar]').forEach(el => { el.textContent = initials(name); });
  }

  function markCurrentPage() {
    const shell = document.getElementById('app-shell');
    const active = document.querySelector('#nav .nav-item.active[data-page]');
    const hasDashboard = !!document.querySelector('#page-content .v6-dashboard');
    const page = hasDashboard ? 'dashboard' : (active?.dataset.page || 'dashboard');
    if (shell) shell.dataset.v6Page = page;
    enforceDashboardHeader(page);
  }

  function enforceDashboardHeader(page) {
    const pageHead = document.querySelector('#app-shell .main > .page-head');
    if (!pageHead) return;
    if (page === 'dashboard' || document.querySelector('#page-content .v6-dashboard')) {
      pageHead.style.display = 'none';
      pageHead.setAttribute('aria-hidden', 'true');
    } else {
      pageHead.style.display = '';
      pageHead.removeAttribute('aria-hidden');
    }
  }

  function enforceSearch() {
    const search = document.getElementById('global-search');
    if (search && search.placeholder !== APPROVED_SEARCH_PLACEHOLDER) search.placeholder = APPROVED_SEARCH_PLACEHOLDER;
  }

  function injectFidelityStylesheet() {
    if (document.getElementById('atlas-v6-mockup-fidelity')) return;
    const link = document.createElement('link');
    link.id = 'atlas-v6-mockup-fidelity';
    link.rel = 'stylesheet';
    link.href = '/mockup-fidelity-v6.css?v=6.4';
    document.head.appendChild(link);
  }

  function injectFidelityGuardStyles() {
    if (document.getElementById('atlas-v6-fidelity-guard')) return;
    const style = document.createElement('style');
    style.id = 'atlas-v6-fidelity-guard';
    style.textContent = `
      #app-shell[data-v6-page="dashboard"] .main > .page-head,
      #app-shell:has(#page-content .v6-dashboard) .main > .page-head { display:none !important; }
      @media (min-width:1181px) {
        :root { --v6-sidebar-width:300px !important; --v6-topbar-height:74px !important; }
        #app-shell .sidebar { width:300px !important; }
        #app-shell .workspace { margin-left:300px !important; }
      }
      #app-shell .topbar { border-radius:0 !important; }
      #app-shell .main { padding-top:0 !important; }
      #app-shell[data-v6-page="dashboard"] #page-content { padding-top:0 !important; }
    `;
    document.head.appendChild(style);
  }

  function observeNavigation() {
    const nav = document.getElementById('nav');
    if (!nav || !window.MutationObserver) return;
    const observer = new MutationObserver(markCurrentPage);
    observer.observe(nav, { attributes: true, subtree: true, attributeFilter: ['class'] });
    nav.addEventListener('click', () => queueMicrotask(markCurrentPage));
  }

  function observeLegacyOverrides() {
    if (!window.MutationObserver) return;
    const search = document.getElementById('global-search');
    if (search) new MutationObserver(enforceSearch).observe(search, { attributes: true, attributeFilter: ['placeholder'] });
    const userName = document.getElementById('user-name');
    if (userName) {
      new MutationObserver(() => {
        syncSidebarIdentity();
        const topRole = document.getElementById('user-role');
        if (topRole && topRole.textContent !== 'ATLAS Legalização') topRole.textContent = 'ATLAS Legalização';
      }).observe(userName, { childList: true, subtree: true, characterData: true });
    }
    const content = document.getElementById('page-content');
    if (content) new MutationObserver(() => queueMicrotask(markCurrentPage)).observe(content, { childList: true, subtree: false });
  }

  function init() {
    injectFidelityStylesheet();
    injectFidelityGuardStyles();
    reorganizeNavigation();
    ensureSidebarAccount();
    enforceSearch();
    const role = document.getElementById('user-role');
    if (role) role.textContent = 'ATLAS Legalização';
    markCurrentPage();
    observeNavigation();
    observeLegacyOverrides();
    syncUserChrome({});
    setTimeout(() => { enforceSearch(); markCurrentPage(); syncSidebarIdentity(); }, 0);
    setTimeout(() => { enforceSearch(); markCurrentPage(); syncSidebarIdentity(); }, 350);
  }

  window.AtlasV6Shell = { syncUserChrome, reorganizeNavigation, markCurrentPage, enforceSearch };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();