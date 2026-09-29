(() => {
  let channel = null;
  let refreshTimer = null;

  function currentPage() {
    const active = document.querySelector('#nav [data-page].active');
    return active?.dataset?.page || null;
  }

  async function fetchClients() {
    const db = window.atlasAuth?.client;
    if (!db) return [];
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
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(async () => {
      try {
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
    const db = window.atlasAuth?.client;
    const profile = window.atlasAuth?.getProfile?.();
    if (!db || !profile?.organization_id) return;

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
    refreshCompanySelects
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