(() => {
  window.showApp = function(profile) {
    atlasCurrentProfile = profile || {};
    const role = atlasCurrentProfile.role || 'cliente';
    const fullName = atlasCurrentProfile.full_name || 'Usuário';

    const nameEl = document.getElementById('user-name');
    const roleEl = document.getElementById('user-role');
    const avatarEl = document.getElementById('user-avatar');

    if (nameEl) nameEl.textContent = fullName;
    if (roleEl) roleEl.textContent = window.atlasAuth?.roleLabel?.(role) || role;
    if (avatarEl) avatarEl.textContent = initials(fullName);

    document.getElementById('login-screen')?.classList.add('hidden');
    document.getElementById('app-shell')?.classList.remove('hidden');

    document.querySelectorAll('[data-roles]').forEach((el) => {
      const allowed = (el.dataset.roles || '').split(',').map((x) => x.trim());
      el.classList.toggle('hidden', !allowed.includes(role));
    });

    const newProcessBtn = document.getElementById('new-process-btn');
    if (newProcessBtn) {
      newProcessBtn.classList.toggle('hidden', !['admin', 'operacao'].includes(role));
    }

    const navItems = [...document.querySelectorAll('#nav [data-page]')];
    navItems.forEach((el) => el.classList.remove('active'));
    const firstVisible = navItems.find((el) => !el.classList.contains('hidden'));
    if (firstVisible) firstVisible.classList.add('active');

    render(firstVisible?.dataset.page || 'dashboard');
  };
})();