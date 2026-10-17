(() => {
  const previousOpenClientModal = window.openClientModal;
  const previousClientPage = window.clientPage;
  const previousOpenCompany360 = window.openCompany360V5;
  const previousArchiveClient = window.archiveClient;
  let hierarchyObserver = null;
  let clientCache = [];
  let pendingHierarchy = null;

  const digits = value => String(value || '').replace(/\D/g, '');
  const cnpjRoot = value => {
    const d = digits(value);
    return d.length === 14 ? d.slice(0, 8) : '';
  };
  const escHierarchy = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  function establishmentTypeFromCnpj(value) {
    const d = digits(value);
    if (d.length !== 14) return 'matriz';
    return d.slice(8, 12) === '0001' ? 'matriz' : 'filial';
  }

  function establishmentTypeFromPayload(payload) {
    const e = payload?.estabelecimento || {};
    const raw = String(
      e?.tipo ||
      e?.descricao_identificador_matriz_filial ||
      payload?.descricao_identificador_matriz_filial ||
      payload?.identificador_matriz_filial ||
      ''
    ).trim().toLowerCase();
    if (raw === '2' || raw.includes('filial')) return 'filial';
    if (raw === '1' || raw.includes('matriz')) return 'matriz';
    return establishmentTypeFromCnpj(e?.cnpj || payload?.cnpj || '');
  }

  function establishmentType(record) {
    const saved = String(record?.metadata?.establishment_type || '').toLowerCase();
    return saved === 'filial' || saved === 'matriz' ? saved : establishmentTypeFromCnpj(record?.tax_id);
  }

  function parentClientId(record, list = clientCache) {
    const saved = record?.metadata?.parent_client_id || null;
    if (saved) return saved;
    if (establishmentType(record) !== 'filial') return null;
    const root = record?.metadata?.cnpj_root || cnpjRoot(record?.tax_id);
    if (!root) return null;
    return list.find(candidate => candidate.id !== record.id && establishmentType(candidate) === 'matriz' && (candidate?.metadata?.cnpj_root || cnpjRoot(candidate?.tax_id)) === root)?.id || null;
  }

  function normalizeClientHierarchy(record, list = clientCache) {
    const type = establishmentType(record);
    return {
      ...record,
      establishment_type: type,
      parent_client_id: type === 'filial' ? parentClientId(record, list) : null,
      cnpj_root: record?.metadata?.cnpj_root || cnpjRoot(record?.tax_id)
    };
  }

  function activeBranchesForMatrix(matrixId, list = clientCache) {
    if (!matrixId) return [];
    return list
      .map(client => normalizeClientHierarchy(client, list))
      .filter(client => client.establishment_type === 'filial' && client.parent_client_id === matrixId);
  }

  function effectiveGroupId(record, list = clientCache) {
    if (!record) return null;
    const normalized = normalizeClientHierarchy(record, list);
    if (normalized.establishment_type !== 'filial') return record.group_id || null;
    const matrix = list.find(candidate => candidate.id === normalized.parent_client_id);
    return matrix?.group_id || record.group_id || null;
  }

  async function loadClients(force = false) {
    if (clientCache.length && !force) return clientCache;
    const db = typeof atlasDb === 'function' ? atlasDb() : null;
    if (!db) return [];
    const { data, error } = await db.from('clients')
      .select('id,legal_name,trade_name,tax_id,city,state,group_id,metadata,deleted_at')
      .is('deleted_at', null)
      .order('legal_name', { ascending: true });
    if (error) return [];
    clientCache = data || [];
    return clientCache;
  }

  function sameRootMatrices(root, currentId = '', list = clientCache) {
    return list.filter(record => {
      if (record.id === currentId || establishmentType(record) !== 'matriz') return false;
      if (!root) return true;
      const candidateRoot = record?.metadata?.cnpj_root || cnpjRoot(record?.tax_id);
      return candidateRoot === root;
    });
  }

  function hierarchyHelp(type, root, matrices) {
    if (type !== 'filial') return 'A matriz é o cadastro principal. As filiais vinculadas aparecerão dentro deste cadastro.';
    if (root && !matrices.length) return 'Filial identificada. A matriz com a mesma raiz de CNPJ ainda não está cadastrada no ATLAS.';
    return 'A filial mantém CNPJ, inscrições, endereço, processos e licenças próprios, mas fica vinculada ao cadastro da matriz.';
  }

  function renderParentOptions(select, matrices, selectedId = '') {
    if (!select) return;
    select.innerHTML = '<option value="">Selecione a matriz</option>' + matrices.map(matrix => {
      const label = `${matrix.legal_name || matrix.trade_name || 'Matriz'}${matrix.tax_id ? ' · ' + matrix.tax_id : ''}`;
      return `<option value="${escHierarchy(matrix.id)}" ${matrix.id === selectedId ? 'selected' : ''}>${escHierarchy(label)}</option>`;
    }).join('');
  }

  function inheritMatrixGroup(parentId) {
    if (!parentId) return;
    const matrix = clientCache.find(client => client.id === parentId);
    const groupSelect = document.getElementById('client-group-id');
    if (!matrix?.group_id || !groupSelect) return;
    if ([...groupSelect.options].some(option => option.value === matrix.group_id)) groupSelect.value = matrix.group_id;
  }

  async function updateHierarchyControls({ type, parentId = '', currentId = '' } = {}) {
    const typeSelect = document.getElementById('client-establishment-type');
    const parentWrap = document.getElementById('client-parent-wrap');
    const parentSelect = document.getElementById('client-parent-id');
    const note = document.getElementById('client-hierarchy-message');
    const cnpj = document.getElementById('client-tax-id')?.value || '';
    const root = cnpjRoot(cnpj);
    const list = await loadClients();
    const resolvedType = type || typeSelect?.value || establishmentTypeFromCnpj(cnpj);
    const matrices = sameRootMatrices(root, currentId, list);

    if (typeSelect) typeSelect.value = resolvedType;
    parentWrap?.classList.toggle('hidden', resolvedType !== 'filial');
    renderParentOptions(parentSelect, matrices, parentId || parentSelect?.value || '');

    if (resolvedType === 'filial' && matrices.length === 1 && !parentSelect?.value) {
      parentSelect.value = matrices[0].id;
      if (!currentId) inheritMatrixGroup(matrices[0].id);
    }
    if (note) {
      note.textContent = hierarchyHelp(resolvedType, root, matrices);
      note.className = `auth-message ${resolvedType === 'filial' && root && !matrices.length ? 'error' : 'info'} span-2`;
    }
  }

  async function classifyCnpjOfficially(cnpj, currentId = '') {
    const d = digits(cnpj);
    if (d.length !== 14) return;
    try {
      const response = await fetch('/api/cnpj?cnpj=' + encodeURIComponent(d), { headers: { Accept: 'application/json' } });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload) return;
      const type = establishmentTypeFromPayload(payload);
      await updateHierarchyControls({ type, currentId });
    } catch (error) {
      await updateHierarchyControls({ type: establishmentTypeFromCnpj(d), currentId });
    }
  }

  async function injectHierarchyFields(id = '', parentId = '') {
    pendingHierarchy = null;
    const form = document.getElementById('client-real-form');
    const cnpjMessage = document.getElementById('client-cnpj-message');
    if (!form || !cnpjMessage || form.dataset.hierarchyV51 === '1') return;
    form.dataset.hierarchyV51 = '1';

    await loadClients(true);
    const db = typeof atlasDb === 'function' ? atlasDb() : null;
    let record = null;
    if (id && db) {
      const result = await db.from('clients').select('id,tax_id,metadata').eq('id', id).single();
      if (!result.error) record = result.data;
    }

    const current = normalizeClientHierarchy(record || { id, tax_id: document.getElementById('client-tax-id')?.value || '', metadata: {} }, clientCache);
    const initialType = parentId ? 'filial' : current.establishment_type;
    const initialParent = parentId || current.parent_client_id || '';

    cnpjMessage.insertAdjacentHTML('afterend', `
      <div class="field">
        <label>Tipo de estabelecimento *</label>
        <select id="client-establishment-type">
          <option value="matriz" ${initialType === 'matriz' ? 'selected' : ''}>Matriz</option>
          <option value="filial" ${initialType === 'filial' ? 'selected' : ''}>Filial</option>
        </select>
      </div>
      <div id="client-parent-wrap" class="field ${initialType === 'filial' ? '' : 'hidden'}">
        <label>Matriz vinculada *</label>
        <select id="client-parent-id"><option value="">Selecione a matriz</option></select>
      </div>
      <div id="client-hierarchy-message" class="auth-message info span-2"></div>
    `);

    await updateHierarchyControls({ type: initialType, parentId: initialParent, currentId: id });
    if (!id && parentId) inheritMatrixGroup(parentId);

    const typeSelect = document.getElementById('client-establishment-type');
    const cnpjInput = document.getElementById('client-tax-id');
    const parentSelect = document.getElementById('client-parent-id');
    typeSelect?.addEventListener('change', () => updateHierarchyControls({ type: typeSelect.value, currentId: id }));
    parentSelect?.addEventListener('change', () => {
      if (!id && parentSelect.value) inheritMatrixGroup(parentSelect.value);
    });
    cnpjInput?.addEventListener('blur', () => {
      const value = digits(cnpjInput.value);
      if (value.length === 14) classifyCnpjOfficially(value, id);
      else updateHierarchyControls({ type: typeSelect?.value || 'matriz', currentId: id });
    });

    const consultButton = document.getElementById('client-cnpj-consult');
    consultButton?.addEventListener('click', () => {
      setTimeout(() => {
        const value = digits(cnpjInput?.value || '');
        if (value.length === 14) classifyCnpjOfficially(value, id);
      }, 350);
    });

    form.addEventListener('submit', event => {
      const type = document.getElementById('client-establishment-type')?.value || 'matriz';
      const parent = document.getElementById('client-parent-id')?.value || '';
      const currentCnpj = document.getElementById('client-tax-id')?.value || '';
      const root = cnpjRoot(currentCnpj);
      const message = document.getElementById('client-form-message');

      if (id && type === 'filial') {
        const original = clientCache.find(client => client.id === id);
        if (original && establishmentType(original) === 'matriz' && activeBranchesForMatrix(id, clientCache).length) {
          event.preventDefault();
          event.stopImmediatePropagation();
          if (message) {
            message.textContent = 'Matriz com filiais vinculadas não pode ser convertida em filial. Desvincule ou arquive as filiais antes de alterar o tipo de estabelecimento.';
            message.className = 'auth-message error span-2';
          }
          return;
        }
      }

      if (type === 'filial' && !parent) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (message) {
          message.textContent = 'Filial precisa estar vinculada a uma matriz cadastrada. Cadastre a matriz primeiro ou selecione a matriz correspondente.';
          message.className = 'auth-message error span-2';
        }
        return;
      }

      if (type === 'filial' && parent) {
        const matrix = clientCache.find(client => client.id === parent);
        const matrixRoot = matrix?.metadata?.cnpj_root || cnpjRoot(matrix?.tax_id);
        if (root && matrixRoot && root !== matrixRoot) {
          event.preventDefault();
          event.stopImmediatePropagation();
          if (message) {
            message.textContent = 'O CNPJ da filial não pertence à mesma raiz de CNPJ da matriz selecionada.';
            message.className = 'auth-message error span-2';
          }
          return;
        }
      }

      pendingHierarchy = {
        currentId: id,
        establishment_type: type,
        parent_client_id: type === 'filial' ? parent : null,
        cnpj_root: root || null
      };
    }, true);
  }

  window.addEventListener('atlas:client-saved', async event => {
    const clientId = event?.detail?.clientId;
    if (!clientId || !pendingHierarchy) return;
    const hierarchy = pendingHierarchy;
    pendingHierarchy = null;
    const db = typeof atlasDb === 'function' ? atlasDb() : null;
    if (!db) return;

    const current = await db.from('clients').select('metadata').eq('id', clientId).single();
    const metadata = {
      ...(current.data?.metadata || {}),
      establishment_type: hierarchy.establishment_type,
      parent_client_id: hierarchy.parent_client_id,
      cnpj_root: hierarchy.cnpj_root
    };
    const { error } = await db.from('clients').update({ metadata }).eq('id', clientId);
    if (error) {
      console.error('ATLAS V5.1: não foi possível persistir hierarquia da empresa', error);
      return;
    }
    clientCache = [];
    setTimeout(() => window.clientPage?.(), 0);
  });

  function rowClient(row, list) {
    const cells = [...row.querySelectorAll('td')];
    const tax = cells.map(cell => digits(cell.textContent || '')).find(value => value.length === 14) || '';
    const name = row.querySelector('td strong')?.textContent?.trim() || '';
    return list.find(client => tax && digits(client.tax_id) === tax) || list.find(client => client.legal_name === name) || null;
  }

  function ensureTypeBadge(row, type) {
    const first = row.querySelector('td');
    if (!first || first.querySelector('.company-establishment-badge')) return;
    first.insertAdjacentHTML('afterbegin', `<span class="company-establishment-badge ${type}">${type === 'filial' ? 'Filial' : 'Matriz'}</span>`);
  }

  function addBranchAction(row, matrixId) {
    if (row.querySelector('.company-add-branch') || typeof canEditOps !== 'function' || !canEditOps()) return;
    const actions = row.querySelector('.row-actions');
    if (!actions) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mini-btn company-add-branch';
    button.textContent = '+ Filial';
    button.addEventListener('click', () => window.openClientModal?.('', matrixId));
    actions.prepend(button);
  }

  async function decorateHierarchyRows() {
    const view = document.getElementById('company-list-view');
    if (!view || view.dataset.hierarchyBusy === '1') return;
    hierarchyObserver?.disconnect();
    view.dataset.hierarchyBusy = '1';
    try {
      const list = await loadClients(true);
      const normalized = list.map(client => normalizeClientHierarchy(client, list));
      const byId = new Map(normalized.map(client => [client.id, client]));
      const rows = [...view.querySelectorAll('tbody tr')];
      const rowById = new Map();

      for (const row of rows) {
        row.classList.remove('company-branch-row', 'company-matrix-row');
        row.querySelectorAll('.company-establishment-badge,.company-branch-parent,.company-branch-count,.company-add-branch').forEach(node => node.remove());
        const record = rowClient(row, normalized);
        if (!record) continue;
        row.dataset.clientId = record.id;
        rowById.set(record.id, row);
        ensureTypeBadge(row, record.establishment_type);
        if (record.establishment_type === 'filial') {
          row.classList.add('company-branch-row');
          const parent = byId.get(record.parent_client_id);
          const first = row.querySelector('td');
          if (first && parent) first.insertAdjacentHTML('beforeend', `<div class="company-branch-parent">↳ Filial de ${escHierarchy(parent.legal_name || parent.trade_name || 'Matriz')}</div>`);
        } else {
          row.classList.add('company-matrix-row');
          addBranchAction(row, record.id);
        }
      }

      for (const matrix of normalized.filter(client => client.establishment_type === 'matriz')) {
        const matrixRow = rowById.get(matrix.id);
        if (!matrixRow) continue;
        const branches = normalized.filter(client => client.establishment_type === 'filial' && client.parent_client_id === matrix.id);
        if (branches.length) {
          const first = matrixRow.querySelector('td');
          first?.insertAdjacentHTML('beforeend', `<div class="company-branch-count">${branches.length} ${branches.length === 1 ? 'filial vinculada' : 'filiais vinculadas'}</div>`);
        }
        let anchor = matrixRow;
        for (const branch of branches) {
          const branchRow = rowById.get(branch.id);
          if (!branchRow || branchRow.parentElement !== matrixRow.parentElement) continue;
          anchor.after(branchRow);
          anchor = branchRow;
        }
      }
    } finally {
      view.dataset.hierarchyBusy = '0';
      if (document.getElementById('company-list-view') === view) watchHierarchyList();
    }
  }

  function watchHierarchyList() {
    hierarchyObserver?.disconnect();
    const view = document.getElementById('company-list-view');
    if (!view) return;
    hierarchyObserver = new MutationObserver(() => {
      if (view.dataset.hierarchyBusy === '1') return;
      queueMicrotask(() => decorateHierarchyRows());
    });
    hierarchyObserver.observe(view, { childList: true, subtree: true });
  }

  function familyForCompany(current, list) {
    const normalized = list.map(client => normalizeClientHierarchy(client, list));
    const currentNormalized = normalized.find(client => client.id === current.id) || normalizeClientHierarchy(current, list);
    const matrixId = currentNormalized.establishment_type === 'filial' ? currentNormalized.parent_client_id : currentNormalized.id;
    const matrix = normalized.find(client => client.id === matrixId) || currentNormalized;
    const branches = normalized.filter(client => client.establishment_type === 'filial' && client.parent_client_id === matrix.id);
    return { matrix, branches, members: [matrix, ...branches] };
  }

  async function injectCompanyFamily(clientId) {
    const grid = document.querySelector('#company-360-backdrop .company-360-grid');
    if (!grid || grid.querySelector('.company-360-family')) return;
    const db = typeof atlasDb === 'function' ? atlasDb() : null;
    if (!db) return;
    const [currentRes, clients] = await Promise.all([
      db.from('clients').select('id,legal_name,trade_name,tax_id,city,state,metadata').eq('id', clientId).single(),
      loadClients(true)
    ]);
    if (currentRes.error || !currentRes.data) return;
    const companyFamily = familyForCompany(currentRes.data, clients);
    const rows = companyFamily.members.map(member => {
      const type = member.id === companyFamily.matrix.id ? 'Matriz' : 'Filial';
      return `<tr class="${member.id === clientId ? 'is-current' : ''}"><td><span class="company-establishment-badge ${type.toLowerCase()}">${type}</span></td><td><strong>${escHierarchy(member.legal_name || member.trade_name || 'Empresa')}</strong></td><td>${escHierarchy(member.tax_id || '—')}</td><td>${escHierarchy([member.city, member.state].filter(Boolean).join('/') || '—')}</td><td><button type="button" class="mini-btn" onclick="openCompany360V51Member('${escHierarchy(member.id)}')">Abrir</button></td></tr>`;
    }).join('');
    const history = grid.querySelector('.company-360-history');
    const section = document.createElement('section');
    section.className = 'company-360-section span-2 company-360-family';
    section.innerHTML = `<div class="company-360-section-head"><h3>Matriz e filiais</h3><span>${companyFamily.branches.length} ${companyFamily.branches.length === 1 ? 'filial' : 'filiais'}</span></div><div class="company-360-table-wrap"><table><thead><tr><th>Tipo</th><th>Estabelecimento</th><th>CNPJ</th><th>Cidade/UF</th><th>Ação</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    if (history) grid.insertBefore(section, history); else grid.appendChild(section);
  }

  window.openCompany360V51Member = function(clientId) {
    window.closeCompany360V5?.();
    window.openCompany360V5?.(clientId);
  };

  window.AtlasCompanyHierarchyV51 = {
    cnpjRoot,
    establishmentTypeFromPayload,
    establishmentType,
    normalizeClientHierarchy,
    activeBranchesForMatrix,
    effectiveGroupId,
    familyForCompany
  };

  if (typeof previousOpenClientModal === 'function') {
    window.openClientModal = async function(id = '', parentId = '') {
      const result = await previousOpenClientModal(id);
      await injectHierarchyFields(id, parentId);
      return result;
    };
  }

  if (typeof previousClientPage === 'function') {
    window.clientPage = async function(...args) {
      const result = await previousClientPage(...args);
      await decorateHierarchyRows();
      watchHierarchyList();
      return result;
    };
  }

  if (typeof previousOpenCompany360 === 'function') {
    window.openCompany360V5 = async function(clientId) {
      const result = await previousOpenCompany360(clientId);
      await injectCompanyFamily(clientId);
      return result;
    };
  }

  if (typeof previousArchiveClient === 'function') {
    window.archiveClient = async function(id) {
      const list = await loadClients(true);
      const record = list.find(client => client.id === id);
      if (record && establishmentType(record) === 'matriz') {
        const branches = activeBranchesForMatrix(id, list);
        if (branches.length) {
          alert(`Não é possível arquivar a matriz enquanto houver filiais ativas vinculadas (${branches.length}). Arquive ou desvincule as filiais primeiro.`);
          return;
        }
      }
      return previousArchiveClient(id);
    };
    window.deleteClient = window.archiveClient;
  }
})();