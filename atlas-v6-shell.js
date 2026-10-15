(() => {
  const PRIMARY_ORDER = ['dashboard', 'clientes', 'processos', 'licencas', 'documentos', 'custos', 'relatorios', 'config'];
  const SECONDARY_ORDER = ['exigencias', 'integracoes', 'conhecimento', 'treinamento', 'usuarios'];

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

  function getNavButton(nav, page) {
    return nav.querySelector(`.nav-item[data-page="${page}"]`);
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

  function syncUserChrome(sessionUser = {}) {
    const name = sessionUser.name || sessionUser.full_name || sessionUser.user_metadata?.name || document.getElementById('user-name')?.textContent || 'Marco Matos';
    const role = sessionUser.role || sessionUser.profile || document.getElementById('user-role')?.textContent || 'ATLAS Legalização';
    const displayRole = /perfil/i.test(role) ? 'ATLAS Legalização' : role;

    const topName = document.getElementById('user-name');
    const topRole = document.getElementById('user-role');
    const topAvatar = document.getElementById('user-avatar');
    if (topName && name) topName.textContent = name;
    if (topRole) topRole.textContent = displayRole || 'ATLAS Legalização';
    if (topAvatar) topAvatar.textContent = initials(name);

    document.querySelectorAll('[data-v6-user-name]').forEach(el => { el.textContent = name; });
    document.querySelectorAll('[data-v6-user-avatar]').forEach(el => { el.textContent = initials(name); });
  }

  function markCurrentPage() {
    const shell = document.getElementById('app-shell');
    const active = document.querySelector('#nav .nav-item.active[data-page]');
    if (shell) shell.dataset.v6Page = active?.dataset.page || 'dashboard';
  }

  function observeNavigation() {
    const nav = document.getElementById('nav');
    if (!nav || !window.MutationObserver) return;
    const observer = new MutationObserver(markCurrentPage);
    observer.observe(nav, { attributes: true, subtree: true, attributeFilter: ['class'] });
    nav.addEventListener('click', () => queueMicrotask(markCurrentPage));
  }

  function init() {
    reorganizeNavigation();
    ensureSidebarAccount();
    const search = document.getElementById('global-search');
    if (search) search.placeholder = 'Buscar empresas, processos, documentos...';
    const role = document.getElementById('user-role');
    if (role && (!role.textContent || role.textContent.trim() === 'Perfil')) role.textContent = 'ATLAS Legalização';
    markCurrentPage();
    observeNavigation();
    syncUserChrome({});
  }

  window.AtlasV6Shell = {
    syncUserChrome,
    reorganizeNavigation,
    markCurrentPage
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
