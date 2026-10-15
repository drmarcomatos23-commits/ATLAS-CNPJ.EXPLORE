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
  const KPI_DEFINITIONS = [
    { key:'companies', label:'Empresas', action:'Ver todas', kind:'companies', icon:'▥', tone:'blue' },
    { key:'activeProcesses', label:'Processos em andamento', action:'Ver processos', kind:'processes', icon:'▤', tone:'blue' },
    { key:'expiringLicenses', label:'Licenças vencendo', action:'Ver licenças', kind:'licenses', icon:'◇', tone:'orange' },
    { key:'monthlyHonoraria', label:'Honorários (mês)', action:'Ver financeiro', kind:'financial', icon:'◎', tone:'cyan', currency:true },
    { key:'pending', label:'Pendências', action:'Ver pendências', kind:'pending', icon:'△', tone:'red' },
    { key:'documents', label:'Documentos', action:'Ver documentos', kind:'documents', icon:'□', tone:'blue' }
  ];

  function arr(value) { return Array.isArray(value) ? value : []; }
  function text(value) { return String(value ?? '').trim(); }
  function norm(value) { return text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  function esc(value) { return text(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
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
    for (const key of keys) if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
    return fallback;
  }
  function statusLabel(raw) {
    const s = norm(raw);
    if (!s) return 'Em andamento';
    if (s.includes('conclu') || s.includes('finaliz') || s === 'done' || s === 'completed') return 'Concluídos';
    if (s.includes('cancel')) return 'Cancelados';
    if (s.includes('aguard') || s.includes('pendente') || s === 'pending') return 'Aguardando';
    if (s.includes('analise') || s.includes('review')) return 'Em análise';
    return 'Em andamento';
  }
  function isActiveProcess(process) {
    const label = statusLabel(pick(process, ['status', 'process_status', 'state']));
    return label !== 'Concluídos' && label !== 'Cancelados';
  }
  function stageFor(process) {
    const candidate = pick(process, ['stage_name', 'current_stage_name', 'stage', 'current_stage', 'step', 'etapa', 'phase', 'status_stage']);
    const raw = norm(typeof candidate === 'object' ? pick(candidate, ['name','label','title']) : candidate);
    if (!raw) return null;
    return PIPELINE_STAGES.find(stage => stage.match.some(token => raw.includes(norm(token)))) || null;
  }
  function companyNameMap(companies) {
    const map = new Map();
    for (const company of companies) map.set(String(pick(company, ['id', 'client_id', 'company_id'])), text(pick(company, ['legal_name', 'name', 'trade_name', 'razao_social'], 'Empresa')));
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
  function financialDate(record) { return dateValue(pick(record, ['payment_date', 'paid_at', 'date', 'due_date', 'competence_date', 'created_at'])); }
  function recordAmount(record) { return number(pick(record, ['amount', 'value', 'total', 'honoraria', 'fee_amount'], 0)); }
  function isSameMonth(date, now) { return !!date && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth(); }
  function licenseDeadline(license) { return dateValue(pick(license, ['final_date', 'expiration_date', 'expires_at', 'due_date', 'valid_until', 'vencimento'])); }
  function processUpdatedAt(process) { return dateValue(pick(process, ['updated_at', 'last_update', 'modified_at', 'updatedAt', 'created_at'])); }
  function companyType(company) { return text(pick(company, ['legal_nature', 'company_type', 'type', 'natureza_juridica', 'legal_type'], 'Outros')) || 'Outros'; }

  function buildModel(sourceState = {}) {
    const companies = arr(sourceState.companies || sourceState.clients);
    const processes = arr(sourceState.processes);
    const licenses = arr(sourceState.licenses);
    const costs = arr(sourceState.costs || sourceState.financial || sourceState.finances);
    const pending = arr(sourceState.pending || sourceState.requirements || sourceState.exigencias);
    const documents = arr(sourceState.documents);
    const now = dateValue(sourceState.now) || new Date();
    const companiesById = companyNameMap(companies);

    const deadlines = licenses.map(license => ({
      ...license,
      id: pick(license, ['id']),
      companyName: companyName(companiesById, license),
      label: text(pick(license, ['name', 'license_type', 'type', 'title'], 'Licença')),
      finalDate: licenseDeadline(license)
    })).filter(item => item.finalDate).sort((a, b) => a.finalDate - b.finalDate);

    const expiringLicenses = deadlines.filter(item => {
      const delta = item.finalDate.getTime() - now.getTime();
      return delta >= 0 && delta <= 30 * 24 * 60 * 60 * 1000;
    }).length;

    const monthlyHonoraria = costs.filter(isHonoraria).filter(record => isSameMonth(financialDate(record), now)).reduce((sum, record) => sum + recordAmount(record), 0);

    const pipeline = PIPELINE_STAGES.map(stage => ({
      key: stage.key,
      label: stage.label,
      count: processes.filter(process => stageFor(process)?.key === stage.key).length
    }));

    const recentProcesses = processes.map(process => ({
      ...process,
      id: pick(process, ['id']),
      companyName: companyName(companiesById, process),
      title: text(pick(process, ['title', 'service', 'type', 'process_type'], 'Processo')),
      statusLabel: statusLabel(pick(process, ['status', 'process_status', 'state'])),
      updatedDate: processUpdatedAt(process)
    })).sort((a, b) => (b.updatedDate?.getTime() || 0) - (a.updatedDate?.getTime() || 0));

    const statusCounts = new Map(STATUS_ORDER.map(label => [label, 0]));
    for (const process of processes) {
      const label = statusLabel(pick(process, ['status', 'process_status', 'state']));
      statusCounts.set(label, (statusCounts.get(label) || 0) + 1);
    }
    const statusDistribution = processes.length ? STATUS_ORDER.map(label => ({ label, count: statusCounts.get(label) || 0 })).filter(item => item.count > 0) : [];

    const typeCounts = new Map();
    for (const company of companies) {
      const label = companyType(company);
      typeCounts.set(label, (typeCounts.get(label) || 0) + 1);
    }
    const companyTypes = [...typeCounts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pt-BR'));
    const pendingCount = Number.isFinite(Number(sourceState.pendingCount)) ? Number(sourceState.pendingCount) : pending.length;

    return {
      kpis: {
        companies: companies.length,
        activeProcesses: processes.filter(isActiveProcess).length,
        expiringLicenses,
        monthlyHonoraria,
        pending: pendingCount,
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
    const target = globalThis.document?.querySelector?.(`#nav .nav-item[data-page="${page}"]`);
    if (target && typeof target.click === 'function') { target.click(); return true; }
    return false;
  }
  function routeTo(target = {}) {
    if (target.kind === 'company' && target.id && typeof globalThis.openCompany360V5 === 'function') { globalThis.openCompany360V5(target.id); return true; }
    if (target.kind === 'process' && target.id && typeof globalThis.openAtlasV4Process === 'function') { globalThis.openAtlasV4Process(target.id); return true; }
    const page = target.page || ({ companies: 'clientes', processes: 'processos', licenses: 'licencas', financial: 'custos', documents: 'documentos', pending: 'exigencias' })[target.kind];
    return page ? clickExistingNav(page) : false;
  }

  function formatCurrency(value) { return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(number(value)); }
  function formatDate(value) { const d=dateValue(value); return d ? d.toLocaleDateString('pt-BR') : '—'; }
  function daysUntil(date, now = new Date()) { return Math.ceil((date.getTime() - now.getTime()) / 86400000); }
  function deadlineUrgency(date, now = new Date()) { const d=daysUntil(date,now); return d <= 7 ? 'critical' : d <= 20 ? 'warn' : 'normal'; }
  function deadlineText(date, now = new Date()) {
    const d=daysUntil(date,now);
    if (d < 0) return `Vencida há ${Math.abs(d)} dia${Math.abs(d)===1?'':'s'}`;
    if (d === 0) return 'Vence hoje';
    return `Vence em ${d} dia${d===1?'':'s'}`;
  }
  function percentage(value,total){ return total ? Math.round(value/total*100) : 0; }
  function roleCanViewFinancial() {
    const role = globalThis.atlasCurrentProfile?.role || 'cliente';
    const sections = globalThis.AtlasV4Dashboard?.sectionsForRole?.(role);
    return sections ? !!sections.financial : ['admin','operacao','financeiro','auditoria'].includes(role);
  }

  function kpiHtml(model) {
    return KPI_DEFINITIONS.map(def => {
      const restricted = def.key === 'monthlyHonoraria' && !roleCanViewFinancial();
      const raw = model.kpis[def.key];
      const value = restricted ? '—' : def.currency ? formatCurrency(raw) : new Intl.NumberFormat('pt-BR').format(raw || 0);
      const action = restricted ? 'Acesso restrito' : def.action;
      return `<button type="button" class="v6-kpi-card" data-v6-route="${def.kind}" data-tone="${def.tone}" ${restricted?'disabled':''}><span class="v6-kpi-icon" aria-hidden="true">${def.icon}</span><span class="v6-kpi-label">${def.label}</span><strong class="v6-kpi-value">${esc(value)}</strong><span class="v6-kpi-action">${action}</span></button>`;
    }).join('');
  }
  function pipelineHtml(model) {
    const max = Math.max(...model.pipeline.map(x=>x.count),1);
    const icons=['⌕','▤','⌂','▤','◇','✓'];
    return `<section class="v6-panel v6-pipeline-panel"><div class="v6-panel-head"><div><h2>PIPELINE DE PROCESSOS</h2><p>Acompanhe o andamento das etapas de legalização e regularização.</p></div><button type="button" class="v6-panel-link" data-v6-route="processes">Ver todos os processos →</button></div><div class="v6-pipeline-wrap"><div class="v6-pipeline-track">${model.pipeline.map((stage,i)=>`<button type="button" class="v6-pipeline-stage" data-v6-stage="${stage.key}"><span class="v6-stage-icon" aria-hidden="true">${icons[i]}</span><strong>${i+1}. ${esc(stage.label)}</strong></button>`).join('')}</div><div class="v6-pipeline-counts">${model.pipeline.map(stage=>`<div class="v6-pipeline-count"><b>${stage.count}</b><span>processos</span><div class="v6-mini-bar"><i style="width:${Math.round(stage.count/max*100)}%"></i></div></div>`).join('')}</div></div></section>`;
  }
  function recentHtml(model) {
    const rows=model.recentProcesses.slice(0,5);
    return `<section class="v6-panel"><div class="v6-panel-head"><div><h2>PROCESSOS RECENTES</h2><p>Últimos processos atualizados no sistema.</p></div><button type="button" class="v6-panel-link" data-v6-route="processes">Ver todos →</button></div><div class="v6-recent-list">${rows.length?rows.map(row=>`<button type="button" class="v6-recent-row" data-v6-process="${esc(row.id)}"><span class="v6-row-icon" aria-hidden="true">▤</span><span class="v6-row-main"><strong>${esc(row.companyName||'Empresa')}</strong><small>${esc(row.title)}</small></span><span class="v6-status-pill" data-status="${esc(row.statusLabel)}">${esc(row.statusLabel)}</span><span class="v6-row-date">${formatDate(row.updatedDate)}</span></button>`).join(''):'<div class="v6-empty">Nenhum processo disponível.</div>'}</div></section>`;
  }
  function statusHtml(model) {
    const total=model.statusDistribution.reduce((s,x)=>s+x.count,0);
    const cumulative=[]; let acc=0;
    for(const item of model.statusDistribution){acc+=percentage(item.count,total);cumulative.push(acc);}
    const a=cumulative[0]||0,b=cumulative[1]||a;
    return `<section class="v6-panel"><div class="v6-panel-head"><div><h2>PROCESSOS POR SITUAÇÃO</h2><p>Distribuição dos processos no momento.</p></div></div><div class="v6-chart-body"><div style="position:relative"><div class="v6-donut" style="--v6-a:${a};--v6-b:${b}"></div><div class="v6-donut-center"><b>${total}</b><span>processos</span></div></div><div class="v6-chart-legend">${model.statusDistribution.length?model.statusDistribution.map((item,i)=>`<div><i style="opacity:${1-i*.1}"></i><span>${esc(item.label)}</span><b>${item.count} &nbsp; ${percentage(item.count,total)}%</b></div>`).join(''):'<div><span>Sem processos cadastrados.</span></div>'}</div></div></section>`;
  }
  function companyTypesHtml(model) {
    const items=model.companyTypes.slice(0,5), max=Math.max(...items.map(x=>x.count),1);
    return `<section class="v6-panel"><div class="v6-panel-head"><div><h2>EMPRESAS POR TIPO</h2><p>Total de empresas gerenciadas por natureza jurídica.</p></div></div>${items.length?`<div class="v6-bar-chart">${items.map(item=>`<div class="v6-bar-item"><b>${item.count}</b><div class="v6-bar"><i style="height:${Math.max(4,Math.round(item.count/max*100))}%"></i></div><span>${esc(item.label)}</span></div>`).join('')}</div>`:'<div class="v6-empty">Nenhuma empresa cadastrada.</div>'}</section>`;
  }
  function deadlinesHtml(model, now=new Date()) {
    const rows=model.deadlines.slice(0,5);
    return `<section class="v6-panel"><div class="v6-panel-head"><div><h2>PRÓXIMOS PRAZOS</h2><p>Licenças e obrigações com vencimento próximo.</p></div><button type="button" class="v6-panel-link" data-v6-route="licenses">Ver todos →</button></div><div class="v6-deadline-list">${rows.length?rows.map(row=>`<button type="button" class="v6-deadline-row" data-v6-route="licenses"><span class="v6-row-icon" aria-hidden="true">◇</span><span class="v6-row-main"><strong>${esc(row.label)}</strong><small>${esc(row.companyName||'Empresa')}</small></span><span class="v6-deadline-pill" data-urgency="${deadlineUrgency(row.finalDate,now)}">${deadlineText(row.finalDate,now)}</span><span class="v6-row-date">${formatDate(row.finalDate)}</span></button>`).join(''):'<div class="v6-empty">Nenhum prazo cadastrado.</div>'}</div></section>`;
  }
  function dashboardHtml(model, now=new Date()) {
    return `<div class="v6-dashboard"><section class="v6-dashboard-hero"><div class="v6-dashboard-hero-main"><img class="v6-dashboard-hero-logo" src="/atlas-dashboard-brand.svg?v=4.2" alt="ATLAS Legalização e Gerenciamento"><div class="v6-dashboard-hero-copy"><span class="v6-kicker">BEM-VINDO AO</span><h1>ATLAS</h1><span class="v6-hero-subtitle">LEGALIZAÇÃO E GERENCIAMENTO</span><div class="v6-orange-line"></div><p>Gestão empresarial completa, com abertura, alterações, licenças e regularização, em um só lugar.</p></div></div><div class="v6-dashboard-services" aria-label="Serviços"><span>ABERTURA</span><span>ALTERAÇÕES</span><span>LICENÇAS</span><span>REGULARIZAÇÃO</span><span>GESTÃO EMPRESARIAL</span></div><span class="v6-hero-art" aria-hidden="true" data-hero-asset="/assets/atlas-legalizacao-hero-v6.svg"></span></section><div class="v6-dashboard-body"><div class="v6-kpi-grid">${kpiHtml(model)}</div><div class="v6-dashboard-main-grid">${pipelineHtml(model)}${recentHtml(model)}</div><div class="v6-dashboard-bottom-grid">${statusHtml(model)}${companyTypesHtml(model)}${deadlinesHtml(model,now)}</div></div></div>`;
  }

  function setPageHtml(html) {
    if (typeof globalThis.page === 'function') { globalThis.page(html); return true; }
    const root=globalThis.document?.getElementById?.('page-content');
    if (root) { root.innerHTML=html; return true; }
    return false;
  }
  function pendingCountFromExisting(data) {
    const summary=globalThis.AtlasV4Core?.buildPendingSummary?.(data);
    return summary ? Object.values(summary).reduce((sum,value)=>sum+(Number(value)||0),0) : arr(data.pending||data.requirements||data.exigencias).length;
  }
  function bindDashboardEvents(root) {
    if (!root?.addEventListener || root.dataset.v6Bound==='true') return;
    root.dataset.v6Bound='true';
    root.addEventListener('click', event => {
      const process=event.target.closest?.('[data-v6-process]');
      if(process){ routeTo({kind:'process',id:process.dataset.v6Process}); return; }
      const stage=event.target.closest?.('[data-v6-stage]');
      if(stage){ globalThis.atlasV6ProcessStageFilter=stage.dataset.v6Stage; routeTo({kind:'processes'}); return; }
      const route=event.target.closest?.('[data-v6-route]');
      if(route && !route.disabled) routeTo({kind:route.dataset.v6Route});
    });
  }
  async function render(sourceState) {
    if (typeof globalThis.setHead === 'function') globalThis.setHead('Dashboard','VISÃO GERAL','');
    const raw=sourceState || (typeof globalThis.loadOperationalData === 'function' ? await globalThis.loadOperationalData() : {});
    const processes=typeof globalThis.decorateProcesses === 'function' ? globalThis.decorateProcesses(raw) : arr(raw.processes);
    const state={...raw,companies:raw.companies||raw.clients||[],processes,pendingCount:pendingCountFromExisting({...raw,processes}),now:new Date()};
    const model=buildModel(state);
    setPageHtml(dashboardHtml(model,state.now));
    const root=globalThis.document?.querySelector?.('#page-content .v6-dashboard');
    bindDashboardEvents(root);
    globalThis.document?.getElementById?.('app-shell')?.setAttribute?.('data-v6-page','dashboard');
    return model;
  }
  async function dashboardEntry(){
    try { return await render(); }
    catch(error){
      console.error('ATLAS V6 Dashboard:',error);
      if(typeof globalThis.dashboardV4Fallback==='function') return globalThis.dashboardV4Fallback();
      setPageHtml('<div class="v6-empty">Não foi possível carregar o Dashboard. Tente novamente.</div>');
      return null;
    }
  }
  function installDashboardOverride(){
    if(typeof globalThis.dashboard === 'function' && !globalThis.dashboardV4Fallback) globalThis.dashboardV4Fallback=globalThis.dashboard;
    globalThis.dashboard=dashboardEntry;
  }

  globalThis.AtlasDashboardV6 = {
    PIPELINE_STAGES: PIPELINE_STAGES.map(({ key, label }) => ({ key, label })),
    KPI_DEFINITIONS: KPI_DEFINITIONS.map(({key,label,kind})=>({key,label,kind})),
    buildModel,
    routeTo,
    dashboardHtml,
    render,
    installDashboardOverride
  };

  if (globalThis.document?.readyState === 'loading') globalThis.document.addEventListener?.('DOMContentLoaded', installDashboardOverride, { once:true });
  else installDashboardOverride();
})();
