(() => {
  const MOCK_KPIS = {
    companies: 142,
    activeProcesses: 86,
    expiringLicenses: 12,
    monthlyHonoraria: 48750,
    pending: 27,
    documents: 1284
  };
  const MOCK_PIPELINE = [32, 28, 24, 18, 16, 21];
  const MOCK_RECENT = [
    ['Tech Solutions Ltda','Abertura de empresa','Em andamento','22/04/2025'],
    ['Restaurante Bom Sabor','Alvará de funcionamento','Aguardando','21/04/2025'],
    ['Construtora Horizonte','Renovação de licença ambiental','Em análise','20/04/2025'],
    ['Clínica Vida Plena','Alteração contratual','Concluído','19/04/2025'],
    ['Logística Express','Licença sanitária','Em andamento','18/04/2025']
  ];
  const MOCK_STATUS = [
    ['Em andamento',42,49],['Concluídos',18,21],['Aguardando',14,16],['Em análise',8,9],['Cancelados',4,5]
  ];
  const MOCK_TYPES = [['LTDA',68],['S/A',24],['MEI',18],['EIRELI',16],['Outros',12]];
  const MOCK_DEADLINES = [
    ['Licença Sanitária','Clínica Vida Plena','Vence em 7 dias','28/04/2025','critical'],
    ['Alvará de Funcionamento','Restaurante Bom Sabor','Vence em 15 dias','06/05/2025','warn'],
    ['Licença Ambiental','Construtora Horizonte','Vence em 22 dias','13/05/2025','warn'],
    ['Renovação de CLCB','Comércio Alfa','Vence em 28 dias','19/05/2025','normal']
  ];

  const svg = paths => `<svg data-atlas-icon viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const ICONS = {
    company: svg('<path d="M4 21V7l8-4 8 4v14"/><path d="M8 10h1M12 10h1M16 10h1M8 14h1M12 14h1M16 14h1M10 21v-4h4v4"/>'),
    document: svg('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 12h6M9 16h6"/>'),
    shield: svg('<path d="M12 3 19 6v5c0 4.6-2.7 8-7 10-4.3-2-7-5.4-7-10V6z"/><path d="m9 12 2 2 4-4"/>'),
    coins: svg('<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v5c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 11v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/>'),
    alert: svg('<path d="M12 3 2.8 20h18.4z"/><path d="M12 9v5M12 17h.01"/>'),
    folder: svg('<path d="M3 7h7l2 2h9v10H3z"/>'),
    search: svg('<circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/>'),
    bank: svg('<path d="M3 9h18L12 3zM5 10v7M9 10v7M15 10v7M19 10v7M3 20h18"/>'),
    check: svg('<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>'),
    flow: svg('<circle cx="12" cy="4" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M12 6v5M5 17v-3h14v3M12 11v3"/>'),
    clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    chart: svg('<path d="M4 20V10M9 20V5M14 20v-8M19 20V3"/>'),
    calendar: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>')
  };

  function esc(value='') { return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  function num(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
  function formatNumber(value) { return new Intl.NumberFormat('pt-BR').format(num(value)); }
  function formatCurrency(value) { return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(num(value)); }
  function formatDate(value) { const d=value instanceof Date?value:new Date(value); return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('pt-BR'); }
  function useMockOnlyWhenMissing(realValue, mockValue, hasRealSource) { return hasRealSource ? realValue : mockValue; }

  function hasOwnAny(obj, keys) { return keys.some(key => Object.prototype.hasOwnProperty.call(obj || {}, key)); }
  function sourceFlags(raw={}) {
    return {
      companies: hasOwnAny(raw,['companies','clients']),
      processes: hasOwnAny(raw,['processes']),
      licenses: hasOwnAny(raw,['licenses']),
      finance: hasOwnAny(raw,['costs','financial','finances']),
      pending: hasOwnAny(raw,['pending','requirements','exigencias']),
      documents: hasOwnAny(raw,['documents'])
    };
  }

  function dateDaysLabel(value, now=new Date()) {
    const d=value instanceof Date?value:new Date(value);
    if(Number.isNaN(d.getTime())) return 'Prazo';
    const days=Math.ceil((d-now)/86400000);
    if(days<0) return `Vencida há ${Math.abs(days)} dias`;
    if(days===0) return 'Vence hoje';
    return `Vence em ${days} dias`;
  }
  function urgency(value, now=new Date()) {
    const d=value instanceof Date?value:new Date(value); if(Number.isNaN(d.getTime())) return 'normal';
    const days=Math.ceil((d-now)/86400000); return days<=7?'critical':days<=22?'warn':'normal';
  }
  function statusKey(label='') {
    const s=String(label).toLowerCase();
    if(s.includes('conclu')) return 'done';
    if(s.includes('aguard')) return 'waiting';
    if(s.includes('análise')||s.includes('analise')) return 'analysis';
    return 'progress';
  }

  const KPI_META = [
    ['companies','Empresas','+8%','Ver todas','company','blue'],
    ['activeProcesses','Processos em andamento','+12%','Ver processos','document','blue'],
    ['expiringLicenses','Licenças vencendo','+33%','Ver licenças','shield','orange'],
    ['monthlyHonoraria','Honorários (mês)','+18%','Ver financeiro','coins','cyan'],
    ['pending','Pendências','+17%','Ver pendências','alert','red'],
    ['documents','Documentos','+21%','Ver documentos','folder','blue']
  ];

  function kpisHtml(model, flags) {
    const sourceByKey={companies:flags.companies,activeProcesses:flags.processes,expiringLicenses:flags.licenses,monthlyHonoraria:flags.finance,pending:flags.pending,documents:flags.documents};
    return KPI_META.map(([key,label,trend,action,icon,tone])=>{
      const value=useMockOnlyWhenMissing(model.kpis[key],MOCK_KPIS[key],sourceByKey[key]);
      const display=key==='monthlyHonoraria'?formatCurrency(value):formatNumber(value);
      return `<button class="atlas-kpi" data-tone="${tone}" data-v6-route="${key==='companies'?'companies':key==='activeProcesses'?'processes':key==='expiringLicenses'?'licenses':key==='monthlyHonoraria'?'financial':key==='pending'?'pending':'documents'}" type="button"><span class="atlas-kpi-icon">${ICONS[icon]}</span><span class="atlas-kpi-copy"><small>${label}</small><strong>${display}</strong><em class="${tone==='orange'||tone==='red'?'warm':''}">▲ ${trend}</em><span>${action} →</span></span></button>`;
    }).join('');
  }

  function pipelineHtml(model, flags) {
    const labels=['Consulta de viabilidade','DBE – Receita Federal','Junta Comercial','Alvará Municipal','Licenças – Órgãos Reguladores','Pós-abertura – Regularização'];
    const icons=[ICONS.search,ICONS.document,ICONS.bank,ICONS.document,ICONS.shield,ICONS.check];
    const real=model.pipeline.map(x=>num(x.count));
    const counts=flags.processes?real:MOCK_PIPELINE;
    const max=Math.max(...counts,1);
    return `<section class="atlas-card atlas-pipeline"><header><div class="atlas-heading-icon">${ICONS.flow}</div><div><h2>PIPELINE DE PROCESSOS</h2><p>Acompanhe o andamento das etapas de legalização e regularização.</p></div><button data-v6-route="processes">Ver todos os processos →</button></header><div class="atlas-pipeline-track">${labels.map((label,i)=>`<button class="atlas-stage s${i+1}" data-v6-stage="${model.pipeline[i]?.key||''}" type="button"><span>${icons[i]}</span><strong>${i+1}. ${label}</strong></button>`).join('')}</div><div class="atlas-pipeline-counts">${counts.map((count,i)=>`<div><b>${count}</b><small>processos</small><span><i class="s${i+1}" style="width:${Math.max(8,Math.round(count/max*100))}%"></i></span></div>`).join('')}</div></section>`;
  }

  function recentHtml(model, flags) {
    const rows=flags.processes?model.recentProcesses.slice(0,5).map(row=>[row.companyName||'Empresa',row.title||'Processo',row.statusLabel||'Em andamento',formatDate(row.updatedDate),row.id]):MOCK_RECENT.map(r=>[...r,'']);
    return `<section class="atlas-card atlas-recent"><header><div class="atlas-heading-icon">${ICONS.clock}</div><div><h2>PROCESSOS RECENTES</h2><p>Últimos processos atualizados no sistema.</p></div><button data-v6-route="processes">Ver todos →</button></header><div class="atlas-list">${rows.map(row=>`<button class="atlas-list-row" ${row[4]?`data-v6-process="${esc(row[4])}"`:''} type="button"><span class="atlas-row-icon">${ICONS.document}</span><span class="atlas-row-main"><strong>${esc(row[0])}</strong><small>${esc(row[1])}</small></span><span class="atlas-badge ${statusKey(row[2])}">${esc(row[2])}</span><time>${esc(row[3])}</time></button>`).join('')}</div></section>`;
  }

  function statusHtml(model, flags) {
    const total=(model.statusDistribution||[]).reduce((s,x)=>s+num(x.count),0);
    const real=(model.statusDistribution||[]).map(x=>[x.label,num(x.count),total?Math.round(num(x.count)/total*100):0]);
    const rows=flags.processes?real:MOCK_STATUS;
    const shownTotal=rows.reduce((s,x)=>s+x[1],0);
    const colors=['#1565D8','#22A861','#F7931E','#19B5E8','#98A5B9'];
    let acc=0; const stops=rows.map((r,i)=>{const start=acc;acc+=r[2];return `${colors[i]} ${start}% ${acc}%`;}).join(',');
    return `<section class="atlas-card atlas-bottom"><header><div class="atlas-heading-icon">${ICONS.chart}</div><div><h2>PROCESSOS POR SITUAÇÃO</h2><p>Distribuição dos processos no momento.</p></div></header><div class="atlas-status-body"><div class="atlas-donut" style="background:conic-gradient(${stops||'#e7edf5 0 100%'})"><div><b>${shownTotal}</b><small>processos</small></div></div><div class="atlas-legend">${rows.map((r,i)=>`<div><i style="background:${colors[i]}"></i><span>${esc(r[0])}</span><b>${r[1]}</b><small>${r[2]}%</small></div>`).join('')}</div></div></section>`;
  }

  function companyTypesHtml(model, flags) {
    const real=(model.companyTypes||[]).slice(0,5).map(x=>[x.label,num(x.count)]);
    const rows=flags.companies?real:MOCK_TYPES;
    const max=Math.max(...rows.map(x=>x[1]),1);
    return `<section class="atlas-card atlas-bottom"><header><div class="atlas-heading-icon">${ICONS.company}</div><div><h2>EMPRESAS POR TIPO</h2><p>Total de empresas gerenciadas por natureza jurídica.</p></div></header><div class="atlas-bars">${rows.map((r,i)=>`<div><b>${r[1]}</b><span><i class="bar${i+1}" style="height:${Math.max(8,Math.round(r[1]/max*100))}%"></i></span><small>${esc(r[0])}</small></div>`).join('')}</div></section>`;
  }

  function deadlinesHtml(model, flags, now=new Date()) {
    const real=(model.deadlines||[]).slice(0,4).map(row=>[row.label,row.companyName||'Empresa',dateDaysLabel(row.finalDate,now),formatDate(row.finalDate),urgency(row.finalDate,now)]);
    const rows=flags.licenses?real:MOCK_DEADLINES;
    return `<section class="atlas-card atlas-bottom atlas-deadlines"><header><div class="atlas-heading-icon">${ICONS.calendar}</div><div><h2>PRÓXIMOS PRAZOS</h2><p>Licenças e obrigações com vencimento próximo.</p></div><button data-v6-route="licenses">Ver todos →</button></header><div class="atlas-deadline-list">${rows.map(r=>`<button data-v6-route="licenses" type="button"><span>${ICONS.shield}</span><span><strong>${esc(r[0])}</strong><small>${esc(r[1])}</small></span><em class="${r[4]}">${esc(r[2])}</em><time>${esc(r[3])}</time></button>`).join('')}</div></section>`;
  }

  function finalHtml(model, flags, now=new Date()) {
    return `<div class="atlas-final-dashboard"><section class="atlas-final-hero"><div class="atlas-hero-main"><img src="/assets/atlas-mark-v6.svg" alt=""><div><span>BEM-VINDO AO</span><h1>ATLAS</h1><h3>LEGALIZAÇÃO E GERENCIAMENTO</h3><i></i><p>Gestão empresarial completa, com abertura, alterações, licenças e regularização, em um só lugar.</p></div></div><div class="atlas-services"><span>ABERTURA</span><span>ALTERAÇÕES</span><span>LICENÇAS</span><span>REGULARIZAÇÃO</span><span>GESTÃO EMPRESARIAL</span></div></section><main class="atlas-final-body"><div class="atlas-kpi-grid">${kpisHtml(model,flags)}</div><div class="atlas-main-grid">${pipelineHtml(model,flags)}${recentHtml(model,flags)}</div><div class="atlas-bottom-grid">${statusHtml(model,flags)}${companyTypesHtml(model,flags)}${deadlinesHtml(model,flags,now)}</div></main></div>`;
  }

  function bind(root) {
    if(!root||root.dataset.atlasFinalBound==='1') return;
    root.dataset.atlasFinalBound='1';
    root.addEventListener('click',event=>{
      const process=event.target.closest?.('[data-v6-process]');
      if(process?.dataset.v6Process){ window.AtlasDashboardV6?.routeTo?.({kind:'process',id:process.dataset.v6Process}); return; }
      const stage=event.target.closest?.('[data-v6-stage]');
      if(stage){ window.atlasV6ProcessStageFilter=stage.dataset.v6Stage; window.AtlasDashboardV6?.routeTo?.({kind:'processes'}); return; }
      const route=event.target.closest?.('[data-v6-route]');
      if(route) window.AtlasDashboardV6?.routeTo?.({kind:route.dataset.v6Route});
    });
  }

  async function renderFinal() {
    if(!window.AtlasDashboardV6?.buildModel) return null;
    if(typeof window.setHead==='function') window.setHead('Dashboard','VISÃO GERAL','');
    const raw=typeof window.loadOperationalData==='function'?await window.loadOperationalData():{};
    const processes=typeof window.decorateProcesses==='function'?window.decorateProcesses(raw):(Array.isArray(raw.processes)?raw.processes:[]);
    const state={...raw,companies:raw.companies||raw.clients||[],processes,now:new Date()};
    if(!Object.prototype.hasOwnProperty.call(state,'pendingCount')) {
      const summary=window.AtlasV4Core?.buildPendingSummary?.(state);
      state.pendingCount=summary?Object.values(summary).reduce((s,v)=>s+(Number(v)||0),0):(state.pending||state.requirements||state.exigencias||[]).length;
    }
    const model=window.AtlasDashboardV6.buildModel(state);
    const flags=sourceFlags(raw);
    const root=document.getElementById('page-content');
    if(root){ root.innerHTML=finalHtml(model,flags,state.now); bind(root.querySelector('.atlas-final-dashboard')); }
    document.getElementById('app-shell')?.setAttribute('data-v6-page','dashboard');
    return model;
  }

  function install() {
    if(!window.AtlasDashboardV6) { setTimeout(install,60); return; }
    window.AtlasReferenceFinal={render:renderFinal,useMockOnlyWhenMissing,MOCK_KPIS,MOCK_RECENT,MOCK_DEADLINES};
    window.dashboard=async()=>{ try{return await renderFinal();}catch(err){console.error('ATLAS Final Dashboard:',err);return window.AtlasDashboardV6.render?.();} };
    if(document.querySelector('#nav .nav-item.active[data-page="dashboard"]') || document.querySelector('#page-content .v6-dashboard')) window.dashboard();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install,{once:true}); else install();
})();