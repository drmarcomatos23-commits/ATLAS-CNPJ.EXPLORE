(() => {
  const LEGACY_LAYER_IDS = ['atlas-v6-fidelity-guard','atlas-v6-mockup-fidelity','atlas-v6-functional-sidebar'];
  const chartInstances = [];

  function removeLegacyFidelityLayers() {
    LEGACY_LAYER_IDS.forEach(id => document.getElementById(id)?.remove());
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
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{enabled:true}},scales:{x:{grid:{display:false},border:{display:false},ticks:{font:{size:8},color:'#60728D'}},y:{display:false,beginAtZero:true,grid:{display:false},border:{display:false}}}}
    }));
    dashboard.dataset.chartjsUpgraded='1';
  }

  function run() {
    removeLegacyFidelityLayers();
    upgradeCharts();
    const root=document.getElementById('page-content');
    if (root && window.MutationObserver) {
      new MutationObserver(() => { removeLegacyFidelityLayers(); queueMicrotask(upgradeCharts); }).observe(root,{childList:true,subtree:false});
    }
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',run,{once:true}); else run();
})();