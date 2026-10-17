(() => {
  let channel = null;
  let refreshTimer = null;

  const emptyOperationalData = () => ({
    clients: [], groups: [], processes: [], templates: [], stages: [],
    profiles: [], protocols: [], costs: [], licenses: []
  });

  function currentPage() {
    const active = document.querySelector('#nav [data-page].active');
    return active?.dataset?.page || null;
  }

  async function waitForAuthenticatedSession() {
    const db = window.atlasAuth?.client;
    const profile = window.atlasAuth?.getProfile?.();
    if (!db || !profile?.id || !db.auth?.getSession) return null;

    const { data, error } = await db.auth.getSession();
    if (error || !data?.session?.access_token) return null;

    return { db, profile, session: data.session };
  }

  async function authenticatedContext() {
    return waitForAuthenticatedSession();
  }

  const originalLoadOperationalData = window.loadOperationalData;
  if (typeof originalLoadOperationalData === 'function' && !window.__atlasOperationalAuthGuardV6) {
    window.loadOperationalData = async function loadOperationalDataAuthenticated(...args) {
      const ctx = await waitForAuthenticatedSession();
      if (!ctx) return emptyOperationalData();
      return originalLoadOperationalData(...args);
    };
    window.__atlasOperationalAuthGuardV6 = true;
  }

  async function fetchClients() {
    const ctx = await authenticatedContext();
    if (!ctx) return [];
    const { db } = ctx;
    const { data, error } = await db.from('clients').select('id,legal_name,tax_id').order('legal_name',{ascending:true});
    if (error) return [];
    return data || [];
  }

  async function refreshCompanySelects() {
    const clients = await fetchClients();
    const selects = [
      document.getElementById('proc-client'),
      document.getElementById('doc-client')
    ].filter(Boolean);

    for (const select of selects) {
      const previous = select.value;
      const includeBlank = select.id === 'doc-client';
      select.innerHTML = (includeBlank ? '<option value="">Sem vínculo</option>' : '') +
        clients.map(c => '<option value="' + c.id + '">' + String(c.legal_name || '').replace(/[&<>"']/g, ch => ({
          '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        }[ch])) + '</option>').join('');
      if (clients.some(c => c.id === previous)) select.value = previous;
    }
  }

  async function refreshCompaniesContext() {
    const ctx = await authenticatedContext();
    if (!ctx) return;
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(async () => {
      try {
        const freshCtx = await authenticatedContext();
        if (!freshCtx) return;
        await refreshCompanySelects();
        const page = currentPage();
        if (page === 'clientes' && typeof window.clientPage === 'function') {
          await window.clientPage();
        } else if (page === 'dashboard' && typeof window.dashboard === 'function') {
          await window.dashboard();
        } else if (page === 'processos' && typeof window.processPage === 'function') {
          await window.processPage();
        }
      } catch (err) {
        console.error('Falha ao atualizar empresas em tempo real', err);
      }
    }, 180);
  }

  async function startRealtime() {
    const ctx = await authenticatedContext();
    if (!ctx) return;
    const { db, profile } = ctx;
    if (!profile?.organization_id) return;

    if (channel) {
      try { await db.removeChannel(channel); } catch {}
      channel = null;
    }

    channel = db
      .channel('atlas-clients-' + profile.organization_id)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clients',
          filter: 'organization_id=eq.' + profile.organization_id
        },
        () => refreshCompaniesContext()
      )
      .subscribe();
  }

  window.atlasRealtime = {
    start: startRealtime,
    refreshCompanies: refreshCompaniesContext,
    refreshCompanySelects,
    waitForAuthenticatedSession
  };

  const originalShow = window.showApp;
  if (typeof originalShow === 'function') {
    window.showApp = function(profile) {
      const result = originalShow(profile);
      setTimeout(startRealtime, 0);
      return result;
    };
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshCompaniesContext();
  });

  window.addEventListener('focus', refreshCompaniesContext);
})();
