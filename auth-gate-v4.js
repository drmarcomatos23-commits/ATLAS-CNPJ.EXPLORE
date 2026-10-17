(() => {
  const REMEMBER_KEY = 'atlas.rememberSession';
  const TAB_KEY = 'atlas.currentLogin';
  const login = document.getElementById('login-screen');
  const app = document.getElementById('app-shell');

  const rememberEnabled = () => localStorage.getItem(REMEMBER_KEY) === '1';
  const tabAuthorized = () => sessionStorage.getItem(TAB_KEY) === '1';
  const canOpenApp = () => rememberEnabled() || tabAuthorized();

  function lockToLogin() {
    app?.classList.add('hidden');
    login?.classList.remove('hidden');
  }

  function markFreshLogin() {
    sessionStorage.setItem(TAB_KEY, '1');
    const remember = !!document.getElementById('remember-session')?.checked;
    if (remember) localStorage.setItem(REMEMBER_KEY, '1');
    else localStorage.removeItem(REMEMBER_KEY);
  }

  function clearAuthorization() {
    sessionStorage.removeItem(TAB_KEY);
    localStorage.removeItem(REMEMBER_KEY);
  }

  // A aplicação começa sempre bloqueada até a autenticação resolver.
  lockToLogin();

  // Intercepta a abertura da aplicação. Nenhum módulo legado pode liberar
  // a Dashboard sem uma autenticação iniciada nesta aba ou sessão lembrada.
  const originalShowApp = window.showApp;
  if (typeof originalShowApp === 'function') {
    window.showApp = function guardedShowApp(profile) {
      if (!canOpenApp()) {
        lockToLogin();
        return;
      }
      return originalShowApp(profile);
    };
  }

  document.getElementById('login-form')?.addEventListener('submit', markFreshLogin, true);
  document.getElementById('bootstrap-form')?.addEventListener('submit', () => {
    sessionStorage.setItem(TAB_KEY, '1');
  }, true);
  document.getElementById('logout-btn')?.addEventListener('click', clearAuthorization, true);

  // Se houver token antigo do Supabase, mas nenhuma autorização de persistência,
  // encerra apenas a sessão local e mantém a tela de login.
  Promise.resolve(window.atlasAuth?.client?.auth?.getSession?.())
    .then(async (result) => {
      const session = result?.data?.session;
      if (session && !canOpenApp()) {
        await window.atlasAuth?.client?.auth?.signOut?.({ scope: 'local' });
        lockToLogin();
      } else if (!session) {
        lockToLogin();
      }
    })
    .catch(() => lockToLogin());
})();
