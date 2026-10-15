(() => {
  const PIPELINE_STAGES = [
    { key: 'viabilidade', label: 'Consulta de Viabilidade', match: ['consulta de viabilidade', 'viabilidade'] },
    { key: 'dbe', label: 'DBE / Receita Federal', match: ['dbe', 'receita federal', 'coletor'] },
    { key: 'junta', label: 'Junta Comercial', match: ['junta comercial', 'junta', 'integrador estadual'] },
    { key: 'alvara', label: 'Alvará Municipal', match: ['alvara municipal', 'alvará municipal', 'alvara', 'alvará'] },
    { key: 'licencas', label: 'Licenças / Órgãos Reguladores', match: ['licencas', 'licenças', 'licenca', 'licença', 'orgaos reguladores', 'órgãos reguladores', 'anvisa', 'avcb'] },
    { key: 'pos', label: 'Pós-abertura / Regularização', match: ['pos-abertura', 'pós-abertura', 'pos abertura', 'pós abertura', 'regularizacao', 'regularização'] }
  ];

  const STATUS_ORDER = ['Em andamento', 'Concluídos', 'Aguardando', 'Em análise', 'Cancelados'];

  function arr(value) { return Array.isArray(value) ? value : []; }
  function text(value) { return String(value ?? '').trim(); }
  function norm(value) {
    return text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }
  function number(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const cleaned = value.replace(/[^0-9,.-]/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
      const parsed = Number(cleaned);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }
  function dateValue(value) {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  function pick(obj, keys, fallback = '') {
    for (const key of keys) {
      if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
    }
    return fallback;
  }
  function statusLabel(raw) {
    const s = norm(raw);
    if (!s) return 'Em andamento';
    if (s.includes('conclu') || s.includes('finaliz') || s === 'done') return 'Concluídos';
    if (s.includes('cancel')) return 'Cancelados';
    if (s.includes('aguard') || s.includes('pendente') || s === 'pending') return 'Aguardando';
    if (s.includes('analise') || s.includes('análise') || s.includes('review')) return 'Em análise';
    return 'Em andamento';
  }
  function isActiveProcess(process) {
    const label = statusLabel(pick(process, ['status', 'process_status', 'state']));
    return label !== 'Concluídos' && label !== 'Cancelados';
  }
  function stageFor(process) {
    const raw = norm(pick(process, ['stage', 'current_stage', 'step', 'etapa', 'phase', 'status_stage']));
    if (!raw) return null;
    return PIPELINE_STAGES.find(stage => stage.match.some(token => raw.includes(norm(token)))) || null;
  }
  function companyNameMap(companies) {
    const map = new Map();
    for (const company of companies) {
      map.set(String(pick(company, ['id', 'client_id', 'company_id'])), text(pick(company, ['legal_name', 'name', 'trade_name', 'razao_social'], 'Empresa')));
    }
    return map;
  }
  function companyName(companyMap, record) {
    const id = String(pick(record, ['client_id', 'company_id', 'empresa_id'], ''));
    return companyMap.get(id) || text(pick(record, ['company_name', 'client_name', 'empresa', 'legal_name'], ''));
  }
  function isHonoraria(record) {
    const category = norm([pick(record, ['type']), pick(record, ['category']), pick(record, ['kind']), pick(record, ['description'])].filter(Boolean).join(' '));
    return category.includes('honor');
  }
  function financialDate(record) {
    return dateValue(pick(record, ['payment_date', 'paid_at', 'date', 'due_date', 'competence_date', 'created_at']));
  }
  function recordAmount(record) {
    return number(pick(record, ['amount', 'value', 'total', 'honoraria', 'fee_amount'], 0));
  }
  function isSameMonth(date, now) {
    return !!date && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }
  function licenseDeadline(license) {
    return dateValue(pick(license, ['final_date', 'expiration_date', 'expires_at', 'due_date', 'valid_until', 'vencimento']));
  }
  function processUpdatedAt(process) {
    return dateValue(pick(process, ['updated_at', 'last_update', 'modified_at', 'updatedAt', 'created_at']));
  }
  function companyType(company) {
    return text(pick(company, ['legal_nature', 'company_type', 'type', 'natureza_juridica', 'legal_type'], 'Outros')) || 'Outros';
  }
  function buildModel(sourceState = {}) {
    const companies = arr(sourceState.companies || sourceState.clients);
    const processes = arr(sourceState.processes);
    const licenses = arr(sourceState.licenses);
    const costs = arr(sourceState.costs || sourceState.financial || sourceState.finances);
    const pending = arr(sourceState.pending || sourceState.requirements || sourceState.exigencias);
    const documents = arr(sourceState.documents);
    const now = dateValue(sourceState.now) || new Date();
    const companiesById = companyNameMap(companies);

    const deadlines = licenses
      .map(license => ({
        ...license,
        id: pick(license, ['id']),
        companyName: companyName(companiesById, license),
        label: text(pick(license, ['name', 'license_type', 'type', 'title'], 'Licença')),
        finalDate: licenseDeadline(license)
      }))
      .filter(item => item.finalDate)
      .sort((a, b) => a.finalDate - b.finalDate);

    const expiringLicenses = deadlines.filter(item => {
      const delta = item.finalDate.getTime() - now.getTime();
      return delta >= 0 && delta <= 30 * 24 * 60 * 60 * 1000;
    }).length;

    const monthlyHonoraria = costs
      .filter(isHonoraria)
      .filter(record => isSameMonth(financialDate(record), now))
      .reduce((sum, record) => sum + recordAmount(record), 0);

    const pipeline = PIPELINE_STAGES.map(stage => ({
      key: stage.key,
      label: stage.label,
      count: processes.filter(process => stageFor(process)?.key === stage.key).length
    }));

    const recentProcesses = processes
      .map(process => ({
        ...process,
        id: pick(process, ['id']),
        companyName: companyName(companiesById, process),
        title: text(pick(process, ['title', 'service', 'type', 'process_type'], 'Processo')),
        statusLabel: statusLabel(pick(process, ['status', 'process_status', 'state'])),
        updatedDate: processUpdatedAt(process)
      }))
      .sort((a, b) => (b.updatedDate?.getTime() || 0) - (a.updatedDate?.getTime() || 0));

    const statusCounts = new Map(STATUS_ORDER.map(label => [label, 0]));
    for (const process of processes) {
      const label = statusLabel(pick(process, ['status', 'process_status', 'state']));
      statusCounts.set(label, (statusCounts.get(label) || 0) + 1);
    }
    const statusDistribution = processes.length
      ? STATUS_ORDER.map(label => ({ label, count: statusCounts.get(label) || 0 })).filter(item => item.count > 0)
      : [];

    const typeCounts = new Map();
    for (const company of companies) {
      const label = companyType(company);
      typeCounts.set(label, (typeCounts.get(label) || 0) + 1);
    }
    const companyTypes = [...typeCounts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pt-BR'));

    return {
      kpis: {
        companies: companies.length,
        activeProcesses: processes.filter(isActiveProcess).length,
        expiringLicenses,
        monthlyHonoraria,
        pending: pending.length,
        documents: documents.length
      },
      pipeline,
      recentProcesses,
      statusDistribution,
      companyTypes,
      deadlines
    };
  }

  function clickExistingNav(page) {
    const selector = `#nav .nav-item[data-page="${page}"]`;
    const target = globalThis.document?.querySelector?.(selector);
    if (target && typeof target.click === 'function') {
      target.click();
      return true;
    }
    return false;
  }

  function routeTo(target = {}) {
    if (target.kind === 'company' && target.id && typeof globalThis.openCompany360V5 === 'function') {
      globalThis.openCompany360V5(target.id);
      return true;
    }
    if (target.kind === 'process' && target.id && typeof globalThis.openAtlasV4Process === 'function') {
      globalThis.openAtlasV4Process(target.id);
      return true;
    }
    const page = target.page || ({ companies: 'clientes', processes: 'processos', licenses: 'licencas', financial: 'custos', documents: 'documentos', pending: 'exigencias' })[target.kind];
    return page ? clickExistingNav(page) : false;
  }

  function render() {
    // Visual renderer is introduced in Task 4. Keeping this callable now gives
    // the data adapter a stable interface without duplicating legacy rendering.
    return false;
  }

  globalThis.AtlasDashboardV6 = {
    PIPELINE_STAGES: PIPELINE_STAGES.map(({ key, label }) => ({ key, label })),
    buildModel,
    routeTo,
    render
  };
})();
