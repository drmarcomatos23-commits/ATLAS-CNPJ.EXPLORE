(() => {
  const LEGACY_LAYER_IDS = ['atlas-v6-fidelity-guard','atlas-v6-mockup-fidelity','atlas-v6-functional-sidebar'];
  const chartInstances = [];

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

  function upgradeCharts() {
    if (!window.Chart) return;
    const dashboard = document.querySelector('.atlas-final-dashboard');
    if (!dashboard || dashboard.dataset.chartjsUpgraded === '1') return;
    const statusBody = dashboard.querySelector('.atlas-status-body');
    const barsBody = dashboard.querySelector('.atlas-bars');
    if (!statusBody || !barsBody) return;

    const statusRows = parseStatusRows(dashboard);
    const typeRows = parseTypeRows(dashboard);
    if (!statusRows.length || !typeRows.length) return;

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
      data:{labels:typeRows.map(x=>x.label),datasets:[{data:typeRows.map(x=>x.value),backgroundColor:['#1565D8','#3CA7E5','#19B5C4','#F7931E','#98A5B9'],borderRadius:3,borderSkipped:false,maxBarThickness:34}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{enabled:true}},scales:{x:{grid:{display:false},border:{display:false},ticks:{font:{size:10},color:'#60728D'}},y:{display:false,beginAtZero:true,grid:{display:false},border:{display:false}}}}
    }));
    dashboard.dataset.chartjsUpgraded='1';
  }

  function run() {
    removeLegacyFidelityLayers();
    ensureFinalStylesheet();
    ensureMobileStylesheet();
    ensureMobileFixStylesheet();
    ensureReadabilityStylesheet();
    injectRuntimeStyles();
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
        syncMobileDashboardChrome();
        queueMicrotask(upgradeCharts);
      }).observe(root,{childList:true,subtree:false});
    }
    window.addEventListener('resize',syncMobileDashboardChrome,{passive:true});
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',run,{once:true}); else run();
})();