(() => {
  const previousClientPage = window.clientPage;
  let companyListObserver = null;
  let companyIdByName = null;

  const esc360 = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  const date360 = (value) => {
    if (!value) return '—';
    const d = new Date(String(value).includes('T') ? value : `${value}T12:00:00`);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
  };

  const money360 = (value) => Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL'
  });

  const empty360 = (text) => `<div class="company-360-empty">${esc360(text)}</div>`;

  function closeCompany360V5() {
    document.getElementById('company-360-backdrop')?.remove();
  }

  function sectionTable(headers, rows, emptyText) {
    if (!rows.length) return empty360(emptyText);
    return `<div class="company-360-table-wrap"><table><thead><tr>${headers.map(h => `<th>${esc360(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  }

  async function openCompany360V5(clientId) {
    const db = typeof atlasDb === 'function' ? atlasDb() : null;
    if (!db || !clientId) return;

    const root = document.getElementById('atlas-modal-root') || document.body;
    root.insertAdjacentHTML('beforeend', `
      <div id="company-360-backdrop" class="company-360-backdrop">
        <div class="company-360-modal" role="dialog" aria-modal="true" aria-label="Empresa 360">
          <div class="company-360-loading"><span class="spinner"></span><span>Carregando visão 360°...</span></div>
        </div>
      </div>`);

    const modal = document.querySelector('#company-360-backdrop .company-360-modal');
    try {
      const [clientRes, partnersRes, processesRes, licensesRes] = await Promise.all([
        db.from('clients').select('*').eq('id', clientId).single(),
        db.from('client_partners').select('*').eq('client_id', clientId).order('full_name', { ascending: true }),
        db.from('processes').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
        db.from('licenses').select('*').eq('client_id', clientId).order('expires_at', { ascending: true })
      ]);

      if (clientRes.error) throw clientRes.error;
      const company = clientRes.data;
      const partners = partnersRes.data || [];
      const processes = processesRes.data || [];
      const licenses = licensesRes.data || [];
      const processIds = processes.map(p => p.id);

      let costs = [];
      let documents = [];
      const [directDocsRes, processDocsRes, costsRes] = await Promise.all([
        db.from('documents').select('id,name,category,client_id,process_id,created_at').eq('client_id', clientId).order('created_at', { ascending: false }),
        processIds.length
          ? db.from('documents').select('id,name,category,client_id,process_id,created_at').in('process_id', processIds).order('created_at', { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        processIds.length
          ? db.from('costs').select('*').in('process_id', processIds)
          : db.from('costs').select('id').limit(0)
      ]);

      if (!costsRes.error && processIds.length) costs = costsRes.data || [];
      const docsById = new Map();
      for (const doc of [...(directDocsRes.data || []), ...(processDocsRes.data || [])]) docsById.set(doc.id, doc);
      documents = [...docsById.values()].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));

      const activeProcesses = processes.filter(p => !['completed', 'cancelled'].includes(p.status)).length;
      const overdueLicenses = licenses.filter(l => l.expires_at && new Date(`${l.expires_at}T23:59:59`) < new Date()).length;
      const totalCosts = costs.reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const paidCosts = costs.filter(item => item.payment_status === 'paid').reduce((sum, item) => sum + Number(item.amount || 0), 0);

      const address = [
        company.street,
        company.address_number,
        company.address_complement,
        company.neighborhood,
        [company.city, company.state].filter(Boolean).join('/'),
        company.postal_code
      ].filter(Boolean).join(' · ') || '—';

      modal.innerHTML = `
        <header class="company-360-header">
          <div>
            <span class="company-360-kicker">EMPRESA 360°</span>
            <h2>${esc360(company.legal_name || 'Empresa')}</h2>
            <p>${esc360(company.trade_name || company.tax_id || 'Visão consolidada operacional')}</p>
          </div>
          <button class="company-360-close" type="button" aria-label="Fechar">×</button>
        </header>

        <div class="company-360-body">
          <div class="company-360-kpis">
            <div><span>Processos</span><strong>${processes.length}</strong><small>${activeProcesses} ativo(s)</small></div>
            <div><span>Licenças</span><strong>${licenses.length}</strong><small>${overdueLicenses} vencida(s)</small></div>
            <div><span>Documentos</span><strong>${documents.length}</strong><small>Dossiê vinculado</small></div>
            <div><span>Financeiro</span><strong>${money360(totalCosts)}</strong><small>${money360(paidCosts)} pago</small></div>
          </div>

          <div class="company-360-grid">
            <section class="company-360-section company-360-identification">
              <div class="company-360-section-head"><h3>Identificação</h3><span>Dados cadastrais</span></div>
              <dl class="company-360-facts">
                <div><dt>CNPJ</dt><dd>${esc360(company.tax_id || '—')}</dd></div>
                <div><dt>IE</dt><dd>${esc360(company.state_registration || '—')}</dd></div>
                <div><dt>IM</dt><dd>${esc360(company.municipal_registration || '—')}</dd></div>
                <div><dt>Contato</dt><dd>${esc360(company.contact_name || company.email || company.phone || '—')}</dd></div>
                <div class="span-2"><dt>Endereço</dt><dd>${esc360(address)}</dd></div>
              </dl>
            </section>

            <section class="company-360-section">
              <div class="company-360-section-head"><h3>Quadro societário</h3><span>${partners.length} registro(s)</span></div>
              ${sectionTable(['Nome','CPF/CNPJ','Participação','Administrador'], partners.map(p => `<tr><td><strong>${esc360(p.full_name || '—')}</strong></td><td>${esc360(p.cpf || '—')}</td><td>${p.ownership_percentage ?? '—'}%</td><td>${p.is_administrator ? 'Sim' : 'Não'}</td></tr>`), 'Nenhum sócio cadastrado.')}
            </section>

            <section class="company-360-section span-2">
              <div class="company-360-section-head"><h3>Processos</h3><span>${processes.length} registro(s)</span></div>
              ${sectionTable(['Código','Processo','Status','Prazo'], processes.map(p => `<tr><td>${esc360(p.public_code || '—')}</td><td><strong>${esc360(p.title || '—')}</strong></td><td>${esc360(typeof statusLabel === 'function' ? statusLabel(p.status) : (p.status || '—'))}</td><td>${date360(p.due_date)}</td></tr>`), 'Nenhum processo vinculado.')}
            </section>

            <section class="company-360-section">
              <div class="company-360-section-head"><h3>Licenças</h3><span>Vencimentos</span></div>
              ${sectionTable(['Licença','Vencimento'], licenses.map(l => `<tr><td><strong>${esc360(l.name || l.license_type || 'Licença')}</strong></td><td>${date360(l.expires_at)}</td></tr>`), 'Nenhuma licença cadastrada.')}
            </section>

            <section class="company-360-section">
              <div class="company-360-section-head"><h3>Financeiro</h3><span>Custos e honorários</span></div>
              ${sectionTable(['Descrição','Valor','Situação'], costs.map(c => `<tr><td>${esc360(c.description || '—')}</td><td><strong>${money360(c.amount)}</strong></td><td>${c.payment_status === 'paid' ? 'Pago' : 'Pendente'}</td></tr>`), 'Nenhum lançamento financeiro vinculado.')}
            </section>

            <section class="company-360-section span-2">
              <div class="company-360-section-head"><h3>Documentos</h3><span>Dossiê digital</span></div>
              ${sectionTable(['Documento','Categoria','Incluído em'], documents.map(d => `<tr><td><strong>${esc360(d.name || 'Documento')}</strong></td><td>${esc360(d.category || 'Geral')}</td><td>${date360(d.created_at)}</td></tr>`), 'Nenhum documento vinculado.')}
            </section>
          </div>
        </div>`;

      modal.querySelector('.company-360-close')?.addEventListener('click', closeCompany360V5);
      document.getElementById('company-360-backdrop')?.addEventListener('click', (event) => {
        if (event.target?.id === 'company-360-backdrop') closeCompany360V5();
      });
    } catch (error) {
      modal.innerHTML = `<div class="company-360-error"><strong>Não foi possível abrir a Empresa 360°.</strong><span>${esc360(error?.message || 'Falha ao carregar dados.')}</span><button type="button" class="btn btn-muted">Fechar</button></div>`;
      modal.querySelector('button')?.addEventListener('click', closeCompany360V5);
    }
  }

  async function loadCompanyIdMap() {
    if (companyIdByName) return companyIdByName;
    const db = typeof atlasDb === 'function' ? atlasDb() : null;
    if (!db) return new Map();
    const { data, error } = await db.from('clients').select('id,legal_name').is('deleted_at', null);
    if (error) return new Map();
    companyIdByName = new Map((data || []).map(c => [String(c.legal_name || '').trim(), c.id]));
    return companyIdByName;
  }

  async function decorateCompanyRows() {
    const rows = [...document.querySelectorAll('#company-list-view tbody tr')];
    if (!rows.length) return;
    const byName = await loadCompanyIdMap();

    rows.forEach(row => {
      if (row.querySelector('.company-360-open')) return;
      const firstCell = row.querySelector('td');
      const name = firstCell?.querySelector('strong')?.textContent?.trim();
      const id = byName.get(name);
      if (!firstCell || !id) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'company-360-open';
      button.textContent = 'Abrir Empresa 360°';
      button.addEventListener('click', () => openCompany360V5(id));
      firstCell.appendChild(button);
    });
  }

  function watchCompanyList() {
    companyListObserver?.disconnect();
    const view = document.getElementById('company-list-view');
    if (!view) return;
    const observer = new MutationObserver(() => {
      queueMicrotask(() => decorateCompanyRows());
    });
    observer.observe(view, { childList: true, subtree: true });
    companyListObserver = observer;
  }

  window.openCompany360V5 = openCompany360V5;
  window.closeCompany360V5 = closeCompany360V5;

  if (typeof previousClientPage === 'function') {
    window.clientPage = async function(...args) {
      companyIdByName = null;
      const result = await previousClientPage(...args);
      await decorateCompanyRows();
      watchCompanyList();
      return result;
    };
  }
})();
