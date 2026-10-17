(() => {
  const H = window.AtlasCompanyHierarchyV51 || {};
  const CACHE_MS = 20000;
  let cache = null;
  let loadedAt = 0;
  let loading = null;
  let searchObserver = null;
  let searchDecorateQueued = false;

  const digits = value => String(value || '').replace(/\D/g, '');
  const cleanName = client => client?.legal_name || client?.trade_name || 'Empresa';
  const locationOf = client => [client?.city, client?.state].filter(Boolean).join('/');

  function fallbackType(client) {
    const saved = String(client?.metadata?.establishment_type || '').toLowerCase();
    if (saved === 'matriz' || saved === 'filial') return saved;
    const cnpj = digits(client?.tax_id || client?.cnpj);
    return cnpj.length === 14 && cnpj.slice(8, 12) !== '0001' ? 'filial' : 'matriz';
  }

  function cnpjRoot(client) {
    if (typeof H.cnpjRoot === 'function') return H.cnpjRoot(client?.tax_id || client?.cnpj);
    const cnpj = digits(client?.tax_id || client?.cnpj);
    return cnpj.length === 14 ? cnpj.slice(0, 8) : '';
  }

  function establishmentNumber(client) {
    const cnpj = digits(client?.tax_id || client?.cnpj);
    return cnpj.length === 14 ? cnpj.slice(8, 12) : '';
  }

  function normalized(client, list = []) {
    if (!client) return null;
    if (typeof H.normalizeClientHierarchy === 'function') return H.normalizeClientHierarchy(client, list);
    const type = fallbackType(client);
    let parentId = type === 'filial' ? client?.metadata?.parent_client_id || null : null;
    if (type === 'filial' && !parentId) {
      const root = cnpjRoot(client);
      parentId = list.find(candidate => candidate.id !== client.id && fallbackType(candidate) === 'matriz' && cnpjRoot(candidate) === root)?.id || null;
    }
    return { ...client, establishment_type: type, parent_client_id: parentId };
  }

  function contextForClient(client, list = []) {
    if (!client) return null;
    const item = normalized(client, list) || client;
    const primary = cleanName(client);
    const loc = locationOf(client);
    const number = establishmentNumber(client);
    const isBranch = item.establishment_type === 'filial';
    const parent = isBranch ? list.find(candidate => candidate.id === item.parent_client_id) || null : null;
    const matrixName = parent ? cleanName(parent) : primary;
    const typeLabel = isBranch ? 'Filial' : 'Matriz';
    const branchLabel = number ? `Filial ${number}` : 'Filial';
    const secondary = isBranch
      ? `${branchLabel}${parent ? ` de ${matrixName}` : ''}${loc ? ` · ${loc}` : ''}`
      : `Matriz${loc ? ` · ${loc}` : ''}`;
    const selector = isBranch
      ? `${matrixName} › ${branchLabel}${loc ? ` — ${loc}` : ''}`
      : `${primary} — Matriz${loc ? ` — ${loc}` : ''}`;
    const search = isBranch
      ? `${primary} · ${branchLabel}${parent ? ` · Matriz: ${matrixName}` : ''}`
      : `${primary} · Matriz`;
    return { client, normalized: item, type: item.establishment_type, typeLabel, number, parent, matrixName, primary, location: loc, secondary, selector, search };
  }

  function labelForClient(clientId, list = [], mode = 'selector') {
    const client = list.find(item => item.id === clientId);
    const ctx = contextForClient(client, list);
    if (!ctx) return 'Empresa';
    return ctx[mode] || ctx.selector;
  }

  async function loadContextData(force = false) {
    if (!force && cache && Date.now() - loadedAt < CACHE_MS) return cache;
    if (loading) return loading;
    const db = typeof atlasDb === 'function' ? atlasDb() : null;
    if (!db) return cache || { clients: [], processes: [], licenses: [], documents: [] };
    loading = (async () => {
      const [clientsRes, processesRes, licensesRes, documentsRes] = await Promise.all([
        db.from('clients').select('id,legal_name,trade_name,tax_id,city,state,group_id,metadata,deleted_at').is('deleted_at', null).order('legal_name', { ascending: true }),
        db.from('processes').select('id,public_code,title,client_id,status,completed_at,created_at').order('created_at', { ascending: false }),
        db.from('licenses').select('id,name,expires_at,client_id,status').order('expires_at', { ascending: true }),
        db.from('documents').select('id,name,category,client_id,process_id,created_at').order('created_at', { ascending: false })
      ]);
      cache = {
        clients: clientsRes.error ? [] : (clientsRes.data || []),
        processes: processesRes.error ? [] : (processesRes.data || []),
        licenses: licensesRes.error ? [] : (licensesRes.data || []),
        documents: documentsRes.error ? [] : (documentsRes.data || [])
      };
      loadedAt = Date.now();
      return cache;
    })().finally(() => { loading = null; });
    return loading;
  }

  function injectStyles() {
    if (document.getElementById('atlas-establishment-context-v51-style')) return;
    const style = document.createElement('style');
    style.id = 'atlas-establishment-context-v51-style';
    style.textContent = `
      .v51-establishment-sub{display:block;margin-top:3px;font-size:10px;line-height:1.35;color:var(--muted,#6f7d8b);font-weight:500}
      .v51-establishment-tax{display:block;margin-top:2px;font-size:9px;line-height:1.3;color:var(--muted,#7e8a96)}
      select option[data-v51-establishment="1"]{font-variant-numeric:tabular-nums}
      .license-company-head .v51-establishment-sub,.license-expiry-company .v51-establishment-sub{margin-top:2px}
      .v4-command-results small .v51-establishment-sub{display:inline}
    `;
    document.head.appendChild(style);
  }

  function setClientBlock(element, client, clients, { showTax = false } = {}) {
    if (!element || !client) return;
    const ctx = contextForClient(client, clients);
    if (!ctx) return;
    element.replaceChildren();
    const strong = document.createElement('strong');
    strong.textContent = ctx.primary;
    const sub = document.createElement('div');
    sub.className = 'v51-establishment-sub';
    sub.textContent = ctx.secondary;
    element.append(strong, sub);
    if (showTax && client.tax_id) {
      const tax = document.createElement('div');
      tax.className = 'v51-establishment-tax';
      tax.textContent = client.tax_id;
      element.appendChild(tax);
    }
    element.dataset.v51Establishment = client.id;
  }

  function addContextAfter(element, client, clients) {
    if (!element || !client) return;
    const ctx = contextForClient(client, clients);
    if (!ctx) return;
    const parent = element.parentElement;
    if (!parent) return;
    parent.querySelectorAll(':scope > .v51-establishment-sub').forEach(node => node.remove());
    const sub = document.createElement('div');
    sub.className = 'v51-establishment-sub';
    sub.textContent = ctx.secondary;
    element.insertAdjacentElement('afterend', sub);
  }

  function decorateClientSelect(select, clients) {
    if (!select) return;
    for (const option of select.querySelectorAll('option[value]')) {
      if (!option.value) continue;
      const client = clients.find(item => item.id === option.value);
      if (!client) continue;
      option.textContent = contextForClient(client, clients)?.selector || cleanName(client);
      option.dataset.v51Establishment = '1';
    }
  }

  function processMaps(data) {
    const byCode = new Map();
    const byId = new Map();
    for (const process of data.processes || []) {
      if (process.public_code) byCode.set(String(process.public_code).trim(), process);
      byId.set(process.id, process);
    }
    const clients = new Map((data.clients || []).map(client => [client.id, client]));
    return { byCode, byId, clients };
  }

  async function decorateProcessPage() {
    const root = document.getElementById('page-content');
    if (!root) return;
    const data = await loadContextData(true);
    const maps = processMaps(data);
    const clientForCode = code => {
      const process = maps.byCode.get(String(code || '').trim());
      return process ? maps.clients.get(process.client_id) : null;
    };

    root.querySelectorAll('.process-table-desktop tbody tr').forEach(row => {
      const cells = row.querySelectorAll('td');
      const code = cells[0]?.querySelector('strong')?.textContent?.trim();
      const client = clientForCode(code);
      if (cells[1] && client) setClientBlock(cells[1], client, data.clients);
    });

    root.querySelectorAll('.process-mobile-card').forEach(card => {
      const code = card.querySelector('.process-mobile-code')?.textContent?.trim();
      const client = clientForCode(code);
      const company = card.querySelector('.process-mobile-company');
      if (company && client) setClientBlock(company, client, data.clients);
    });

    root.querySelectorAll('.task-card.real-task').forEach(card => {
      const code = card.querySelector('b')?.textContent?.trim();
      const client = clientForCode(code);
      const company = card.querySelector('strong');
      if (company && client) {
        company.textContent = contextForClient(client, data.clients)?.primary || cleanName(client);
        addContextAfter(company, client, data.clients);
      }
    });
  }

  async function decorateProcessModal() {
    const data = await loadContextData(true);
    decorateClientSelect(document.getElementById('proc-client'), data.clients);
  }

  async function decorateDocumentsPage() {
    const root = document.getElementById('page-content');
    if (!root) return;
    const data = await loadContextData(true);
    const section = [...root.querySelectorAll('section')].find(item => /Dossiê de documentos/i.test(item.textContent || ''));
    const rows = section ? [...section.querySelectorAll('tbody tr')] : [];
    const processById = new Map(data.processes.map(process => [process.id, process]));
    const clientById = new Map(data.clients.map(client => [client.id, client]));
    rows.forEach((row, index) => {
      const doc = data.documents[index];
      if (!doc) return;
      const process = processById.get(doc.process_id);
      const client = clientById.get(doc.client_id || process?.client_id);
      const cells = row.querySelectorAll('td');
      if (cells[2] && client) setClientBlock(cells[2], client, data.clients);
    });
  }

  async function decorateDocumentModal() {
    const data = await loadContextData(true);
    decorateClientSelect(document.getElementById('doc-client'), data.clients);
    const processById = new Map(data.processes.map(process => [process.id, process]));
    const clientById = new Map(data.clients.map(client => [client.id, client]));
    const select = document.getElementById('doc-process');
    select?.querySelectorAll('option[value]').forEach(option => {
      if (!option.value) return;
      const process = processById.get(option.value);
      const client = clientById.get(process?.client_id || option.dataset.client);
      if (!process || !client) return;
      const ctx = contextForClient(client, data.clients);
      option.textContent = `${process.public_code || 'Processo'} · ${process.title || ''} — ${ctx?.selector || cleanName(client)}`;
      option.dataset.v51Establishment = '1';
    });
  }

  async function decorateFinancePage() {
    const root = document.getElementById('page-content');
    if (!root) return;
    const data = await loadContextData(true);
    const maps = processMaps(data);
    root.querySelectorAll('table tbody tr').forEach(row => {
      const cells = row.querySelectorAll('td');
      const code = cells[0]?.querySelector('strong')?.textContent?.trim();
      const process = maps.byCode.get(code);
      const client = process ? maps.clients.get(process.client_id) : null;
      if (cells[1] && client) setClientBlock(cells[1], client, data.clients, { showTax: true });
    });
  }

  function clientByCnpjText(text, clients) {
    const compact = digits(text);
    if (compact.length >= 14) {
      const all = compact.match(/\d{14}/g) || [compact.slice(0, 14)];
      for (const candidate of all) {
        const found = clients.find(client => digits(client.tax_id) === candidate);
        if (found) return found;
      }
    }
    return null;
  }

  async function decorateLicensesPage() {
    const root = document.getElementById('page-content');
    if (!root) return;
    const data = await loadContextData(true);

    root.querySelectorAll('.license-expiry-row').forEach(row => {
      const company = row.querySelector('.license-expiry-company');
      const client = clientByCnpjText(company?.textContent || '', data.clients);
      const strong = company?.querySelector('strong');
      if (!client || !strong) return;
      strong.textContent = contextForClient(client, data.clients)?.primary || cleanName(client);
      addContextAfter(strong, client, data.clients);
    });

    root.querySelectorAll('.company-license-block').forEach(block => {
      const head = block.querySelector('.license-company-head');
      const client = clientByCnpjText(head?.textContent || '', data.clients);
      const title = head?.querySelector('h2');
      if (!client || !title) return;
      title.textContent = contextForClient(client, data.clients)?.primary || cleanName(client);
      addContextAfter(title, client, data.clients);
    });
  }

  async function decorateReportsPage() {
    const root = document.getElementById('page-content');
    if (!root) return;
    const data = await loadContextData(true);
    const maps = processMaps(data);
    const completedHeading = 'Concluídos recentemente';
    const completedSection = [...root.querySelectorAll('section')].find(section => section.querySelector('h2')?.textContent?.includes(completedHeading));
    if (completedSection) {
      const headRow = completedSection.querySelector('thead tr');
      if (headRow && !headRow.querySelector('[data-v51-company-head]')) {
        const th = document.createElement('th');
        th.textContent = 'Empresa / estabelecimento';
        th.dataset.v51CompanyHead = '1';
        headRow.children[0]?.insertAdjacentElement('afterend', th);
      }
      completedSection.querySelectorAll('tbody tr').forEach(row => {
        if (row.querySelector('[data-v51-company-cell]')) return;
        const code = row.children[0]?.textContent?.trim();
        const process = maps.byCode.get(code);
        const client = process ? maps.clients.get(process.client_id) : null;
        if (!client) return;
        const td = document.createElement('td');
        td.dataset.v51CompanyCell = '1';
        setClientBlock(td, client, data.clients);
        row.children[0]?.insertAdjacentElement('afterend', td);
      });
    }

    const renewalSection = [...root.querySelectorAll('section')].find(section => /Próximas renovações/i.test(section.querySelector('h2')?.textContent || ''));
    if (renewalSection) {
      const now = new Date();
      const upcoming = data.licenses.filter(license => license.expires_at && new Date(`${license.expires_at}T12:00:00`) >= now).slice(0, 5);
      const clientById = new Map(data.clients.map(client => [client.id, client]));
      [...renewalSection.querySelectorAll('.alert-item')].forEach((row, index) => {
        const license = upcoming[index];
        const client = license ? clientById.get(license.client_id) : null;
        const box = row.firstElementChild;
        if (!client || !box || box.querySelector('.v51-establishment-sub')) return;
        const sub = document.createElement('div');
        sub.className = 'v51-establishment-sub';
        sub.textContent = contextForClient(client, data.clients)?.secondary || '';
        box.appendChild(sub);
      });
    }
  }

  function resolveSearchClient(button, data) {
    const type = String(button.querySelector('em')?.textContent || '').trim().toLowerCase();
    const label = String(button.querySelector('strong')?.textContent || '').trim();
    const meta = String(button.querySelector('small')?.textContent || '').trim();
    const clientById = new Map(data.clients.map(client => [client.id, client]));
    const findProcess = () => data.processes.find(process => process.public_code && (label === process.public_code || meta.includes(process.public_code)));
    if (type === 'empresa') {
      return clientByCnpjText(meta, data.clients) || data.clients.find(client => label === client.legal_name || label === client.trade_name) || null;
    }
    if (type === 'processo') {
      const process = findProcess();
      return process ? clientById.get(process.client_id) || null : null;
    }
    if (type === 'licenca') {
      const direct = data.clients.find(client => (client.legal_name && meta.includes(client.legal_name)) || (client.trade_name && meta.includes(client.trade_name)));
      if (direct) return direct;
      const license = data.licenses.find(item => item.name === label && (!item.expires_at || meta.includes(item.expires_at)));
      return license ? clientById.get(license.client_id) || null : null;
    }
    if (type === 'documento' || type === 'financeiro') {
      const process = findProcess();
      return process ? clientById.get(process.client_id) || null : null;
    }
    return null;
  }

  async function decorateGlobalSearch() {
    const host = document.getElementById('v4-command-results');
    if (!host) return;
    const data = await loadContextData(false);
    host.querySelectorAll('button[data-v4-index]').forEach(button => {
      const small = button.querySelector('small');
      if (!small || button.dataset.v51Establishment === '1') return;
      const client = resolveSearchClient(button, data);
      if (!client) return;
      const ctx = contextForClient(client, data.clients);
      if (!ctx) return;
      const base = small.textContent.trim();
      small.textContent = [base, ctx.search.replace(`${ctx.primary} · `, '')].filter(Boolean).join(' · ');
      button.dataset.v51Establishment = '1';
    });
  }

  function queueGlobalSearchDecoration() {
    if (searchDecorateQueued) return;
    searchDecorateQueued = true;
    queueMicrotask(async () => {
      searchDecorateQueued = false;
      try { await decorateGlobalSearch(); } catch (error) { console.warn('ATLAS V5.1: contexto da busca indisponível', error); }
    });
  }

  function watchGlobalSearch() {
    searchObserver?.disconnect();
    if (!document.body) return;
    searchObserver = new MutationObserver(mutations => {
      if (mutations.some(mutation => mutation.target?.id === 'v4-command-results' || mutation.target?.closest?.('#v4-command-results') || [...mutation.addedNodes].some(node => node?.id === 'v4-command-results' || node?.querySelector?.('#v4-command-results')))) {
        queueGlobalSearchDecoration();
      }
    });
    searchObserver.observe(document.body, { childList: true, subtree: true });
  }

  function wrapPage(name, decorator) {
    const previous = window[name];
    if (typeof previous !== 'function' || previous.__atlasEstablishmentV51) return;
    const wrapped = async function(...args) {
      const result = await previous.apply(this, args);
      try { await decorator(...args); } catch (error) { console.warn(`ATLAS V5.1: contexto de estabelecimento em ${name} indisponível`, error); }
      return result;
    };
    wrapped.__atlasEstablishmentV51 = true;
    window[name] = wrapped;
  }

  wrapPage('processPage', decorateProcessPage);
  wrapPage('docsPage', decorateDocumentsPage);
  wrapPage('costPage', decorateFinancePage);
  wrapPage('licensePage', decorateLicensesPage);
  wrapPage('reportsPage', decorateReportsPage);
  wrapPage('openProcessModal', decorateProcessModal);
  wrapPage('openDocumentModal', decorateDocumentModal);

  const previousOpenCompanyLicenses = window.openCompanyLicenses;
  if (typeof previousOpenCompanyLicenses === 'function') {
    window.openCompanyLicenses = async function(clientId, ...args) {
      const result = await previousOpenCompanyLicenses.call(this, clientId, ...args);
      try {
        const data = await loadContextData(false);
        const client = data.clients.find(item => item.id === clientId);
        const ctx = contextForClient(client, data.clients);
        const title = document.querySelector('#atlas-modal-root .atlas-modal-head h2');
        if (title && ctx) title.textContent = `Licenças · ${ctx.selector}`;
      } catch (error) {
        console.warn('ATLAS V5.1: contexto do modal de licenças indisponível', error);
      }
      return result;
    };
  }

  window.AtlasEstablishmentContextV51 = {
    establishmentNumber,
    contextForClient,
    labelForClient,
    loadContextData,
    decorateProcessPage,
    decorateDocumentsPage,
    decorateFinancePage,
    decorateLicensesPage,
    decorateReportsPage,
    decorateGlobalSearch
  };

  injectStyles();
  watchGlobalSearch();
})();
