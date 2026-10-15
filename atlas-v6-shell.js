(() => {
  const PRIMARY_ORDER = ['dashboard', 'clientes', 'processos', 'licencas', 'documentos', 'custos', 'relatorios', 'config'];
  const SECONDARY_ORDER = ['exigencias', 'integracoes', 'conhecimento', 'treinamento', 'usuarios'];
  const APPROVED_SEARCH_PLACEHOLDER = 'Buscar empresas, processos, documentos...';

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

  const iconByPage = {
    dashboard: '⌂',
    clientes: '▥',
    processos: '▤',
    licencas: '◇',
    documentos: '□',
    custos: '$',
    relatorios: '▥',
    config: '⚙',
    exigencias: '!',
    integracoes: '⌘',
    conhecimento: '?',
    treinamento: '▣',
    usuarios: '♙'
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
    if (icon) icon.textContent = iconByPage[page] || icon.textContent;
    if (spans.length > 1) spans[spans.length - 1].textContent = labelByPage[page] || spans[spans.length - 1].textContent;
    button.classList.toggle('v6-primary-nav-item', PRIMARY_ORDER.includes(page));
    button.classList.toggle('v6-secondary-nav-item', SECONDARY_ORDER.includes(page));
  }

  function reorganizeNavigation() {
    const nav = document.getElementById('nav');
    if (!nav || nav.dataset.v6Organized === 'true') return;

    const byPage = new Map();
    nav.querySelectorAll('.nav-item[data-page]').forEach(button => {
      byPage.set(button.dataset.page, button);
      normalizeButton(button, button.dataset.page);
    });

    const primaryFragment = document.createDocumentFragment();
    PRIMARY_ORDER.forEach(page => {
      const node = byPage.get(page);
      if (node) primaryFragment.appendChild(node);
    });

    const secondaryWrap = document.createElement('div');
    secondaryWrap.className = 'v6-secondary-nav';
    const secondaryTitle = document.createElement('div');
    secondaryTitle.className = 'nav-group-title v6-secondary-title';
    secondaryTitle.textContent = 'Mais recursos';
    secondaryWrap.appendChild(secondaryTitle);
    SECONDARY_ORDER.forEach(page => {
      const node = byPage.get(page);
      if (node) secondaryWrap.appendChild(node);
    });

    nav.replaceChildren(primaryFragment, secondaryWrap);
    nav.dataset.v6Organized = 'true';
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
    if (search && search.placeholder !== APPROVED_SEARCH_PLACEHOLDER) {
      search.placeholder = APPROVED_SEARCH_PLACEHOLDER;
    }
  }

  function injectFidelityStylesheet() {
    if (document.getElementById('atlas-v6-mockup-fidelity')) return;
    const link = document.createElement('link');
    link.id = 'atlas-v6-mockup-fidelity';
    link.rel = 'stylesheet';
    link.href = '/mockup-fidelity-v6.css?v=6.2';
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
    if (search) {
      new MutationObserver(enforceSearch).observe(search, { attributes: true, attributeFilter: ['placeholder'] });
    }
    const userName = document.getElementById('user-name');
    if (userName) {
      new MutationObserver(() => {
        syncSidebarIdentity();
        const topRole = document.getElementById('user-role');
        if (topRole && topRole.textContent !== 'ATLAS Legalização') topRole.textContent = 'ATLAS Legalização';
      }).observe(userName, { childList: true, subtree: true, characterData: true });
    }
    const content = document.getElementById('page-content');
    if (content) {
      new MutationObserver(() => queueMicrotask(markCurrentPage)).observe(content, { childList: true, subtree: false });
    }
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

  window.AtlasV6Shell = {
    syncUserChrome,
    reorganizeNavigation,
    markCurrentPage,
    enforceSearch
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();