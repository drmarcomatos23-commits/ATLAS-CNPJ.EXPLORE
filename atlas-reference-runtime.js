(() => {
  const LEGACY_LAYER_IDS = ['atlas-v6-fidelity-guard','atlas-v6-mockup-fidelity','atlas-v6-functional-sidebar'];
  const chartInstances = [];
  const SIDEBAR_ORDER = ['dashboard','clientes','processos','licencas','documentos','custos','relatorios','config'];
  const TYPE_FALLBACK = [
    { label:'LTDA', value:68 },
    { label:'S/A', value:24 },
    { label:'MEI', value:18 },
    { label:'EIRELI', value:16 },
    { label:'Outros', value:12 }
  ];

  function removeLegacyFidelityLayers() {
    LEGACY_LAYER_IDS.forEach(id => document.getElementById(id)?.remove());
  }

  function ensureFinalStylesheet() {
    if (document.getElementById('atlas-reference-final-css')) return;
    const link=document.createElement('link');
    link.id='atlas-reference-final-css';
    link.rel='stylesheet';
    link.href='/atlas-reference-final.css?v=1.0';
    document.head.appendChild(link);
  }

  function ensureMobileStylesheet() {
    if (document.getElementById('atlas-reference-mobile-css')) return;
    const link=document.createElement('link');
    link.id='atlas-reference-mobile-css';
    link.rel='stylesheet';
    link.href='/atlas-reference-mobile.css?v=1.0';
    document.head.appendChild(link);
  }

  function ensureMobileFixStylesheet() {
    if (document.getElementById('atlas-reference-mobile-fix-css')) return;
    const link=document.createElement('link');
    link.id='atlas-reference-mobile-fix-css';
    link.rel='stylesheet';
    link.href='/atlas-reference-mobile-fix.css?v=1.0';
    document.head.appendChild(link);
  }

  function ensureReadabilityStylesheet() {
    if (document.getElementById('atlas-readability-fix-css')) return;
    const link=document.createElement('link');
    link.id='atlas-readability-fix-css';
    link.rel='stylesheet';
    link.href='/atlas-readability-fix.css?v=1.0';
    document.head.appendChild(link);
  }

  function ensurePolishStylesheet() {
    if (document.getElementById('atlas-dashboard-polish-css')) return;
    const link=document.createElement('link');
    link.id='atlas-dashboard-polish-css';
    link.rel='stylesheet';
    link.href='/atlas-dashboard-polish.css?v=1.0';
    document.head.appendChild(link);
  }

  function polishSidebarOrder() {
    SIDEBAR_ORDER.forEach((page,index) => {
      const item=document.querySelector(`#nav .nav-item[data-page="${page}"]`);
      if(item) item.style.setProperty('--atlas-nav-order', String(index));
    });
  }

  function syncMobileDashboardChrome() {
    const active=!!document.querySelector('#page-content .atlas-final-dashboard');
    document.body.classList.toggle('atlas-final-dashboard-active',active);
    const shell=document.getElementById('app-shell');
    if(active) shell?.setAttribute('data-v6-page','dashboard');
    const pageHead=shell?.querySelector('.main > .page-head');
    if(pageHead){
      if(active){
        pageHead.style.setProperty('display','none','important');
        pageHead.setAttribute('aria-hidden','true');
      } else {
        pageHead.style.removeProperty('display');
        pageHead.removeAttribute('aria-hidden');
      }
    }
    const fab=document.getElementById('new-process-btn');
    if(fab && active) fab.classList.add('mobile-fab-suppressed');
  }

  function injectRuntimeStyles() {
    if (document.getElementById('atlas-reference-runtime-style')) return;
    const style=document.createElement('style');
    style.id='atlas-reference-runtime-style';
    style.textContent=`
      .atlas-chart-canvas{position:relative;min-width:0}
      .atlas-chart-canvas.donut{width:82px;height:82px;margin:auto}
      .atlas-chart-canvas.donut canvas{width:82px!important;height:82px!important}
      .atlas-chart-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none}
      .atlas-chart-center b{font-size:12px;color:#0F1D3A}.atlas-chart-center small{font-size:5.5px;color:#6B7A99}
      .atlas-chart-canvas.bars{height:98px;width:100%}
      .atlas-chart-canvas.bars canvas{width:100%!important;height:98px!important}
      .atlas-status-body:has(.atlas-chart-canvas){grid-template-columns:96px minmax(0,1fr)}
      .atlas-bars:has(.atlas-chart-canvas){display:block;height:104px;padding:8px 14px 4px}
    `;
    document.head.appendChild(style);
  }

  function destroyCharts() {
    while (chartInstances.length) {
      try { chartInstances.pop()?.destroy?.(); } catch (_) {}
    }
  }

  function parseStatusRows(root) {
    return [...root.querySelectorAll('.atlas-legend > div')].map(row => ({
      label: row.querySelector('span')?.textContent?.trim() || '',
      value: Number(row.querySelector('b')?.textContent?.replace(/\D/g,'') || 0)
    })).filter(x => x.label);
  }

  function parseTypeRows(root) {
    return [...root.querySelectorAll('.atlas-bars > div')].map(row => ({
      label: row.querySelector('small')?.textContent?.trim() || '',
      value: Number(row.querySelector('b')?.textContent?.replace(/\D/g,'') || 0)
    })).filter(x => x.label);
  }

  function normalizeTypeRows(rows=[]) {
    const clean=rows.filter(row => row?.label && Number.isFinite(Number(row.value)) && Number(row.value) >= 0);
    const onlyOutros=clean.length===1 && /outros/i.test(clean[0].label) && Number(clean[0].value)>0;
    return (!clean.length || onlyOutros) ? TYPE_FALLBACK.map(row=>({...row})) : clean;
  }

  function upgradeCharts() {
    if (!window.Chart) return;
    const dashboard = document.querySelector('.atlas-final-dashboard');
    if (!dashboard || dashboard.dataset.chartjsUpgraded === '1') return;
    const statusBody = dashboard.querySelector('.atlas-status-body');
    const barsBody = dashboard.querySelector('.atlas-bars');
    if (!statusBody || !barsBody) return;

    const statusRows = parseStatusRows(dashboard);
    const parsedTypeRows = parseTypeRows(dashboard);
    const onlyOutros = parsedTypeRows.length===1 && /outros/i.test(parsedTypeRows[0].label) && parsedTypeRows[0].value>0;
    const typeRows = normalizeTypeRows(parsedTypeRows);
    if (!statusRows.length || !typeRows.length) return;

    const typeCard=barsBody.closest('.atlas-card');
    if(onlyOutros || !parsedTypeRows.length){
      typeCard?.setAttribute('data-atlas-fallback','company-types');
      const subtitle=typeCard?.querySelector('header p');
      if(subtitle) subtitle.textContent='Distribuição ilustrativa — natureza jurídica não informada nos cadastros.';
    } else {
      typeCard?.removeAttribute('data-atlas-fallback');
    }

    destroyCharts();
    const total = statusRows.reduce((s,x)=>s+x.value,0);
    statusBody.innerHTML = `<div class="atlas-chart-canvas donut"><canvas id="atlas-status-chart"></canvas><div class="atlas-chart-center"><b>${total}</b><small>processos</small></div></div><div class="atlas-legend">${statusRows.map((r,i)=>`<div><i style="background:${['#1565D8','#22A861','#F7931E','#19B5E8','#98A5B9'][i]}"></i><span>${r.label}</span><b>${r.value}</b><small>${total?Math.round(r.value/total*100):0}%</small></div>`).join('')}</div>`;
    barsBody.innerHTML = `<div class="atlas-chart-canvas bars"><canvas id="atlas-type-chart"></canvas></div>`;

    chartInstances.push(new Chart(document.getElementById('atlas-status-chart'), {
      type:'doughnut',
      data:{labels:statusRows.map(x=>x.label),datasets:[{data:statusRows.map(x=>x.value),backgroundColor:['#1565D8','#22A861','#F7931E','#19B5E8','#98A5B9'],borderWidth:0,hoverOffset:2}]},
      options:{responsive:true,maintainAspectRatio:false,cutout:'67%',plugins:{legend:{display:false},tooltip:{enabled:true}}}
    }));

    chartInstances.push(new Chart(document.getElementById('atlas-type-chart'), {
      type:'bar',
      data:{labels:typeRows.map(x=>x.label),datasets:[{data:typeRows.map(x=>x.value),backgroundColor:['#1565D8','#3CA7E5','#19B5C4','#F7931E','#98A5B9'],borderRadius:4,borderSkipped:false,maxBarThickness:42}]},
      options:{responsive:true,maintainAspectRatio:false,layout:{padding:{top:8,left:6,right:6,bottom:0}},plugins:{legend:{display:false},tooltip:{enabled:true}},scales:{x:{grid:{display:false},border:{display:false},ticks:{font:{size:10,weight:'500'},color:'#60728D'}},y:{display:false,beginAtZero:true,grid:{display:false},border:{display:false}}}}
    }));
    dashboard.dataset.chartjsUpgraded='1';
  }

  function run() {
    removeLegacyFidelityLayers();
    ensureFinalStylesheet();
    ensureMobileStylesheet();
    ensureMobileFixStylesheet();
    ensureReadabilityStylesheet();
    ensurePolishStylesheet();
    injectRuntimeStyles();
    polishSidebarOrder();
    syncMobileDashboardChrome();
    upgradeCharts();
    const root=document.getElementById('page-content');
    if (root && window.MutationObserver) {
      new MutationObserver(() => {
        removeLegacyFidelityLayers();
        ensureFinalStylesheet();
        ensureMobileStylesheet();
        ensureMobileFixStylesheet();
        ensureReadabilityStylesheet();
        ensurePolishStylesheet();
        polishSidebarOrder();
        syncMobileDashboardChrome();
        queueMicrotask(upgradeCharts);
      }).observe(root,{childList:true,subtree:false});
    }
    window.addEventListener('resize',()=>{polishSidebarOrder();syncMobileDashboardChrome();},{passive:true});
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',run,{once:true}); else run();
})();