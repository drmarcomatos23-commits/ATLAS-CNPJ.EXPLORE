(() => {
  const previousDashboard = window.dashboard;
  const previousOpenCompany360 = window.openCompany360V5;
  const moneyFamily = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const escFamily = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  function hierarchyApi() {
    return window.AtlasCompanyHierarchyV51 || null;
  }

  function establishmentType(record) {
    const h = hierarchyApi();
    if (h?.establishmentType) return h.establishmentType(record);
    const saved = String(record?.metadata?.establishment_type || '').toLowerCase();
    if (saved === 'matriz' || saved === 'filial') return saved;
    const digits = String(record?.tax_id || '').replace(/\D/g, '');
    return digits.length === 14 && digits.slice(8, 12) !== '0001' ? 'filial' : 'matriz';
  }

  function establishmentNumber(record) {
    const digits = String(record?.tax_id || record?.cnpj || '').replace(/\D/g, '');
    return digits.length >= 12 ? digits.slice(8, 12) : '';
  }

  function normalize(record, list) {
    const h = hierarchyApi();
    if (h?.normalizeClientHierarchy) return h.normalizeClientHierarchy(record, list);
    const type = establishmentType(record);
    const digits = String(record?.tax_id || '').replace(/\D/g, '');
    const root = digits.slice(0, 8);
    const parent = type === 'filial'
      ? (record?.metadata?.parent_client_id || list.find(candidate => {
          if (candidate.id === record.id || establishmentType(candidate) !== 'matriz') return false;
          return String(candidate?.tax_id || '').replace(/\D/g, '').slice(0, 8) === root;
        })?.id || null)
      : null;
    return { ...record, establishment_type: type, parent_client_id: parent, cnpj_root: root };
  }

  function normalizedClients(clients = []) {
    return clients.map(client => normalize(client, clients));
  }

  function buildStructureMetrics(clients = []) {
    const list = normalizedClients(clients);
    const matrices = list.filter(client => client.establishment_type === 'matriz');
    const branches = list.filter(client => client.establishment_type === 'filial');
    const matrixIdsWithBranches = new Set(branches.map(client => client.parent_client_id).filter(Boolean));
    return {
      matrices: matrices.length,
      branches: branches.length,
      establishments: list.length,
      familiesWithBranches: matrices.filter(matrix => matrixIdsWithBranches.has(matrix.id)).length
    };
  }

  function familyForClient(clientId, clients = []) {
    const current = clients.find(client => client.id === clientId);
    if (!current) return { matrix: null, branches: [], members: [] };
    const h = hierarchyApi();
    if (h?.familyForCompany) return h.familyForCompany(current, clients);

    const list = normalizedClients(clients);
    const currentNormalized = list.find(client => client.id === clientId) || normalize(current, clients);
    const matrixId = currentNormalized.establishment_type === 'filial' ? currentNormalized.parent_client_id : currentNormalized.id;
    const matrix = list.find(client => client.id === matrixId) || currentNormalized;
    const branches = list.filter(client => client.establishment_type === 'filial' && client.parent_client_id === matrix.id);
    return { matrix, branches, members: [matrix, ...branches] };
  }

  function consolidateFamily(family, data = {}, now = new Date()) {
    const memberIds = new Set((family?.members || []).map(member => member.id).filter(Boolean));
    const processes = (data.processes || []).filter(process => memberIds.has(process.client_id));
    const processIds = new Set(processes.map(process => process.id).filter(Boolean));
    const activeProcesses = processes.filter(process => !['completed', 'cancelled'].includes(String(process.status || '').toLowerCase()));

    const licenses = (data.licenses || []).filter(license => memberIds.has(license.client_id));
    const overdueLicenses = licenses.filter(license => {
      if (!license.expires_at) return false;
      const expires = new Date(String(license.expires_at).includes('T') ? license.expires_at : `${license.expires_at}T23:59:59`);
      return !Number.isNaN(expires.getTime()) && expires < now;
    });

    const docsById = new Map();
    for (const document of data.documents || []) {
      if (memberIds.has(document.client_id) || processIds.has(document.process_id)) {
        docsById.set(document.id || `${document.client_id || ''}:${document.process_id || ''}:${docsById.size}`, document);
      }
    }

    const costs = (data.costs || []).filter(cost => processIds.has(cost.process_id));
    const total = costs.reduce((sum, cost) => sum + Number(cost.amount || 0), 0);
    const paid = costs.filter(cost => cost.payment_status === 'paid').reduce((sum, cost) => sum + Number(cost.amount || 0), 0);

    return {
      processes: { total: processes.length, active: activeProcesses.length },
      licenses: { total: licenses.length, overdue: overdueLicenses.length },
      documents: docsById.size,
      financial: { total, paid, pending: Math.max(0, total - paid) }
    };
  }

  function buildEstablishmentBreakdown(family, data = {}, now = new Date()) {
    return (family?.members || []).map(member => {
      const summary = consolidateFamily({ members: [member] }, data, now);
      return {
        id: member.id,
        name: member.trade_name || member.legal_name || 'Estabelecimento',
        legalName: member.legal_name || member.trade_name || 'Estabelecimento',
        type: establishmentType(member),
        establishmentNumber: establishmentNumber(member),
        taxId: member.tax_id || member.cnpj || '',
        city: member.city || '',
        state: member.state || '',
        ...summary
      };
    });
  }

  async function loadClients() {
    const db = typeof atlasDb === 'function' ? atlasDb() : null;
    if (!db) return [];
    const { data, error } = await db.from('clients')
      .select('id,legal_name,trade_name,tax_id,city,state,metadata,deleted_at')
      .is('deleted_at', null)
      .order('legal_name', { ascending: true });
    return error ? [] : (data || []);
  }

  async function loadFamilyOperationalData(family) {
    const db = typeof atlasDb === 'function' ? atlasDb() : null;
    const memberIds = (family?.members || []).map(member => member.id).filter(Boolean);
    if (!db || !memberIds.length) return { processes: [], licenses: [], documents: [], costs: [] };

    const [processRes, licenseRes, directDocsRes] = await Promise.all([
      db.from('processes').select('id,client_id,status,public_code,title,due_date').in('client_id', memberIds),
      db.from('licenses').select('id,client_id,name,license_type,expires_at,status').in('client_id', memberIds),
      db.from('documents').select('id,client_id,process_id,name,category').in('client_id', memberIds)
    ]);

    const processes = processRes.error ? [] : (processRes.data || []);
    const processIds = processes.map(process => process.id).filter(Boolean);
    const [processDocsRes, costsRes] = await Promise.all([
      processIds.length
        ? db.from('documents').select('id,client_id,process_id,name,category').in('process_id', processIds)
        : Promise.resolve({ data: [], error: null }),
      processIds.length
        ? db.from('costs').select('id,process_id,amount,payment_status').in('process_id', processIds)
        : Promise.resolve({ data: [], error: null })
    ]);

    const docs = new Map();
    for (const document of [...(directDocsRes.data || []), ...(processDocsRes.data || [])]) docs.set(document.id, document);
    return {
      processes,
      licenses: licenseRes.error ? [] : (licenseRes.data || []),
      documents: [...docs.values()],
      costs: costsRes.error ? [] : (costsRes.data || [])
    };
  }

  function structureCard(label, value, helper, type = '') {
    const click = type ? `onclick="openCompaniesByEstablishment('${type}')"` : '';
    const tag = type ? 'button' : 'div';
    return `<${tag} class="enterprise-structure-card ${type ? 'is-action' : ''}" ${click}>
      <span>${escFamily(label)}</span><strong>${Number(value || 0)}</strong><small>${escFamily(helper)}</small>
    </${tag}>`;
  }

  async function renderEnterpriseStructureDashboard() {
    const root = document.getElementById('page-content');
    if (!root || root.querySelector('.enterprise-structure')) return;
    const clients = await loadClients();
    const metrics = buildStructureMetrics(clients);
    const section = document.createElement('section');
    section.className = 'v4-card enterprise-structure';
    section.innerHTML = `
      <div class="enterprise-structure-head">
        <div><span>ESTRUTURA SOCIETÁRIA</span><h2>Estrutura Empresarial</h2></div>
        <button type="button" class="v4-link" onclick="openCompaniesByEstablishment('all')">Ver empresas</button>
      </div>
      <div class="enterprise-structure-grid">
        ${structureCard('Matrizes', metrics.matrices, 'Cadastros principais', 'matriz')}
        ${structureCard('Filiais', metrics.branches, 'Estabelecimentos vinculados', 'filial')}
        ${structureCard('Total de estabelecimentos', metrics.establishments, 'Matrizes + filiais')}
        ${structureCard('Famílias empresariais', metrics.familiesWithBranches, 'Matrizes com ao menos uma filial')}
      </div>`;
    const first = root.firstElementChild;
    if (first) first.after(section); else root.appendChild(section);
  }

  function applyCompanyEstablishmentFilter(type) {
    const view = document.getElementById('company-list-view');
    if (!view) return false;
    const normalizedType = ['matriz', 'filial'].includes(type) ? type : 'all';
    const rows = [...view.querySelectorAll('tbody tr')];
    for (const row of rows) {
      const isBranch = row.classList.contains('company-branch-row');
      const isMatrix = row.classList.contains('company-matrix-row');
      row.hidden = normalizedType === 'filial' ? !isBranch : normalizedType === 'matriz' ? !isMatrix : false;
    }

    let bar = view.querySelector('.enterprise-list-filter');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'enterprise-list-filter';
      view.prepend(bar);
    }
    const label = normalizedType === 'matriz' ? 'Matrizes' : normalizedType === 'filial' ? 'Filiais' : 'Todos os estabelecimentos';
    bar.innerHTML = `<span>Filtro de estabelecimento: <strong>${label}</strong></span><button type="button" class="mini-btn" onclick="openCompaniesByEstablishment('all')">Limpar filtro</button>`;
    return rows.length > 0;
  }

  window.openCompaniesByEstablishment = function(type = 'all') {
    const target = document.querySelector('[data-page="clientes"]');
    target?.click();
    let attempts = 0;
    const apply = () => {
      attempts += 1;
      if (applyCompanyEstablishmentFilter(type) || attempts >= 8) return;
      setTimeout(apply, 120);
    };
    setTimeout(apply, 0);
  };

  function establishmentLabel(row) {
    return row.type === 'filial'
      ? `Filial ${row.establishmentNumber || ''}`.trim()
      : 'Matriz';
  }

  function renderEstablishmentBreakdown(rows, currentClientId) {
    return `<div class="company-360-family-breakdown">
      <div class="company-360-family-breakdown-head">
        <div><span>UNIDADES DA FAMÍLIA</span><h4>Detalhamento por estabelecimento</h4></div>
        <small>Indicadores preservados por CNPJ</small>
      </div>
      <div class="company-360-family-breakdown-list">
        ${rows.map(row => {
          const place = [row.city, row.state].filter(Boolean).join('/');
          const current = row.id === currentClientId ? ' is-current' : '';
          return `<button type="button" class="family-establishment-row${current}" onclick="openFamilyEstablishment('${escFamily(row.id)}')">
            <span class="family-establishment-main"><strong>${escFamily(establishmentLabel(row))}</strong><b>${escFamily(row.name)}</b><small>${escFamily([row.taxId, place].filter(Boolean).join(' · '))}</small></span>
            <span><em>Processos</em><strong>${row.processes.total}</strong><small>${row.processes.active} ativo(s)</small></span>
            <span><em>Licenças</em><strong>${row.licenses.total}</strong><small>${row.licenses.overdue} vencida(s)</small></span>
            <span><em>Documentos</em><strong>${row.documents}</strong><small>vinculado(s)</small></span>
            <span><em>Financeiro</em><strong>${moneyFamily(row.financial.total)}</strong><small>${moneyFamily(row.financial.pending)} pendente</small></span>
            <span class="family-establishment-open">Abrir →</span>
          </button>`;
        }).join('')}
      </div>
    </div>`;
  }

  async function injectFamilySummary(clientId) {
    const body = document.querySelector('#company-360-backdrop .company-360-body');
    if (!body || body.querySelector('.company-360-family-summary')) return;
    const clients = await loadClients();
    const family = familyForClient(clientId, clients);
    if (!family.matrix || !family.members.length) return;
    const data = await loadFamilyOperationalData(family);
    const summary = consolidateFamily(family, data);
    const breakdown = buildEstablishmentBreakdown(family, data);
    const current = family.members.find(member => member.id === clientId);
    const currentType = current ? establishmentType(current) : 'matriz';

    const section = document.createElement('section');
    section.className = 'company-360-family-summary';
    section.innerHTML = `
      <div class="company-360-family-summary-head">
        <div><span>FAMÍLIA EMPRESARIAL</span><h3>Visão consolidada da família</h3><p>Leitura gerencial da matriz e ${family.branches.length} ${family.branches.length === 1 ? 'filial vinculada' : 'filiais vinculadas'}, preservando cada registro no seu próprio CNPJ.</p></div>
        ${currentType === 'filial' ? `<button type="button" class="btn btn-muted" onclick="openFamilyMatrix('${escFamily(family.matrix.id)}')">Abrir matriz</button>` : ''}
      </div>
      <div class="company-360-family-kpis">
        <div><span>Processos</span><strong>${summary.processes.total}</strong><small>${summary.processes.active} ativo(s)</small></div>
        <div><span>Licenças</span><strong>${summary.licenses.total}</strong><small>${summary.licenses.overdue} vencida(s)</small></div>
        <div><span>Documentos</span><strong>${summary.documents}</strong><small>Dossiê da família</small></div>
        <div><span>Financeiro</span><strong>${moneyFamily(summary.financial.total)}</strong><small>${moneyFamily(summary.financial.paid)} pago · ${moneyFamily(summary.financial.pending)} pendente</small></div>
      </div>
      ${renderEstablishmentBreakdown(breakdown, clientId)}`;
    const kpis = body.querySelector('.company-360-kpis');
    if (kpis) kpis.after(section); else body.prepend(section);
  }

  window.openFamilyEstablishment = function(clientId) {
    if (!clientId) return;
    window.closeCompany360V5?.();
    window.openCompany360V5?.(clientId);
  };

  window.openFamilyMatrix = function(matrixId) {
    window.openFamilyEstablishment?.(matrixId);
  };

  window.AtlasEnterpriseFamilyV51 = {
    buildStructureMetrics,
    familyForClient,
    consolidateFamily,
    buildEstablishmentBreakdown,
    renderEnterpriseStructureDashboard,
    injectFamilySummary
  };

  if (typeof previousDashboard === 'function') {
    window.dashboard = async function(...args) {
      const result = await previousDashboard(...args);
      await renderEnterpriseStructureDashboard();
      return result;
    };
  }

  if (typeof previousOpenCompany360 === 'function') {
    window.openCompany360V5 = async function(clientId) {
      const result = await previousOpenCompany360(clientId);
      await injectFamilySummary(clientId);
      return result;
    };
  }
})();